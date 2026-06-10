import { useState, useCallback } from "react";
import axios from "axios";

export interface SearchResult {
  osm_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
  // GeoJSON polygon when available
  geojson?: {
    type: string;
    coordinates: any;
  };
  type: string;
  class: string;
  extratags?: {
    website?: string;
    [key: string]: any;
  };
}

export interface LandmarkResult {
  label: string;
  zone: string;
  type: string;
  lat: number;
  lng: number;
}

// Convert OSM geojson polygon/multipolygon to flat [lat, lng][] array
function extractBoundaryPoints(geojson: SearchResult["geojson"]): [number, number][] {
  if (!geojson) return [];
  if (geojson.type === "Polygon") {
    return (geojson.coordinates[0] as [number, number][]).map(([lng, lat]) => [lat, lng]);
  }
  if (geojson.type === "MultiPolygon") {
    // Use the largest ring
    const rings = (geojson.coordinates as [number, number][][][]).map(poly => poly[0]);
    const largest = rings.reduce((a, b) => (b.length > a.length ? b : a), []);
    return largest.map(([lng, lat]) => [lat, lng]);
  }
  return [];
}

// Map OSM amenity/building tags to our landmark types
function osmTagToType(tags: Record<string, string>): string {
  const am = tags.amenity || "";
  const bld = tags.building || "";
  const leisure = tags.leisure || "";

  if (["library"].includes(am)) return "Library";
  if (["dormitory", "residential"].includes(am) || ["dormitory", "residential"].includes(bld) || tags.student_housing) return "Residence";
  if (["dormitory", "house", "apartments"].includes(bld) && tags.name) return "Residence";
  if (["administration", "office"].includes(am) || tags.office || bld === "office") return "Admin";
  if (["sports_centre", "stadium", "pitch"].includes(am) || ["sports_centre", "stadium"].includes(bld) || ["sports_centre", "pitch"].includes(leisure)) return "Recreation";
  if (["hospital", "clinic", "health_centre", "doctors", "pharmacy"].includes(am)) return "Medical";
  if (["police", "security", "guardpost", "emergency_phone"].includes(am)) return "Security";
  if (["hall", "lecture_hall", "theatre", "auditorium"].includes(am) || bld === "hall" || bld === "auditorium") return "Hall";
  if (["bank", "atm", "cafe", "restaurant", "shop"].includes(am)) return "Services";
  if (["university", "college", "school", "classroom"].includes(am) || ["university", "college", "academic", "department"].includes(bld)) return "Academic";
  return "Academic";
}

