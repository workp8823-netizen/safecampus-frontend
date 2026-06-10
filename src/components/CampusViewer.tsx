import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Maximize,
  Minimize,
  Navigation,
  LocateFixed,
  Layers,
  X,
  AlertTriangle,
  Activity,
  MapPin,
  Plus,
  Minus,
} from "lucide-react";

export interface ViewerLandmark {
  label: string;
  zone: string;
  type: string;
  lat: number;
  lng: number;
}

export interface ViewerIncident {
  id: string;
  title: string;
  description?: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: string;
  location_lat?: number;
  location_lng?: number;
  location_name?: string;
  created_at?: string;
}

interface CampusViewerProps {
  boundary: [number, number][];
  landmarks: ViewerLandmark[];
  incidents?: ViewerIncident[];
  center: { lat: number; lng: number };
  institutionName: string;
  selectedIncidentId?: string | null;
  onSelectIncident?: (id: string | null) => void;
  selectedBuddyId?: string | null;
  buddies?: { id: string, name: string, lat: number, lng: number }[];
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "#10b981",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
  CRITICAL: "#7c3aed",
};

const LAYER_URLS = {
  standard: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  hybrid: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
};

function buildIncidentIcon(priority: string, selected: boolean) {
  const color = PRIORITY_COLOR[priority] || "#6366f1";
  const size = priority === "CRITICAL" ? 24 : priority === "HIGH" ? 20 : 16;
  const ring = selected
    ? `box-shadow:0 0 0 5px ${color}55,0 0 24px ${color}aa;`
    : `box-shadow:0 0 0 3px ${color}44;`;
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:-8px;border-radius:9999px;background:${color};opacity:.2;animation:pulse-ring 2s ease-out infinite;"></div>
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;background:${color};${ring}border:2px solid #fff;display:flex;align-items:center;justify-content:center;">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function buildLandmarkIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:#6366f1;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 12px rgba(99,102,241,0.4);display:flex;align-items:center;justify-content:center;">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    </div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export function CampusViewer({
  boundary,
  landmarks,
  incidents = [],
  center,
  institutionName,
  selectedIncidentId,
  onSelectIncident,
  selectedBuddyId,
  buddies = [],
}: CampusViewerProps) {
  // The map canvas div – physically moved between the inline container and the portal
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // Placeholder element that occupies space in normal flow when not fullscreen
  const inlineSlotRef = useRef<HTMLDivElement>(null);
  // The portal overlay div (appended to body)
  const portalRef = useRef<HTMLDivElement | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const polyRef = useRef<L.Polygon | null>(null);
  const landmarkMarkersRef = useRef<L.Marker[]>([]);
  const incidentMarkersRef = useRef<Record<string, L.Marker>>({});
  const buddyMarkersRef = useRef<Record<string, L.Marker>>({});
  const userLocRef = useRef<L.Marker | null>(null);
  const boundaryFittedRef = useRef(false);

  const [mapLayer, setMapLayer] = useState<"standard" | "satellite" | "hybrid">("standard");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // ─── Create portal container once ──────────────────────────────────────────
  useEffect(() => {
    const el = document.createElement("div");
    el.id = "campus-viewer-fullscreen-portal";
    el.style.cssText = `
      display:none;
      position:fixed;
      inset:0;
      width:100vw;
      height:100%;
      height:100dvh;
      z-index:99999;
      background:#000;
    `;
    document.body.appendChild(el);
    portalRef.current = el;
    return () => {
      document.body.removeChild(el);
      portalRef.current = null;
    };
  }, []);

  // ─── Map Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const tile = L.tileLayer(LAYER_URLS.standard, {
      maxZoom: 19,
      subdomains: "abcd",
    }).addTo(map);
    (map as any)._activeTile = tile;

    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapContainerRef.current!);

    const poly = L.polygon([], {
      color: "#059669",
      fillColor: "#10b981",
      fillOpacity: 0.08,
      weight: 2.5,
      dashArray: "8 5",
      interactive: false,
    }).addTo(map);
    polyRef.current = poly;

    mapRef.current = map;
    setMapReady(true);

    // Sync native fullscreen exit (e.g. Escape key)
    const onFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener("fullscreenchange", onFsChange);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Fullscreen toggle – move DOM node into/out of portal ──────────────────
  const toggleFullscreen = useCallback(() => {
    const portal = portalRef.current;
    const mapEl = mapContainerRef.current;
    const map = mapRef.current;
    if (!portal || !mapEl || !map) return;

    if (!isFullscreen) {
      // Move map canvas into the portal overlay, inserting before the controls
      portal.style.display = "block";
      portal.insertBefore(mapEl, portal.firstChild);
      document.body.style.overflow = "hidden";
      setIsFullscreen(true);
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    } else {
      // Move map canvas back into the inline slot
      if (inlineSlotRef.current) {
        inlineSlotRef.current.appendChild(mapEl);
      }
      portal.style.display = "none";
      document.body.style.overflow = "";
      setIsFullscreen(false);
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    }
  }, [isFullscreen]);

  // Cleanup body overflow on unmount if fullscreen
  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
      const portal = portalRef.current;
      const mapEl = mapContainerRef.current;
      if (portal && mapEl && portal.contains(mapEl) && inlineSlotRef.current) {
        inlineSlotRef.current.appendChild(mapEl);
        portal.style.display = "none";
      }
    };
  }, []);

  // ─── Boundary ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !polyRef.current) return;

    try {
      let parsed = boundary;
      while (typeof parsed === "string") {
        parsed = JSON.parse(parsed);
      }
      const valid: [number, number][] = (Array.isArray(parsed) ? parsed : []).filter(
        (pt: any) =>
          Array.isArray(pt) && pt.length === 2 &&
          typeof pt[0] === "number" && !isNaN(pt[0]) &&
          typeof pt[1] === "number" && !isNaN(pt[1])
      );
      polyRef.current.setLatLngs(valid);

      if (valid.length >= 3 && !boundaryFittedRef.current) {
        map.fitBounds(valid as L.LatLngBoundsExpression, { padding: [30, 30], animate: false });
        boundaryFittedRef.current = true;
      }
    } catch { /* ignore */ }
  }, [boundary]);

  // ─── Layer switcher ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if ((map as any)._activeTile) map.removeLayer((map as any)._activeTile);
    const url = LAYER_URLS[mapLayer];
    const tile = L.tileLayer(url, { maxZoom: 19, subdomains: "abcd" }).addTo(map);
    (map as any)._activeTile = tile;
  }, [mapLayer]);

  // ─── Landmarks ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    landmarkMarkersRef.current.forEach(m => m.remove());
    landmarkMarkersRef.current = [];
    if (!showLandmarks) return;

    landmarks.forEach(lm => {
      if (!lm.lat || !lm.lng) return;
      const marker = L.marker([lm.lat, lm.lng], { icon: buildLandmarkIcon(), interactive: true })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;min-width:160px;">
            <div style="font-size:10px;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">${lm.type}</div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:2px;">${lm.label}</div>
            <div style="font-size:11px;color:#64748b;margin-top:1px;">${lm.zone}</div>
          </div>`,
          { closeButton: false, className: "campus-popup" }
        );
      landmarkMarkersRef.current.push(marker);
    });
  }, [landmarks, showLandmarks, mapReady]);

  // ─── Incident Markers ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    Object.values(incidentMarkersRef.current).forEach(m => m.remove());
    incidentMarkersRef.current = {};
    if (!showIncidents) return;

    incidents.forEach(inc => {
      if (!inc.location_lat || !inc.location_lng) return;
      const isSelected = inc.id === selectedIncidentId;
      const marker = L.marker([inc.location_lat, inc.location_lng], {
        icon: buildIncidentIcon(inc.priority, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;min-width:200px;">
            <div style="font-size:10px;color:${PRIORITY_COLOR[inc.priority]};font-weight:700;text-transform:uppercase;letter-spacing:.1em;">${inc.priority} · ${inc.type}</div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:2px;">${inc.title}</div>
            ${inc.location_name ? `<div style="font-size:11px;color:#64748b;margin-top:1px;">${inc.location_name}</div>` : ""}
            <div style="font-size:10px;color:#94a3b8;margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;">Status: ${inc.status}</div>
          </div>`,
          { closeButton: false, className: "campus-popup" }
        );

      marker.on("click", e => {
        L.DomEvent.stopPropagation(e);
        onSelectIncident?.(inc.id);
      });

      incidentMarkersRef.current[inc.id] = marker;
    });
  }, [incidents, showIncidents, selectedIncidentId, onSelectIncident, mapReady]);

  // ─── Buddy Markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    console.log(`[map]: Rendering ${buddies.length} buddy markers`);

    const currentBuddyIds = new Set(buddies.map(b => String(b.id)));
    Object.keys(buddyMarkersRef.current).forEach(id => {
      if (!currentBuddyIds.has(id)) {
        buddyMarkersRef.current[id].remove();
        delete buddyMarkersRef.current[id];
      }
    });

    buddies.forEach(buddy => {
      if (!buddy.lat || !buddy.lng) return;

      if (buddyMarkersRef.current[buddy.id]) {
        buddyMarkersRef.current[buddy.id].setLatLng([Number(buddy.lat), Number(buddy.lng)]);
      } else {
        const marker = L.circleMarker([Number(buddy.lat), Number(buddy.lng)], {
          color: '#ffffff',
          weight: 4,
          fillColor: '#ef4444',
          fillOpacity: 1,
          radius: 12,
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:Inter,sans-serif;min-width:120px;">
              <div style="font-size:10px;color:#ef4444;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">Safety Buddy</div>
              <div style="font-size:13px;font-weight:600;color:#0f172a;margin-top:2px;">${buddy.name}</div>
              <div style="font-size:10px;color:#64748b;margin-top:1px;">Live Location</div>
            </div>`,
            { closeButton: false, className: "campus-popup" }
          );
        buddyMarkersRef.current[buddy.id] = marker as any;
      }
    });
  }, [buddies, mapReady]);

  // ─── Pan to selected incident ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedIncidentId) return;
    const inc = incidents.find(i => i.id === selectedIncidentId);
    if (inc?.location_lat && inc?.location_lng) {
      mapRef.current.flyTo([inc.location_lat, inc.location_lng], 18, { duration: 0.8 });
      incidentMarkersRef.current[selectedIncidentId]?.openPopup();
    }
  }, [selectedIncidentId, incidents]);

  // ─── Pan to selected buddy ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !selectedBuddyId) return;
    const buddy = buddies.find(b => b.id === selectedBuddyId);
    if (buddy?.lat && buddy?.lng) {
      mapRef.current.flyTo([Number(buddy.lat), Number(buddy.lng)], 18, { duration: 0.8 });
      setTimeout(() => {
        buddyMarkersRef.current[selectedBuddyId]?.openPopup();
      }, 900);
    }
  }, [selectedBuddyId, buddies, mapReady]);

  const handleLocate = () => {
    const map = mapRef.current;
    if (!map) return;
    map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
    map.once("locationfound", e => {
      if (userLocRef.current) userLocRef.current.remove();
      userLocRef.current = L.marker(e.latlng, {
        icon: L.divIcon({
          className: "",
          html: `<div style="position:relative;width:18px;height:18px;">
            <div style="position:absolute;inset:-8px;border-radius:9999px;background:#3b82f6;opacity:.3;animation:pulse-ring 2s ease-out infinite;"></div>
            <div style="position:relative;width:18px;height:18px;border-radius:9999px;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 12px rgba(59,130,246,.6);"></div>
          </div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      }).addTo(map).bindPopup("You are here");
    });
  };

  const handleResetView = () => {
    const map = mapRef.current;
    if (!map) return;
    const parsed = typeof boundary === "string" ? JSON.parse(boundary) : boundary;
    if (Array.isArray(parsed) && parsed.length >= 3) {
      map.fitBounds(parsed as any, { padding: [30, 30], animate: true });
    } else {
      map.setView([center.lat, center.lng], 16, { animate: true });
    }
    onSelectIncident?.(null);
  };

  const activeIncidents = incidents.filter(i => i.location_lat && i.location_lng);
  const priorityCounts = {
    CRITICAL: activeIncidents.filter(i => i.priority === "CRITICAL").length,
    HIGH: activeIncidents.filter(i => i.priority === "HIGH").length,
    MEDIUM: activeIncidents.filter(i => i.priority === "MEDIUM").length,
    LOW: activeIncidents.filter(i => i.priority === "LOW").length,
  };

  // Controls JSX shared between normal and fullscreen modes
  const Controls = (
    <>
      {/* Top-left: Fullscreen + Locate + Reset */}
      <div className="absolute left-4 top-4 z-[1000] flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors flex items-center justify-center"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={handleLocate}
          className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors"
          title="My Location"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors"
          title="Reset View"
        >
          <Navigation className="h-4 w-4" />
        </button>
      </div>

      {/* Top-right: Layers */}
      <div className="absolute right-4 top-4 max-md:top-auto max-md:bottom-24 z-[1000] flex flex-col gap-2">
        <div className="relative pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowLayerMenu(v => !v)}
            className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors flex items-center gap-1.5 px-3"
            title="Map Layers"
          >
            <Layers className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase">{mapLayer}</span>
          </button>
          <AnimatePresence>
            {showLayerMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border/60 bg-surface/95 glass-strong p-2 shadow-2xl backdrop-blur-md"
              >
                <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Base Layer</p>
                {(["standard", "satellite", "hybrid"] as const).map(l => (
                  <button
                    key={l}
                    onClick={() => { setMapLayer(l); setShowLayerMenu(false); }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors ${mapLayer === l ? "bg-primary/10 text-primary font-bold" : "hover:bg-secondary/50"}`}
                  >
                    {l === "standard" ? <MapPin className="h-3 w-3" /> : <Layers className="h-3 w-3" />}
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
                <div className="mt-2 border-t border-border/40 pt-2">
                  <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Overlays</p>
                  <button
                    onClick={() => setShowLandmarks(v => !v)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs hover:bg-secondary/50"
                  >
                    <span className="flex items-center gap-2"><MapPin className="h-3 w-3 text-indigo-500" /> Landmarks</span>
                    <span className={`h-3 w-3 rounded-full ${showLandmarks ? "bg-primary" : "bg-secondary"}`} />
                  </button>
                  <button
                    onClick={() => setShowIncidents(v => !v)}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-xs hover:bg-secondary/50"
                  >
                    <span className="flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-destructive" /> Incidents</span>
                    <span className={`h-3 w-3 rounded-full ${showIncidents ? "bg-primary" : "bg-secondary"}`} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom-left: Legend */}
      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-lg bg-surface/90 glass-strong border border-border/40 p-3 shadow-lg">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Legend</p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px]">
            <div className="h-3 w-3 rounded-full border-2 border-white" style={{ background: "#7c3aed" }} />
            <span>Critical {priorityCounts.CRITICAL > 0 && `(${priorityCounts.CRITICAL})`}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="h-3 w-3 rounded-full border-2 border-white" style={{ background: "#ef4444" }} />
            <span>High {priorityCounts.HIGH > 0 && `(${priorityCounts.HIGH})`}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="h-3 w-3 rounded-full border-2 border-white" style={{ background: "#f59e0b" }} />
            <span>Medium {priorityCounts.MEDIUM > 0 && `(${priorityCounts.MEDIUM})`}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="h-3 w-3 rounded-full border-2 border-white" style={{ background: "#10b981" }} />
            <span>Low {priorityCounts.LOW > 0 && `(${priorityCounts.LOW})`}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <div className="h-3 w-3 rounded-full border-2 border-white" style={{ background: "#6366f1" }} />
            <span>Landmark</span>
          </div>
        </div>
      </div>

      {/* Institution label in fullscreen */}
      {isFullscreen && institutionName && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] rounded-full border border-primary/30 bg-surface/90 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary glass-strong shadow-lg">
          {institutionName}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Normal (inline) container */}
      <div className="relative w-full h-full rounded-2xl border border-border/60 overflow-hidden bg-background/50">
        {/* Slot where the map canvas lives when NOT fullscreen */}
        <div ref={inlineSlotRef} className="absolute inset-0 z-0">
          {/* Map canvas starts here; moved into portal on fullscreen */}
          <div ref={mapContainerRef} className="absolute inset-0" />
        </div>
        {Controls}
      </div>

      {/* Fullscreen portal – controls rendered via React portal into the body-level div */}
      {isFullscreen && portalRef.current && createPortal(
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="pointer-events-auto">{Controls}</div>
        </div>,
        portalRef.current
      )}
    </>
  );
}
