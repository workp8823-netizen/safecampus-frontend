import { motion, AnimatePresence } from "framer-motion";
import { Phone, Plus, Trash2, Shield, AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Contact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

export default function EmergencyContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', relationship: '', phone: '', isPrimary: false });

  useBodyScrollLock(isAdding);

  const fetchContacts = async () => {
    try {
      const data = await apiRequest('/contacts');
      setContacts(data);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/contacts/${id}`, { method: 'DELETE' });
      toast.success("Contact removed");
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove contact");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.relationship) return;
    setSaving(true);
    try {
      await apiRequest('/contacts', {
        method: 'POST',
        data: form
      });
      toast.success(`${form.name} added to your emergency contacts`);
      setForm({ name: '', relationship: '', phone: '', isPrimary: false });
      setIsAdding(false);
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "Failed to add contact");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="mb-8">
        <Link to="/profile" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-3 w-3" /> Back to Profile
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">Safety Settings</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Emergency Contacts</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          The contacts listed below will be notified instantly when you trigger an SOS signal.
        </p>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">Syncing contacts...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center rounded-3xl border border-dashed border-border/60 bg-surface/50">
            <Phone className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="mt-4 font-bold">No Contacts</h3>
            <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">Add people to notify in emergencies.</p>
          </div>
        ) : (
          contacts.map((contact, i) => (
            <motion.div
              key={contact.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative overflow-hidden rounded-3xl border p-5 transition-all ${
                contact.is_primary ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5" : "border-border/60 bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                    contact.is_primary ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                  }`}>
                    <Phone className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                      {contact.name}
                      {contact.is_primary && <Shield className="h-3 w-3 text-primary" />}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
                      {contact.relationship} · {contact.phone}
                    </div>
                  </div>
                </div>
                {/* Always allow delete */}
                <button 
                  onClick={() => handleDelete(contact.id)}
                  className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-white transition-all"
                  title="Remove contact"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))
        )}

        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-8 rounded-3xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground group"
        >
          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
            <Plus className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold">Add New Contact</span>
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsAdding(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-3xl border border-border/60 bg-surface shadow-2xl z-10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-display">Add Emergency Contact</h2>
                <button
                  onClick={() => setIsAdding(false)}
                  className="h-8 w-8 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Full Name</label>
                  <input
                    required
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Kofi Mensah"
                    className="w-full h-11 rounded-xl border border-border bg-background/50 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Relationship</label>
                  <select
                    required
                    value={form.relationship}
                    onChange={e => setForm({ ...form, relationship: e.target.value })}
                    className="w-full h-11 rounded-xl border border-border bg-background/50 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Select relationship</option>
                    <option value="Parent">Parent</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend</option>
                    <option value="Partner">Partner</option>
                    <option value="Roommate">Roommate</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Phone Number</label>
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+233 XX XXX XXXX"
                    className="w-full h-11 rounded-xl border border-border bg-background/50 px-4 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-secondary/20">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={form.isPrimary}
                    onChange={e => setForm({ ...form, isPrimary: e.target.checked })}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <label htmlFor="isPrimary" className="text-sm font-medium cursor-pointer">
                    Set as Primary Contact
                    <p className="text-[11px] text-muted-foreground font-normal">Will receive a call when SOS is triggered</p>
                  </label>
                </div>
                <Button type="submit" variant="default" className="w-full h-12 rounded-xl" disabled={saving}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : 'Save Contact'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SOS Protocol Card */}
      <div className="mt-10 rounded-3xl border border-destructive/20 bg-destructive/5 p-6">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h4 className="text-sm font-bold text-destructive uppercase tracking-wider">SOS Protocol</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          When an SOS is triggered, your primary contact receives an automated phone call, and secondary contacts receive an SMS containing your live GPS coordinates.
        </p>
      </div>
    </div>
  );
}
