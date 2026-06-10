import { motion } from "framer-motion";
import { Shield, Eye, Lock, MapPin, ChevronLeft, ShieldAlert, Key, Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

const DEFAULT_PRIVACY = {
  anonymousReporting: true,
  locationSharing: false,
  twoFactor: false,
};

export default function PrivacySecurityPage() {
  const [settings, setSettings] = useState(DEFAULT_PRIVACY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const profile = await apiRequest('/users/profile');
        if (profile?.preferences?.privacy) {
          setSettings({ ...DEFAULT_PRIVACY, ...profile.preferences.privacy });
        }
      } catch {
        // Defaults
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const profile = await apiRequest('/users/profile');
      const latestPreferences = profile?.preferences || {};
      
      await apiRequest('/users/preferences', {
        method: 'PATCH',
        data: { 
          preferences: {
            ...latestPreferences,
            privacy: settings
          }
        }
      });
      toast.success("Security preferences saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const options = [
    {
      id: 'anonymousReporting',
      icon: Eye,
      title: "Anonymous Reporting",
      desc: "Always hide your identity when filing incident reports.",
      value: settings.anonymousReporting
    },
    {
      id: 'locationSharing',
      icon: MapPin,
      title: "Precise Location Sharing",
      desc: "Allow the app to access your GPS while using safety features.",
      value: settings.locationSharing
    },
    {
      id: 'twoFactor',
      icon: Lock,
      title: "Two-Factor Authentication",
      desc: "Add an extra layer of security to your institutional account.",
      value: settings.twoFactor
    }
  ];

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-8">
        <Link to="/profile" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-3 w-3" /> Back to Profile
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Account Security</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Privacy & Security</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Control your data visibility and account protection layers.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Security Overview */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-3xl border border-border/60 bg-surface p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="text-sm font-bold">Safety Level</div>
              <div className="text-[10px] text-primary uppercase font-bold mt-1">High Protection</div>
            </div>
            <div className="rounded-3xl border border-border/60 bg-surface p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent mb-3">
                <Key className="h-5 w-5" />
              </div>
              <div className="text-sm font-bold">Active Sessions</div>
              <div className="text-[10px] text-accent uppercase font-bold mt-1">1 Device</div>
            </div>
          </div>

          {/* Settings List */}
          <div className="rounded-3xl border border-border/60 bg-surface divide-y divide-border/40">
            {options.map((option) => (
              <div key={option.id} className="p-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground shrink-0 mt-1">
                    <option.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">{option.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{option.desc}</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggle(option.id as keyof typeof settings)}
                  className={`relative h-6 w-11 rounded-full transition-colors mt-2 shrink-0 ${option.value ? "bg-primary" : "bg-border"}`}
                >
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${option.value ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? "Saving..." : "Save Privacy Settings"}
          </button>

          {/* Danger Zone */}
          <div className="mt-10 p-6 rounded-3xl border border-destructive/20 bg-destructive/5">
            <h4 className="text-sm font-bold text-destructive flex items-center gap-2">
              <Shield className="h-4 w-4" /> Account Management
            </h4>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Downloading your data or deleting your account are permanent actions.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button variant="outline" className="w-full h-12 rounded-xl text-xs font-bold border-destructive/20 text-destructive hover:bg-destructive/10">
                Download Personal Data
              </Button>
              <Button variant="ghost" className="w-full h-12 rounded-xl text-xs font-bold text-destructive/60 hover:text-destructive hover:bg-destructive/5">
                Request Account Deletion
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
