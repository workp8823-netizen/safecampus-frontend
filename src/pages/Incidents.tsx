import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Search,
  Filter,
  Download,
  MapPin,
  Clock,
  CheckCircle2,
  Eye,
  ArrowUpDown,
  Loader2,
  Calendar,
  PlusCircle,
  X,
  Navigation,
  Building2,
  Play
} from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { getCookie } from "@/lib/cookies";
import { LocationPickerMap } from "@/components/LocationPickerMap";
import { MediaViewerModal } from "@/components/MediaViewerModal";

const formatDate = (dateStr: string) => {
  const d = dateStr ? new Date(dateStr) : new Date(NaN);
  return isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Compute bounding box [minLng, minLat, maxLng, maxLat] from a boundary polygon
function boundaryToViewbox(boundary: [number, number][]): string | null {
  if (!boundary || boundary.length < 3) return null;
  const lats = boundary.map(([lat]) => lat);
  const lngs = boundary.map(([, lng]) => lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Add ~500m padding (~0.005 degrees)
  const pad = 0.005;
  return `${(minLng - pad).toFixed(5)},${(maxLat + pad).toFixed(5)},${(maxLng + pad).toFixed(5)},${(minLat - pad).toFixed(5)}`;
}

interface LocationSuggestion {
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  source: "landmark" | "geocode";
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-destructive/10 text-destructive border-destructive/20",
  INVESTIGATING: "bg-accent/10 text-accent border-accent/20",
  RESOLVED: "bg-primary/10 text-primary border-primary/20",
};

const priorityStyles: Record<string, string> = {
  HIGH: "bg-destructive text-white",
  MEDIUM: "bg-warning text-warning-foreground",
  LOW: "bg-muted text-muted-foreground",
};

const incidentTypes = ["harassment", "theft", "suspicious", "medical", "vandalism", "other"];

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [officers, setOfficers] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUpdateMapModal, setShowUpdateMapModal] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<{ url: string, isVideo: boolean } | null>(null);
  const [creating, setCreating] = useState(false);

  useBodyScrollLock(!!selectedIncident || showUpdateMapModal || showAddModal || !!viewingMedia);
  const [remarksInput, setRemarksInput] = useState("");
  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    type: "suspicious",
    priority: "MEDIUM",
    locationName: "",
    lat: 5.6507,
    lng: -0.1870
  });

  // Smart location state
  const [landmarks, setLandmarks] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user = getCookie('user') || {};
  const institution = user.institution || {};
  const campusBoundary = institution.boundary ? (typeof institution.boundary === 'string' ? JSON.parse(institution.boundary) : institution.boundary) : null;
  const campusCenterLat = institution.center_lat || 5.6507;
  const campusCenterLng = institution.center_lng || -0.1870;

  useEffect(() => {
    fetchIncidents();
  }, [page, statusFilter, priorityFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchIncidents(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchIncidents();
    fetchOfficers();
    fetchLandmarks();

    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchLandmarks = async () => {
    const institutionId = user.institution_id;
    if (!institutionId) return;
    try {
      const data = await apiRequest(`/institutions/${institutionId}/hotspots`);
      setLandmarks(data);
    } catch (error) { }
  };

  const fetchOfficers = async () => {
    try {
      const data = await apiRequest('/users/officers');
      setOfficers(data);
    } catch (error) {
      console.error('Failed to fetch officers:', error);
    }
  };

  const fetchIncidents = async (p = page) => {
    setLoading(true);
    try {
      const data = await apiRequest(`/incidents?status=${statusFilter.toLowerCase()}&priority=${priorityFilter}&page=${p}&search=${search}`);
      setIncidents(data.incidents || []);
      setTotalPages(data.pages || 1);
      setTotalItems(data.total || 0);
    } catch (error: any) {
      console.error('Failed to fetch incidents:', error);
      toast.error(error.message || 'Could not load incident logs');
    } finally {
      setLoading(false);
    }
  };

  const filtered = incidents;

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setUpdating(true);
    try {
      await apiRequest(`/incidents/${id}/status`, {
        method: 'PATCH',
        data: { status: newStatus }
      });
      toast.success(`Incident marked as ${newStatus}`);
      setSelectedIncident((prev: any) => ({ ...prev, status: newStatus }));
      fetchIncidents();
    } catch (error) {
      toast.error('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssign = async (id: string, officerId: string) => {
    setUpdating(true);
    try {
      await apiRequest(`/incidents/${id}/assign`, {
        method: 'PATCH',
        data: { assignee_id: officerId }
      });
      const officer = officers.find(o => o.id === officerId);
      toast.success(`Assigned to ${officer?.first_name || 'Officer'}`);
      setSelectedIncident((prev: any) => ({
        ...prev,
        assignee_id: officerId,
        assignee: officer
      }));
      fetchIncidents();
    } catch (error) {
      toast.error('Failed to assign personnel');
    } finally {
      setUpdating(false);
    }
  };

  const handleLocationUpdate = async (lat: number, lng: number, name: string) => {
    if (!selectedIncident) return;
    setUpdating(true);
    try {
      await apiRequest(`/incidents/${selectedIncident.id}/location`, {
        method: 'PATCH',
        data: { lat, lng, locationName: name }
      });
      toast.success('Incident location updated');
      setSelectedIncident((prev: any) => ({
        ...prev,
        location_lat: lat,
        location_lng: lng,
        location_name: name
      }));
      fetchIncidents();
    } catch (error) {
      toast.error('Failed to update location');
    } finally {
      setUpdating(false);
    }
  };

  const handleRemarksUpdate = async () => {
    if (!selectedIncident) return;
    setUpdating(true);
    try {
      await apiRequest(`/incidents/${selectedIncident.id}/remarks`, {
        method: 'PATCH',
        data: { remarks: remarksInput }
      });
      toast.success('Resolution remarks saved successfully');
      setSelectedIncident((prev: any) => ({ ...prev, remarks: remarksInput }));
      fetchIncidents();
    } catch (error) {
      toast.error('Failed to save remarks');
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = () => {
    const headers = ["ID", "Status", "Priority", "Title/Type", "Location", "Created At"];
    const rows = filtered.map(i => [
      i.id.slice(0, 8),
      i.status,
      i.priority,
      i.title || i.type,
      i.location_name || "Campus",
      formatDate(i.created_at || i.createdAt)
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidents-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success("Exported " + filtered.length + " records");
  };

  const filterLandmarks = useCallback((query: string): LocationSuggestion[] => {
    const q = query.toLowerCase().trim();
    return landmarks
      .filter(l => q === '' || l.label.toLowerCase().includes(q) || (l.zone && l.zone.toLowerCase().includes(q)))
      .slice(0, 5)
      .map(l => ({
        label: l.label,
        sublabel: l.zone,
        lat: parseFloat(l.lat),
        lng: parseFloat(l.lng),
        source: "landmark" as const,
      }));
  }, [landmarks]);

  const geocodeQuery = useCallback(async (query: string) => {
    if (query.trim().length < 3) return;
    setGeocoding(true);
    try {
      const viewbox = boundaryToViewbox(campusBoundary);
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        addressdetails: '1',
      });
      if (viewbox) {
        params.set('viewbox', viewbox);
        params.set('bounded', '1');
      } else {
        params.set('viewbox', `${(campusCenterLng - 0.02).toFixed(5)},${(campusCenterLat + 0.02).toFixed(5)},${(campusCenterLng + 0.02).toFixed(5)},${(campusCenterLat - 0.02).toFixed(5)}`);
        params.set('bounded', '1');
      }

      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'SafeCampusApp/1.0' }
      });
      if (!resp.ok) return;
      const results: any[] = await resp.json();

      const geocodeSuggestions: LocationSuggestion[] = results.map(r => ({
        label: r.name || r.display_name.split(',')[0],
        sublabel: r.display_name.split(',').slice(1, 3).join(',').trim(),
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        source: "geocode" as const,
      }));

      setSuggestions(prev => {
        const landmarkPart = prev.filter(s => s.source === 'landmark');
        return [...landmarkPart, ...geocodeSuggestions].slice(0, 8);
      });
    } catch {
    } finally {
      setGeocoding(false);
    }
  }, [campusBoundary, campusCenterLat, campusCenterLng]);

  const handleLocationInput = (value: string) => {
    setNewIncident(prev => ({ ...prev, locationName: value }));

    const landmarkMatches = filterLandmarks(value);
    setSuggestions(landmarkMatches);
    setShowSuggestions(true);

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (value.trim().length >= 3) {
      geocodeTimer.current = setTimeout(() => geocodeQuery(value), 600);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiRequest('/incidents', {
        method: 'POST',
        data: {
          ...newIncident,
          isAnonymous: false,
        },
      });
      toast.success("Incident created successfully");
      setShowAddModal(false);
      setNewIncident({ title: "", description: "", type: "suspicious", priority: "MEDIUM", locationName: "", lat: campusCenterLat, lng: campusCenterLng });
      fetchIncidents();
    } catch (error: any) {
      toast.error(error.message || "Failed to create incident");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Incident Command</p>
          <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Security Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">Historical and active incident reports across campus</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            className="rounded-xl"
            disabled={incidents.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={() => fetchIncidents()} variant="secondary" className="rounded-xl border border-border/40">
            <Clock className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)} variant="hero" className="rounded-xl ml-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Incident
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by keyword, location, or ID..."
            className="w-full rounded-xl border border-border/60 bg-surface py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border/60 bg-surface py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>

        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full appearance-none rounded-xl border border-border/60 bg-surface py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Incident</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">Priority</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Location</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-sm text-muted-foreground">Syncing command logs...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Shield className="mx-auto h-12 w-12 text-muted-foreground/20" />
                    <h3 className="mt-4 text-lg font-semibold">
                      {incidents.length === 0 ? "All Clear" : "No Results"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {incidents.length === 0
                        ? "No safety incidents have been reported on campus yet."
                        : "No incidents match your current search filters."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((i, idx) => (
                  <motion.tr
                    key={i.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.01 }}
                    className="group hover:bg-secondary/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedIncident(i);
                      setRemarksInput(i.remarks || "");
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] text-muted-foreground mb-0.5">#{i.id.slice(0, 8)}</span>
                        <span className="font-bold text-foreground line-clamp-1">{i.title || i.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyles[i.status]}`}>
                          {i.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityStyles[i.priority]}`}>
                          {i.priority}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {i.location_name || "Campus Main"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(i.created_at || i.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 group-hover:bg-primary/10 group-hover:text-primary">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer info */}
        <div className="bg-muted/30 px-6 py-3 border-t border-border/60 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
            Showing {incidents.length} of {totalItems} incidents
          </div>

          <div className="flex items-center gap-4">
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="h-8 px-3 rounded-lg border-border/60"
                >
                  Prev
                </Button>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="h-8 px-3 rounded-lg border-border/60"
                >
                  Next
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium uppercase tracking-widest">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Live connection active
            </div>
          </div>
        </div>
      </div>

      {/* Incident Detail Modal */}
      <AnimatePresence>
        {selectedIncident && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setSelectedIncident(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary shrink-0" />

              <div className="p-6 sm:p-8 overflow-y-auto flex-1 pb-20 sm:pb-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-muted-foreground">#{selectedIncident.id}</span>
                      <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityStyles[selectedIncident.priority]}`}>
                        {selectedIncident.priority} PRIORITY
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold font-display">{selectedIncident.title || selectedIncident.type}</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedIncident(null)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="rounded-2xl bg-secondary/30 p-4 border border-border/40">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status</div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      {selectedIncident.status === 'RESOLVED' ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-accent" />}
                      {selectedIncident.status}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-secondary/30 p-4 border border-border/40 col-span-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex justify-between items-center">
                      <span>Location</span>
                      <button
                        onClick={() => setShowUpdateMapModal(true)}
                        className="text-primary hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {selectedIncident.location_name || "Campus Main"}
                    </div>
                    {selectedIncident.location_lat && selectedIncident.location_lng && (
                      <Link
                        to={`/map?incident=${selectedIncident.id}`}
                        onClick={() => setSelectedIncident(null)}
                        className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-primary hover:underline underline-offset-2"
                      >
                        <Navigation className="h-3 w-3" />
                        {Number(selectedIncident.location_lat).toFixed(5)}, {Number(selectedIncident.location_lng).toFixed(5)} — View on Map
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Report Details</h3>
                  <p className="text-foreground/80 leading-relaxed bg-background/50 rounded-2xl p-5 border border-border/30">
                    {selectedIncident.description || "No detailed description provided for this incident log."}
                  </p>
                </div>

                {(() => {
                  let mediaArray: string[] = [];
                  try {
                    if (typeof selectedIncident.media === 'string') {
                      mediaArray = JSON.parse(selectedIncident.media);
                    } else if (Array.isArray(selectedIncident.media)) {
                      mediaArray = selectedIncident.media;
                    }
                  } catch (e) {
                    console.error("Failed to parse media array", e);
                  }

                  if (mediaArray.length === 0) return null;

                  return (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Attached Evidence</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {mediaArray.map((asset: string, idx: number) => {
                          const isCloudinaryId = !asset.startsWith('/') && !asset.startsWith('http');
                          const isVideo = isCloudinaryId
                            ? asset.includes('/video/') || asset.match(/\.(mp4|webm|mov)$/i)
                            : asset.match(/\.(mp4|webm|mov)$/i);

                          let mediaUrl: string;
                          if (isCloudinaryId) {
                            const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'safecampus';
                            const resourceType = isVideo ? 'video' : 'image';
                            mediaUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${asset}`;
                          } else {
                            mediaUrl = asset.startsWith('/')
                              ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${asset}`
                              : asset;
                          }

                          return (
                            <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border border-border/40 bg-black/5 group cursor-pointer" onClick={() => setViewingMedia({ url: mediaUrl, isVideo: !!isVideo })}>
                              {isVideo ? (
                                <div className="relative h-full w-full bg-black">
                                  <video src={`${mediaUrl}#t=0.1`} className="h-full w-full object-cover opacity-80" preload="metadata" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform group-hover:scale-110">
                                      <Play className="h-5 w-5 text-white ml-1" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <img src={mediaUrl} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Resolution Remarks</h3>
                  <textarea
                    className="w-full min-h-[100px] rounded-2xl border border-border/60 bg-background/50 p-4 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
                    placeholder="Document resolution steps, findings, or notes here..."
                    value={remarksInput}
                    onChange={(e) => setRemarksInput(e.target.value)}
                    disabled={updating || (user.role !== 'SCHOOL_ADMIN' && user.role !== 'SUPER_ADMIN' && selectedIncident.assignee_id !== user.id)}
                  />
                  <div className="flex justify-end mt-2">
                    <Button
                      size="sm"
                      onClick={handleRemarksUpdate}
                      disabled={updating || remarksInput === (selectedIncident.remarks || '') || (user.role !== 'SCHOOL_ADMIN' && user.role !== 'SUPER_ADMIN' && selectedIncident.assignee_id !== user.id)}
                    >
                      {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Save Remarks
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 pt-4 border-t border-border/40">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Transition Status</label>
                      <select
                        className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-3 text-sm focus:border-primary focus:outline-none"
                        value={selectedIncident.status}
                        onChange={(e) => handleStatusUpdate(selectedIncident.id, e.target.value)}
                        disabled={updating}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="INVESTIGATING">Investigating</option>
                        <option value="RESOLVED">Resolved</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 flex flex-col justify-end">
                      <div className="flex items-center justify-between ml-1 pr-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Assign Personnel</label>
                      </div>
                      {user.role === 'SECURITY' ? (
                        <Button
                          className="w-full h-11 rounded-xl"
                          variant={selectedIncident.assignee_id && selectedIncident.assignee_id !== user.id ? 'outline' : 'hero'}
                          onClick={() => handleAssign(selectedIncident.id, user.id)}
                          disabled={updating || !!selectedIncident.assignee_id}
                        >
                          {updating ? "Picking up..." : selectedIncident.assignee_id === user.id ? "Assigned to You" : selectedIncident.assignee_id ? "Already Assigned" : "Pick Up Task"}
                        </Button>
                      ) : (
                        <select
                          className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-3 text-sm focus:border-primary focus:outline-none"
                          value={selectedIncident.assignee_id || ""}
                          onChange={(e) => handleAssign(selectedIncident.id, e.target.value)}
                          disabled={updating}
                        >
                          <option value="" disabled>Assign Officer</option>
                          {officers.map(o => (
                            <option key={o.id} value={o.id}>{o.first_name} {o.last_name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="hero"
                    className="w-full h-12 font-bold shadow-lg shadow-primary/20"
                    onClick={() => setSelectedIncident(null)}
                  >
                    Close Log View
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Picker Modal for Updating Incident Location */}
      {showUpdateMapModal && selectedIncident && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUpdateMapModal(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl flex flex-col h-[80vh] max-h-[800px]"
          >
            <div className="flex items-center justify-between border-b border-border/40 px-6 py-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Update Location: {selectedIncident.id.slice(0, 8)}
              </h3>
              <button
                type="button"
                onClick={() => setShowUpdateMapModal(false)}
                className="rounded-full p-2 hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 bg-secondary/10 relative p-4">
              <div className="w-full h-full rounded-xl overflow-hidden border border-border/50">
                <LocationPickerMap
                  boundary={campusBoundary || []}
                  landmarks={landmarks}
                  center={{ lat: campusCenterLat, lng: campusCenterLng }}
                  institutionName={user?.institution?.name || "Campus"}
                  initialLocation={
                    selectedIncident.location_lat && selectedIncident.location_lng
                      ? { lat: selectedIncident.location_lat, lng: selectedIncident.location_lng, name: selectedIncident.location_name }
                      : null
                  }
                  onLocationSelected={(loc) => {
                    handleLocationUpdate(loc.lat, loc.lng, loc.name);
                    setShowUpdateMapModal(false);
                  }}
                />
              </div>
            </div>

            <div className="border-t border-border/40 p-4 bg-background/50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowUpdateMapModal(false)}>
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Incident Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
              <div className="p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-primary">Admin</p>
                    <h2 className="text-xl font-bold font-display">Log New Incident</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <form onSubmit={handleCreateIncident} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title</label>
                    <input
                      required
                      type="text"
                      placeholder="Brief incident title..."
                      className="w-full h-11 rounded-xl border border-border bg-background/50 px-3 text-sm focus:border-primary focus:outline-none"
                      value={newIncident.title}
                      onChange={e => setNewIncident({ ...newIncident, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Type</label>
                      <select
                        className="w-full h-11 rounded-xl border border-border bg-background/50 px-3 text-sm focus:border-primary focus:outline-none appearance-none"
                        value={newIncident.type}
                        onChange={e => setNewIncident({ ...newIncident, type: e.target.value })}
                      >
                        {incidentTypes.map(t => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Priority</label>
                      <select
                        className="w-full h-11 rounded-xl border border-border bg-background/50 px-3 text-sm focus:border-primary focus:outline-none appearance-none"
                        value={newIncident.priority}
                        onChange={e => setNewIncident({ ...newIncident, priority: e.target.value })}
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Location</label>
                    <div className="relative" ref={locationRef}>
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        required
                        type="text"
                        placeholder="Building, room, or area..."
                        className="w-full h-11 rounded-xl border border-border bg-background/50 pl-10 pr-10 text-sm focus:border-primary focus:outline-none"
                        value={newIncident.locationName}
                        onChange={e => handleLocationInput(e.target.value)}
                        onFocus={() => {
                          if (!newIncident.locationName) setSuggestions(filterLandmarks(''));
                          setShowSuggestions(true);
                        }}
                      />
                      {geocoding && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}

                      {showSuggestions && (suggestions.length > 0) && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="absolute left-0 right-0 top-full z-[110] mt-1 overflow-hidden rounded-xl border border-border/60 bg-surface shadow-2xl"
                        >
                          {suggestions.map((s, i) => (
                            <button
                              key={`${s.source}-${i}`}
                              type="button"
                              onClick={() => {
                                setNewIncident(prev => ({ ...prev, locationName: s.label, lat: s.lat, lng: s.lng }));
                                setShowSuggestions(false);
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-primary/10 group transition-colors"
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary">
                                {s.source === 'landmark' ? <Building2 className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{s.label}</div>
                                {s.sublabel && <div className="text-[10px] text-muted-foreground truncate">{s.sublabel}</div>}
                              </div>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Describe the incident in detail..."
                      className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm focus:border-primary focus:outline-none resize-none"
                      value={newIncident.description}
                      onChange={e => setNewIncident({ ...newIncident, description: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" variant="hero" className="flex-1 h-11" disabled={creating}>
                      {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log Incident"}
                    </Button>
                    <Button type="button" variant="outline" className="h-11 px-5" onClick={() => setShowAddModal(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <MediaViewerModal media={viewingMedia} onClose={() => setViewingMedia(null)} />
    </div>
  );
}
