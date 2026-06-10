import { useEffect, useRef } from "react";
import L from "leaflet";

export type Hotspot = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  zone: string;
  count: number;
  intensity: "high" | "medium" | "low" | "landmark";
  lastIncident: string;
  types: string[];
};

type Props = {
  hotspots: Hotspot[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showHeatmap: boolean;
  showMarkers: boolean;
  showZones: boolean;
  showLandmarks: boolean;
  center?: [number, number];
  zoom?: number;
  boundary?: [number, number][];
  institutionName?: string;
};

const intensityHex: Record<Hotspot["intensity"], string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#10b981",
  landmark: "#6366f1",
};

// University of Ghana, Legon — central campus coordinates
const UG_CENTER: [number, number] = [5.6508, -0.1869];

function buildIcon(intensity: Hotspot["intensity"], size: number, selected: boolean) {
  const color = intensityHex[intensity];
  const ring = selected ? `box-shadow:0 0 0 4px ${color}55, 0 0 24px ${color}aa;` : `box-shadow:0 0 0 3px ${color}33;`;
  return L.divIcon({
    className: "campus-marker",
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <div style="position:absolute;inset:-6px;border-radius:9999px;background:${color};opacity:.25;animation:pulse-ring 2s ease-out infinite;"></div>
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;background:${color};${ring}display:flex;align-items:center;justify-content:center;border:2px solid #fff;">
        <div style="width:6px;height:6px;border-radius:9999px;background:#fff;"></div>
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function CampusMap({
  hotspots,
  selectedId,
  onSelect,
  showHeatmap,
  showMarkers,
  showZones,
  showLandmarks,
  center = UG_CENTER,
  zoom = 16,
  boundary,
  institutionName,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const heatLayerRef = useRef<L.LayerGroup | null>(null);
  const zonesLayerRef = useRef<L.LayerGroup | null>(null);
  const userLocationRef = useRef<L.Marker | null>(null);
  const boundaryFittedRef = useRef<boolean>(false); // Track if we've fitted to institution boundary yet

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false,
      attributionControl: true,
    });

    // Carto Voyager tiles — much better visibility for campus features
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
        keepBuffer: 4,
        updateWhenZooming: false,
      },
    ).addTo(map);

    // Fix for map not loading fully (gray squares issue) and responsive resize
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    // Campus boundary marker (label)
    if (institutionName) {
      L.marker(center, {
        icon: L.divIcon({
          className: "",
          html: `<div style="background:rgba(15,23,42,.85);border:1px solid rgba(16,185,129,.4);color:#10b981;padding:4px 10px;border-radius:9999px;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;font-family:'JetBrains Mono',monospace;">${institutionName}</div>`,
          iconSize: [220, 24],
          iconAnchor: [110, 12],
        }),
        interactive: false,
      }).addTo(map);
    }

    map.on("click", () => onSelect(null));

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When boundary arrives (async from cookie/API), always fit map to it
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !boundary || boundary.length < 3) return;
    if (boundaryFittedRef.current) return; // Only auto-fit on first load
    
    try {
      const parsed = typeof boundary === 'string' ? JSON.parse(boundary) : boundary;
      const valid = parsed.filter((pt: any) =>
        Array.isArray(pt) && pt.length === 2 &&
        typeof pt[0] === 'number' && !isNaN(pt[0]) &&
        typeof pt[1] === 'number' && !isNaN(pt[1])
      );
      if (valid.length >= 3) {
        map.fitBounds(valid as L.LatLngBoundsExpression, { padding: [30, 30], animate: false });
        boundaryFittedRef.current = true;
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [boundary]);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // clear existing
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    if (!showMarkers) return;

    hotspots.filter(h => h.intensity !== 'landmark' || showLandmarks).forEach((h) => {
      const size = h.intensity === "high" ? 22 : h.intensity === "medium" ? 18 : 16;
      const marker = L.marker([h.lat, h.lng], {
        icon: buildIcon(h.intensity, size, selectedId === h.id),
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Inter,sans-serif;min-width:200px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:${intensityHex[h.intensity]};font-weight:700;">${h.intensity} density</div>
            <div style="font-size:14px;font-weight:600;color:#0f172a;margin-top:2px;">${h.label}</div>
            <div style="font-size:11px;color:#64748b;margin-top:1px;">${h.zone}</div>
            <div style="display:flex;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;">
              <span style="font-size:11px;color:#64748b;">Incidents</span>
              <span style="font-size:13px;font-weight:700;color:#0f172a;">${h.count}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-top:4px;">
              <span style="font-size:11px;color:#64748b;">Last</span>
              <span style="font-size:11px;color:#0f172a;">${h.lastIncident}</span>
            </div>
          </div>`,
          { closeButton: false, className: "campus-popup" },
        );

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onSelect(h.id);
      });

      markersRef.current[h.id] = marker;
    });
  }, [hotspots, showMarkers, showLandmarks, selectedId, onSelect]);

  // heatmap (concentric circles to simulate density)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (heatLayerRef.current) {
      heatLayerRef.current.remove();
      heatLayerRef.current = null;
    }

    if (!showHeatmap) return;

    const layer = L.layerGroup();
    hotspots.filter(h => h.intensity !== 'landmark' || showLandmarks).forEach((h) => {
      const baseRadius = 60 + h.count * 8;
      const color = intensityHex[h.intensity];
      [
        { r: baseRadius * 2.2, op: 0.05 },
        { r: baseRadius * 1.5, op: 0.1 },
        { r: baseRadius, op: 0.18 },
        { r: baseRadius * 0.55, op: 0.28 },
      ].forEach(({ r, op }) => {
        L.circle([h.lat, h.lng], {
          radius: r,
          color: color,
          fillColor: color,
          fillOpacity: op,
          weight: 0,
          interactive: false,
        }).addTo(layer);
      });
    });
    layer.addTo(map);
    heatLayerRef.current = layer;
  }, [hotspots, showHeatmap, showLandmarks]);

  // zones (rough campus polygon overlay)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (zonesLayerRef.current) {
      zonesLayerRef.current.remove();
      zonesLayerRef.current = null;
    }

    if (!showZones) return;

    const layer = L.layerGroup();

    // Use institution boundary if provided
    const parsedBoundary = typeof boundary === 'string' ? JSON.parse(boundary) : boundary;
    const rawBoundary = (Array.isArray(parsedBoundary) && parsedBoundary.length >= 3) ? parsedBoundary : [];

    // Final safety check: filter out any malformed coordinates
    const sanitizedBoundary = rawBoundary.filter(pt => 
      Array.isArray(pt) && pt.length === 2 && 
      typeof pt[0] === 'number' && !isNaN(pt[0]) &&
      typeof pt[1] === 'number' && !isNaN(pt[1])
    );

    if (sanitizedBoundary.length >= 3) {
      L.polygon(sanitizedBoundary as L.LatLngTuple[], {
        color: "#059669", // Emerald 600
        weight: 2,
        fillColor: "#10b981",
        fillOpacity: 0.1,
        dashArray: "8 6",
        interactive: false,
      }).addTo(layer);

      // Auto-fit boundary on load or boundary change
      map.fitBounds(sanitizedBoundary as any, { padding: [20, 20], animate: true });
    }
    
    layer.addTo(map);
    zonesLayerRef.current = layer;
  }, [showZones, boundary, hotspots]); // Added hotspots to ensure re-sync if data loads late

  // pan to selected
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const h = hotspots.find((x) => x.id === selectedId);
    if (!h) return;
    map.flyTo([h.lat, h.lng], 17, { duration: 0.8 });
    const marker = markersRef.current[h.id];
    if (marker) marker.openPopup();
  }, [selectedId, hotspots]);

  // expose locate for parent via window event
  useEffect(() => {
    const handler = () => {
      const map = mapRef.current;
      if (!map) return;
      map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
      map.once("locationfound", (e: L.LocationEvent) => {
        if (userLocationRef.current) userLocationRef.current.remove();
        userLocationRef.current = L.marker(e.latlng, {
          icon: L.divIcon({
            className: "",
            html: `<div style="position:relative;width:18px;height:18px;">
              <div style="position:absolute;inset:-8px;border-radius:9999px;background:#3b82f6;opacity:.3;animation:pulse-ring 2s ease-out infinite;"></div>
              <div style="position:relative;width:18px;height:18px;border-radius:9999px;background:#3b82f6;border:3px solid #fff;box-shadow:0 0 12px rgba(59,130,246,.6);"></div>
            </div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        })
          .addTo(map)
          .bindPopup("You are here");
      });
      map.once("locationerror", () => {
        // fallback: center on institution campus
        map.flyTo(center, zoom);
      });
    };
    window.addEventListener("safecampus:locate", handler);
    return () => window.removeEventListener("safecampus:locate", handler);
  }, []);

  // reset view
  useEffect(() => {
    const handler = () => {
      const map = mapRef.current;
      if (!map) return;
      
      if (boundary && boundary.length >= 3) {
        map.fitBounds(boundary as any, { padding: [20, 20], animate: true, duration: 0.8 });
      } else {
        map.setView(center, zoom, { animate: true });
      }
    };
    window.addEventListener("safecampus:reset", handler);
    return () => window.removeEventListener("safecampus:reset", handler);
  }, []);

  // zoom controls
  useEffect(() => {
    const zoomIn = () => mapRef.current?.zoomIn();
    const zoomOut = () => mapRef.current?.zoomOut();
    window.addEventListener("safecampus:zoom-in", zoomIn);
    window.addEventListener("safecampus:zoom-out", zoomOut);
    return () => {
      window.removeEventListener("safecampus:zoom-in", zoomIn);
      window.removeEventListener("safecampus:zoom-out", zoomOut);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
}
