import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, MapPin, Activity, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { getCookie } from "@/lib/cookies";
import { useSearchParams } from "react-router-dom";
import { CampusViewer } from "@/components/CampusViewer";
import type { ViewerLandmark, ViewerIncident } from "@/components/CampusViewer";
import { toast } from "sonner";
import socket from "@/lib/socket";

export default function MapPage() {
  const [user, setUser] = useState(() => getCookie('user'));
  const role = user?.role || "STUDENT";
  const isDemo = window.location.pathname.startsWith('/demo');
  const [searchParams] = useSearchParams();

  const [landmarks, setLandmarks] = useState<ViewerLandmark[]>([]);
  const [incidents, setIncidents] = useState<ViewerIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [activeBuddies, setActiveBuddies] = useState<Record<string, any>>({});
  const buddyListRef = useRef<Set<string>>(new Set());

  const [instData, setInstData] = useState<any>(user?.institution);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Fetch latest institution context (boundary/center)
      let currentInst = user?.institution;
      if (!isDemo) {
        try {
          const profile = await apiRequest('/users/profile');
          currentInst = profile.Institution || profile.institution;
          setInstData(currentInst);
        } catch (e) {
          console.error("Failed to sync institution context", e);
        }
      }

      const institutionId = isDemo ? 'demo-ug-id' : currentInst?.id;
      if (!institutionId) {
        setLoading(false);
        return;
      }

      // 2. Fetch fresh hotspots (landmarks)
      const hotspotsData = await apiRequest(`/institutions/${institutionId}/hotspots`);
      const validHotspots = Array.isArray(hotspotsData) ? hotspotsData : [];
      
      const formattedLandmarks = validHotspots.map((h: any) => ({
        label: h.label,
        zone: h.zone,
        type: Array.isArray(h.types) ? h.types[0] : (h.types || 'General'),
        lat: h.lat,
        lng: h.lng
      }));
      setLandmarks(formattedLandmarks);

      // 3. Fetch active incidents
      const incidentsData = await apiRequest(`/incidents?status=all&limit=50`);
      setIncidents(incidentsData.incidents || []);

    } catch (error) {
      console.error('Failed to fetch map data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isDemo]);

  const fetchBuddies = useCallback(async () => {
    try {
      const data = await apiRequest('/buddies');
      const ids = new Set<string>();
      const initialBuddies: Record<string, any> = {};

      data.forEach((b: any) => {
        const isRequester = b.user_id === user?.id;
        const otherInfo = isRequester ? b.buddy_info : b.requester_info;
        const otherUserId = isRequester ? b.buddy_id : b.user_id;
        const isBuddySharing = isRequester ? b.buddy_is_sharing : b.user_is_sharing;
        
        ids.add(otherUserId);

        if (isBuddySharing) {
          if (otherInfo?.last_lat != null && otherInfo?.last_lng != null) {
            initialBuddies[otherUserId] = {
              id: otherUserId,
              name: `${otherInfo.first_name} ${otherInfo.last_name}`,
              lat: otherInfo.last_lat,
              lng: otherInfo.last_lng,
              timestamp: Date.now()
            };
          } else {
            // Force a live pull if DB is empty
            socket.emit('request-location', { targetUserId: otherUserId });
          }
        }
      });

      buddyListRef.current = ids;
      if (Object.keys(initialBuddies).length > 0) {
        setActiveBuddies(prev => ({ ...initialBuddies, ...prev }));
      }
    } catch (e) {
      console.error("Failed to fetch buddy list for map filtering");
    }
  }, [user?.id, role]);

  useEffect(() => {
    const handleUserUpdated = () => setUser(getCookie('user'));
    window.addEventListener('user-updated', handleUserUpdated);
    
    fetchBuddies();
    
    // Listen for live location updates
    const handleLocationUpdate = (data: any) => {
      // Security sees everyone, Students only see buddies
      const isBuddy = buddyListRef.current.has(data.userId);
      const shouldSee = role !== 'STUDENT' || isBuddy;

      if (data.userId !== user?.id && shouldSee) {
        setActiveBuddies(prev => ({
          ...prev,
          [data.userId]: {
            id: data.userId,
            name: data.userName,
            lat: data.lat,
            lng: data.lng,
            timestamp: Date.now()
          }
        }));
      }
    };

    socket.on('live-location-update', handleLocationUpdate);
    
    // On socket reconnect, re-request locations for all active sharers
    const handleReconnect = () => {
      // We need to re-fetch buddies to know who is sharing
      fetchData();
      fetchBuddies();
    };

    socket.on('connect', handleReconnect);
    socket.on('institution-updated', () => {
      toast.info("Campus data updated", { description: "Refreshing map with latest institutional changes..." });
      fetchData();
    });

    return () => {
      window.removeEventListener('user-updated', handleUserUpdated);
      socket.off('live-location-update', handleLocationUpdate);
      socket.off('connect', handleReconnect);
      socket.off('institution-updated');
    };
  }, [user?.id, role, fetchData, fetchBuddies]);

  useEffect(() => {
    console.log("[map]: Active Buddies State Updated:", JSON.stringify(activeBuddies, null, 2));
  }, [activeBuddies]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-select incident from URL param (e.g. navigated from incident detail)
  const buddyParam = searchParams.get('buddy');
  
  useEffect(() => {
    const incidentParam = searchParams.get('incident');
    if (incidentParam) {
      setSelectedIncidentId(incidentParam);
    }
  }, [searchParams, incidents]);

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);

  const institutionName = isDemo ? 'University of Ghana, Legon' : (user?.institution?.name || 'Campus');
  const boundary = isDemo 
    ? [[5.6620,-0.1980],[5.6620,-0.1760],[5.6580,-0.1720],[5.6420,-0.1730],[5.6380,-0.1820],[5.6400,-0.1960],[5.6500,-0.1995]] 
    : instData?.boundary;
  const centerLat = isDemo ? 5.6507 : (instData?.center_lat || 5.6507);
  const centerLng = isDemo ? -0.1870 : (instData?.center_lng || -0.1870);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background/50 flex flex-col">
      <div className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
              Geospatial intelligence
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight">
              {institutionName} Map
            </h1>
            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> Live safety feed and campus perimeters
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Active Incidents</span>
              <span className="text-2xl font-bold text-primary">{incidents.filter(i => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length}</span>
            </div>
          </div>
        </motion.div>

        <div className={`flex-1 grid gap-6 ${role === 'STUDENT' ? 'grid-cols-1' : 'lg:grid-cols-[1fr_320px]'}`}>
          <div className="relative min-h-[400px] sm:min-h-[500px] rounded-2xl overflow-hidden border border-border/60 shadow-xl bg-surface/50" style={{ height: '60svh' }}>
            {!loading ? (
              <CampusViewer
                boundary={boundary || []}
                landmarks={landmarks}
                incidents={incidents}
                center={{ lat: centerLat, lng: centerLng }}
                institutionName={institutionName}
                selectedIncidentId={selectedIncidentId}
                onSelectIncident={setSelectedIncidentId}
                selectedBuddyId={buddyParam}
                buddies={Object.values(activeBuddies)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Activity className="h-8 w-8 animate-pulse text-primary/40" />
              </div>
            )}
          </div>

          {/* Sidebar for admin/security */}
          {role !== 'STUDENT' && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-4 overflow-y-auto"
            >
              <AnimatePresence mode="wait">
                {selectedIncident ? (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="rounded-2xl border border-primary/30 bg-gradient-to-br from-surface to-primary/5 p-5 shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {selectedIncident.priority} Priority Incident
                        </div>
                        <h3 className="mt-1 font-display text-xl font-bold leading-tight">
                          {selectedIncident.title}
                        </h3>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0 text-primary" />
                        <span className="line-clamp-2">{selectedIncident.location_name || 'Location unspecified'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
                        <span className="capitalize">{selectedIncident.type.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                    {selectedIncident.description && (
                      <p className="mt-4 text-sm text-foreground/80 leading-relaxed border-t border-border/50 pt-4">
                        {selectedIncident.description}
                      </p>
                    )}
                    <div className="mt-6 flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedIncidentId(null)}>
                        Deselect
                      </Button>
                      {selectedIncident.status === 'PENDING' && (
                        <Button variant="hero" size="sm" className="flex-1" onClick={() => toast.success("Units notified")}>
                          Dispatch
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="list"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-3"
                  >
                    <div className="rounded-2xl border border-border/60 bg-surface p-5 shadow-sm">
                      <h3 className="font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" /> Live Feed
                      </h3>
                      <div className="mt-4 space-y-2">
                        {incidents.filter(i => i.location_lat && i.location_lng).length === 0 ? (
                          <div className="text-center py-6 text-sm text-muted-foreground">
                            No mapped incidents active.
                          </div>
                        ) : (
                          incidents.filter(i => i.location_lat && i.location_lng).slice(0, 5).map(inc => (
                            <button
                              key={inc.id}
                              onClick={() => setSelectedIncidentId(inc.id)}
                              className="w-full flex flex-col text-left p-3 rounded-xl border border-border/40 bg-background/50 hover:bg-secondary/50 hover:border-primary/30 transition-all group"
                            >
                              <div className="flex items-center justify-between w-full">
                                <span className="font-medium text-sm truncate pr-2 group-hover:text-primary transition-colors">{inc.title}</span>
                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                                  {inc.priority}
                               </span>
                              </div>
                              <span className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {inc.location_name || 'Map Pin'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.aside>
          )}
        </div>
      </div>
    </div>
  );
}
