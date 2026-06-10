import { Logo } from "@/components/Logo";
import { Mail } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border/50 bg-surface/50">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-md text-xs text-muted-foreground">
              A smarter, faster way to keep campuses safe — real-time reporting,
              alerts, and analytics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#"
              className="rounded-md border border-border/60 p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <FaGithub className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="rounded-md border border-border/60 p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <FaXTwitter className="h-4 w-4" />
            </a>
            <a
              href="#"
              className="rounded-md border border-border/60 p-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-border/40 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SafeCampus. Built for safer learning environments.</p>
          <p className="font-mono uppercase tracking-widest">
            Status: <span className="text-primary">All systems operational</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
