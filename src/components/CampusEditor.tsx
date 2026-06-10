import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  Maximize, 
  Minimize, 
  Plus, 
  RotateCcw, 
  Trash2, 
  Undo2, 
  X,
  Minus,
  Check,
  MousePointer2,
  MapPin,
  Building,
  Navigation,
  Wand,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstitutionSearch } from "@/hooks/useInstitutionSearch";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Landmark {
  label: string;
  zone: string;
  type: string;
  lat: number;
  lng: number;
}

interface CampusEditorProps {
  initialBoundary: [number, number][];
  initialLandmarks: Landmark[];
  center: { lat: number, lng: number };
  onUpdate: (boundary: [number, number][], landmarks: Landmark[]) => void;
  institutionName: string;
}

export function CampusEditor({ 
  initialBoundary, 
  initialLandmarks, 
  center, 
  onUpdate,
  institutionName 
}: CampusEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const inlineSlotRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polyRef = useRef<L.Polygon | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const landmarkMarkersRef = useRef<L.Marker[]>([]);
  const tempLandmarkRef = useRef<L.Marker | null>(null);
  const historyRef = useRef<[number, number][][]>([]);

  const [boundary, setBoundary] = useState<[number, number][]>(initialBoundary);
  const [landmarks, setLandmarks] = useState<Landmark[]>(initialLandmarks);
  
  // Prop sync - absorb initial data cleanly, ensuring it overwrites if an actual change happens 
  // (e.g. searching a new university or auto-fetching overpass data)
  useEffect(() => {
    // We only update if the lengths change drastically (meaning a totally new dataset arrived)
    // For small manual additions via the editor, we ignore the prop sync
    if (initialBoundary.length > 0 && initialBoundary.length !== boundary.length && boundary.length === 0) {
      setBoundary(initialBoundary);
    }
  }, [initialBoundary, boundary.length]);

  useEffect(() => {
    if (initialLandmarks.length > 0 && initialLandmarks.length !== landmarks.length && landmarks.length === 0) {
      setLandmarks(initialLandmarks);
    }
  }, [initialLandmarks, landmarks.length]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite' | 'hybrid'>('standard');
  const [isAddingLandmark, setIsAddingLandmark] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editingLandmarkIdx, setEditingLandmarkIdx] = useState<number | null>(null);
  
  useBodyScrollLock(showResetModal);
  const [mapReady, setMapReady] = useState(false);
  const [landmarkInput, setLandmarkInput] = useState<Landmark>({ 
    label: "", 
    zone: "", 
    type: "Academic", 
    lat: 0, 
    lng: 0 
  });

  const { search, resolveInstitution, loadingDetails } = useInstitutionSearch();

  // ─── Create portal container once ────────────────────────────────────────
  useEffect(() => {
    const el = document.createElement("div");
    el.id = "campus-editor-fullscreen-portal";
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

  // Cleanup body overflow on unmount
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

  // ─── Fullscreen toggle – move DOM node into/out of portal ─────────────────
  const toggleFullscreen = useCallback(() => {
    const portal = portalRef.current;
    const mapEl = mapContainerRef.current;
    const map = mapRef.current;
    if (!portal || !mapEl || !map) return;

    if (!isFullscreen) {
      portal.style.display = "block";
      portal.appendChild(mapEl);
      document.body.style.overflow = "hidden";
      setIsFullscreen(true);
      requestAnimationFrame(() => map.invalidateSize());
    } else {
      if (inlineSlotRef.current) inlineSlotRef.current.appendChild(mapEl);
      portal.style.display = "none";
      document.body.style.overflow = "";
      setIsFullscreen(false);
      requestAnimationFrame(() => map.invalidateSize());
    }
  }, [isFullscreen]);

  const handleAutoReset = async () => {
    if (!institutionName) return;
    try {
      const results = await search(institutionName);
      if (results && results.length > 0) {
        const resolved = await resolveInstitution(results[0]);
        if (resolved.boundary && resolved.boundary.length >= 3) {
          setBoundary(resolved.boundary);
          setLandmarks(resolved.landmarks);
          
          // Clear current markers and poly
          markersRef.current.forEach(m => m.remove());
          markersRef.current = [];
          
          // Re-create markers from resolved boundary
          if (mapRef.current) {
            resolved.boundary.forEach(pt => createMarker(pt[0], pt[1], mapRef.current!));
            mapRef.current.fitBounds(resolved.boundary as any, { padding: [40, 40] });
          }
        }
      }
    } catch (e) {
      console.error("Auto reset failed:", e);
    }
  };

  const handleDefaultReset = () => {
    setShowResetModal(true);
  };

  const confirmReset = () => {
    setBoundary(initialBoundary);
    setLandmarks(initialLandmarks);
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (mapRef.current) {
      if (initialBoundary.length >= 3) {
        initialBoundary.forEach(pt => createMarker(pt[0], pt[1], mapRef.current!));
        mapRef.current.fitBounds(initialBoundary as any, { padding: [40, 40] });
      }
    }
    setShowResetModal(false);
  };

  const isAddingLandmarkRef = useRef(false);
  const editingLandmarkIdxRef = useRef<number | null>(null);

  useEffect(() => {
    isAddingLandmarkRef.current = isAddingLandmark;
    editingLandmarkIdxRef.current = editingLandmarkIdx;
  }, [isAddingLandmark, editingLandmarkIdx]);

  // Sync state to parent
  useEffect(() => {
    onUpdate(boundary, landmarks);
  }, [boundary, landmarks, onUpdate]);

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [center.lat, center.lng],
      zoom: 16,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const layers: any = {
      standard: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      hybrid: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png')
      ])
    };

    const currentLayer = layers[mapLayer] || layers.standard;
    currentLayer.addTo(map);
    (map as any)._activeLayer = currentLayer;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    const poly = L.polygon([], {
      color: '#10b981',
      fillColor: '#10b981',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '6, 4'
    }).addTo(map);

    polyRef.current = poly;
    mapRef.current = map;
    setMapReady(true);

    // Load initial state
    if (initialBoundary.length >= 3) {
      poly.setLatLngs(initialBoundary);
      map.fitBounds(initialBoundary as any, { padding: [40, 40] });
      initialBoundary.forEach(pt => createMarker(pt[0], pt[1], map, true));
    }

    // Load initial landmarks will be handled by the landmarks sync effect

    map.on('click', (e) => {
      if (isAddingLandmarkRef.current || editingLandmarkIdxRef.current !== null) {
        const { lat, lng } = e.latlng;
        setLandmarkInput(prev => ({ ...prev, lat, lng }));

        if (editingLandmarkIdxRef.current !== null) {
          landmarkMarkersRef.current[editingLandmarkIdxRef.current]?.setLatLng(e.latlng);
        }

        if (tempLandmarkRef.current) {
          tempLandmarkRef.current.setLatLng(e.latlng);
        } else if (editingLandmarkIdxRef.current === null) {
          tempLandmarkRef.current = L.marker(e.latlng, {
            icon: L.divIcon({
              className: 'temp-landmark',
              html: `<div style="width:20px;height:20px;background:#f59e0b;border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px rgba(245,158,11,0.5);animation:pulse 2s infinite;"></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
          }).addTo(map);
        }
        return;
      }

      historyRef.current.push(markersRef.current.map(m => [m.getLatLng().lat, m.getLatLng().lng]));
      createMarker(e.latlng.lat, e.latlng.lng, map);
    });

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
      markersRef.current = [];
      landmarkMarkersRef.current = [];
      polyRef.current = null;
    };
  }, []);

  const updatePolygon = (updateState = true) => {
    if (!polyRef.current) return;
    const latlngs = markersRef.current.map(m => m.getLatLng());
    polyRef.current.setLatLngs(latlngs);
    if (updateState) {
      skipNextMapUpdate.current = true;
      setBoundary(latlngs.map(ll => [ll.lat, ll.lng]));
    }
  };

  const createMarker = (lat: number, lng: number, map: L.Map, skipUpdate = false) => {
    const marker = L.marker([lat, lng], {
      draggable: true,
      icon: L.divIcon({
        className: 'custom-boundary-marker',
        html: `<div class="marker-dot"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
    }).addTo(map);

    marker.on('drag', () => updatePolygon(false)); // Visual update only
    marker.on('dragstart', () => {
      map.dragging.disable();
      historyRef.current.push(markersRef.current.map(m => [m.getLatLng().lat, m.getLatLng().lng]));
    });
    marker.on('dragend', () => {
      map.dragging.enable();
      updatePolygon(true); // Final state update
    });

    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      const popupContent = document.createElement('div');
      const btn = document.createElement('button');
      btn.innerHTML = 'Remove Point';
      btn.className = 'bg-destructive text-destructive-foreground text-[10px] font-bold px-3 py-1.5 rounded-lg';
      btn.onclick = () => {
        historyRef.current.push(markersRef.current.map(m => [m.getLatLng().lat, m.getLatLng().lng]));
        marker.remove();
        markersRef.current = markersRef.current.filter(m => m !== marker);
        updatePolygon();
        map.closePopup();
      };
      popupContent.appendChild(btn);
      L.popup().setLatLng(marker.getLatLng()).setContent(popupContent).openOn(map);
    });

    markersRef.current.push(marker);
    if (!skipUpdate) {
      updatePolygon();
    }
    return marker;
  };

  // Sync Boundary State to Map Markers
  const skipNextMapUpdate = useRef(false);
  useEffect(() => {
    if (skipNextMapUpdate.current) {
      skipNextMapUpdate.current = false;
      return;
    }
    const map = mapRef.current;
    if (!map || !polyRef.current) return;

    // Only update if markers count or coordinates differ significantly
    const currentMarkerLatLngs = markersRef.current.map(m => m.getLatLng());
    const needsUpdate = boundary.length !== markersRef.current.length || 
      boundary.some((pt, i) => {
        const m = currentMarkerLatLngs[i];
        return !m || Math.abs(m.lat - pt[0]) > 0.0001 || Math.abs(m.lng - pt[1]) > 0.0001;
      });

    if (needsUpdate) {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      boundary.forEach(pt => createMarker(pt[0], pt[1], map, true));
      polyRef.current.setLatLngs(boundary);
    }
  }, [boundary]);

  // Update Layer Effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if ((map as any)._activeLayer) map.removeLayer((map as any)._activeLayer);

    const layers: any = {
      standard: L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }),
      hybrid: L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png')
      ])
    };

    const nextLayer = layers[mapLayer] || layers.standard;
    nextLayer.addTo(map);
    (map as any)._activeLayer = nextLayer;
  }, [mapLayer]);

  // Update Layer Effect

  // Sync Landmarks to Map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove markers that are no longer needed
    if (landmarkMarkersRef.current.length > landmarks.length) {
      const toRemove = landmarkMarkersRef.current.splice(landmarks.length);
      toRemove.forEach(m => m.remove());
    }

    // Add or Update markers
    landmarks.forEach((lm, index) => {
      let marker = landmarkMarkersRef.current[index];
      
      if (marker) {
        marker.setLatLng([lm.lat, lm.lng]);
      } else {
        marker = L.marker([lm.lat, lm.lng], {
          draggable: true,
          icon: L.divIcon({
            className: 'landmark-marker-container',
            html: `<div class="landmark-dot">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(map);

        marker.on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng();
          const currentIdx = landmarkMarkersRef.current.indexOf(marker);
          if (currentIdx !== -1) {
            setLandmarks(prev => {
              const next = [...prev];
              next[currentIdx] = { ...next[currentIdx], lat, lng };
              return next;
            });
          }
        });

        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const currentIdx = landmarkMarkersRef.current.indexOf(marker);
          if (currentIdx !== -1) {
            // Need to use the latest state, but we close over landmarks from the effect dependency,
            // which is fine because this effect runs whenever landmarks changes!
            setEditingLandmarkIdx(currentIdx);
            setLandmarkInput(landmarks[currentIdx]);
            setIsAddingLandmark(false);
          }
        });

        landmarkMarkersRef.current.push(marker);
      }
    });
  }, [landmarks, mapReady]);

  const handleUndo = () => {
    if (historyRef.current.length === 0 || !mapRef.current) return;
    const prev = historyRef.current.pop()!;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    const map = mapRef.current;
    prev.forEach(pt => createMarker(pt[0], pt[1], map));
    updatePolygon();
  };

  const clearTempLandmark = () => {
    if (tempLandmarkRef.current) {
      tempLandmarkRef.current.remove();
      tempLandmarkRef.current = null;
    }
  };

  return (
    <>
    <div className="space-y-6">
      <style>{`
        .custom-boundary-marker .marker-dot {
          width: 14px;
          height: 14px;
          background: #fff;
          border: 3px solid #10b981;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .custom-boundary-marker:hover .marker-dot {
          transform: scale(1.3);
          border-width: 4px;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }
        .landmark-dot {
          width: 24px;
          height: 24px;
          background: #6366f1;
          border: 3px solid #fff;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .landmark-marker-container:hover .landmark-dot {
          transform: scale(1.2);
          background: #4f46e5;
          box-shadow: 0 6px 16px rgba(79, 70, 229, 0.5);
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="rounded-2xl border border-border/60 bg-surface/50 p-4">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              {institutionName || "Campus"} Perimeter
            </h3>
            <p className="text-xs text-muted-foreground">Plot boundaries and mark key campus landmarks. ({landmarks.length} landmarks active)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              type="button"
              size="sm" 
              variant={isAddingLandmark ? "hero" : "outline"}
              className="text-[10px] uppercase font-bold tracking-wider"
              onClick={() => {
                const next = !isAddingLandmark;
                setIsAddingLandmark(next);
                setEditingLandmarkIdx(null);
                if (!next) clearTempLandmark();
              }}
            >
              <Plus className="mr-1 h-3 w-3" /> {isAddingLandmark ? "Stop Adding" : "Add Landmark"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="text-[10px] uppercase font-bold tracking-wider" onClick={handleUndo} disabled={historyRef.current.length === 0}>
              <Undo2 className="mr-1 h-3 w-3" /> Undo
            </Button>
            <Button 
              type="button"
              size="sm" 
              variant="outline" 
              className="text-[10px] uppercase font-bold tracking-wider"
              onClick={handleAutoReset}
              disabled={loadingDetails}
            >
              {loadingDetails ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Wand className="mr-1 h-3 w-3" />} Auto-Fetch
            </Button>
            <Button 
              type="button"
              size="sm" 
              variant="outline" 
              className="text-[10px] uppercase font-bold tracking-wider"
              onClick={handleDefaultReset}
            >
              <RotateCcw className="mr-1 h-3 w-3" /> Reset
            </Button>
            <Button 
              type="button"
              size="sm" 
              variant="outline" 
              className="text-[10px] uppercase font-bold tracking-wider hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setBoundary([]);
                setLandmarks([]);
                markersRef.current.forEach(m => m.remove());
                markersRef.current = [];
                landmarkMarkersRef.current.forEach(m => m.remove());
                landmarkMarkersRef.current = [];
                polyRef.current?.setLatLngs([]);
              }}
            >
              <Trash2 className="mr-1 h-3 w-3" /> Clear
            </Button>
          </div>
        </div>

        <div className="relative w-full rounded-xl border border-border/60 bg-background/50 overflow-hidden aspect-video">
          {/* Slot – map canvas lives here when not fullscreen */}
          <div ref={inlineSlotRef} className="absolute inset-0 z-0">
            <div ref={mapContainerRef} className="absolute inset-0" />
          </div>
          
          {/* Editor Overlay Controls */}
          <div className="absolute left-4 top-4 z-[1000] flex flex-col gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors flex items-center justify-center"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
            
            {isFullscreen && (
              <>
                <button
                  onClick={handleUndo}
                  disabled={historyRef.current.length === 0}
                  className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    const next = !isAddingLandmark;
                    setIsAddingLandmark(next);
                    setEditingLandmarkIdx(null);
                    if (!next) clearTempLandmark();
                  }}
                  className={`p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors ${isAddingLandmark ? 'text-primary ring-2 ring-primary/20' : ''}`}
                  title="Add Landmarks"
                >
                  <MapPin className="h-4 w-4" />
                </button>
                <button
                  onClick={handleAutoReset}
                  disabled={loadingDetails}
                  className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors disabled:opacity-50"
                  title="Auto-fetch Boundary"
                >
                  {loadingDetails ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Wand className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleDefaultReset}
                  className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors"
                  title="Reset to Registration Data"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </>
            )}
          </div>

          <div className="absolute right-4 bottom-4 z-[1000] flex gap-1 p-1 rounded-lg bg-surface/90 glass-strong border border-border/40 shadow-lg">
            {(['standard', 'satellite', 'hybrid'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setMapLayer(l)}
                className={`px-3 py-1.5 text-[9px] uppercase font-bold rounded-md transition-all ${
                  mapLayer === l ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Landmark Form Overlay */}
          <AnimatePresence>
            {(isAddingLandmark || editingLandmarkIdx !== null) && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="absolute right-4 top-4 z-[1000] w-64 rounded-xl border border-border/60 bg-surface/95 glass-strong p-4 shadow-2xl backdrop-blur-md"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                    {editingLandmarkIdx !== null ? "Edit Landmark" : "Add Landmark"}
                  </h4>
                  <button onClick={() => { setIsAddingLandmark(false); setEditingLandmarkIdx(null); clearTempLandmark(); }}>
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Name</label>
                    <input 
                      className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      placeholder="e.g. Science Block"
                      value={landmarkInput.label}
                      onChange={e => setLandmarkInput({ ...landmarkInput, label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">Zone/Area</label>
                    <input 
                      className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      placeholder="e.g. North Campus"
                      value={landmarkInput.zone}
                      onChange={e => setLandmarkInput({ ...landmarkInput, zone: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      className="w-full rounded-lg" variant="hero" size="sm"
                      disabled={!landmarkInput.label || !landmarkInput.lat}
                      onClick={() => {
                        if (editingLandmarkIdx !== null) {
                          setLandmarks(prev => {
                            const next = [...prev];
                            next[editingLandmarkIdx] = landmarkInput;
                            return next;
                          });
                        } else {
                          setLandmarks(prev => [...prev, landmarkInput]);
                        }
                        setIsAddingLandmark(false);
                        setEditingLandmarkIdx(null);
                        clearTempLandmark();
                        setLandmarkInput({ label: "", zone: "", type: "Academic", lat: 0, lng: 0 });
                      }}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Save
                    </Button>
                    {editingLandmarkIdx !== null && (
                      <Button 
                        className="w-full rounded-lg" variant="outline" size="sm"
                        onClick={() => {
                          setLandmarks(prev => prev.filter((_, i) => i !== editingLandmarkIdx));
                          setEditingLandmarkIdx(null);
                          clearTempLandmark();
                        }}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Reset Confirmation Modal */}
          <AnimatePresence>
            {showResetModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[2000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-sm rounded-2xl border border-border/60 bg-surface p-6 shadow-2xl"
                >
                  <h3 className="text-lg font-bold">Confirm Reset</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Are you sure you want to reset to the default registration data? This will overwrite your current map configuration.
                  </p>
                  <div className="mt-6 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowResetModal(false)}>
                      Cancel
                    </Button>
                    <Button type="button" variant="destructive" onClick={confirmReset}>
                      Reset Data
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

    {/* Fullscreen portal – render overlay controls on top of the moved map canvas */}
    {isFullscreen && portalRef.current && createPortal(
      <div className="absolute inset-0 z-[1000] pointer-events-none">
        {/* Left controls */}
        <div className="absolute left-4 top-4 flex flex-col gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors flex items-center justify-center"
            title="Exit Fullscreen"
          >
            <Minimize className="h-4 w-4" />
          </button>
          <button
            onClick={handleUndo}
            disabled={historyRef.current.length === 0}
            className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const next = !isAddingLandmark;
              setIsAddingLandmark(next);
              setEditingLandmarkIdx(null);
              if (!next) clearTempLandmark();
            }}
            className={`p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors ${isAddingLandmark ? 'text-primary ring-2 ring-primary/20' : ''}`}
            title="Add Landmarks"
          >
            <MapPin className="h-4 w-4" />
          </button>
          <button
            onClick={handleAutoReset}
            disabled={loadingDetails}
            className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors disabled:opacity-50"
            title="Auto-fetch Boundary"
          >
            {loadingDetails ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Wand className="h-4 w-4" />}
          </button>
          <button
            onClick={handleDefaultReset}
            className="p-2 bg-surface/90 glass-strong border border-border/40 rounded-lg shadow-lg hover:bg-surface transition-colors"
            title="Reset"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Layer switcher */}
        <div className="absolute right-4 bottom-16 z-[1000] flex gap-1 p-1 rounded-lg bg-surface/90 glass-strong border border-border/40 shadow-lg pointer-events-auto">
          {(['standard', 'satellite', 'hybrid'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setMapLayer(l)}
              className={`px-3 py-1.5 text-[9px] uppercase font-bold rounded-md transition-all ${
                mapLayer === l ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Landmark form overlay */}
        <AnimatePresence>
          {(isAddingLandmark || editingLandmarkIdx !== null) && (
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute right-4 top-4 z-[1000] w-64 rounded-xl border border-border/60 bg-surface/95 glass-strong p-4 shadow-2xl backdrop-blur-md pointer-events-auto"
            >
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">
                  {editingLandmarkIdx !== null ? "Edit Landmark" : "Add Landmark"}
                </h4>
                <button onClick={() => { setIsAddingLandmark(false); setEditingLandmarkIdx(null); clearTempLandmark(); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Name</label>
                  <input
                    className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    placeholder="e.g. Science Block"
                    value={landmarkInput.label}
                    onChange={e => setLandmarkInput({ ...landmarkInput, label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-muted-foreground">Zone/Area</label>
                  <input
                    className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    placeholder="e.g. North Campus"
                    value={landmarkInput.zone}
                    onChange={e => setLandmarkInput({ ...landmarkInput, zone: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="w-full rounded-lg" variant="hero" size="sm"
                    disabled={!landmarkInput.label || !landmarkInput.lat}
                    onClick={() => {
                      if (editingLandmarkIdx !== null) {
                        setLandmarks(prev => {
                          const next = [...prev];
                          next[editingLandmarkIdx] = landmarkInput;
                          return next;
                        });
                      } else {
                        setLandmarks(prev => [...prev, landmarkInput]);
                      }
                      setIsAddingLandmark(false);
                      setEditingLandmarkIdx(null);
                      clearTempLandmark();
                      setLandmarkInput({ label: "", zone: "", type: "Academic", lat: 0, lng: 0 });
                    }}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Save
                  </Button>
                  {editingLandmarkIdx !== null && (
                    <Button
                      className="w-full rounded-lg" variant="outline" size="sm"
                      onClick={() => {
                        setLandmarks(prev => prev.filter((_, i) => i !== editingLandmarkIdx));
                        setEditingLandmarkIdx(null);
                        clearTempLandmark();
                      }}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset modal in fullscreen */}
        <AnimatePresence>
          {showResetModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-[2000] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-sm rounded-2xl border border-border/60 bg-surface p-6 shadow-2xl"
              >
                <h3 className="text-lg font-bold">Confirm Reset</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Are you sure you want to reset to the default registration data?
                </p>
                <div className="mt-6 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowResetModal(false)}>Cancel</Button>
                  <Button type="button" variant="destructive" onClick={confirmReset}>Reset Data</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>,
      portalRef.current
    )}
    </>
  );
}
