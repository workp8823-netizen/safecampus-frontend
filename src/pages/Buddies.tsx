import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  Search, 
  ShieldCheck, 
  MapPin, 
  Clock, 
  X, 
  Check, 
  Navigation,
  Loader2,
  Map as MapIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { getCookie } from "@/lib/cookies";
import { Link, useNavigate } from "react-router-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import socket from "@/lib/socket";

interface Buddy {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'pending' | 'sharing';
  lastSeen?: string;
}

const mockBuddies: Buddy[] = [
  { id: "1", name: "Kofi Owusu", email: "kofi@legon.edu", status: 'sharing', lastSeen: "2 mins ago" },
  { id: "2", name: "Ama Serwaa", email: "ama@legon.edu", status: 'active' },
  { id: "3", name: "John Doe", email: "john@legon.edu", status: 'pending' },
];

export default function BuddiesPage() {
  const navigate = useNavigate();
  const [buddies, setBuddies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [buddyLocations, setBuddyLocations] = useState<Record<string, { lat: number, lng: number }>>({});
  
  useBodyScrollLock(isAdding);
  
  const user = getCookie('user');
  const userId = user?.id;

  const fetchBuddies = async () => {
    try {
      const data = await apiRequest('/buddies');
      setBuddies(data);

      // Seed last known locations from DB so we never show "Locating..."
      const seedLocations: Record<string, { lat: number; lng: number }> = {};
      data.forEach((b: any) => {
        const isRequester = b.user_id === userId;
        const otherInfo = isRequester ? b.buddy_info : b.requester_info;
        const otherUserId = isRequester ? b.buddy_id : b.user_id;
        const isBuddySharing = isRequester ? b.buddy_is_sharing : b.user_is_sharing;
        if (isBuddySharing && otherInfo?.last_lat != null && otherInfo?.last_lng != null) {
          seedLocations[otherUserId] = { lat: otherInfo.last_lat, lng: otherInfo.last_lng };
        }
      });
      if (Object.keys(seedLocations).length > 0) {
        setBuddyLocations(prev => ({ ...seedLocations, ...prev }));
      }

      // For any buddy sharing but with no persisted location, request it live from server
      data.forEach((b: any) => {
        const isRequester = b.user_id === userId;
        const otherInfo = isRequester ? b.buddy_info : b.requester_info;
        const otherUserId = isRequester ? b.buddy_id : b.user_id;
        const isBuddySharing = isRequester ? b.buddy_is_sharing : b.user_is_sharing;
        if (isBuddySharing && (otherInfo?.last_lat == null || otherInfo?.last_lng == null)) {
          socket.emit('request-location', { targetUserId: otherUserId });
        }
      });
    } catch (error) {
      console.error('Failed to fetch buddies:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuddies();
  }, []);

  const handleAddBuddy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      await apiRequest('/buddies', {
        method: 'POST',
        data: { email: searchQuery }
      });
      toast.success("Buddy request sent to " + searchQuery);
      setSearchQuery("");
      setIsAdding(false);
      fetchBuddies();
    } catch (error: any) {
      toast.error(error.message || "Failed to add buddy");
    }
  };

  const handleToggleSharing = async (buddyRelId: string) => {
    const buddy = buddies.find(b => b.id === buddyRelId);
    if (!buddy) return;
    
    const isRequester = buddy.user_id === userId;
    const amISharing = isRequester ? buddy.user_is_sharing : buddy.buddy_is_sharing;
    const newIsSharing = !amISharing;
    
    try {
      if (newIsSharing) {
        // Pre-capture location BEFORE updating DB to ensure recipient sees it immediately
        if (!navigator.geolocation) {
          toast.error("Geolocation is not supported by your browser.");
          return;
        }
        
        toast.info("Acquiring precise location...", { duration: 2500 });
        
        let capturedPosition: any = null;
        try {
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                capturedPosition = position;
                resolve();
              },
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 8000 }
            );
          });
        } catch (err) {
          toast.error("Failed to acquire location. Please enable GPS permissions.");
          return; // Abort sharing if we can't get location
        }
        
        // 2. Update DB and notify
        await apiRequest(`/buddies/${buddyRelId}`, {
          method: 'PATCH',
          data: { isSharing: newIsSharing }
        });

        // 3. Emit location NOW that the DB is active, and cache it locally for instant display
        if (capturedPosition) {
          socket.emit('update-location', {
            userId: user?.id,
            lat: capturedPosition.coords.latitude,
            lng: capturedPosition.coords.longitude,
            institutionId: user?.institution?.id,
            userName: `${user?.first_name} ${user?.last_name}`
          });
          // Cache own coords in state — the sharer also sees their own broadcast via the socket listener
          // but we pre-seed it here to guarantee immediate display
          setBuddyLocations(prev => ({
            ...prev,
            [user?.id]: { lat: capturedPosition.coords.latitude, lng: capturedPosition.coords.longitude }
          }));
        }
      } else {
        await apiRequest(`/buddies/${buddyRelId}`, {
          method: 'PATCH',
          data: { isSharing: newIsSharing }
        });
      }
      
      if (newIsSharing) {
        toast.success("Now sharing live location");
      } else {
        toast.info("Stopped sharing location");
      }
      fetchBuddies();
    } catch (error: any) {
      toast.error(error.message || "Failed to update sharing status");
    }
  };

  // Live location listener
  useEffect(() => {
    const handleLocationUpdate = (data: any) => {
      if (data.userId !== userId) {
        setBuddyLocations(prev => ({ ...prev, [data.userId]: { lat: data.lat, lng: data.lng } }));
      }
    };
    socket.on('live-location-update', handleLocationUpdate);

    // On socket reconnect, re-request locations for all active sharers
    const handleReconnect = () => {
      setBuddies(prev => {
        prev.forEach((b: any) => {
          const isRequester = b.user_id === userId;
          const otherUserId = isRequester ? b.buddy_id : b.user_id;
          const isBuddySharing = isRequester ? b.buddy_is_sharing : b.user_is_sharing;
          if (isBuddySharing) {
            socket.emit('request-location', { targetUserId: otherUserId });
          }
        });
        return prev;
      });
    };
    socket.on('connect', handleReconnect);

    return () => {
      socket.off('live-location-update', handleLocationUpdate);
      socket.off('connect', handleReconnect);
    };
  }, [userId]);

  // Live location watcher: emit position continuously while sharing
  useEffect(() => {
    let watchId: number | null = null;
    
    const isAnySharing = buddies.some(b => {
      const isRequester = b.user_id === userId;
      return isRequester ? b.user_is_sharing : b.buddy_is_sharing;
    });
    
    if (isAnySharing && navigator.geolocation) {
      const emitLocation = (position: GeolocationPosition) => {
        socket.emit('update-location', {
          userId: user?.id,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          institutionId: user?.institution?.id,
          userName: `${user?.first_name} ${user?.last_name}`
        });
      };

      // Immediately broadcast current position on load/mount
      navigator.geolocation.getCurrentPosition(
        emitLocation,
        (e) => console.warn('[buddies]: Initial position fetch failed:', e.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );

      // Then keep watching for movement
      watchId = navigator.geolocation.watchPosition(
        emitLocation,
        (error) => console.error("Location tracking error:", error),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [buddies]);

  const handleAcceptBuddy = async (id: string) => {
    try {
      await apiRequest(`/buddies/${id}`, {
        method: 'PATCH',
        data: { status: 'ACCEPTED' }
      });
      toast.success("Buddy request accepted!");
      fetchBuddies();
    } catch (error: any) {
      toast.error(error.message || "Failed to accept buddy");
    }
  };

  const handleRemoveBuddy = async (id: string) => {
    try {
      await apiRequest(`/buddies/${id}`, { method: 'DELETE' });
      toast.success("Buddy removed");
      fetchBuddies();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove buddy");
    }
  };

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Safety Network</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Safety Buddies</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            Connect with trusted friends to share your location while walking at night.
          </p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
        >
          <UserPlus className="h-6 w-6" />
        </button>
      </div>

      {/* Add Buddy Overlay */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl z-10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display">Add Safety Buddy</h2>
                <button onClick={() => setIsAdding(false)} className="rounded-full bg-secondary/50 p-1.5 hover:bg-secondary">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleAddBuddy} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or student email..."
                    className="w-full h-12 rounded-2xl border border-border/60 bg-surface pl-11 pr-4 text-sm focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5"
                    autoFocus
                  />
                </div>
                <Button type="submit" variant="hero" className="w-full h-12 rounded-xl text-sm font-bold">
                  Send Buddy Request
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Active Sharing Banner */}
      {buddies.some(b => {
        const isRequester = b.user_id === userId;
        return isRequester ? b.user_is_sharing : b.buddy_is_sharing;
      }) && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 rounded-3xl bg-primary/10 border border-primary/30 p-5 flex items-center gap-4"
        >
          <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center animate-pulse">
            <Navigation className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-primary">Live Sharing Active</div>
            <div className="text-xs text-primary/70 font-medium">Your trusted friends can now see your location.</div>
          </div>
          <Button size="sm" variant="outline" className="rounded-xl border-primary/30 text-primary text-xs" onClick={async () => {
            const sharingBuddies = buddies.filter(b => {
              const isRequester = b.user_id === userId;
              return isRequester ? b.user_is_sharing : b.buddy_is_sharing;
            });
            for (const b of sharingBuddies) {
              await apiRequest(`/buddies/${b.id}`, { method: 'PATCH', data: { isSharing: false } }).catch(() => {});
            }
            fetchBuddies();
          }}>
            Stop All
          </Button>
        </motion.div>
      )}

      {/* Buddies List */}
      <div className="space-y-4">
        {loading ? (
           <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Syncing network...</p>
          </div>
        ) : buddies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-3xl border border-dashed border-border/60 bg-surface/50">
            <Users className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="mt-4 font-bold">No Safety Buddies</h3>
            <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">Add trusted friends to your safety network.</p>
          </div>
        ) : (
          buddies.map((buddy, i) => {
            const isRequester = buddy.user_id === userId;
            const info = isRequester ? buddy.buddy_info : buddy.requester_info;
            const otherUserId = isRequester ? buddy.buddy_id : buddy.user_id;
            const name = info ? `${info.first_name} ${info.last_name}` : "Unknown Buddy";
            
            const amISharing = isRequester ? buddy.user_is_sharing : buddy.buddy_is_sharing;
            const isBuddySharing = isRequester ? buddy.buddy_is_sharing : buddy.user_is_sharing;
            
            const location = buddyLocations[otherUserId];
            
            return (
              <motion.div
                key={buddy.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`group relative overflow-hidden rounded-3xl border transition-all p-5 shadow-sm hover:shadow-xl ${
                  isBuddySharing ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-surface'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-colors ${
                      isBuddySharing ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                    }`}>
                      <Users className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">
                        {name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                        {isBuddySharing ? (
                          <span className="flex items-center gap-1 text-primary">
                            <span className="relative flex h-2 w-2">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                            </span>
                            Sharing Location with you
                          </span>
                        ) : buddy.status === 'PENDING' ? (
                          <span className="text-amber-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Pending Approval
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" /> Trusted Friend
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {buddy.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleAcceptBuddy(buddy.id)}
                          className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleRemoveBuddy(buddy.id)}
                          className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button 
                          variant={amISharing ? 'hero' : 'outline'} 
                          size="sm" 
                          className="rounded-xl h-9 text-xs font-bold"
                          onClick={() => handleToggleSharing(buddy.id)}
                        >
                          {amISharing ? 'Stop Sharing' : 'Share Location'}
                        </Button>
                        <button 
                          onClick={() => handleRemoveBuddy(buddy.id)}
                          className="h-9 w-9 rounded-xl text-muted-foreground flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-all"
                          title="Remove Buddy"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isBuddySharing && (
                  <div className="mt-4 pt-4 border-t border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-primary/60">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-primary" />
                        {location ? (
                          <button 
                            onClick={() => navigate(`/map?buddy=${otherUserId}`)}
                            className="text-primary hover:underline hover:text-primary/80 transition-colors flex items-center gap-1"
                          >
                            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                            <MapIcon className="h-2.5 w-2.5 ml-1" />
                          </button>
                        ) : (
                          <span>Locating...</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Started at {new Date(buddy.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Info Card */}
      <div className="mt-8 rounded-3xl border border-border/40 bg-surface/50 p-6">
        <h4 className="text-sm font-bold mb-2">How it works</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Safety Buddies can see your live location only when you explicitly start a sharing session. All sessions are encrypted and automatically end after 2 hours or when you manually stop.
        </p>
      </div>
    </div>
  );
}
