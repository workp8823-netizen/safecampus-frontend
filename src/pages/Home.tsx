import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  Bell,
  MapPin,
  BarChart3,
  EyeOff,
  Users,
  ArrowRight,
  Zap,
  Activity,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Zap,
    title: "Instant Reporting",
    desc: "Submit incidents in under 30 seconds with photo evidence, location, and urgency level.",
  },
  {
    icon: Bell,
    title: "Real-Time Alerts",
    desc: "Push notifications instantly reach students and security in the affected campus zone.",
  },
  {
    icon: EyeOff,
    title: "Anonymous Mode",
    desc: "Report sensitive incidents without revealing your identity. Privacy by design.",
  },
  {
    icon: MapPin,
    title: "Hotspot Mapping",
    desc: "Visual heatmap reveals incident clusters so security can patrol smarter.",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    desc: "Auto-generated weekly and monthly reports surface trends and resolution rates.",
  },
  {
    icon: Lock,
    title: "Role-Based Access",
    desc: "Granular permissions for students, security officers, and administrators.",
  },
];

const stats = [
  { value: "< 30s", label: "Avg. report time" },
  { value: "98%", label: "Incident response" },
  { value: "24/7", label: "Live monitoring" },
  { value: "100%", label: "Encrypted data" },
];

export default function Home() {
  return (
    <div className="flex flex-col">

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="absolute left-1/2 top-0 -z-10 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[var(--gradient-glow)] blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Now in beta — Pilot at 12 institutions</span>
            </div>

            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              A safer campus,{" "}
              <span className="text-gradient">in real time.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              SafeCampus connects students, staff, and security through one
              elegant platform — instant incident reports, live alerts, and
              data-driven safety intelligence.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="hero" size="xl">
                <Link to="/onboard">
                  Onboard Institution <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="glass" size="xl">
                <Link to="/demo/dashboard">See live demo</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                End-to-end encrypted
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" />
                FERPA compliant
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                Trusted by 18,000+ users
              </div>
            </div>
          </motion.div>

          {/* Stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/40 sm:grid-cols-4"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center justify-center bg-surface px-4 py-6"
              >
                <div className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-primary">
            Core capabilities
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Everything you need to keep campus safe.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Six tightly integrated modules. Zero friction. Built for the people
            who actually use it.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group relative overflow-hidden rounded-2xl border border-border/60 bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_12px_40px_oklch(0.10_0.02_250/0.5)]"
            >
              <div className="absolute right-0 top-0 h-32 w-32 -translate-y-12 translate-x-12 rounded-full bg-primary/10 blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-surface via-surface to-primary/5 p-10 sm:p-16">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to protect your campus?
              </h2>
              <p className="mt-4 text-muted-foreground">
                Deploy SafeCampus in under a week. No infrastructure required —
                just sign in and start saving lives.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <Button asChild variant="hero" size="lg">
                <Link to="/onboard">Get started free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/demo/dashboard">See live demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
