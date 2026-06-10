import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UserPlus, 
  Mail, 
  Shield, 
  MoreVertical, 
  Search, 
  Loader2, 
  CheckCircle2, 
  X,
  BadgeCheck,
  Clock,
  Trash2,
  Power,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";
import { getCookie } from "@/lib/cookies";
import { connectSocket, disconnectSocket, onOfficerActivated } from "@/lib/socket";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Officer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  badge_number: string;
}

export default function OfficersPage() {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean, officer: Officer | null }>({
    isOpen: false,
    officer: null
  });
  const [deleting, setDeleting] = useState(false);

  useBodyScrollLock(isModalOpen || deleteModal.isOpen);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchOfficers();

    const institutionId = getCookie('institutionId');
    if (institutionId) {
      connectSocket(institutionId);
      onOfficerActivated(({ id, status }) => {
        setOfficers(prev => prev.map(o => 
          o.id === id ? { ...o, status: status as any } : o
        ));
      });
    }

    return () => {
      disconnectSocket();
    };
  }, []);

  const fetchOfficers = async () => {
    try {
      const data = await apiRequest('/users/officers');
      // If data is null or undefined, default to empty array
      setOfficers(data || []);
    } catch (error: any) {
      // Handle "Not Found" or empty cases gracefully
      if (error?.status === 404 || error?.message?.toLowerCase().includes('not found')) {
        setOfficers([]);
        // Don't show an "error" toast if it's just that none exist yet
      } else {
        const msg = error?.message || 'Please check your connection or try again later.';
        toast.error(`Unable to load security personnel data: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    
    try {
      await apiRequest('/users/officers', {
        method: 'POST',
        data: { email: inviteEmail }
      });
      
      toast.success(`Invitation sent to ${inviteEmail}`);
      setIsModalOpen(false);
      setInviteEmail("");
      fetchOfficers(); // Refresh the list
    } catch (error: any) {
      console.error('Failed to invite officer:', error);
      toast.error(error.message || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleToggleStatus = async (officerId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await apiRequest(`/users/officers/${officerId}`, {
        method: 'PATCH',
        data: { status: newStatus }
      });
      toast.success(`Officer status updated to ${newStatus}`);
      fetchOfficers();
    } catch (error) {
      toast.error('Failed to update status');
    }
    setActiveDropdown(null);
  };

  const confirmDelete = (officer: Officer) => {
    setDeleteModal({ isOpen: true, officer });
    setActiveDropdown(null);
  };

  const handleDelete = async () => {
    const officerId = deleteModal.officer?.id;
    if (!officerId) return;

    setDeleting(true);
    try {
      await apiRequest(`/users/officers/${officerId}`, {
        method: 'DELETE'
      });
      toast.success('Officer removed');
      fetchOfficers();
      setDeleteModal({ isOpen: false, officer: null });
    } catch (error) {
      toast.error('Failed to remove officer');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = officers.filter(o => 
    o.email.toLowerCase().includes(search.toLowerCase()) ||
    `${o.first_name} ${o.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    o.badge_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Security Management</p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">Security Personnel</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage your on-ground security force and onboarding</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} variant="hero" className="rounded-xl shadow-lg shadow-primary/20">
            <UserPlus className="mr-2 h-4 w-4" /> Add Officer
          </Button>
        </div>

        {/* Search & Stats */}
        <div className="mb-6 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or badge..."
              className="w-full rounded-xl border border-border/60 bg-surface py-2.5 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="rounded-xl border border-border/60 bg-surface p-3 text-center">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Active Force</div>
            <div className="text-xl font-bold text-primary">{officers.filter(o => o.status === 'ACTIVE').length}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-surface p-3 text-center">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Pending Invites</div>
            <div className="text-xl font-bold text-accent">{officers.filter(o => o.status === 'PENDING').length}</div>
          </div>
        </div>

        {/* Personnel Grid */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-20 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 && search ? (
            <div className="col-span-full py-20 text-center rounded-2xl border border-dashed border-border">
              <Search className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">No results found</h3>
              <p className="text-sm text-muted-foreground">No personnel matching "{search}".</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center rounded-2xl border border-dashed border-border">
              <Shield className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">No security personnel yet</h3>
              <p className="text-sm text-muted-foreground">Click "Add Officer" to start building your security team.</p>
            </div>
          ) : (
            filtered.map((officer, i) => (
              <motion.div
                key={officer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-5 transition-all hover:border-primary/30 hover:shadow-xl group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">
                        {officer.first_name} {officer.last_name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{officer.email}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === officer.id ? null : officer.id);
                      }}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                    
                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {activeDropdown === officer.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border/60 bg-surface p-1 shadow-xl z-50"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(officer.id, officer.status)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                          >
                            <Power className="h-4 w-4" />
                            {officer.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(officer)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove Officer
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border/40 pt-4">
                  <div className="flex items-center gap-2">
                    <BadgeCheck className="h-4 w-4 text-primary" />
                    <span className="text-xs font-mono font-bold tracking-tight">{officer.badge_number}</span>
                  </div>
                  <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                    officer.status === 'ACTIVE' 
                      ? "bg-primary/10 text-primary" 
                      : officer.status === 'PENDING' 
                        ? "bg-accent/10 text-accent" 
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {officer.status === 'PENDING' && <Clock className="h-3 w-3" />}
                    {officer.status}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Invitation Modal */}
        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={() => !inviting && setIsModalOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md rounded-3xl border border-border/60 bg-surface p-8 shadow-2xl"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <UserPlus className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-bold">Onboard Officer</h2>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} disabled={inviting}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <p className="mb-6 text-sm text-muted-foreground">
                  Admins can create accounts for security personnel by providing their institutional email. An invite link will be sent to them to set their password.
                </p>

                <form onSubmit={handleInvite} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Institutional Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="email"
                        required
                        className="w-full rounded-xl border border-border bg-background/50 py-3 pl-10 pr-4 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5"
                        placeholder="officer@institution.edu"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button type="submit" variant="hero" className="w-full py-6 text-base" disabled={inviting || !inviteEmail}>
                    {inviting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>Send Invitation Link <CheckCircle2 className="ml-2 h-5 w-5" /></>
                    )}
                  </Button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteModal.isOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                onClick={() => !deleting && setDeleteModal({ isOpen: false, officer: null })}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-sm rounded-3xl border border-border/60 bg-surface p-8 shadow-2xl text-center"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">Remove Officer?</h2>
                <p className="text-sm text-muted-foreground mb-8">
                  Are you sure you want to remove <span className="font-bold text-foreground">{deleteModal.officer?.first_name} {deleteModal.officer?.last_name}</span>? This action cannot be undone and they will lose all access.
                </p>

                <div className="flex flex-col gap-3">
                  <Button 
                    variant="destructive" 
                    className="w-full py-6 rounded-xl font-bold"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Yes, Remove Personnel"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full py-6 rounded-xl"
                    onClick={() => setDeleteModal({ isOpen: false, officer: null })}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
