import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { 
  ClipboardList, 
  Map as MapIcon, 
  LogOut,
  Activity,
  Send,
  Settings,
  Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Logo } from "@/components/Logo";
import socket from "@/lib/socket";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api";

const securityLinks = [
  { to: "/security/dashboard", label: "My Tasks", icon: ClipboardList },
  { to: "/map", label: "Hotspot Map", icon: MapIcon },
  { to: "/incidents", label: "Incident Feed", icon: Activity },
  { to: "/alerts/new", label: "Broadcast", icon: Send },
  { to: "/security/settings", label: "Settings", icon: Settings },
];


import { getCookie, deleteCookie } from "@/lib/cookies";

export function SecurityLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore
    }
    deleteCookie('token');
    deleteCookie('user');
    deleteCookie('institutionId');
    localStorage.removeItem('token'); // Fallback
    window.location.href = '/';
  };

  const [userData, setUserData] = useState(() => {
    return getCookie('user');
  });

  useEffect(() => {
    const handleUpdate = () => {
      setUserData(getCookie('user'));
    };
    window.addEventListener('user-updated', handleUpdate);
    return () => window.removeEventListener('user-updated', handleUpdate);
  }, []);

  const badgeNumber = userData?.badge_number || (userData?.id ? userData.id.slice(-4).toUpperCase() : "4412");
  const firstName = userData?.first_name || userData?.firstName;
  const lastName = userData?.last_name || userData?.lastName;
  const isDefault = (firstName === 'Security' && lastName === 'Officer') || (firstName === 'Pending' && lastName === 'Invite');
  const officerName = userData && !isDefault ? `${firstName} ${lastName}` : "Officer";

  const [notifications, setNotifications] = useState<any[]>([]);
  const hasUnread = notifications.some(n => !n.read);

  useEffect(() => {
    const fetchInitialAlerts = async () => {
      try {
        const alerts = await apiRequest('/alerts');
        const formatted = alerts.slice(0, 10).map((a: any) => ({
          id: a.id,
          type: a.type,
          message: a.title,
          time: new Date(a.created_at),
          read: true
        }));
        setNotifications(formatted);
      } catch (err) {
        console.error("Failed to fetch initial alerts", err);
      }
    };

    if (userData?.institution?.id) {
      fetchInitialAlerts();
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit('join-institution', userData.institution.id);

      const handleAlert = (data: any) => {
        setNotifications(prev => [{
          id: Date.now(),
          type: data.type || 'ALERT',
          message: data.title || data.message || 'New incident reported',
          time: new Date(),
          read: false
        }, ...prev].slice(0, 10));
        
        toast.error(`🔔 ${data.title || 'New Alert'}`, {
           description: data.description || data.message
        });
      };

      socket.on('new-incident', handleAlert);
      socket.on('sos-alert', handleAlert);
      socket.on('system-alert', handleAlert);

      return () => {
        socket.off('new-incident', handleAlert);
        socket.off('sos-alert', handleAlert);
        socket.off('system-alert', handleAlert);
      };
    }
  }, [userData]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col pb-20 sm:pb-0">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="ml-2 hidden sm:inline-flex rounded-full bg-destructive/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-destructive border border-destructive/20">
            Security Force
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800">
                <Bell className="h-5 w-5" />
                {hasUnread && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive border-2 border-slate-900 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 mr-4 mt-2 bg-slate-900 border-slate-800 text-slate-100 z-[5000]" align="end">
              <div className="flex items-center justify-between p-4 border-b border-slate-800">
                <h3 className="font-bold text-sm">Duty Alerts</h3>
                {hasUnread && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-[10px] uppercase font-bold tracking-wider text-slate-500 hover:text-slate-300">
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500 italic">
                    No active alerts.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {notifications.map(n => (
                      <div key={n.id} className={`p-4 hover:bg-slate-800/50 transition-colors ${!n.read ? 'bg-destructive/5' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.type === 'CRITICAL' ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'bg-blue-500'}`} />
                          <div>
                            <p className="text-xs font-medium text-slate-200 leading-tight">{n.message}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Just now</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-slate-500">Officer On Duty</span>
            <span className="text-sm font-medium">{officerName} (Badge #{badgeNumber})</span>
          </div>
          <div className="sm:hidden flex flex-col items-end mr-1">
            <span className="text-[9px] uppercase font-bold text-slate-500 leading-tight">Badge</span>
            <span className="text-xs font-bold text-slate-300 leading-tight">#{badgeNumber}</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Desktop Navigation Tabs (Hidden on mobile) */}
      <nav className="hidden sm:block bg-slate-900 border-b border-slate-800 px-6">
        <div className="flex gap-1 max-w-4xl mx-auto">
          {securityLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-6 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                  active ? "text-primary" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </div>
                {active && (
                  <motion.div 
                    layoutId="security-nav-line" 
                    className="absolute bottom-0 left-0 right-0 h-1 bg-primary shadow-[0_0_12px_var(--primary)]" 
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[3000] sm:hidden bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 px-2 pb-6 pt-3">
        <div className="flex items-center justify-around">
          {securityLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center gap-1 transition-all ${
                  active ? "text-primary" : "text-slate-500"
                }`}
              >
                <link.icon className={`h-5 w-5 ${active ? "animate-pulse" : ""}`} />
                <span className="text-[9px] font-bold uppercase tracking-tighter">{link.label.split(' ')[0]}</span>
                {active && (
                  <motion.div 
                    layoutId="security-nav-dot" 
                    className="h-1 w-1 rounded-full bg-primary mt-0.5" 
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto w-full">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            {children}
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
}
