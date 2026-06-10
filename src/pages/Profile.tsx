import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { User, Mail, Shield, LogOut, Bell, ChevronRight, Phone, Users } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

import { getCookie, deleteCookie } from "@/lib/cookies";

export default function ProfilePage() {
  const user = getCookie('user');

  const [buddiesCount, setBuddiesCount] = useState(0);
  const [contactsCount, setContactsCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [buddies, contacts] = await Promise.all([
          apiRequest('/buddies'),
          apiRequest('/contacts')
        ]);
        setBuddiesCount(Array.isArray(buddies) ? buddies.length : 0);
        setContactsCount(Array.isArray(contacts) ? contacts.length : 0);
      } catch (err) {
        console.error('Failed to fetch profile stats:', err);
      }
    };
    fetchStats();
  }, []);

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore
    }
    deleteCookie('user');
    deleteCookie('institutionId');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('institutionId');
    window.location.href = '/';
  };

  const menuItems = [
    { icon: Users, label: "Safety Buddies", value: `${buddiesCount} Active`, link: "/buddies" },
    { icon: Phone, label: "Emergency Contacts", value: `${contactsCount} Contacts`, link: "/emergency-contacts" },
    { icon: Bell, label: "Notification Settings", value: "Push & Email", link: "/settings?tab=notifications" },
    { icon: Shield, label: "Profile & Security", value: "High Protection", link: "/settings?tab=security" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Profile Header */}
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-primary to-accent p-1 shadow-xl shadow-primary/20">
            <div className="h-full w-full rounded-full bg-surface flex items-center justify-center">
              <User className="h-10 w-10 text-primary" />
            </div>
          </div>
          <div className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary border-4 border-background flex items-center justify-center">
            <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
          </div>
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold">{user?.firstName || user?.first_name} {user?.lastName || user?.last_name}</h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
          <Mail className="h-3.5 w-3.5" /> {user?.email}
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-secondary/50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Shield className="h-3 w-3" /> {user?.role} · {user?.institution?.name || "Campus User"}
        </div>
      </div>

      {/* Profile Actions */}
      <div className="grid gap-4">
        {menuItems.map((item, i) => {
          const Content = (
            <div className="flex items-center justify-between p-4 rounded-2xl border border-border/40 bg-surface/50 hover:bg-secondary/30 transition-all group w-full">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">{item.label}</div>
                  {item.value && <div className="text-[10px] text-muted-foreground uppercase font-medium">{item.value}</div>}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </div>
          );

          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {item.link ? (
                <Link to={item.link}>{Content}</Link>
              ) : (
                <button className="w-full text-left">{Content}</button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Logout */}
      <div className="pt-4">
        <Button 
          variant="outline" 
          className="w-full py-6 rounded-2xl border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
        <p className="m-6 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
          SafeCampus v1.2.4 · Beta
        </p>
      </div>
    </div>
  );
}
