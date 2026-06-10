import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Building, Mail, Lock, ArrowRight, Loader2, CheckCircle2, ArrowLeft, Search, Sparkles, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import "leaflet/dist/leaflet.css";
import { useInstitutionSearch } from "@/hooks/useInstitutionSearch";
import { CampusEditor } from "@/components/CampusEditor";

export default function OnboardInstitution() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    institutionName: "",
    domain: "",
    adminEmail: "",
    adminPassword: "",
    firstName: "",
    lastName: "",
    center: { lat: 5.6507, lng: -0.1870 },
    boundary: [] as any[],
    landmarks: [] as { label: string, zone: string, type: string, lat: number, lng: number }[],
    originalSearchBoundary: [] as any[], // For reset
    originalSearchLandmarks: [] as any[], // For reset
  });

  const [searchDebounce, setSearchDebounce] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { query, setQuery, results, setResults, searching, loadingDetails, search, resolveInstitution } = useInstitutionSearch();

  const handleSearchInput = useCallback((val: string) => {
    setQuery(val);
    if (searchDebounce) clearTimeout(searchDebounce);
    const t = setTimeout(() => {
      search(val);
    }, 450);
    setSearchDebounce(t);
  }, [searchDebounce, search, setQuery]);

  const isValidDomain = (d: string) => {
    return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(d);
  };

  const handleSelectResult = useCallback(async (result: any) => {
    setResults([]);
    setQuery(result.display_name.split(",")[0]);
    const resolved = await resolveInstitution(result);
    
    // Intelligent Domain Extraction (Official Only)
    let finalDomain = "";
    if (resolved.website) {
      try {
        const url = new URL(resolved.website);
        finalDomain = url.hostname.replace('www.', '');
      } catch {
        finalDomain = "";
      }
    }

    setFormData(prev => {
      const newState = {
        ...prev,
        institutionName: result.display_name.split(",")[0],
        domain: finalDomain,
        center: { lat: resolved.lat, lng: resolved.lng },
        boundary: resolved.boundary,
        landmarks: resolved.landmarks,
        originalSearchBoundary: [...resolved.boundary],
        originalSearchLandmarks: [...resolved.landmarks],
      };
      return newState;
    });
  }, [resolveInstitution, setResults, setQuery]);



  const handleMapUpdate = useCallback((boundary: [number, number][], landmarks: any[]) => {
    setFormData(prev => ({ ...prev, boundary, landmarks }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Create Institution with Geospatial Data
      const instRes = await apiRequest('/institutions', {
        method: 'POST',
        data: {
          name: formData.institutionName,
          domain: formData.domain,
          center_lat: formData.center.lat,
          center_lng: formData.center.lng,
          boundary: formData.boundary,
          hotspots: formData.landmarks.map(l => ({
            label: l.label,
            zone: l.zone,
            lat: l.lat,
            lng: l.lng,
            intensity: 'landmark',
            count: 0,
            types: l.type
          })),
          density: 'Standard'
        }
      });

      // 2. Create Admin Account
      await apiRequest('/auth/register', {
        method: 'POST',
        data: {
          email: formData.adminEmail,
          password: formData.adminPassword,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: 'SCHOOL_ADMIN',
          institutionId: instRes.id
        }
      });

      setStep(4);
    } catch (error) {
      console.error('Onboarding failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute left-1/2 top-1/2 -z-10 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative w-full overflow-hidden rounded-3xl border border-border/50 glass-strong shadow-2xl transition-all duration-500 ${step === 2 ? 'max-w-4xl' : 'max-w-lg'}`}
      >
        {step === 1 || step === 4 ? (
          <Link to="/" className="absolute left-8 top-8 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group z-20">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            Home
          </Link>
        ) : (
          <button type="button" onClick={() => setStep(step - 1)} className="absolute left-8 top-8 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group z-20">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
            Back
          </button>
        )}
        <div className={`${step === 2 ? 'p-4 sm:p-8' : 'p-8 sm:p-10'}`}>
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Onboard Institution</h1>
            <p className="mt-2 text-sm text-muted-foreground">Register your campus safety network</p>
            
            {/* Step Indicator */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${step === i ? 'w-8 bg-primary' : 'w-2 bg-primary/20'}`} />
              ))}
            </div>
          </div>

          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="space-y-4">
                {/* Smart Search */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Search your institution
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    {(searching || loadingDetails) && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />}
                    <input
                      type="text"
                      placeholder="e.g. University of Ghana, Legon"
                      className="w-full rounded-xl border border-primary/40 bg-primary/5 py-3 pl-10 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={query}
                      onChange={e => handleSearchInput(e.target.value)}
                    />
                  </div>
                  {/* Results dropdown */}
                  <AnimatePresence>
                    {results.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="rounded-xl border border-border/60 bg-surface shadow-xl overflow-hidden"
                      >
                        {results.map(r => (
                          <button
                            key={r.osm_id}
                            type="button"
                            onClick={() => handleSelectResult(r)}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-primary/10 transition-colors border-b border-border/40 last:border-0"
                          >
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div>
                              <div className="text-sm font-medium">{r.display_name.split(",")[0]}</div>
                              <div className="text-[11px] text-muted-foreground line-clamp-1">{r.display_name}</div>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">or fill manually</span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Institution Name</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="e.g. University of Ghana"
                      className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formData.institutionName}
                      onChange={e => setFormData({ ...formData, institutionName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Institutional Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. ug.edu.gh"
                    className={`w-full rounded-xl border bg-background/50 py-3 px-4 text-sm focus:outline-none focus:ring-2 ${
                      formData.domain && !isValidDomain(formData.domain) 
                        ? 'border-destructive/50 focus:border-destructive focus:ring-destructive/20' 
                        : 'border-border focus:border-primary focus:ring-primary/20'
                    }`}
                    value={formData.domain}
                    onChange={e => setFormData({ ...formData, domain: e.target.value })}
                  />
                  {formData.domain && !isValidDomain(formData.domain) && (
                    <p className="text-[10px] text-destructive font-medium px-1">Please enter a valid domain (e.g. institution.edu)</p>
                  )}
                </div>
                <Button className="w-full py-6 rounded-xl" variant="hero"
                  disabled={!formData.institutionName || !formData.domain || !isValidDomain(formData.domain) || loadingDetails}
                  onClick={() => setStep(2)}
                >
                  {loadingDetails ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching campus data...</> : <>Next Step: Campus Mapping <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <CampusEditor
                initialBoundary={formData.boundary}
                initialLandmarks={formData.landmarks}
                center={formData.center}
                institutionName={formData.institutionName}
                onUpdate={handleMapUpdate}
              />
              
              <div className="mt-6 flex gap-3">
                <Button className="flex-1 py-6 rounded-xl" variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button className="flex-[2] py-6 rounded-xl" variant="hero" onClick={() => setStep(3)} disabled={formData.boundary.length < 3 || formData.landmarks.length === 0}>
                  Next Step: Admin Details <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.form initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">First Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Admin First Name"
                      className="w-full rounded-xl border border-border bg-background/50 py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formData.firstName}
                      onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Admin Last Name"
                      className="w-full rounded-xl border border-border bg-background/50 py-3 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formData.lastName}
                      onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="email"
                      required
                      className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formData.adminEmail}
                      onChange={e => setFormData({ ...formData, adminEmail: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      required
                      className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formData.adminPassword}
                      onChange={e => setFormData({ ...formData, adminPassword: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 py-6 rounded-xl" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" className="flex-[2] py-6 rounded-xl" variant="hero" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Complete Onboarding"}
                  </Button>
                </div>
              </div>
            </motion.form>
          )}

          {step === 4 && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary ring-4 ring-primary/10">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold">Registration Successful!</h2>
              <p className="mt-2 text-muted-foreground">Your institution has been onboarded. You can now log in to manage your campus.</p>
              <Button asChild className="mt-8 w-full py-6 rounded-xl" variant="hero">
                <Link to="/login">Go to Login</Link>
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
