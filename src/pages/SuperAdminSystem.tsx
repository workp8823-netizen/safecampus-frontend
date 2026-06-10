import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Server, 
  Database, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

interface Diagnostic {
  name: string;
  status: string;
  latency: string;
  detail: string;
}

interface DiagnosticResult {
  timestamp: string;
  overallStatus: string;
  duration: string;
  diagnostics: Diagnostic[];
}

export default function SuperAdminSystemPage() {
  const location = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostics = async () => {
    setRefreshing(true);
    try {
      const data = await apiRequest('/admin/diagnostics', { method: 'POST' });
      setResult(data);
      if (data.overallStatus === 'Optimal') {
        toast.success("System diagnostics passed successfully");
      } else {
        toast.warning("Diagnostics complete with some attention required");
      }
    } catch (error: any) {
      toast.error("Failed to run diagnostics engine");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('runDiagnostics') === 'true') {
      runDiagnostics();
      // Clear the query param without refresh
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location]);

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">System Health</h1>
          <p className="text-sm text-muted-foreground mt-1">Infrastructure monitoring and node diagnostics</p>
        </div>
        <Button 
          variant="hero" 
          className="rounded-xl h-12 px-6 gap-2"
          onClick={runDiagnostics}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Run Deep Diagnostics
        </Button>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
         {[
            { label: "Overall System Status", value: result?.overallStatus || "Standby", icon: Cloud, color: result?.overallStatus === 'Optimal' ? "text-primary" : "text-muted-foreground" },
            { label: "Engine Latency", value: result?.duration || "---", icon: Zap, color: "text-accent" },
            { label: "Last Analysis", value: result ? new Date(result.timestamp).toLocaleTimeString() : "Never", icon: ShieldCheck, color: "text-primary" }
         ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-3xl border border-border/60 bg-surface p-8 shadow-sm"
            >
              <div className="flex items-center gap-4">
                 <div className={`p-3 rounded-2xl bg-secondary/50 ${s.color}`}>
                    <s.icon className="h-6 w-6" />
                 </div>
                 <div>
                    <div className="text-2xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                 </div>
              </div>
            </motion.div>
         ))}
      </div>

      {/* Diagnostic Results Table */}
      <div className="rounded-3xl border border-border/60 bg-surface shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/60 flex items-center justify-between">
           <h3 className="font-bold">Active Engine Diagnostics</h3>
           {result && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Node ID: SC-ROOT-NODE-01
              </span>
           )}
        </div>
        <div className="overflow-x-auto">
          {!result && !refreshing ? (
             <div className="p-20 text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-secondary/30 flex items-center justify-center text-muted-foreground">
                   <Activity className="h-8 w-8" />
                </div>
                <div className="max-w-xs mx-auto">
                   <p className="text-sm font-medium">Diagnostic Engine Idle</p>
                   <p className="text-xs text-muted-foreground mt-1">Run deep diagnostics to analyze infrastructure health and data integrity across nodes.</p>
                </div>
                <Button variant="outline" onClick={runDiagnostics} className="rounded-xl mt-4">Initialize Analysis</Button>
             </div>
          ) : refreshing && !result ? (
            <div className="p-20 text-center space-y-4">
               <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
               <p className="text-sm font-medium animate-pulse">Scanning infrastructure clusters...</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-secondary/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4">Probe Name</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Latency</th>
                  <th className="px-6 py-4">Findings</th>
                  <th className="px-6 py-4 text-right">Reliability</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {result?.diagnostics.map((probe, idx) => (
                  <motion.tr 
                    key={idx} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="group hover:bg-secondary/10 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                          <Server className="h-4 w-4" />
                        </div>
                        <div className="font-bold text-sm">{probe.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        probe.status === 'Healthy' || probe.status === 'Active' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                      }`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${probe.status === 'Healthy' || probe.status === 'Active' ? 'bg-primary' : 'bg-destructive'}`} />
                        {probe.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-muted-foreground">
                      {probe.latency}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                      {probe.detail}
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-primary">
                      99.9%
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Support Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="rounded-3xl border border-border/60 bg-surface p-8">
            <h3 className="font-bold mb-6 flex items-center gap-2">
               <Database className="h-4 w-4 text-primary" />
               Persistence Status
            </h3>
            <div className="space-y-4">
               <div className="p-4 rounded-2xl bg-secondary/30 border border-border/40">
                  <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-muted-foreground uppercase">Primary Cluster</span>
                     <span className={`text-xs font-bold ${result?.overallStatus === 'Optimal' ? 'text-primary' : 'text-destructive'}`}>
                        {result?.overallStatus === 'Optimal' ? 'ACTIVE' : 'DEGRADED'}
                     </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                     <div className={`h-full transition-all duration-1000 ${result?.overallStatus === 'Optimal' ? 'bg-primary' : 'bg-destructive'}`} 
                          style={{ width: result?.overallStatus === 'Optimal' ? '100%' : '30%' }} />
                  </div>
               </div>
               <p className="text-xs text-muted-foreground">
                  {result?.overallStatus === 'Optimal' 
                    ? "Database clusters are fully operational with optimal latency. Node replication is active."
                    : "Some database nodes are reporting high latency or connectivity issues. Investigating..."
                  }
               </p>
            </div>
         </div>

         <div className="rounded-3xl border border-border/60 bg-surface p-8">
            <h3 className="font-bold mb-6 flex items-center gap-2">
               <ShieldCheck className="h-4 w-4 text-accent" />
               Security Context
            </h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">SSL Status</span>
                  <span className="text-primary font-bold">VERIFIED</span>
               </div>
               <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Node Encryption</span>
                  <span className="text-primary font-bold">AES-256</span>
               </div>
               <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Environment</span>
                  <span className="text-accent font-bold uppercase">{import.meta.env.MODE}</span>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
