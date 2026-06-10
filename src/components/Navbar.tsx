import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { motion } from "framer-motion";
import { Bell, Menu, X, CheckCircle2, User as UserIcon, LogOut, Settings, AlertTriangle, Shield, Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { initNotifications, subscribeToNotifications, teardownNotifications, type NotificationItem } from "@/lib/notifications";

const links: { to: string; label: string }[] = [
  { to: "/report", label: "Report" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/map", label: "Hotspot Map" },
  { to: "/analytics", label: "Analytics" },
];

import { getCookie, deleteCookie } from "@/lib/cookies";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  
  const isDemoPath = location.pathname.startsWith('/demo');
  const gatewayPaths = ["/", "/login", "/signup", "/onboard"];
  const isGatewayPath = gatewayPaths.includes(location.pathname);
  const user = getCookie('user');
  const isDemo = getCookie('isDemo') === true;
  const isLoggedIn = !!user || isDemo;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const hasUnread = notifications.some(n => !n.read);


  // 1. Initialize notification service (runs once)
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;

    // Boot the centralized notification service
    initNotifications({
      id: user.id,
      role: user.role,
      institution: user.institution,
    });
  }, [user?.id, isLoggedIn]);

  // 2. Subscribe to UI state (safe across re-renders)
  useEffect(() => {
    if (!isLoggedIn || !user?.id) return;

    // Subscribe this component to incoming notifications
    const unsub = subscribeToNotifications(notif => {
      setNotifications(prev => [notif, ...prev].slice(0, 20));
    });

    return () => {
      unsub();
    };
  }, [user?.id, isLoggedIn]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotifClick = (n: NotificationItem) => {
    // Mark this single notification as read
    setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif));
    // Navigate client-side
    if (n.url) navigate(n.url);
  };

  const handleLogout = () => {
    teardownNotifications();
    deleteCookie('user');
    deleteCookie('institutionId');
    deleteCookie('isDemo');
    window.location.href = '/login';
  };

  const navLinks = links.map(link => {
    let to = link.to;
    
    // Prefix with /demo if in demo path
    if (isDemoPath) {
      to = `/demo${link.to === "/" ? "/dashboard" : link.to}`;
    } else if (link.to === "/dashboard" && user?.role === "SCHOOL_ADMIN") {
      // Point to /admin for admins in live mode
      to = "/admin";
    }
    
    return { ...link, to };
  });

  // On gateway pages (Landing, Login, etc.), we only show minimal branding/actions
  if (isGatewayPath && !isDemoPath) {
    return (
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="sticky top-0 z-50 w-full border-b border-border/50 glass-strong"
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 pl-2 pr-3">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <UserIcon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm font-medium hidden sm:inline-block">
                      {user?.first_name || 'User'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user?.first_name} {user?.last_name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={user?.role === 'SCHOOL_ADMIN' ? '/admin' : user?.role === 'SUPER_ADMIN' ? '/super-admin' : user?.role === 'SECURITY' ? '/security/dashboard' : '/dashboard'} className="cursor-pointer w-full flex items-center">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="ghost" size="sm" className="text-sm font-medium">
                <Link to="/login">Login</Link>
              </Button>
            )}
            <Button asChild variant="hero" size="sm">
              <Link to={isLoggedIn ? "/admin" : "/signup"}>
                {isLoggedIn ? "Go to Console" : "Get Started"}
              </Link>
            </Button>
          </div>
        </nav>
      </motion.header>
    );
  }

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b border-border/50 glass-strong"
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-md bg-secondary/70 border border-border/60"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {!isDemoPath && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
                  <Bell className="h-4 w-4" />
                  {hasUnread && (
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive pulse-dot text-destructive" />
                  )}
                </Button>
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
                      All clear! No recent alerts.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {notifications.map(n => {
                        const icon = n.type === 'SOS_ALERT'
                          ? <AlertTriangle className="h-4 w-4 text-destructive" />
                          : n.type === 'NEW_INCIDENT'
                          ? <Shield className="h-4 w-4 text-accent" />
                          : <Info className="h-4 w-4 text-primary" />;
                        return (
                          <div
                            key={n.id}
                            className={`p-4 flex gap-3 cursor-pointer hover:bg-secondary/50 transition-colors ${!n.read ? 'bg-primary/5 border-l-2 border-primary' : ''}`}
                            onClick={() => handleNotifClick(n)}
                          >
                            <div className={`mt-0.5 flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full ${!n.read ? 'bg-primary/10' : 'bg-muted/50'}`}>
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-snug ${!n.read ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>{n.message}</p>
                              {n.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>}
                              <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-bold tracking-tight">{n.time.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                            </div>
                            {!n.read && <div className="mt-1.5 flex-shrink-0 h-2 w-2 rounded-full bg-primary" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {isLoggedIn ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 pl-2 pr-3">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-medium hidden sm:inline-block">
                    {user?.first_name || 'User'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.first_name} {user?.last_name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={user?.role === 'SCHOOL_ADMIN' ? '/admin' : user?.role === 'SUPER_ADMIN' ? '/super-admin' : user?.role === 'SECURITY' ? '/security/dashboard' : '/dashboard'} className="cursor-pointer w-full flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
          <Button asChild variant="hero" size="sm">
            <Link to="/signup">Get Started</Link>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t border-border/50 px-4 py-3 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {isLoggedIn ? (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/admin" onClick={() => setOpen(false)}>
                  Dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link to="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            )}
            <Button asChild variant="hero" size="sm" className="mt-2">
              <Link to={"/signup"} onClick={() => setOpen(false)}>
                Get Started
              </Link>
            </Button>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}
