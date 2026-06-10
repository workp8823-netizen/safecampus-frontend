import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertTriangle,
  Camera,
  MapPin,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Navigation,
  Building2,
  Search,
  ChevronDown,
  X,
  Video,
  XCircle,
  Image as ImageIcon,
  Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { getCookie } from "@/lib/cookies";
import { LocationPickerMap } from "@/components/LocationPickerMap";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { MediaViewerModal } from "@/components/MediaViewerModal";

const incidentTypes = [
  { id: "harassment", label: "Harassment", color: "bg-destructive/15 text-destructive border-destructive/30" },
  { id: "theft", label: "Theft", color: "bg-warning/15 text-warning border-warning/30" },
  { id: "suspicious", label: "Suspicious Activity", color: "bg-accent/15 text-accent border-accent/30" },
  { id: "medical", label: "Medical Emergency", color: "bg-destructive/15 text-destructive border-destructive/30" },
  { id: "vandalism", label: "Vandalism", color: "bg-warning/15 text-warning border-warning/30" },
  { id: "other", label: "Other", color: "bg-muted text-muted-foreground border-border" },
];

const urgencyLevels = [
  { id: "low", label: "Low", desc: "Non-urgent, for record" },
  { id: "medium", label: "Medium", desc: "Needs attention soon" },
  { id: "high", label: "High", desc: "Immediate response required" },
];

interface Landmark {
  id: string;
  label: string;
  zone: string;
  lat: number;
  lng: number;
  types: string[];
}

interface LocationSuggestion {
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  source: "landmark" | "geocode";
}

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