// Build Overpass QL query for campus landmarks
function buildOverpassQuery(s: number, w: number, n: number, e: number): string {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:30];
(
  node["amenity"~"library|university|college|dormitory|administration|sports_centre|hospital|lecture_hall|theatre|auditorium|bank|cafe|police|security|clinic|pharmacy|fast_food|atm"](${bbox});
  node["building"~"dormitory|university|college|hall|department|office|residential|academic|house|apartments"](${bbox});
  node["leisure"~"sports_centre|stadium|pitch|swimming_pool|track"](${bbox});
  way["amenity"~"library|university|college|dormitory|administration|sports_centre|hospital|lecture_hall|theatre|auditorium|police|security|clinic"](${bbox});
  way["building"~"dormitory|university|college|hall|department|office|academic|residential"](${bbox});
  way["leisure"~"sports_centre|stadium|pitch|swimming_pool"](${bbox});
  relation["amenity"~"university|college|library|hospital"](${bbox});
  relation["building"~"university|college"](${bbox});
);
out center 80;`;
}

export function useInstitutionSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setResults([]); return []; }
    setSearching(true);
    try {
      const url = `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q,
          format: "json",
          addressdetails: "1",
          polygon_geojson: "1",
          limit: "8",
          extratags: "1",
        });
      const { data } = await axios.get<SearchResult[]>(url, {
        headers: { "Accept-Language": "en" }
      });
      setResults(data);
      return data;
    } catch {
      setResults([]);
      return [];
    } finally {
      setSearching(false);
    }
  }, []);

  // Fetch full details including boundary polygon + nearby amenities via Overpass
  const resolveInstitution = useCallback(async (result: SearchResult) => {
    setLoadingDetails(true);
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const bb = result.boundingbox; // [s, n, w, e]

    let boundary = extractBoundaryPoints(result.geojson);

    // If no polygon, fall back to bounding box corners
    if (boundary.length < 3 && bb) {
      const [s, n, w, e] = bb.map(Number);
      boundary = [[n, w], [n, e], [s, e], [s, w]];
    }

    // Fetch POIs inside the bbox via Overpass
    let landmarks: LandmarkResult[] = [];
    try {
      const [s, n, w, e] = (bb || []).map(Number);

      // Guard: ensure all bbox values are present (use isFinite to handle 0-value coords correctly)
      const validBbox = isFinite(s) && isFinite(n) && isFinite(w) && isFinite(e) &&
        bb && bb.length === 4;

      if (validBbox) {
        const overpassQuery = buildOverpassQuery(s, w, n, e);

        const endpoints = [
          "https://overpass-api.de/api/interpreter",
          "https://lz4.overpass-api.de/api/interpreter",
          "https://overpass.kumi.systems/api/interpreter"
        ];

        let ovRes: Response | null = null;
        let successfulEndpoint = "";

        for (const endpoint of endpoints) {
          try {
            // Use POST to avoid URL length limits and browser CORS preflight issues
            ovRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: "data=" + encodeURIComponent(overpassQuery),
            });

            if (ovRes.ok) {
              successfulEndpoint = endpoint;
              break; // Success! Break out of the retry loop
            } else {
              const errText = await ovRes.text().catch(() => "(unreadable)");
              console.warn(`[Overpass] HTTP ${ovRes.status} from ${endpoint}:`, errText.substring(0, 100));
            }
          } catch (fetchErr) {
            console.warn(`[Overpass] Failed to reach ${endpoint}:`, fetchErr);
          }
        }

        if (!ovRes || !ovRes.ok) {
          console.error(`[Overpass] All Overpass endpoints failed or timed out.`);
        } else {
          const ovData = await ovRes.json();
          if (ovData && Array.isArray(ovData.elements)) {
            const raw = (ovData.elements as any[])
              .filter((el: any) => {
                if (!el.tags?.name) return false;
                // Filter out the institution itself (exact name match)
                const name = el.tags.name as string;
                if (name.toLowerCase() === result.display_name.split(",")[0].toLowerCase()) return false;
                // Must have valid coordinates
                const elLat = el.lat ?? el.center?.lat;
                const elLon = el.lon ?? el.center?.lon;
                return isFinite(elLat) && isFinite(elLon);
              });

            // Deduplicate by label (keep first occurrence)
            const seen = new Set<string>();
            landmarks = raw
              .filter((el: any) => {
                const name = (el.tags.name as string).trim();
                if (seen.has(name)) return false;
                seen.add(name);
                return true;
              })
              .slice(0, 50)
              .map((el: any) => ({
                label: (el.tags.name as string).trim(),
                zone: el.tags["addr:street"] || el.tags.description || el.tags["addr:suburb"] || "Campus",
                type: osmTagToType(el.tags),
                lat: el.lat ?? el.center?.lat,
                lng: el.lon ?? el.center?.lon,
              }));

            if (landmarks.length === 0) {
              console.warn(`[Overpass] Zero landmarks returned. Raw elements sample:`, ovData.elements.slice(0, 3));
            }
          } else {
            console.error(`[Overpass] Response missing elements array:`, ovData);
          }
        }
      } else {
        console.warn(`[Overpass] Skipped — invalid bounding box:`, bb);
      }
    } catch (err) {
      console.error(`[Overpass] Landmark fetch failed:`, err);
    } finally {
      setLoadingDetails(false);
    }

    const website = result.extratags?.website || "";
    return { lat, lng, boundary, landmarks, website };
  }, []);

  return { query, setQuery, results, setResults, searching, loadingDetails, search, resolveInstitution };
}
