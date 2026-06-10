import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { getCookie } from "@/lib/cookies";

export function Logo({ className = "" }: { className?: string }) {
  const user = getCookie('user');
  const to = user ? (user.role === 'SCHOOL_ADMIN' ? '/admin' : '/dashboard') : '/';

  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2.5 ${className}`}
    >
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-[0_0_20px_oklch(0.74_0.16_158/0.4)] transition-transform duration-300 group-hover:scale-105">
        <ShieldCheck className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-display text-base font-bold tracking-tight text-foreground">
          Safe<span className="text-primary">Campus</span>
        </span>
        <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          v1.0 secure
        </span>
      </div>
    </Link>
  );
}