export default function ReportPage() {
  const navigate = useNavigate();
  const user = getCookie('user');
  const institutionId = getCookie('institutionId');



  const [type, setType] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<string>("medium");
  const [anonymous, setAnonymous] = useState(() => {
    try {
      const pref = user?.preferences?.privacy?.anonymousReporting;
      return pref !== undefined ? !!pref : true;
    } catch { return false; }
  });
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [viewingMedia, setViewingMedia] = useState<{url: string, isVideo: boolean} | null>(null);

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      mediaPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [mediaPreviews]);

  // Location combobox state
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locationInputFocused, setLocationInputFocused] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  useBodyScrollLock(showMapPicker || !!viewingMedia);
  const locationRef = useRef<HTMLDivElement>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State-based campus data for reactivity
  const [instData, setInstData] = useState<any>(user?.institution);
  const campusBoundary: [number, number][] | null = (() => {
    try {
      const rawB = instData?.boundary;
      if (!rawB) return null;
      const b = typeof rawB === 'string' ? JSON.parse(rawB) : rawB;
      return Array.isArray(b) ? b : null;
    } catch { return null; }
  })();
  const campusCenterLat: number = instData?.center_lat || 5.6507;
  const campusCenterLng: number = instData?.center_lng || -0.1870;

  // Fetch campus context & landmarks
  useEffect(() => {
    if (!institutionId) return;

    const syncContext = async () => {
      try {
        const profile = await apiRequest('/users/profile');
        const inst = profile.Institution || profile.institution;
        if (inst) setInstData(inst);

        const data = await apiRequest(`/institutions/${institutionId}/hotspots`);
        setLandmarks(data.map((h: any) => ({
          id: h.id,
          label: h.label,
          zone: h.zone || 'Campus',
          lat: parseFloat(h.lat),
          lng: parseFloat(h.lng),
          types: Array.isArray(h.types) ? h.types : []
        })));
      } catch (err) {
        console.error("Failed to sync report context:", err);
      }
    };

    syncContext();
  }, [institutionId]);

  // Filter landmarks by query
  const filterLandmarks = useCallback((query: string): LocationSuggestion[] => {
    const q = query.toLowerCase().trim();
    return landmarks
      .filter(l => q === '' || l.label.toLowerCase().includes(q) || l.zone.toLowerCase().includes(q))
      .slice(0, 5)
      .map(l => ({
        label: l.label,
        sublabel: l.zone,
        lat: l.lat,
        lng: l.lng,
        source: "landmark" as const,
      }));
  }, [landmarks]);

  // Geocode via Nominatim within campus bounds
  const geocodeQuery = useCallback(async (query: string) => {
    if (query.trim().length < 3) return;
    setGeocoding(true);
    try {
      const viewbox = boundaryToViewbox(campusBoundary || []);
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        addressdetails: '1',
      });
      if (viewbox) {
        params.set('viewbox', viewbox);
        params.set('bounded', '1'); // restrict to boundary
      } else {
        // Fall back to campus center with ~2km radius
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
      // Nominatim unavailable — silently fall back to landmarks only
    } finally {
      setGeocoding(false);
    }
  }, [campusBoundary, campusCenterLat, campusCenterLng]);

  // Handle location input change
  const handleLocationInput = (value: string) => {
    setLocation(value);
    setLocationConfirmed(false);
    setLat(null);
    setLng(null);

    // Immediately filter landmarks
    const landmarkMatches = filterLandmarks(value);
    setSuggestions(landmarkMatches);
    setShowSuggestions(true);

    // Debounce geocode for free-text
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    if (value.trim().length >= 3) {
      geocodeTimer.current = setTimeout(() => geocodeQuery(value), 600);
    }
  };

  // Show all landmarks when input is focused with empty value
  const handleLocationFocus = () => {
    setLocationInputFocused(true);
    if (!location) {
      setSuggestions(filterLandmarks(''));
    }
    setShowSuggestions(true);
  };

  // Select a suggestion
  const selectSuggestion = (s: LocationSuggestion) => {
    setLocation(s.label);
    setLat(s.lat);
    setLng(s.lng);
    setLocationConfirmed(true);
    setShowSuggestions(false);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Update landmarks suggestions when landmarks load
  useEffect(() => {
    if (locationInputFocused && !location) {
      setSuggestions(filterLandmarks(''));
    }
  }, [landmarks, locationInputFocused, location, filterLandmarks]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (mediaFiles.length + files.length > 3) {
      toast.error("Maximum 3 files allowed.");
      return;
    }

    const validFiles = files.filter(f => {
      const isVideo = f.type.startsWith('video/');
      const limit = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (f.size > limit) {
        toast.error(`${f.name} exceeds ${isVideo ? '50MB' : '10MB'} limit.`);
        return false;
      }
      return true;
    });

    setMediaFiles(prev => [...prev, ...validFiles]);
    setMediaPreviews(prev => [...prev, ...validFiles.map(f => URL.createObjectURL(f))]);

    if (e.target) e.target.value = '';
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;

    setSubmitting(true);
    try {
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        const formData = new FormData();
        mediaFiles.forEach(file => formData.append('files', file));

        // Upload media directly
        const uploadRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          throw new Error('Failed to upload media files.');
        }

        const uploadData = await uploadRes.json();
        mediaUrls = uploadData.urls || [];
      }

      const result = await apiRequest('/incidents', {
        method: 'POST',
        data: {
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
          description,
          type,
          priority: urgency.toUpperCase(),
          locationName: location,
          lat: lat || campusCenterLat,
          lng: lng || campusCenterLng,
          isAnonymous: anonymous,
          institutionId: institutionId || 'default-id',
          media: mediaUrls
        },
      });
      setSubmittedId(result?.id || null);
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit report:', error);
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 ring-4 ring-primary/20"
          >
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </motion.div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Report submitted
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Your report{" "}
            {submittedId ? (
              <span className="font-mono text-foreground">#{submittedId.slice(0, 8).toUpperCase()}</span>
            ) : (
              ""
            )}{" "}
            has been routed to campus security. Expected response: under 4 minutes.
          </p>
          <div className="mt-8 flex gap-3">
            <Button variant="hero" onClick={() => navigate("/dashboard", { state: { refreshReports: true } })}>
              Track status
            </Button>
            <Button variant="outline" onClick={() => { setSubmitted(false); setType(null); }}>
              File another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            For life-threatening emergencies, call 911 first
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Report an incident
          </h1>
          <p className="mt-2 text-muted-foreground">
            Help keep your campus safe. All submissions are encrypted and routed
            instantly to security.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          onSubmit={handleSubmit}
          className="mt-10 space-y-8 rounded-2xl border border-border/60 bg-surface p-6 sm:p-8"
        >
          {/* Type */}
          <div>
            <label className="mb-3 block text-sm font-medium text-foreground">
              Incident type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {incidentTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${type === t.id
                    ? `${t.color} ring-2 ring-primary/40 scale-[1.02]`
                    : "border-border bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Urgency */}
          <div>
            <label className="mb-3 block text-sm font-medium text-foreground">
              Urgency level
            </label>
            <div className="grid gap-2">
              {urgencyLevels.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setUrgency(u.id)}
                  className={`rounded-lg border p-3 text-left transition-all ${urgency === u.id
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-border bg-background/40 hover:border-primary/30"
                    }`}
                >
                  <div className="text-sm font-semibold capitalize">{u.label}</div>
                  <div className="text-xs text-muted-foreground">{u.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="desc" className="mb-2 block text-sm font-medium">
              Description
            </label>
            <textarea
              id="desc"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened, who was involved, and any other details..."
              className="w-full resize-none rounded-lg border border-border bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Location & Photo */}
          <div className="grid gap-4">
            {/* Smart Location Combobox */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">Location</label>
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) return toast.error("Geolocation not supported");
                    const loadingToast = toast.loading("Fetching precise location...");
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        toast.dismiss(loadingToast);
                        setLat(pos.coords.latitude);
                        setLng(pos.coords.longitude);
                        setLocation("Current GPS Location");
                        setLocationConfirmed(true);
                        toast.success("Location attached", { description: "Precise GPS coordinates captured." });
                      },
                      () => {
                        toast.dismiss(loadingToast);
                        toast.error("Location access denied. Please enable precise location in your browser.");
                      },
                      { enableHighAccuracy: true }
                    );
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80"
                >
                  <Navigation className="h-3 w-3" /> Use my GPS
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 ml-4"
                >
                  <MapPin className="h-3 w-3" /> Pin on Map
                </button>
              </div>

              <div className="relative" ref={locationRef}>
                {/* Input */}
                <div className={`flex items-center rounded-lg border bg-background/60 transition-all ${locationInputFocused ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                  } ${locationConfirmed ? 'border-primary/40 bg-primary/5' : ''}`}>
                  {locationConfirmed ? (
                    <MapPin className="ml-3 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <input
                    required
                    type="text"
                    value={location}
                    onChange={(e) => handleLocationInput(e.target.value)}
                    onFocus={handleLocationFocus}
                    onBlur={() => setLocationInputFocused(false)}
                    placeholder="Search campus buildings or areas..."
                    className="w-full bg-transparent py-2.5 pl-2 pr-8 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                  {geocoding ? (
                    <Loader2 className="mr-3 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                  ) : (
                    <ChevronDown className={`mr-3 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${showSuggestions ? 'rotate-180' : ''}`} />
                  )}
                </div>

                {/* Confirmed GPS indicator */}
                {lat && lng && locationConfirmed && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-primary">
                    <Navigation className="h-2.5 w-2.5" />
                    {lat.toFixed(5)}, {lng.toFixed(5)}
                  </div>
                )}

                {/* Suggestions dropdown */}
                {showSuggestions && (suggestions.length > 0 || landmarks.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border/60 bg-surface shadow-2xl shadow-black/20 max-h-[50vh] overflow-y-auto"
                  >
                    {/* Section header: Campus Landmarks */}
                    {suggestions.some(s => s.source === 'landmark') && (
                      <div className="px-3 py-1.5 border-b border-border/40">
                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          <Building2 className="h-3 w-3" /> Campus Landmarks
                        </span>
                      </div>
                    )}
                    {suggestions.filter(s => s.source === 'landmark').map((s, i) => (
                      <button
                        key={`lm-${i}`}
                        type="button"
                        onMouseDown={() => selectSuggestion(s)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-primary/10 hover:text-primary group"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.label}</div>
                          {s.sublabel && <div className="text-[10px] text-muted-foreground">{s.sublabel}</div>}
                        </div>
                      </button>
                    ))}

                    {/* Section header: Nearby Places */}
                    {suggestions.some(s => s.source === 'geocode') && (
                      <div className="px-3 py-1.5 border-t border-b border-border/40">
                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          <MapPin className="h-3 w-3" /> Nearby Places
                        </span>
                      </div>
                    )}
                    {suggestions.filter(s => s.source === 'geocode').map((s, i) => (
                      <button
                        key={`gc-${i}`}
                        type="button"
                        onMouseDown={() => selectSuggestion(s)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 group"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground group-hover:text-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{s.label}</div>
                          {s.sublabel && <div className="text-[10px] text-muted-foreground truncate">{s.sublabel}</div>}
                        </div>
                      </button>
                    ))}

                    {/* Empty state for typed query with no geocode results */}
                    {suggestions.length === 0 && location.trim().length >= 3 && !geocoding && (
                      <div className="px-4 py-6 text-center">
                        <MapPin className="mx-auto h-5 w-5 text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">No locations found near campus</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </div>

            {/* Photo / Video */}
            <div>
              <label className="mb-2 block text-sm font-medium">Photo & Video Evidence</label>

              {mediaPreviews.length > 0 && (
                <div className="mb-3 grid grid-cols-3 gap-3">
                  {mediaPreviews.map((preview, i) => {
                    const isVideo = mediaFiles[i].type.startsWith('video/');
                    return (
                      <div key={i} className="relative aspect-square overflow-hidden rounded-lg border border-border group">
                        {isVideo ? (
                          <div className="relative h-full w-full bg-black">
                            <video src={`${preview}#t=0.1`} className="h-full w-full object-cover opacity-80" preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform group-hover:scale-110">
                                <Play className="h-5 w-5 text-white ml-1" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <img src={preview} alt={`Preview ${i}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        )}
                        
                        <button 
                          type="button" 
                          className="absolute inset-0 z-10 w-full h-full cursor-pointer" 
                          onClick={() => setViewingMedia({ url: preview, isVideo })}
                        />

                        <button
                          type="button"
                          onClick={() => removeMedia(i)}
                          className="absolute right-1 top-1 z-20 rounded-full bg-black/50 p-1 text-white hover:bg-destructive transition-colors"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {mediaFiles.length < 3 && (
                <>
                  {/* Photo input — images only */}
                  <input
                    type="file"
                    id="photo-upload"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    onChange={handleFileSelect}
                  />
                  {/* Video input — videos only */}
                  <input
                    type="file"
                    id="video-upload"
                    className="hidden"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleFileSelect}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('photo-upload')?.click()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/30 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <ImageIcon className="h-4 w-4" /> Add Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('video-upload')?.click()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/30 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      <Video className="h-4 w-4" /> Add Video
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground text-center">
                    Max 3 files. Up to 10MB per photo, 50MB per video.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Anonymous toggle */}
          <button
            type="button"
            onClick={() => setAnonymous(!anonymous)}
            className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${anonymous ? "border-accent/40 bg-accent/5" : "border-border bg-background/30"
              }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${anonymous ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground"}`}>
                <EyeOff className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">Submit anonymously</div>
                <div className="text-xs text-muted-foreground">
                  Your identity will be hidden from all parties
                </div>
              </div>
            </div>
            <div className={`relative h-6 w-11 rounded-full transition-colors ${anonymous ? "bg-accent" : "bg-secondary"}`}>
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${anonymous ? "translate-x-5" : "translate-x-0.5"
                  }`}
              />
            </div>
          </button>

          {/* Submit */}
          <div className="flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="ghost" type="button">
              <Link to="/">Cancel</Link>
            </Button>
            <Button type="submit" variant="hero" size="lg" disabled={!type || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                </>
              ) : (
                <>
                  Submit report <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.form>
      </div>

      {/* Map Picker Modal */}
      {showMapPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMapPicker(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl flex flex-col"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-6 py-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Pinpoint Location
              </h3>
              <button
                type="button"
                onClick={() => setShowMapPicker(false)}
                className="rounded-full p-2 hover:bg-secondary text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-secondary/10 relative p-2 sm:p-4">
              <div className="w-full rounded-xl overflow-hidden border border-border/50">
                <LocationPickerMap
                  boundary={campusBoundary || []}
                  landmarks={landmarks.map(lm => ({ ...lm, type: lm.types?.[0] || 'general' }))}
                  center={{ lat: campusCenterLat, lng: campusCenterLng }}
                  institutionName={user?.institution?.name || "Campus"}
                  initialLocation={lat && lng ? { lat, lng, name: location } : null}
                  onLocationSelected={(loc) => {
                    setLat(loc.lat);
                    setLng(loc.lng);
                    setLocation(loc.name);
                    setLocationConfirmed(true);
                  }}
                />
              </div>
            </div>

            <div className="shrink-0 border-t border-border/40 p-4 bg-background/50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowMapPicker(false)}>
                Cancel
              </Button>
              <Button variant="hero" onClick={() => setShowMapPicker(false)}>
                Confirm Location
              </Button>
            </div>
          </motion.div>
        </div>
      )}
      <MediaViewerModal media={viewingMedia} onClose={() => setViewingMedia(null)} />
    </div>
  );
}
