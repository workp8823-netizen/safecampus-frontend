import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Search,
  MoreVertical,
  MapPin,
  EyeOff,
  Loader2,
  Phone,
  PlusCircle,
  ChevronRight,
  Bell,
  Users,
  Navigation,
  X,
  Download,
  Calendar,
  Play
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { connectSocket, disconnectSocket, onNewIncident, offNewIncident, onSOSAlert, offSOSAlert } from "@/lib/socket";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { toast } from "sonner";
import { getCookie } from "@/lib/cookies";
import { MediaViewerModal } from "@/components/MediaViewerModal";

const urgencyStyles: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-muted text-muted-foreground border-border",
};

const statusStyles: Record<string, string> = {
  active: "bg-destructive/15 text-destructive",
  "in-progress": "bg-accent/15 text-accent",
  resolved: "bg-primary/15 text-primary",
};

const statusIcons = {
  active: AlertTriangle,
  "in-progress": Clock,
  resolved: CheckCircle2,
};

export default function Dashboard() {
  const [filter, setFilter] = useState<string>("all");
  const [incidents, setIncidents] = useState<any[]>([]);
  const [myReports, setMyReports] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const isDemo = getCookie('isDemo') === true || (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo'));
  const [sosCountdown, setSosCountdown] = useState<number | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [viewingMedia, setViewingMedia] = useState<{url: string, isVideo: boolean} | null>(null);

  useBodyScrollLock(!!selectedIncident);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [buddiesCount, setBuddiesCount] = useState(0);
  const [contactsCount, setContactsCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);

  const user = getCookie('user');
  const role = user?.role || (isDemo ? "SCHOOL_ADMIN" : "STUDENT");

  const handleSOS = () => {
    if (sosCountdown !== null) {
      setSosCountdown(null);
      toast.info("SOS Canceled");
      return;
    }
    setSosCountdown(3);
  };

  useEffect(() => {
    if (sosCountdown === null) return;
    if (sosCountdown === 0) {
      setSosCountdown(null);

      // Get location if possible
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          await apiRequest('/incidents/sos', {
            method: 'POST',
            data: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              locationName: "User's Live Location"
            }
          });
          toast.error("EMERGENCY SIGNAL SENT!", {
            description: "Security forces have been dispatched to your GPS location.",
            duration: 8000,
          });
        } catch (error) {
          toast.error("Failed to send SOS signal. Please call campus security directly.");
        }
      }, async () => {
        // Fallback without GPS
        try {
          await apiRequest('/incidents/sos', {
            method: 'POST',
            data: {
              locationName: "Unknown GPS Location"
            }
          });
          toast.error("EMERGENCY SIGNAL SENT!", {
            description: "Security forces have been alerted, but your GPS was unavailable.",
            duration: 8000,
          });
        } catch (error) {
          toast.error("Failed to send SOS signal.");
        }
      }, { enableHighAccuracy: true });
      return;
    }
    const timer = setTimeout(() => setSosCountdown(sosCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [sosCountdown]);

  const handleAssignToSelf = async (incidentId: string) => {
    setUpdating(true);
    try {
      await apiRequest(`/incidents/${incidentId}/assign`, {
        method: 'PATCH',
        data: { assignee_id: user?.id }
      });
      toast.success("Incident assigned to you");
      // Update the selected incident state immediately so the button reflects the change
      setSelectedIncident((prev: any) => prev ? { ...prev, assignee_id: user?.id, assignee: user } : prev);
      // Also refresh to update the card list
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign incident");
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async (incidentId: string, status: string) => {
    setUpdating(true);
    try {
      await apiRequest(`/incidents/${incidentId}/status`, {
        method: 'PATCH',
        data: { status }
      });
      toast.success(`Incident marked as ${status}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const fetchData = async (p = page, f = filter, s = search) => {
    setLoading(true);
    try {
      const promises = [
        apiRequest(`/incidents?status=${f}&page=${p}&search=${s}`),
        apiRequest('/incidents/stats'),
        apiRequest('/alerts')
      ];

      if (role === 'STUDENT') {
        promises.push(apiRequest('/buddies'));
        promises.push(apiRequest('/contacts'));
        promises.push(apiRequest('/incidents/my-reports'));
      }

      const results = await Promise.all(promises);
      setIncidents(results[0].incidents);
      setTotalPages(results[0].pages);
      setStatsData(results[1]);
      setAlerts(results[2] || []);
      if (role === 'STUDENT') {
        setBuddiesCount(Array.isArray(results[3]) ? results[3].length : 0);
        setContactsCount(Array.isArray(results[4]) ? results[4].length : 0);
        setMyReports(Array.isArray(results[5]) ? results[5] : []);
      }
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      if (!isDemo) {
        toast.error(error.message || 'Failed to synchronize dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const location = useLocation();

  useEffect(() => {
    fetchData();
  }, [page, filter]);

  // If navigated here after submitting a report, immediately refresh my-reports
  useEffect(() => {
    if (location.state?.refreshReports && role === 'STUDENT') {
      apiRequest('/incidents/my-reports')
        .then(data => { if (Array.isArray(data)) setMyReports(data); })
        .catch(() => { });
    }
  }, [location.state]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchData(1, filter, search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const institutionId = getCookie('institutionId');
    if (institutionId) {
      connectSocket(institutionId);

      const newIncidentHandler = (newIncident: any) => {
        setIncidents((prev) => [newIncident, ...prev]);
        toast.error("NEW INCIDENT REPORTED", {
          description: `${newIncident.title || newIncident.type} at ${newIncident.location_lat ? `${newIncident.location_lat}, ${newIncident.location_lng}` : "Campus"}`,
        });
        // Also refresh stats
        apiRequest('/incidents/stats').then(setStatsData);
      };

      const sosHandler = (sosIncident: any) => {
        setIncidents((prev) => [sosIncident, ...prev]);
        toast.error("CRITICAL SOS ALERT", {
          description: `Emergency at ${sosIncident.location_name}. Respond immediately!`,
          className: "bg-destructive text-white border-none",
        });
        apiRequest('/incidents/stats').then(setStatsData);
      };

      onNewIncident(newIncidentHandler);
      onSOSAlert(sosHandler);

      return () => {
        offNewIncident(newIncidentHandler);
        offSOSAlert(sosHandler);
        disconnectSocket();
      };
    }

    return () => {
      disconnectSocket();
    };
  }, []);

  const filtered = incidents || [];

  const dynamicStats = [
    {
      label: "Active incidents",
      value: statsData?.activeIncidents ?? "0",
      change: statsData?.activeChange || "+0", trend: (statsData?.activeChange?.startsWith('-') ? "down" : "up"), color: (statsData?.activeChange?.startsWith('-') ? "text-primary" : "text-destructive")
    },
    {
      label: "Resolved today",
      value: statsData?.resolvedToday ?? "0",
      change: statsData?.resolvedChange || "+0%", trend: (statsData?.resolvedChange?.startsWith('-') ? "down" : "up"), color: "text-primary"
    },
    {
      label: role === 'SCHOOL_ADMIN' ? "Total Personnel" : "Avg. response",
      value: role === 'SCHOOL_ADMIN' ? (statsData?.totalOfficers ?? "0") : (statsData?.avgResponseTime ?? "0m"),
      change: role === 'SCHOOL_ADMIN' ? (statsData?.personnelChange || "+0") : (statsData?.avgResponseChange || "-0.0%"),
      trend: (role === 'SCHOOL_ADMIN' ? (statsData?.personnelChange?.startsWith('-') ? "down" : "up") : (statsData?.avgResponseChange?.startsWith('-') ? "down" : "up")),
      color: "text-primary"
    },
    {
      label: role === 'SCHOOL_ADMIN' ? "Total Students" : "Officers on duty",
      value: role === 'SCHOOL_ADMIN' ? (statsData?.totalStudents ?? "0") : (statsData?.officersOnDuty ?? "0"),
      change: role === 'SCHOOL_ADMIN' ? (statsData?.studentChange || "+0") : (statsData?.dutyChange || "+0"),
      trend: (role === 'SCHOOL_ADMIN' ? (statsData?.studentChange?.startsWith('-') ? "down" : "up") : (statsData?.dutyChange?.startsWith('-') ? "down" : "up")),
      color: (role === 'SCHOOL_ADMIN' ? "text-primary" : "text-foreground")
    },
  ];

  const timeAgo = (date: string) => {
    const d = date ? new Date(date) : new Date(NaN);
    if (isNaN(d.getTime())) return "Recently";
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center"
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              {role === "SCHOOL_ADMIN" ? "Institutional Oversight" : role === "SECURITY" ? "Security operations" : "Personal Safety"}
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">
              {role === "SCHOOL_ADMIN" ? "Admin Console" : role === "SECURITY" ? "Officer Dashboard" : "Safety Home"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "SCHOOL_ADMIN" ? "Manage your campus safety network" : role === "SECURITY" ? "Live overview of campus safety activity" : "Quick access to reports and safety tools"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Live
            </div>
            <div className="flex gap-2">
              {role !== "STUDENT" && (
                <>
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/alerts/new">
                      <PlusCircle className="mr-2 h-4 w-4" /> Create Alert
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {role === "STUDENT" ? (
          <>
            <div className="mt-8 space-y-8">
              {/* Quick Actions Grid */}
              <div className="grid gap-4 grid-cols-2">
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSOS}
                  className={`flex flex-col items-center justify-center gap-3 rounded-3xl border transition-all cursor-pointer p-6 text-center ${sosCountdown !== null
                    ? "border-destructive bg-destructive text-white animate-pulse"
                    : "border-destructive/20 bg-destructive/5"
                    }`}
                >
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-colors ${sosCountdown !== null ? "bg-white text-destructive" : "bg-destructive text-white shadow-destructive/30"
                    }`}>
                    <Phone className="h-7 w-7" />
                  </div>
                  <div className={`text-sm font-bold ${sosCountdown !== null ? "text-white" : "text-destructive"}`}>
                    {sosCountdown !== null ? `Canceling in ${sosCountdown}s...` : "Emergency SOS"}
                  </div>
                  <div className="text-[10px] uppercase font-bold tracking-wider opacity-60">Instant Help</div>
                </motion.div>

                <Link to="/report" className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-6 text-center hover:bg-primary/10 transition-colors group">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                    <PlusCircle className="h-7 w-7" />
                  </div>
                  <div className="text-sm font-bold text-primary">Report Incident</div>
                  <div className="text-[10px] text-primary/70 uppercase font-bold tracking-wider">Fast & Secure</div>
                </Link>

                <Link to="/buddies" className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-accent/20 bg-accent/5 p-6 text-center hover:bg-accent/10 transition-colors group">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30 group-hover:scale-110 transition-transform">
                    <Users className="h-7 w-7" />
                  </div>
                  <div className="text-sm font-bold text-accent">Safety Buddies</div>
                  <div className="text-[10px] text-accent/70 uppercase font-bold tracking-wider">{buddiesCount} Active</div>
                </Link>

                <Link to="/contacts" className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-warning/20 bg-warning/5 p-6 text-center hover:bg-warning/10 transition-colors group">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning text-white shadow-lg shadow-warning/30 group-hover:scale-110 transition-transform">
                    <Phone className="h-7 w-7" />
                  </div>
                  <div className="text-sm font-bold text-warning">Emergency Contacts</div>
                  <div className="text-[10px] text-warning/70 uppercase font-bold tracking-wider">{contactsCount} Contacts</div>
                </Link>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5 p-8 shadow-xl">
                  <div className="relative z-10">
                    <h2 className="text-2xl font-bold">Safety Score: {statsData?.safetyScore ?? 98}</h2>
                    <p className="mt-2 text-sm text-muted-foreground italic">"{statsData?.safetyMessage ?? 'Your campus is currently stable.'}"</p>
                    <Button asChild variant="hero" className="mt-8 h-12 w-full rounded-xl text-sm font-bold shadow-lg shadow-primary/30">
                      <Link to="/map">View Safety Map</Link>
                    </Button>
                  </div>
                  <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
                </motion.div>

                <div className="grid gap-4">
                  {incidents && incidents.length > 0 ? (
                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface p-5">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${incidents[0].priority === 'CRITICAL' ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent'}`}>
                          <Bell className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold">{incidents[0].title || incidents[0].type}</div>
                          <div className="text-[10px] text-muted-foreground uppercase">
                            {timeAgo(incidents[0].created_at || incidents[0].createdAt)} · {incidents[0].location_name || "Campus Main"}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/50 p-5 opacity-60">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                          <Bell className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold">No Active Alerts</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Campus is currently stable</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="rounded-2xl border border-border/60 bg-surface p-6">
                    <h3 className="font-semibold">Quick Safety Tip</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{statsData?.safetyTip ?? 'Walking at night? Use the "Share Location" feature with a trusted friend in the app.'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* My Reports - Status Tracking */}
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Status Tracker</p>
                  <h2 className="font-display text-xl font-bold">My Reports</h2>
                </div>
                <Link to="/report" className="text-xs font-bold text-primary hover:underline underline-offset-4">
                  + New Report
                </Link>
              </div>

              {myReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-surface/50 py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-semibold">No reports filed yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">When you submit a report, you can track its status here.</p>
                  <Link to="/report">
                    <Button variant="hero" size="sm" className="mt-4">File a Report</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {myReports.map((report: any) => {
                    const statusConfig: Record<string, { label: string; cls: string }> = {
                      PENDING: { label: "Pending Review", cls: "bg-destructive/10 text-destructive border-destructive/20" },
                      INVESTIGATING: { label: "Under Investigation", cls: "bg-accent/10 text-accent border-accent/20" },
                      RESOLVED: { label: "Resolved", cls: "bg-primary/10 text-primary border-primary/20" },
                      DISMISSED: { label: "Dismissed", cls: "bg-muted text-muted-foreground border-border" },
                    };
                    const sc = statusConfig[report.status] || statusConfig.PENDING;
                    const reportDate = new Date(report.created_at || report.createdAt);
                    const dateStr = isNaN(reportDate.getTime()) ? 'Unknown date' : reportDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = isNaN(reportDate.getTime()) ? 'Unknown time' : reportDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface p-4 gap-4"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] text-muted-foreground">#{report.id.slice(0, 8)}</span>
                              <span className="text-xs font-semibold capitalize text-foreground">{report.title || report.type}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {dateStr} · {timeStr}
                              {report.assignee && (
                                <span> · Assigned to {report.assignee.first_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${sc.cls}`}>
                          {sc.label}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
            <div className="lg:col-span-8">
              <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${role === 'SECURITY' ? 'lg:grid-cols-2' : 'lg:grid-cols-2'}`}>
                <Link to="/alerts/new" className="flex items-center gap-4 rounded-3xl border border-destructive/20 bg-destructive/5 p-5 hover:bg-destructive/10 transition-all group">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive text-white shadow-lg shadow-destructive/20 group-hover:scale-110 transition-transform">
                    <Bell className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-destructive">Broadcast Alert</div>
                    <div className="text-[10px] text-destructive/70 uppercase font-bold tracking-wider">Campus-wide</div>
                  </div>
                </Link>

                {role === "SCHOOL_ADMIN" && (
                  <Link to="/officers" className="flex items-center gap-4 rounded-3xl border border-primary/20 bg-primary/5 p-5 hover:bg-primary/10 transition-all group">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform">
                      <Users className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-primary">Manage Personnel</div>
                      <div className="text-[10px] text-primary/70 uppercase font-bold tracking-wider">{statsData?.officersOnDuty || 0} Active</div>
                    </div>
                  </Link>
                )}

                <Link to="/map" className="flex items-center gap-4 rounded-3xl border border-accent/20 bg-accent/5 p-5 hover:bg-accent/10 transition-all group">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/20 group-hover:scale-110 transition-transform">
                    <Navigation className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-accent">Safety Map</div>
                    <div className="text-[10px] text-accent/70 uppercase font-bold tracking-wider">Live View</div>
                  </div>
                </Link>

                {role === "SCHOOL_ADMIN" && (
                  <Link to="/analytics" className="flex items-center gap-4 rounded-3xl border border-border/60 bg-surface p-5 hover:bg-secondary/30 transition-all group">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground shadow-lg group-hover:scale-110 transition-transform">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Deep Analytics</div>
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Strategic</div>
                    </div>
                  </Link>
                )}
              </div>

              <div className="mt-10 grid gap-4 grid-cols-2">
                {dynamicStats.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-border/60 bg-surface p-5 transition-colors hover:border-primary/30"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </p>
                      <span className={`flex items-center gap-0.5 text-xs font-medium ${s.color}`}>
                        {s.trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {s.change}
                      </span>
                    </div>
                    <div className="mt-3 font-display text-3xl font-bold">
                      {s.value}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Admin Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-2xl border border-border/60 bg-surface p-6">
                <h3 className="font-bold mb-4">Security Insights</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{statsData?.totalOfficers || 0} Officers</div>
                      <div className="text-[10px] text-muted-foreground">Currently on roster</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{statsData?.avgResponseTime || '0m'} Avg</div>
                      <div className="text-[10px] text-muted-foreground">Response time</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-surface p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold">Active Alerts</h3>
                  <Link to="/alerts" className="text-xs font-bold text-primary hover:underline">View All</Link>
                </div>
                <div className="space-y-4">
                  {alerts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-xl">
                      No active alerts broadcasted
                    </div>
                  ) : (
                    alerts.slice(0, 1).map((alert: any) => (
                      <div key={alert.id} className="group relative rounded-xl border border-border/40 bg-background/50 p-4 transition-all hover:border-primary/30">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`h-2 w-2 rounded-full ${alert.type === 'CRITICAL' ? 'bg-destructive animate-pulse' : alert.type === 'WARNING' ? 'bg-warning' : 'bg-primary'}`} />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{alert.type}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(alert.created_at || alert.createdAt)}</span>
                        </div>
                        <h4 className="text-sm font-bold line-clamp-1">{alert.title}</h4>
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{alert.description}</p>
                      </div>
                    ))
                  )}
                </div>
                <Button variant="outline" className="w-full mt-6 h-10 text-xs font-bold border-dashed" asChild>
                  <Link to="/alerts/new">+ New Broadcast</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {role !== "STUDENT" && (
        <div className="mt-10 overflow-hidden rounded-2xl border border-border/60 bg-surface">
          <div className="flex flex-col items-start justify-between gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-lg font-semibold">Recent incidents</h2>
              <p className="text-xs text-muted-foreground">{filtered.length} reports — auto-refreshing</p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="Search incidents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-border bg-background/60 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex rounded-md border border-border bg-background/60 p-0.5 text-xs">
                {["all", "active", "in-progress", "resolved"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded px-2.5 py-1.5 font-medium capitalize transition-colors ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {f === "in-progress" ? "In-Progress" : f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="divide-y divide-border/60">
            {loading ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading incidents...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center p-10 text-center">
                <div className="mb-4 rounded-full bg-muted p-4">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold">No incidents found</h3>
                <p className="text-sm text-muted-foreground">Try changing your filter or search query</p>
              </div>
            ) : (
              filtered.map((i, idx) => {
                const status = (i.status || "").toLowerCase();
                const StatusIcon = statusIcons[status as keyof typeof statusIcons] || AlertTriangle;
                const timestamp = i.created_at || i.createdAt;
                const timeAgoStr = timestamp ? timeAgo(timestamp) : "Recently";
                return (
                  <motion.div
                    key={i.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => setSelectedIncident(i)}
                    className="group flex flex-col items-start gap-3 p-5 transition-colors hover:bg-secondary/30 sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${statusStyles[status] || "bg-muted"}`}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{i.id.slice(0, 8)}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${urgencyStyles[i.priority?.toLowerCase()] || urgencyStyles.low}`}>
                            {i.priority}
                          </span>
                          {i.is_anonymous && (
                            <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                              <EyeOff className="h-2.5 w-2.5" /> Anon
                            </span>
                          )}
                        </div>
                        <div className="mt-1 font-medium text-foreground">{i.title || i.type}</div>
                        <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {i.location_name || (i.location_lat ? `${i.location_lat}, ${i.location_lng}` : "Campus Main")}
                          </span>
                          <span>•</span>
                          <span>{timeAgoStr}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {i.assignee_id === user?.id ? (
                        <div className="flex items-center gap-2">
                          <div className="text-right mr-2">
                            <div className="text-[10px] uppercase tracking-wider text-primary font-bold">Your Task</div>
                            <div className="text-xs font-medium">Active</div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                            onClick={() => handleStatusUpdate(i.id, 'RESOLVED')}
                            disabled={updating}
                          >
                            {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Resolve"}
                          </Button>
                        </div>
                      ) : i.assignee ? (
                        <div className="text-right">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Assigned</div>
                          <div className="text-sm font-medium">{i.assignee.first_name}</div>
                        </div>
                      ) : (
                        <Button
                          variant="hero"
                          size="sm"
                          className="h-8 text-xs px-4"
                          onClick={() => handleAssignToSelf(i.id)}
                          disabled={updating}
                        >
                          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pick Up"}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })
            )}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/40 p-4">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="h-8 px-3"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="h-8 px-3"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Incident Detail Modal */}
      <AnimatePresence>
        {selectedIncident && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setSelectedIncident(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-border/60 bg-surface shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary shrink-0" />

              <div className="p-6 sm:p-8 overflow-y-auto flex-1 pb-20 sm:pb-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-muted-foreground">#{selectedIncident.id.slice(0, 8)}</span>
                      <span className={`rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${urgencyStyles[selectedIncident.priority?.toLowerCase()] || urgencyStyles.low}`}>
                        {selectedIncident.priority} PRIORITY
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold font-display">{selectedIncident.title || selectedIncident.type}</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedIncident(null)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-8">
                  <div className="rounded-2xl bg-secondary/30 p-4 border border-border/40">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Status</div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      {selectedIncident.status === 'RESOLVED' ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-accent" />}
                      {selectedIncident.status}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-secondary/30 p-4 border border-border/40">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Reported</div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {(() => {
                        const d = new Date(selectedIncident.created_at || selectedIncident.createdAt);
                        return isNaN(d.getTime()) ? 'Unknown time' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                      })()}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-secondary/30 p-4 border border-border/40">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Location</div>
                    <div className="text-sm font-bold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {selectedIncident.location_name || "Campus Main"}
                    </div>
                    {selectedIncident.location_lat && selectedIncident.location_lng && (
                      <Link
                        to={`/map?incident=${selectedIncident.id}`}
                        onClick={() => setSelectedIncident(null)}
                        className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-primary hover:underline underline-offset-2"
                      >
                        <Navigation className="h-3 w-3" />
                        {Number(selectedIncident.location_lat).toFixed(5)}, {Number(selectedIncident.location_lng).toFixed(5)} — View on Map
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Report Details</h3>
                  <p className="text-foreground/80 leading-relaxed bg-background/50 rounded-2xl p-5 border border-border/30">
                    {selectedIncident.description || "No detailed description provided for this incident log."}
                  </p>
                </div>

                {(() => {
                  let mediaArray: string[] = [];
                  try {
                    if (typeof selectedIncident.media === 'string') {
                      mediaArray = JSON.parse(selectedIncident.media);
                    } else if (Array.isArray(selectedIncident.media)) {
                      mediaArray = selectedIncident.media;
                    }
                  } catch (e) {
                    console.error("Failed to parse media array", e);
                  }

                  if (mediaArray.length === 0) return null;

                  return (
                    <div className="mb-8">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">Attached Evidence</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {mediaArray.map((asset: string, idx: number) => {
                          const isCloudinaryId = !asset.startsWith('/') && !asset.startsWith('http');
                          const isVideo = isCloudinaryId
                            ? asset.includes('/video/') || asset.match(/\.(mp4|webm|mov)$/i)
                            : asset.match(/\.(mp4|webm|mov)$/i);

                          let mediaUrl: string;
                          if (isCloudinaryId) {
                            const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'safecampus';
                            const resourceType = isVideo ? 'video' : 'image';
                            mediaUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/${asset}`;
                          } else {
                            mediaUrl = asset.startsWith('/')
                              ? `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${asset}`
                              : asset;
                          }

                          return (
                            <div key={idx} className="relative aspect-square overflow-hidden rounded-xl border border-border/40 bg-black/5 group cursor-pointer" onClick={() => setViewingMedia({ url: mediaUrl, isVideo: !!isVideo })}>
                              {isVideo ? (
                                <div className="relative h-full w-full bg-black">
                                  <video src={`${mediaUrl}#t=0.1`} className="h-full w-full object-cover opacity-80" preload="metadata" />
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform group-hover:scale-110">
                                      <Play className="h-5 w-5 text-white ml-1" />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <img src={mediaUrl} alt={`Evidence ${idx + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {selectedIncident.remarks && (
                  <div className="mb-8">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-3">Security Remarks</h3>
                    <div className="text-sm text-foreground/90 leading-relaxed bg-primary/5 rounded-2xl p-5 border border-primary/20 italic">
                      "{selectedIncident.remarks}"
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4 pt-4 border-t border-border/40">
                  {role !== "STUDENT" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Transition Status</label>
                        <select
                          className="w-full h-11 rounded-xl border border-border/60 bg-background/50 px-3 text-sm focus:border-primary focus:outline-none"
                          value={selectedIncident.status}
                          onChange={(e) => handleStatusUpdate(selectedIncident.id, e.target.value)}
                          disabled={updating}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="INVESTIGATING">Investigating</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="DISMISSED">Dismissed</option>
                        </select>
                      </div>
                      <div className="space-y-1.5 text-right">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mr-1">Action Required</label>
                        {role === 'SCHOOL_ADMIN' ? (
                          <div className="h-11 flex items-center justify-end px-3 bg-secondary/50 rounded-xl border border-border/40 text-muted-foreground text-xs uppercase">
                            {selectedIncident.assignee ? `Assigned · ${selectedIncident.assignee.first_name || ''}` : 'Unassigned'}
                          </div>
                        ) : (
                          <Button 
                            className="w-full h-11 rounded-xl"
                            variant={selectedIncident.assignee_id && selectedIncident.assignee_id !== user?.id ? 'outline' : 'hero'}
                            onClick={() => handleAssignToSelf(selectedIncident.id)}
                            disabled={updating || !!selectedIncident.assignee_id}
                          >
                            {updating ? (
                              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Picking up...</>
                            ) : selectedIncident.assignee_id === user?.id ? (
                              <><CheckCircle2 className="h-4 w-4 mr-2 text-primary" /> Assigned to You</>
                            ) : selectedIncident.assignee_id ? (
                              "Already Assigned"
                            ) : (
                              "Pick Up Task"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full h-12 font-bold"
                    onClick={() => setSelectedIncident(null)}
                  >
                    Close Log View
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <MediaViewerModal 
        media={viewingMedia} 
        onClose={() => setViewingMedia(null)} 
      />
    </div>
  );
}
