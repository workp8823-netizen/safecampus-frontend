import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Users, 
  ShieldAlert, 
  ShieldCheck, 
  TrendingUp,
  Activity,
  Zap,
  Globe,
  Loader2,
  Server,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from "@/components/ui/button";

interface SystemStats {
  totalInstitutions: number;
  totalUsers: number;
  totalIncidents: number;
  activeIncidents: number;
  newInstitutions: number;
  growth: number;
  healthScore: number;
  growthData: { name: string; value: number }[];
}

interface ActivityLog {
  type: string;
  msg: string;
  time: string;
  priority: string;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        apiRequest('/admin/stats'),
        apiRequest('/admin/activity')
      ]);
      setStats(statsRes);
      setActivities(activityRes);
    } catch (error: any) {
      toast.error("Failed to load global data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayGrowthData = stats?.growthData || [
    { name: 'N/A', value: 0 }
  ];

  return (
    <div className="space-y-10">
      {/* Welcome Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">System Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time performance metrics across all nodes</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-surface p-2 border border-border/40">
           <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 text-primary">
              <Zap className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Live Monitoring</span>
           </div>
           <Button variant="ghost" size="sm" onClick={fetchData} className="rounded-xl h-8">
              <Clock className="h-3 w-3 mr-2" />
              Sync Now
           </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
         {[
            { label: "Total Schools", value: stats?.totalInstitutions, icon: Globe, trend: `+${stats?.newInstitutions} new`, color: "text-primary" },
            { label: "Global Users", value: stats?.totalUsers || 0, icon: Users, trend: "Platform total", color: "bg-accent/10 text-accent" },
            { label: "Total Incidents", value: stats?.totalIncidents || 0, icon: ShieldAlert, trend: `${stats?.activeIncidents || 0} active`, color: "bg-destructive/10 text-destructive" },
            { label: "System Health", value: stats && stats.healthScore !== undefined ? `${stats.healthScore}%` : "---", icon: ShieldCheck, trend: stats && stats.healthScore !== undefined && stats.healthScore > 90 ? "Healthy" : "Attention", color: "bg-primary/10 text-primary" }
         ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="group relative overflow-hidden rounded-3xl border border-border/60 bg-surface p-6 shadow-sm transition-all hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                 <div className={`p-2 rounded-xl bg-secondary/50 ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                 </div>
                 <div className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary`}>
                    {s.trend}
                 </div>
              </div>
              <div className="mt-4">
                 <div className="text-3xl font-bold">{s.value}</div>
                 <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
              <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform">
                 <s.icon className="h-20 w-20" />
              </div>
            </motion.div>
         ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <div className="lg:col-span-8 rounded-3xl border border-border/60 bg-surface p-8">
            <div className="flex items-center justify-between mb-8">
               <div>
                  <h3 className="font-bold">Institutional Growth</h3>
                  <p className="text-xs text-muted-foreground">Global campus onboarding trajectory</p>
               </div>
               <div className="text-xs font-bold text-primary flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {stats?.growth.toFixed(1)}% Monthly
               </div>
            </div>
            <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayGrowthData}>
                     <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                           <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'gray'}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'gray'}} />
                     <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px' }}
                     />
                     <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="lg:col-span-4 rounded-3xl border border-border/60 bg-surface p-8">
             <h3 className="font-bold mb-6">System Nodes</h3>
             <div className="space-y-6">
                {[
                   { label: "API Cluster", status: "Healthy", icon: Server, color: "text-primary" },
                   { label: "PostgreSQL Node", status: "Active", icon: Activity, color: "text-primary" },
                   { label: "Socket Node", status: "Syncing", icon: Zap, color: "text-accent" },
                   { label: "Auth Shield", status: "Locked", icon: ShieldCheck, color: "text-primary" }
                ].map((item) => (
                   <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-lg bg-secondary/50 ${item.color}`}>
                            <item.icon className="h-4 w-4" />
                         </div>
                         <div className="text-sm font-medium">{item.label}</div>
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-widest ${item.status === 'Active' || item.status === 'Healthy' || item.status === 'Locked' ? 'text-primary' : 'text-accent'}`}>
                         {item.status}
                      </div>
                   </div>
                ))}
             </div>

             <div className="mt-8 pt-8 border-t border-border/40">
                <Button 
                  className="w-full rounded-2xl h-12 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all"
                  onClick={() => navigate('/super-admin/system?runDiagnostics=true')}
                >
                   Full Diagnostics <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
         </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-3xl border border-border/60 bg-surface overflow-hidden">
         <div className="p-6 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-bold">Recent Global Activity</h3>
            <Button variant="ghost" size="sm" onClick={fetchData} className="text-xs text-primary">Refresh Logs</Button>
         </div>
         <div className="divide-y divide-border/60">
            {activities.length === 0 ? (
               <div className="p-10 text-center text-muted-foreground text-sm italic">
                  No recent activity found.
               </div>
            ) : (
               activities.map((log, i) => (
                  <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className={`h-2 w-2 rounded-full ${log.type === 'INCIDENT' ? 'bg-destructive' : 'bg-primary'}`} />
                        <div>
                           <div className="text-sm font-medium">{log.msg}</div>
                           <div className="text-[10px] text-muted-foreground uppercase mt-0.5 font-bold tracking-wider">{log.type}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(log.time).toLocaleTimeString()}
                     </div>
                  </div>
               )
            ))}
         </div>
      </div>
    </div>
  );
}
