import { Bell, Mail, Smartphone, Globe, ChevronLeft, ShieldCheck, Save, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

const DEFAULT_SETTINGS = {
  pushCritical: true,
  pushUpdates: true,
  emailCritical: true,
  emailWeekly: false,
  smsSOS: true,
};

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const profile = await apiRequest('/users/profile');
        if (profile?.preferences?.notifications) {
          setSettings({ ...DEFAULT_SETTINGS, ...profile.preferences.notifications });
        }
      } catch {
        // Use defaults on error
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
      // First get latest preferences to avoid overwriting privacy settings
      const profile = await apiRequest('/users/profile');
      const latestPreferences = profile?.preferences || {};
      
      await apiRequest('/users/preferences', {
        method: 'PATCH',
        data: { 
          preferences: {
            ...latestPreferences,
            notifications: settings
          }
        }
      });
      toast.success("Notification preferences saved");
    } catch (error: any) {
      toast.error(error.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    {
      title: "Critical Safety Alerts",
      description: "Immediate notifications about high-risk incidents on campus.",
      items: [
        { id: 'pushCritical', label: "Push Notifications", icon: Smartphone, value: settings.pushCritical },
        { id: 'emailCritical', label: "Email Alerts", icon: Mail, value: settings.emailCritical },
        { id: 'smsSOS', label: "SMS SOS Feedback", icon: Globe, value: settings.smsSOS },
      ]
    },
    {
      title: "General Updates",
      description: "Non-urgent news and weekly safety summaries.",
      items: [
        { id: 'pushUpdates', label: "App Activity", icon: Bell, value: settings.pushUpdates },
        { id: 'emailWeekly', label: "Weekly Safety Audit", icon: Globe, value: settings.emailWeekly },
      ]
    }
  ];

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-8">
        <Link to="/profile" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-3 w-3" /> Back to Profile
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Preferences</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Manage how you receive real-time campus safety intelligence.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="px-2">
                <h3 className="font-bold text-foreground">{section.title}</h3>
                <p className="text-xs text-muted-foreground">{section.description}</p>
              </div>

              <div className="rounded-3xl border border-border/60 bg-surface divide-y divide-border/40">
                {section.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <button
                      onClick={() => toggle(item.id as keyof typeof settings)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${item.value ? "bg-primary" : "bg-border"}`}
                    >
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${item.value ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}

      {/* Security Banner */}
      <div className="mt-12 rounded-3xl border border-primary/20 bg-primary/5 p-6 flex items-start gap-4">
        <div className="h-10 w-10 rounded-2xl bg-primary text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold">End-to-End Encryption</h4>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Your contact details and notification preferences are encrypted. Only you can access these settings.
          </p>
        </div>
      </div>
    </div>
  );
}
