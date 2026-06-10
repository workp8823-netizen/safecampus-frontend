import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { 
  Home, 
  Map as MapIcon, 
  PlusCircle, 
  User, 
  Bell
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import socket from "@/lib/socket";
import { toast } from "sonner";
import { getCookie } from "@/lib/cookies";
import { apiRequest } from "@/lib/api";

const studentLinks = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/map", label: "Safety Map", icon: MapIcon },
  { to: "/report", label: "Report", icon: PlusCircle, special: true },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export function StudentLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const hasUnread = notifications.some(n => !n.read);

  const [userData, setUserData] = useState(() => getCookie('user'));

  useEffect(() => {
    const handleUpdate = () => {
      setUserData(getCookie('user'));
    };
    window.addEventListener('user-updated', handleUpdate);
    return () => window.removeEventListener('user-updated', handleUpdate);
  }, []);

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
        console.error("Failed to fetch alerts", err);
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
  }, [userData?.id]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative h-8 w-8 rounded-full bg-secondary/80 flex items-center justify-center">
                <Bell className="h-4 w-4" />
                {hasUnread && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive border-2 border-background" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 mr-4 mt-2" align="end">
              <div className="flex items-center justify-between p-4 border-b border-border/50">
                <h3 className="font-bold text-sm">Notifications</h3>
                {hasUnread && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground italic">
                    No recent alerts.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {notifications.map(n => (
                      <div key={n.id} className={`p-4 hover:bg-secondary/30 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}>
                        <div className="flex items-start gap-3">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.type === 'CRITICAL' ? 'bg-destructive' : 'bg-primary'}`} />
                          <div>
                            <p className="text-xs font-medium text-foreground leading-tight">{n.message}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Just now</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      <main className="px-6 py-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            {children}
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-[3000] px-6 pb-8 pt-4 bg-background/80 backdrop-blur-lg border-t border-border/40">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          {studentLinks.map((link) => {
            const active = location.pathname === link.to;
            if (link.special) {
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="relative -top-8 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 ring-4 ring-background"
                >
                  <link.icon className="h-8 w-8" />
                </Link>
              );
            }
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <link.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium uppercase tracking-tighter">{link.label}</span>
                {active && (
                  <motion.div 
                    layoutId="student-nav-dot" 
                    className="h-1 w-1 rounded-full bg-primary mt-0.5" 
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
