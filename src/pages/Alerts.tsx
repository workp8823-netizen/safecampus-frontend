import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Zap, 
  Info, 
  Clock, 
  MapPin,
  ChevronRight,
  Search,
  X,
  AlertCircle,
  Loader2
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";


export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await apiRequest('/alerts');
        setAlerts(data);
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);
  
  const selectedAlert = alerts.find(a => a.id === selectedAlertId);

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Real-Time Alerts</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Campus Safety Feed</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Instantly reach students in the affected campus zone with critical safety updates.
        </p>
      </div>

      {/* Search/Filter Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input 
          type="text" 
          placeholder="Search alerts..."
          className="w-full h-12 rounded-2xl border border-border/60 bg-surface pl-11 pr-4 text-sm focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5"
        />
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Syncing safety feed...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-border/60 bg-surface/50">
            <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="mt-4 font-bold">No Active Alerts</h3>
            <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">Your campus is currently stable. Stay vigilant.</p>
          </div>
        ) : (
          alerts.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedAlertId(alert.id)}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-border/60 bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-xl active:scale-[0.98]"
            >
              {alert.type === 'CRITICAL' && (
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
              )}
              
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {alert.type === 'CRITICAL' ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                    ) : alert.type === 'WARNING' ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <Zap className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Info className="h-4 w-4" />
                      </div>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      alert.type === 'CRITICAL' ? 'text-destructive' : alert.type === 'WARNING' ? 'text-accent' : 'text-primary'
                    }`}>
                      {alert.type}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                    {alert.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {alert.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors mt-8" />
              </div>

              <div className="mt-4 flex items-center gap-4 pt-4 border-t border-border/40">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {(() => { 
                    const d = new Date(alert.created_at || alert.createdAt); 
                    return isNaN(d.getTime()) ? 'Unknown time' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); 
                  })()}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {alert.location}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-10 text-center"
      >
        <button 
          onClick={() => toast.info("Archived alerts", { description: "You are now viewing historical safety records." })}
          className="text-sm font-medium text-primary hover:underline underline-offset-4"
        >
          View archived alerts
        </button>
      </motion.div>


      {/* View Details Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAlertId(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl z-10"
            >
              {selectedAlert.type === 'CRITICAL' && (
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-destructive shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
              )}
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    {selectedAlert.type === 'CRITICAL' ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                        <ShieldAlert className="h-6 w-6" />
                      </div>
                    ) : selectedAlert.type === 'WARNING' ? (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <Zap className="h-6 w-6" />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Info className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <span className={`text-xs font-bold uppercase tracking-wider ${
                        selectedAlert.type === 'CRITICAL' ? 'text-destructive' : selectedAlert.type === 'WARNING' ? 'text-accent' : 'text-primary'
                      }`}>
                        {selectedAlert.type} ALERT
                      </span>
                      <h2 className="mt-1 text-xl font-bold font-display text-foreground leading-tight">
                        {selectedAlert.title}
                      </h2>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedAlertId(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-8 p-4 rounded-2xl bg-secondary/30 border border-border/40">
                  <p className="text-[15px] leading-relaxed text-foreground/90">
                    {selectedAlert.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Reported</div>
                      <div className="text-sm font-medium text-foreground">
                        {(() => { 
                          const d = new Date(selectedAlert.created_at || selectedAlert.createdAt); 
                          return isNaN(d.getTime()) ? 'Unknown' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); 
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-background/50 border border-border/30">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Location</div>
                      <div className="text-sm font-medium text-foreground">{selectedAlert.location}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => {
                      setSelectedAlertId(null);
                      toast.success("Alert acknowledged");
                    }} 
                    className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Acknowledge
                  </button>

                  <button className="flex h-12 w-12 items-center justify-center rounded-xl border border-border hover:bg-secondary transition-colors">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
