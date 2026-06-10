import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building, 
  User, 
  Map as MapIcon, 
  Bell, 
  Lock, 
  Save, 
  Globe, 
  Mail, 
  Loader2,
  ChevronRight,
  AlertTriangle,
  EyeOff,
  Trash2,
  Download,
  ExternalLink,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";
import { getCookie, setCookie } from "@/lib/cookies";
import { CampusEditor } from "@/components/CampusEditor";

type Tab = "profile" | "institution" | "campus" | "notifications" | "security";

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || "profile";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwords, setPasswords] = useState({ current: "", new: "" });
  
  const user = getCookie('user');
  
  const [formData, setFormData] = useState(() => {
    let boundary = [];
    try {
      let parsed = user?.institution?.boundary;
      while (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      boundary = parsed || [];
      if (!Array.isArray(boundary)) boundary = [];
    } catch (e) {
      boundary = [];
    }

    return {
      firstName: user?.first_name || user?.firstName || "",
      lastName: user?.last_name || user?.lastName || "",
      email: user?.email || "",
      institutionName: user?.institution?.name || "",
      domain: user?.institution?.domain || "",
      boundary,
      landmarks: [] as any[],
      anonymousReporting: user?.preferences?.privacy?.anonymousReporting ?? true,
      recoveryEmail: user?.recovery_email || "",
    };
  });

  // Simple flag: was the map actually edited by the user since last save/load?
  const [hasMapChanges, setHasMapChanges] = useState(false);
  // Key to force-remount CampusEditor on Discard
  const [mapKey, setMapKey] = useState(0);
  // Saved server values so Discard can restore them
  const [serverBoundary, setServerBoundary] = useState<[number, number][]>(formData.boundary);
  const [serverLandmarks, setServerLandmarks] = useState<any[]>([]);
  // Skip the first onUpdate fired by CampusEditor on mount/remount (not a real user edit)
  const skipNextMapUpdate = useRef(true);

  const profileIsDirty =
    formData.firstName !== (user?.first_name || user?.firstName || '') ||
    formData.lastName !== (user?.last_name || user?.lastName || '') ||
    formData.email !== (user?.email || '') ||
    formData.recoveryEmail !== (user?.recovery_email || '');

  const institutionIsDirty =
    formData.institutionName !== (user?.institution?.name || '') ||
    formData.domain !== (user?.institution?.domain || '');

  const currentTabIsDirty =
    activeTab === 'campus'      ? hasMapChanges :
    activeTab === 'profile'     ? profileIsDirty :
    activeTab === 'institution' ? institutionIsDirty :
    false;

  useEffect(() => {
    const syncProfile = async () => {
      try {
        const fullUser = await apiRequest('/users/profile');
        setCookie('user', fullUser);
        
        let newFormData = { ...formData };
        
        // Sync institution data to form state
        const inst = fullUser.Institution || fullUser.institution;
        if (inst) {
          let boundary = [];
          try {
            let parsed = inst.boundary;
            while (typeof parsed === 'string') {
              parsed = JSON.parse(parsed);
            }
            boundary = parsed || [];
          } catch (e) { boundary = []; }
          
          if (boundary.length > 0) {
            newFormData.boundary = boundary;
          }

          // Fetch Hotspots fresh
          try {
            const rawData = await apiRequest(`/institutions/${inst.id}/hotspots`);
            newFormData.landmarks = Array.isArray(rawData) ? rawData : [];
          } catch (e) {
            console.error("Failed to fetch hotspots:", e);
          }
          
          newFormData.institutionName = inst.name || newFormData.institutionName;
          newFormData.domain = inst.domain || newFormData.domain;
        }
        
        setFormData(newFormData);
        setServerBoundary(newFormData.boundary);
        setServerLandmarks(newFormData.landmarks);
        setHasMapChanges(false); // data just loaded — no unsaved changes
        skipNextMapUpdate.current = true; // Tell handler to ignore the remount initialization
        setMapKey(k => k + 1); // Force remount if already viewing campus tab
      } catch (err) {
        console.error("Failed to sync profile:", err);
      }
    };
    syncProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every time the campus tab is visited, CampusEditor remounts and fires onUpdate once.
  // Mark that call as "initial" so it doesn't trigger hasMapChanges = true.
  useEffect(() => {
    if (activeTab === 'campus') {
      skipNextMapUpdate.current = true;
    }
  }, [activeTab]);

  const handleMapUpdate = useCallback((boundary: [number, number][], landmarks: any[]) => {
    setFormData(prev => ({ ...prev, boundary, landmarks }));
    // The first call after every mount/remount is CampusEditor's own initialisation fire — skip it
    if (skipNextMapUpdate.current) {
      skipNextMapUpdate.current = false;
      return;
    }
    setHasMapChanges(true);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Re-read user from storage to avoid stale closure (syncProfile may have updated it)
      const freshUser = getCookie('user');

      if (activeTab === 'profile') {
        const updatedUser = await apiRequest('/users/profile', {
          method: 'PATCH',
          data: {
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: user?.role === 'SUPER_ADMIN' ? formData.email : undefined,
            // Only send recovery_email if the user explicitly changed it
            ...(formData.recoveryEmail !== (user?.recovery_email || '')
              ? { recovery_email: formData.recoveryEmail }
              : {}),
            preferences: (() => {
              const currentPrefs = typeof freshUser?.preferences === 'string' 
                ? JSON.parse(freshUser.preferences) 
                : (freshUser?.preferences || {});
              return {
                ...currentPrefs,
                privacy: {
                  ...(currentPrefs.privacy || {}),
                  anonymousReporting: formData.anonymousReporting
                }
              };
            })()
          }
        });
        
        const newUser = { 
          ...freshUser, 
          first_name: updatedUser.first_name, 
          last_name: updatedUser.last_name,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          email: updatedUser.email || freshUser?.email,
          recovery_email: updatedUser.recovery_email || freshUser?.recovery_email,
          preferences: updatedUser.preferences
        };
        localStorage.setItem('user', JSON.stringify(newUser));
        window.dispatchEvent(new Event('user-updated'));
        toast.success("Profile updated successfully");
      } 
      else if (activeTab === 'institution' || activeTab === 'campus') {
        const instId = freshUser?.Institution?.id || freshUser?.institution?.id;
        if (!instId) throw new Error("No institution ID found. Please refresh the page and try again.");
        
        await apiRequest(`/institutions/${instId}`, {
          method: 'PATCH',
          data: {
            name: formData.institutionName,
            domain: formData.domain,
            boundary: formData.boundary,
            hotspots: formData.landmarks
          }
        });
        
        const pts = formData.boundary as [number, number][];
        const inst = freshUser?.Institution || freshUser?.institution;
        const centerLat = pts.length >= 3 ? pts.reduce((s, p) => s + p[0], 0) / pts.length : inst?.center_lat;
        const centerLng = pts.length >= 3 ? pts.reduce((s, p) => s + p[1], 0) / pts.length : inst?.center_lng;

        const newUser = { 
          ...freshUser, 
          institution: { 
            ...(freshUser?.Institution || freshUser?.institution), 
            name: formData.institutionName, 
            domain: formData.domain,
            boundary: formData.boundary,
            center_lat: centerLat,
            center_lng: centerLng,
          } 
        };
        setCookie('user', newUser);
        localStorage.setItem('user', JSON.stringify(newUser));
        window.dispatchEvent(new Event('user-updated'));
        setServerBoundary(formData.boundary);
        setServerLandmarks(formData.landmarks);
        setHasMapChanges(false);
        toast.success("Campus map data saved — the Site Map will now reflect your changes.");
      }
      else {
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success("Settings updated");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwords.current || !passwords.new) return;
    
    if (passwords.new.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      await apiRequest('/users/change-password', {
        method: 'PATCH',
        data: {
          currentPassword: passwords.current,
          newPassword: passwords.new
        }
      });
      toast.success("Password updated successfully");
      setPasswords({ current: "", new: "" });
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setSaving(false);
    }
  };









  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "profile", label: "My Profile", icon: User },
    { id: "institution", label: "Institution Info", icon: Building },
    { id: "campus", label: "Campus Management", icon: MapIcon },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Profile & Security", icon: Lock },
  ].filter(t => {
    if (user?.role === 'SECURITY' || user?.role === 'STUDENT' || user?.role === 'SUPER_ADMIN') {
      return ['profile', 'notifications', 'security'].includes(t.id);
    }
    return true;
  }) as { id: Tab; label: string; icon: any }[];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Control Center</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">System Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your personal and institutional configurations</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        {/* Nav */}
        <aside className="space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                activeTab === t.id 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {activeTab === t.id && <ChevronRight className="ml-auto h-3 w-3" />}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="rounded-3xl border border-border/60 bg-surface p-8 shadow-sm">
          <form onSubmit={handleSave}>
            <AnimatePresence mode="wait">
              {activeTab === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-6 mb-8">
                    <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary to-accent p-px">
                      <div className="h-full w-full rounded-2xl border-4 border-background bg-surface flex items-center justify-center text-2xl font-bold text-primary">
                        {formData.firstName[0]}{formData.lastName[0]}
                      </div>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Personal Identity</h2>
                      <p className="text-sm text-muted-foreground">This info will be visible to other administrators</p>
                    </div>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">First Name</label>
                      <input 
                        className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-4 text-sm focus:border-primary focus:outline-none"
                        value={formData.firstName}
                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Last Name</label>
                      <input 
                        className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-4 text-sm focus:border-primary focus:outline-none"
                        value={formData.lastName}
                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Institutional Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input 
                        disabled={user?.role !== 'SUPER_ADMIN'}
                        className={`w-full h-11 rounded-xl border border-border/60 px-10 text-sm focus:border-primary focus:outline-none transition-all ${
                          user?.role === 'SUPER_ADMIN' ? 'bg-background/50' : 'bg-muted/30 opacity-60'
                        }`}
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recovery Email (Optional)</label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input 
                        className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-10 text-sm focus:border-primary focus:outline-none"
                        placeholder="recovery@email.com"
                        value={formData.recoveryEmail}
                        onChange={e => setFormData({ ...formData, recoveryEmail: e.target.value })}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Used for account recovery if primary email is inaccessible.</p>
                  </div>
                </motion.div>
              )}

              {activeTab === "institution" && (
                <motion.div
                  key="institution"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold">Institution Profile</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Official Name</label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input 
                          className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-10 text-sm focus:border-primary focus:outline-none"
                          value={formData.institutionName}
                          onChange={e => setFormData({ ...formData, institutionName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Institutional Domain</label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input 
                          className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-10 text-sm focus:border-primary focus:outline-none"
                          value={formData.domain}
                          onChange={e => setFormData({ ...formData, domain: e.target.value })}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground italic">Domain is used to whitelist student email addresses during signup.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "campus" && (
                <div key="campus" className="space-y-6">
                  {/* Quick navigation shortcuts */}
                  <div className="flex gap-3 flex-wrap">
                    <Link
                      to="/map"
                      className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                    >
                      <MapIcon className="h-4 w-4" />
                      View Safety Map
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link
                      to="/incidents"
                      className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                    >
                      <Shield className="h-4 w-4" />
                      View Incidents
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>

                  <CampusEditor
                    key={mapKey}
                    initialBoundary={formData.boundary}
                    initialLandmarks={formData.landmarks}
                    center={{
                      lat: user?.institution?.center_lat || 5.6507,
                      lng: user?.institution?.center_lng || -0.1870
                    }}
                    institutionName={formData.institutionName}
                    onUpdate={handleMapUpdate}
                  />

                  {/* Campus-specific action bar */}
                  <div className="pt-6 border-t border-border/40 flex items-center justify-between gap-4">
                    <p className={`text-xs font-medium transition-colors ${
                      hasMapChanges ? 'text-amber-500' : 'text-muted-foreground'
                    }`}>
                      {hasMapChanges ? '● Unsaved changes to campus map' : '✓ Campus map is up to date'}
                    </p>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={!hasMapChanges || saving}
                        onClick={() => {
                          // Tell handleMapUpdate to ignore the first call from the remounted editor
                          skipNextMapUpdate.current = true;
                          setFormData(prev => ({ ...prev, boundary: serverBoundary, landmarks: serverLandmarks }));
                          setHasMapChanges(false);
                          setMapKey(k => k + 1);
                        }}
                      >
                        Discard Changes
                      </Button>
                      <Button
                        type="submit"
                        variant="hero"
                        className="rounded-xl px-8"
                        disabled={!hasMapChanges || saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Save Campus Map
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold">Alert Preferences</h2>
                  <div className="space-y-4">
                    {(() => {
                      let notifs = [];
                      if (user?.role === 'SUPER_ADMIN') {
                        notifs = [
                          { id: 'sys_health', label: 'System Health Alerts', desc: 'Instant alerts when core node connectivity drops' },
                          { id: 'global_onboard', label: 'Global Onboarding Digest', desc: 'Weekly digest of newly registered institutions' },
                          { id: 'sys_failure', label: 'Critical System Failures', desc: 'Immediate notification of database sync errors' },
                        ];
                      } else if (user?.role === 'SCHOOL_ADMIN') {
                        notifs = [
                          { id: 'campus_sos', label: 'Campus SOS Alerts', desc: 'Instant push notification for campus emergencies' },
                          { id: 'daily_summary', label: 'Daily Safety Summaries', desc: 'Receive a digest of the last 24 hours every morning' },
                          { id: 'officer_logs', label: 'Officer Duty Logs', desc: 'Alerts when security personnel miss check-ins' },
                        ];
                      } else if (user?.role === 'SECURITY') {
                        notifs = [
                          { id: 'dispatch', label: 'Active Dispatch Alerts', desc: 'Instant push when assigned to an incident' },
                          { id: 'prox_sos', label: 'Proximity SOS', desc: 'Alert when a distress signal is triggered nearby' },
                          { id: 'shift_remind', label: 'Shift Reminders', desc: 'Notifications for upcoming duty shifts' },
                        ];
                      } else {
                        notifs = [
                          { id: 'campus_broadcast', label: 'Campus Emergency Broadcasts', desc: 'Receive campus-wide critical alerts' },
                          { id: 'buddy_sos', label: 'Safety Buddy SOS', desc: 'Instant alert if a designated buddy triggers an emergency' },
                          { id: 'safewalk', label: 'SafeWalk Updates', desc: 'Notifications when a buddy arrives safely at destination' },
                        ];
                      }

                      return notifs.map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-background/30 transition-colors hover:bg-background/50">
                          <div>
                            <div className="text-sm font-bold">{n.label}</div>
                            <div className="text-xs text-muted-foreground">{n.desc}</div>
                          </div>
                          <div className="relative h-5 w-9 rounded-full bg-primary cursor-pointer">
                            <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </motion.div>
              )}

              {activeTab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-8"
                >
                  {/* Section 1: Account Security */}
                  <div className="rounded-3xl border border-border/40 bg-surface/30 p-8 shadow-sm">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                      <Lock className="h-5 w-5 text-primary" />
                      Account Security
                    </h2>
                    <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Current Password</label>
                        <input 
                          type="password"
                          className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-4 focus:border-primary focus:outline-none"
                          value={passwords.current}
                          onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">New Password</label>
                        <input 
                          type="password"
                          className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-4 focus:border-primary focus:outline-none"
                          value={passwords.new}
                          onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                        />
                      </div>

                      <div className="mt-8 flex flex-wrap lg:flex-nowrap items-center gap-3">
                        <Button 
                          type="submit" 
                          variant="hero" 
                          className="rounded-xl px-6 h-11" 
                          disabled={saving || !passwords.current || !passwords.new}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          Update Password
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="rounded-xl px-6 h-11"
                          onClick={() => setPasswords({ current: "", new: "" })}
                        >
                          Discard Changes
                        </Button>
                      </div>
                    </form>
                  </div>

                  {/* Section 2: Privacy Settings (Reporters Only) */}
                  {user?.role === 'STUDENT' && (
                    <div className="rounded-3xl border border-border/40 bg-surface/30 p-8 shadow-sm">
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                      <EyeOff className="h-5 w-5 text-accent" />
                      Privacy Settings
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">Control how your identity is shared across the platform.</p>
                    
                    <button
                      type="button"
                      onClick={async () => {
                        const newValue = !formData.anonymousReporting;
                        setFormData({ ...formData, anonymousReporting: newValue });
                        
                        try {
                          const freshUser = getCookie('user');
                          const currentPrefs = typeof freshUser?.preferences === 'string' 
                            ? JSON.parse(freshUser.preferences) 
                            : (freshUser?.preferences || {});

                          const updatedPrefs = {
                            ...currentPrefs,
                            privacy: {
                              ...(currentPrefs.privacy || {}),
                              anonymousReporting: newValue
                            }
                          };

                          await apiRequest('/users/profile', {
                            method: 'PATCH',
                            data: {
                              preferences: updatedPrefs
                            }
                          });
                          
                          // Sync cookies and local storage
                          const newUser = { 
                            ...freshUser, 
                            preferences: updatedPrefs
                          };
                          setCookie('user', newUser);
                          localStorage.setItem('user', JSON.stringify(newUser));
                          window.dispatchEvent(new Event('user-updated'));
                          toast.success("Privacy preference updated");
                        } catch (err) {
                          console.error("Privacy update error:", err);
                          toast.error("Failed to update privacy preference");
                          // Revert on failure
                          setFormData({ ...formData, anonymousReporting: !newValue });
                        }
                      }}
                      className={`flex w-full items-center justify-between p-5 rounded-2xl border transition-all ${
                        formData.anonymousReporting ? "border-primary/40 bg-primary/5" : "border-border/40 bg-background/30"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${formData.anonymousReporting ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                          <EyeOff className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold">Default Anonymous Reporting</div>
                          <div className="text-xs text-muted-foreground">Set reporting to anonymous by default</div>
                        </div>
                      </div>
                      <div className={`relative h-6 w-11 rounded-full transition-colors ${formData.anonymousReporting ? "bg-primary" : "bg-secondary"}`}>
                        <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${formData.anonymousReporting ? "translate-x-5.5" : "translate-x-1"}`} />
                      </div>
                    </button>
                  </div>
                  )}

                  {/* Section 3: Account Management / Decommissioning */}
                  {user?.role !== 'SUPER_ADMIN' && (
                    <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8 shadow-sm">
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-destructive">
                      <Trash2 className="h-5 w-5" />
                      {user?.role === 'SCHOOL_ADMIN' ? "Institutional Offboarding" : "Account Management"}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-8">
                      {user?.role === 'SCHOOL_ADMIN' 
                        ? "Decommissioning will permanently delete all institutional records, campus configurations, and administrator access."
                        : "Downloading your data or deleting your account are permanent actions."}
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="rounded-2xl h-16 justify-start px-6 gap-4 bg-background/50 border-border/40"
                        onClick={() => {
                          const headers = ["First Name", "Last Name", "Email", "Role", "Institution"];
                          const row = [
                            user.first_name || user.firstName || "",
                            user.last_name || user.lastName || "",
                            user.email || "",
                            user.role || "",
                            user.institution?.name || ""
                          ].map(val => `"${val}"`);
                          
                          const csvContent = [headers, row].map(e => e.join(",")).join("\n");
                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `safecampus-personal-data.csv`;
                          a.click();
                          toast.success("Personal data download started");
                        }}
                      >
                        <Download className="h-6 w-6 text-primary" />
                        <div className="text-left">
                          <div className="text-sm font-bold">Download Data</div>
                          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">CSV Archive</div>
                        </div>
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="rounded-2xl h-16 justify-start px-6 gap-4 border-destructive/20 hover:bg-destructive/10 hover:text-destructive group bg-background/50"
                        onClick={() => setShowDeleteModal(true)}
                      >
                        <Trash2 className="h-6 w-6 text-destructive group-hover:scale-110 transition-transform" />
                        <div className="text-left text-destructive">
                          <div className="text-sm font-bold">
                            {user?.role === 'SCHOOL_ADMIN' ? "Decommission Institution" : "Delete Account"}
                          </div>
                          <div className="text-[10px] uppercase font-bold text-destructive/70 tracking-wider">Permanent Action</div>
                        </div>
                      </Button>
                    </div>
                  </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {activeTab !== "security" && activeTab !== "campus" && (
              <div className="mt-10 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-end gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl w-full sm:w-auto order-2 sm:order-1"
                  onClick={() => {
                    // Restore formData map fields from server baseline and force-remount the editor
                    setFormData(prev => ({ ...prev, boundary: serverBoundary, landmarks: serverLandmarks }));
                    setMapKey(k => k + 1);
                  }}
                  disabled={!currentTabIsDirty || saving}
                >
                  Discard Changes
                </Button>
                <Button 
                  type="submit" 
                  variant="hero" 
                  className="rounded-xl px-8 w-full sm:w-auto order-1 sm:order-2" 
                  disabled={!currentTabIsDirty || saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Settings
                </Button>
              </div>
            )}
          </form>
        </main>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-destructive/20 bg-surface p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold">
                  {user?.role === 'SCHOOL_ADMIN' ? "Decommission Institution?" : "Delete Account?"}
                </h3>
                <p className="mt-3 text-muted-foreground">
                  {user?.role === 'SCHOOL_ADMIN' 
                    ? "This will permanently wipe all onboarded school data, campus perimeters, and administrator access. This action cannot be undone."
                    : "This action is permanent and all your data will be erased. You will lose access to your safety history and buddy network."}
                </p>
                <div className="mt-8 flex w-full flex-col gap-3">
                  <Button 
                    variant="destructive" 
                    className="h-12 rounded-xl font-bold"
                    onClick={() => {
                      toast.error(`${user?.role === 'SCHOOL_ADMIN' ? 'Decommissioning' : 'Account deletion'} is disabled for demo purposes.`);
                      setShowDeleteModal(false);
                    }}
                  >
                    {user?.role === 'SCHOOL_ADMIN' ? "Confirm Decommission" : "Yes, Delete Forever"}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-12 rounded-xl font-bold"
                    onClick={() => setShowDeleteModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


    </div>
  );
}
