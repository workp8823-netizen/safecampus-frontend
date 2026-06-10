import { useState } from "react";
import { 
  ShieldAlert, 
  Zap, 
  Info, 
  Send, 
  ChevronLeft, 
  Clock, 
  MapPin,
  CheckCircle2,
  Loader2
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";


export default function CreateAlertPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [alertData, setAlertData] = useState({
    title: "",
    description: "",
    type: "CRITICAL",
    location: "All Campus",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // Map "2 Hours", "6 Hours" etc to numbers
      const expirationMap: Record<string, number | null> = {
        "2 Hours": 2,
        "6 Hours": 6,
        "24 Hours": 24,
        "Until Resolved": null
      };
      
      const select = document.querySelector('select');
      const expiresIn = select ? expirationMap[select.value] : null;

      await apiRequest('/alerts', {
        method: 'POST',
        data: {
          ...alertData,
          expires_in_hours: expiresIn
        }
      });
      
      toast.success("Broadcast Signal Sent!", {
        description: "All institutional devices and students have been notified.",
      });
      navigate("/alerts");
    } catch (error: any) {
      toast.error(error.message || "Failed to broadcast alert");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-3 w-3" /> Back to Console
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Admin Operations</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Broadcast Alert</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Instantly reach every student and officer with critical safety updates.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 rounded-3xl border border-border/60 bg-surface p-6 sm:p-8">
        {/* Alert Type Selection */}
        <div className="space-y-8">
          <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Priority Level</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'CRITICAL', icon: ShieldAlert, color: 'text-destructive bg-destructive/10 border-destructive/20' },
              { id: 'WARNING', icon: Zap, color: 'text-accent bg-accent/10 border-accent/20' },
              { id: 'INFO', icon: Info, color: 'text-primary bg-primary/10 border-primary/20' },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setAlertData({ ...alertData, type: type.id })}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all ${
                  alertData.type === type.id 
                    ? type.color + " ring-2 ring-offset-2 ring-offset-background ring-current" 
                    : "border-border/60 bg-background/40 text-muted-foreground hover:bg-secondary/40"
                }`}
              >
                <type.icon className="h-6 w-6" />
                <span className="text-[10px] font-bold uppercase tracking-widest">{type.id}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Alert Headline</label>
            <input
              required
              type="text"
              placeholder="e.g. Unauthorized Activity Near Science Block"
              className="w-full h-12 rounded-xl border border-border bg-background/50 px-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5"
              value={alertData.title}
              onChange={e => setAlertData({ ...alertData, title: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Description & Instructions</label>
            <textarea
              required
              rows={4}
              placeholder="Provide clear instructions for students and staff..."
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 resize-none"
              value={alertData.description}
              onChange={e => setAlertData({ ...alertData, description: e.target.value })}
            />
          </div>
        </div>

        {/* Location & Schedule */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Target Zone</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                className="w-full h-11 rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm focus:border-primary focus:outline-none"
                value={alertData.location}
                onChange={e => setAlertData({ ...alertData, location: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Expiration</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select className="w-full h-11 rounded-xl border border-border bg-background/50 pl-10 pr-4 text-sm focus:border-primary focus:outline-none appearance-none">
                <option>2 Hours</option>
                <option>6 Hours</option>
                <option>24 Hours</option>
                <option>Until Resolved</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button type="submit" variant="hero" className="flex-1 py-6 text-base font-bold shadow-xl shadow-primary/20" disabled={loading}>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>Broadcast Signal <Send className="ml-2 h-5 w-5" /></>
            )}
          </Button>
          <Button type="button" variant="outline" className="py-6 rounded-xl" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Safety Note */}
      <div className="mt-8 flex items-center gap-3 px-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" />
        Encrypted Institutional Delivery Guaranteed
      </div>
    </div>
  );
}
