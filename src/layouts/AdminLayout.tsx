import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PageTransition } from "@/components/PageTransition";
import { 
  LayoutDashboard, 
  Shield, 
  Map as MapIcon, 
  BarChart3, 
  Settings, 
  Users, 
  LogOut,
  ChevronRight,
  Search,
  Bell,
  Menu,
  X,
  User as UserIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Logo } from "@/components/Logo";
import { useState, useEffect } from "react";
import socket from "@/lib/socket";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api";
import { getCookie, deleteCookie } from "@/lib/cookies";

const adminLinks = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/incidents", label: "All Incidents", icon: Shield },
  { to: "/map", label: "Safety Map", icon: MapIcon },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/officers", label: "Security Personnel", icon: Users },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [userData, setUserData] = useState(() => getCookie('user'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const hasUnread = notifications.some(n => !n.read);

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
          read: true // Historical are read by default
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
  }, [userData?.id]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore logout errors
    }
    deleteCookie('user');
    deleteCookie('institutionId');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('institutionId');
    window.location.href = '/';
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-[3000] w-64 border-r border-border/60 bg-surface flex flex-col transition-transform duration-300 md:translate-x-0 ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="p-6 flex items-center justify-between gap-2">
          <Logo />
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Main Menu</p>
          {adminLinks.map((link) => {
            const active = link.to === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                }`}
              >
                <link.icon className={`h-4 w-4 ${active ? "text-primary" : "group-hover:text-foreground"}`} />
                {link.label}
                {active && <ChevronRight className="ml-auto h-3 w-3" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border/40">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full md:ml-64 min-h-screen flex flex-col max-w-[100vw]">
        {/* Top Header */}
        <header className="sticky top-0 z-30 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between px-4 sm:px-8 gap-4">
            <div className="flex items-center gap-4 flex-1">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="relative w-full max-w-[200px] sm:max-w-96 hidden xs:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search records, incidents, or users..." 
                  className="w-full rounded-full border border-border/60 bg-secondary/30 py-2 pl-10 pr-4 text-xs focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/5"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Notifications" className="relative rounded-full text-muted-foreground hover:bg-secondary/80 hover:text-foreground">
                    <Bell className="h-5 w-5" />
                    {hasUnread && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive pulse-dot text-destructive border-2 border-background" />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 mr-4 mt-2" align="end">
                  <div className="flex items-center justify-between p-4 border-b border-border/50">
                    <h3 className="font-bold text-sm">System Alerts</h3>
                    {hasUnread && (
                      <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                        Mark all read
                      </Button>
                    )}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground italic">
                        All clear! No recent alerts.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-4 flex gap-3 ${!n.read ? 'bg-primary/5' : ''}`}>
                            <div className={`mt-0.5 flex-shrink-0 h-2 w-2 rounded-full ${!n.read ? 'bg-destructive pulse-dot' : 'bg-muted'}`} />
                            <div>
                              <p className={`text-sm ${!n.read ? 'font-bold' : 'font-medium text-muted-foreground'}`}>{n.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">{n.time.toLocaleTimeString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent p-px hover:opacity-90 transition-opacity">
                    <div className="h-full w-full rounded-full border-2 border-background bg-slate-900 flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
                      {userData?.first_name?.[0] || 'A'}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{userData?.first_name || 'Admin'} {userData?.last_name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{userData?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer w-full flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-8 flex-1 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
