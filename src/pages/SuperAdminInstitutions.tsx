import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building,
  Users,
  Search,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Globe,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { ConfirmationModal } from "@/components/ConfirmationModal";

interface SystemStats {
  totalInstitutions: number;
  totalUsers: number;
  totalIncidents: number;
  activeIncidents: number;
  newInstitutions: number;
  growth: number;
  healthScore: number;
}

interface Institution {
  id: string;
  name: string;
  domain: string;
  status: 'ACTIVE' | 'SUSPENDED';
  created_at: string;
  adminCount: number;
  studentCount: number;
  securityCount: number;
  superAdminCount: number;
  totalCount: number;
}

export default function SuperAdminInstitutionsPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'suspend' | 'delete' | null;
    target: Institution | null;
  }>({
    isOpen: false,
    type: null,
    target: null
  });

  const fetchData = async () => {
    try {
      const [statsRes, instRes] = await Promise.all([
        apiRequest('/admin/stats'),
        apiRequest(`/admin/institutions?page=${page}&search=${search}`)
      ]);

      if (statsRes) setStats(statsRes);
      if (instRes && instRes.institutions) {
        setInstitutions(instRes.institutions);
        setTotalPages(instRes.pages || 1);
      }
    } catch (error: any) {
      console.error("SuperAdmin Fetch Error:", error);
      toast.error("Failed to load system data: " + (error.message || "Connection error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) fetchData();
      else setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleConfirmAction = async () => {
    if (!confirmModal.target || !confirmModal.type) return;

    const inst = confirmModal.target;
    setActionLoading(inst.id);

    try {
      if (confirmModal.type === 'suspend') {
        const newStatus = inst.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        await apiRequest(`/admin/institutions/${inst.id}/status`, {
          method: 'PATCH',
          data: { status: newStatus }
        });
        toast.success(`Institution ${newStatus.toLowerCase()} successfully`);
      } else if (confirmModal.type === 'delete') {
        await apiRequest(`/admin/institutions/${inst.id}`, {
          method: 'DELETE'
        });
        toast.success("Institution deleted permanently");
      }

      fetchData();
      setConfirmModal({ isOpen: false, type: null, target: null });
    } catch (error: any) {
      toast.error(error.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">System Governance</p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Institution Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Detailed oversight of user populations and campus status</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Onboarded Schools", value: stats?.totalInstitutions || 0, icon: Building, trend: `+${stats?.newInstitutions || 0} this month`, color: "bg-primary/10 text-primary" },
          { label: "Global Users", value: stats?.totalUsers || 0, icon: Users, trend: "Platform total", color: "bg-accent/10 text-accent" },
          { label: "Total Incidents", value: stats?.totalIncidents || 0, icon: ShieldAlert, trend: `${stats?.activeIncidents || 0} active`, color: "bg-destructive/10 text-destructive" },
          { label: "System Health", value: stats && stats.healthScore !== undefined ? `${stats.healthScore}%` : "---", icon: ShieldCheck, trend: stats && stats.healthScore > 90 ? "Healthy" : "Attention", color: "bg-primary/10 text-primary" }
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-3xl border border-border/60 bg-surface p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <TrendingUp className="h-4 w-4 text-primary opacity-30" />
            </div>
            <div className="mt-4">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.trend}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="rounded-3xl border border-border/60 bg-surface shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border/60 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search by name or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-background/50 py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="hero" className="rounded-xl h-10 gap-2" onClick={() => window.location.href = '/onboard'}>
              <Plus className="h-4 w-4" /> Add Institution
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-secondary/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-6 py-4">Institution</th>
                <th className="px-6 py-4">Domain</th>
                <th className="px-6 py-4">User Population Breakdown</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {institutions.map((inst, idx) => (
                <motion.tr
                  key={inst.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group hover:bg-secondary/10 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {inst.name[0]}
                      </div>
                      <div className="font-bold text-sm">{inst.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      {inst.domain}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      {inst.superAdminCount > 0 && (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-accent uppercase">System</span>
                          <span className="text-sm font-semibold">{inst.superAdminCount}</span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Admins</span>
                        <span className="text-sm font-semibold">{inst.adminCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Students</span>
                        <span className="text-sm font-semibold">{inst.studentCount}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Security</span>
                        <span className="text-sm font-semibold">{inst.securityCount}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${inst.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                      }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${inst.status === 'ACTIVE' ? 'bg-primary' : 'bg-destructive'}`} />
                      {inst.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-primary">
                      {inst.totalCount}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {inst.domain !== 'safecampus.edu' ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className={`cursor-pointer rounded-lg h-8 px-3 text-[10px] font-bold uppercase tracking-wider transition-all ${inst.status === 'ACTIVE' ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-primary/10 hover:text-primary'
                              }`}
                            onClick={() => setConfirmModal({ isOpen: true, type: 'suspend', target: inst })}
                            disabled={actionLoading === inst.id}
                          >
                            {actionLoading === inst.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              inst.status === 'ACTIVE' ? "Suspend" : "Activate"
                            )}
                          </Button>
                          <Button
                            className="h-8 w-8 rounded-lg text-destructive bg-destructive/10 cursor-pointer"
                            onClick={() => setConfirmModal({ isOpen: true, type: 'delete', target: inst })}
                            disabled={actionLoading === inst.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border border-border/40">
                          <ShieldCheck className="h-3 w-3" /> System Protected
                        </div>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border/60 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-8 px-3"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg h-8 px-3"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Reusable Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, target: null })}
        onConfirm={handleConfirmAction}
        isLoading={!!actionLoading}
        variant={confirmModal.type === 'delete' ? 'danger' : 'warning'}
        title={confirmModal.type === 'delete' ? "Delete Institution?" : (confirmModal.target?.status === 'ACTIVE' ? "Suspend Institution?" : "Activate Institution?")}
        message={
          confirmModal.type === 'delete'
            ? "Are you absolutely sure? This will delete all institution data including users, map configurations, and incidents. This action is IRREVERSIBLE."
            : `Are you sure you want to ${confirmModal.target?.status === 'ACTIVE' ? 'suspend' : 'activate'} ${confirmModal.target?.name}? This will affect all associated users.`
        }
        confirmText={confirmModal.type === 'delete' ? "Delete Permanently" : (confirmModal.target?.status === 'ACTIVE' ? "Suspend" : "Activate")}
      />
    </div>
  );
}
