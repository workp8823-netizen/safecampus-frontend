import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, MapPin, Navigation } from "lucide-react";
import type { ViewerLandmark } from "./CampusViewer";

interface LocationPickerProps {
  boundary: [number, number][];
  landmarks: ViewerLandmark[];
  center: { lat: number; lng: number };
  institutionName: string;
  initialLocation?: { lat: number; lng: number, name?: string } | null;
  onLocationSelected: (loc: { lat: number; lng: number; name: string }) => void;
}

export function LocationPickerMap({
  boundary,
  landmarks,
  center,
  institutionName,
  initialLocation,
  onLocationSelected
}: LocationPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedLat, setSelectedLat] = useState<number | null>(initialLocation?.lat || null);
  const [selectedLng, setSelectedLng] = useState<number | null>(initialLocation?.lng || null);
  const [selectedName, setSelectedName] = useState<string>(initialLocation?.name || "");
  const markerRef = useRef<L.Marker | null>(null);
  const landmarksRef = useRef<L.LayerGroup | null>(null);
  const userLocRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      { maxZoom: 20 }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    landmarksRef.current = L.layerGroup().addTo(map);

    // Initial pin
    if (initialLocation?.lat && initialLocation?.lng) {
      updatePin(initialLocation.lat, initialLocation.lng, initialLocation.name || 'Selected Location');
      map.setView([initialLocation.lat, initialLocation.lng], 16);
    } else if (center) {
      map.setView([center.lat, center.lng], 15);
    }

    // Click map to drop pin
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      // Reverse geocode or just set "Custom Pin"
      updatePin(lat, lng, 'Pinned Location');
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const updatePin = (lat: number, lng: number, name: string) => {
    if (!mapRef.current) return;
    
    if (markerRef.current) {
      mapRef.current.removeLayer(markerRef.current);
    }

    const pinHtml = `<div class="relative flex items-center justify-center w-8 h-8 -mt-4 -ml-4">
      <div class="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
      <div class="relative z-10 flex items-center justify-center w-6 h-6 bg-primary text-white rounded-full shadow-lg border-2 border-white">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    </div>`;

    const icon = L.divIcon({
      html: pinHtml,
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    markerRef.current = L.marker([lat, lng], { icon }).addTo(mapRef.current);
    
    setSelectedLat(lat);
    setSelectedLng(lng);
    setSelectedName(name);
    onLocationSelected({ lat, lng, name });
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Boundary
    map.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        map.removeLayer(layer);
      }
    });

    if (boundary && boundary.length > 2) {
      const validBoundary = boundary.filter((pt) => pt && pt.length === 2 && !isNaN(pt[0]) && !isNaN(pt[1])) as [number, number][];
      if (validBoundary.length > 2) {
        const polygon = L.polygon(validBoundary, {
          color: "#3b82f6",
          weight: 2,
          opacity: 0.8,
          fillColor: "#3b82f6",
          fillOpacity: 0.05,
          dashArray: "5, 10",
        }).addTo(map);

        if (!initialLocation && validBoundary.length > 0) {
          map.fitBounds(polygon.getBounds(), { padding: [20, 20], maxZoom: 16 });
        }
      }
    }
  }, [boundary, initialLocation]);

  useEffect(() => {
    if (!landmarksRef.current) return;
    const group = landmarksRef.current;
    group.clearLayers();

    if (landmarks && landmarks.length > 0) {
      landmarks.forEach((lm) => {
        const iconHtml = `<div class="flex items-center justify-center w-6 h-6 bg-secondary text-primary rounded-full shadow border border-border cursor-pointer hover:bg-primary hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>`;

        const icon = L.divIcon({
          html: iconHtml,
          className: "",
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });

        const marker = L.marker([lm.lat, lm.lng], { icon }).addTo(group);
        marker.bindTooltip(lm.label, { direction: "top", offset: [0, -20] });
        
        // When clicking a landmark, set it as the pin
        marker.on('click', () => {
           updatePin(lm.lat, lm.lng, lm.label);
        });
      });
    }
  }, [landmarks]);

  const recenter = () => {
    if (mapRef.current && center) {
      mapRef.current.setView([center.lat, center.lng], 15);
    }
  };

  const locateMe = () => {
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
      
      // Auto-pin their location
      updatePin(e.latlng.lat, e.latlng.lng, "My Location");
    });
  };

  return (
    <div className="relative w-full h-[300px] sm:h-[400px] rounded-2xl overflow-hidden border border-border shadow-sm">
      <div ref={containerRef} className="absolute inset-0 bg-secondary/20 z-0" />
      
      <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2">
        <button
          type="button"
          onClick={locateMe}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface/90 backdrop-blur border border-border/50 text-foreground shadow-sm hover:bg-secondary transition-colors"
          title="My Location"
        >
          <LocateFixed className="h-5 w-5 text-primary" />
        </button>
        <button
          type="button"
          onClick={recenter}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface/90 backdrop-blur border border-border/50 text-foreground shadow-sm hover:bg-secondary transition-colors"
          title="Recenter Map"
        >
          <Navigation className="h-5 w-5" />
        </button>
      </div>

      {selectedLat && selectedLng && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[400]">
          <div className="bg-surface/90 backdrop-blur-md border border-primary/30 shadow-lg rounded-2xl p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-[150px]">
              <div className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Selected Location</div>
              <div className="text-sm font-medium line-clamp-1">{selectedName}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
