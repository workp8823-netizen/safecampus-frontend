import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/api";
import { toast } from "sonner";

export default function AnalyticsPage({ isDemo = false }: { isDemo?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Demo mode: intercepted by api.ts → returns UG_DEMO_DATA.analytics
        const res = await apiRequest('/incidents/analytics');
        setData(res);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  // ─── Derived chart data — all from same `data` object ──────────────────────
  const trend: any[] = data?.trend || [];

  const types: any[] = (data?.typeBreakdown || []).map((t: any) => ({
    type: (t.type || 'Other').charAt(0).toUpperCase() + (t.type || 'Other').slice(1).replace(/_/g, ' ').toLowerCase(),
    count: t.count
  }));

  const pie: any[] = (data?.statusBreakdown || []).map((s: any) => ({
    name: (s.status || 'Unknown').charAt(0).toUpperCase() + (s.status || 'Unknown').slice(1).toLowerCase(),
    value: s.count,
    color: s.status === 'RESOLVED'
      ? 'oklch(0.74 0.16 158)'
      : s.status === 'INVESTIGATING'
        ? 'oklch(0.68 0.18 230)'
        : 'oklch(0.80 0.16 75)'
  }));

  // ─── PDF Export ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setIsExporting(true);
    toast.info("Generating your safety report...", { duration: 2000 });
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      const doc = new jsPDF();

      // Colour palette — explicit r,g,b (jsPDF does NOT accept spread arrays)
      const G  = { r: 16,  g: 185, b: 129 }; // SafeCampus green
      const AM = { r: 245, g: 158, b: 11  }; // Amber / warning
      const SL = { r: 241, g: 245, b: 249 }; // Slate bg
      const DK = { r: 15,  g: 23,  b: 42  }; // Dark text
      const MU = { r: 100, g: 116, b: 139 }; // Muted text
      const WH = { r: 255, g: 255, b: 255 }; // White

      // ── Cover header ────────────────────────────────────────────────────────
      doc.setFillColor(G.r, G.g, G.b);
      doc.rect(0, 0, 210, 44, 'F');

      doc.setTextColor(WH.r, WH.g, WH.b);
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      doc.text("SafeCampus", 14, 22);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Institutional Safety & Analytics Report", 14, 32);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 39);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("University of Ghana, Legon", 210 - 14, 32, { align: 'right' });

      // ── Executive Summary ──────────────────────────────────────────────────
      doc.setTextColor(DK.r, DK.g, DK.b);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Executive Summary", 14, 58);

      // Compute KPIs from data
      const totalIncidents: number =
        data?.totalIncidents
        ?? (data?.statusBreakdown?.reduce((a: number, s: any) => a + Number(s.count || 0), 0) ?? 0);

      const resolvedCount: number =
        data?.statusBreakdown?.find((s: any) => s.status === 'RESOLVED')?.count ?? 0;

      const resRate: string =
        data?.resolutionRate
        ?? (totalIncidents > 0 ? ((resolvedCount / totalIncidents) * 100).toFixed(1) + '%' : '0%');

      const pendingCount: number =
        data?.statusBreakdown?.find((s: any) => s.status === 'PENDING')?.count ?? 0;

      const avgTime: string = data?.avgResponseTime ?? 'N/A';

      const kpis = [
        { label: "Total Incidents",   value: String(totalIncidents), change: data?.incidentChange  ?? '' },
        { label: "Resolution Rate",   value: resRate,                change: data?.resRateChange   ?? '' },
        { label: "Avg Response Time", value: avgTime,                change: data?.avgResponseChange ?? '' },
        { label: "Pending Reports",   value: String(pendingCount),   change: '' },
      ];

      kpis.forEach((kpi, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = 14 + col * 95;
        const y = 65 + row * 42;   // increased row pitch to 42 (was 38)

        doc.setFillColor(SL.r, SL.g, SL.b);
        doc.roundedRect(x, y, 87, 36, 3, 3, 'F');   // height 36 (was 30)

        // Label
        doc.setTextColor(MU.r, MU.g, MU.b);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(kpi.label.toUpperCase(), x + 5, y + 9);

        // Main stat value
        doc.setTextColor(G.r, G.g, G.b);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(kpi.value, x + 5, y + 22);

        // Change badge — on its own line below the value
        if (kpi.change) {
          const col2 = kpi.change.startsWith('-') ? G : AM;
          doc.setTextColor(col2.r, col2.g, col2.b);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text(kpi.change + ' vs last week', x + 5, y + 31);
        }
      });

      // ── Weekly Activity Log ────────────────────────────────────────────────
      doc.setTextColor(DK.r, DK.g, DK.b);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("Weekly Activity Log", 14, 158);

      const trendTotal   = trend.reduce((a: number, r: any) => a + Number(r.incidents || 0), 0);
      const trendResolved = trend.reduce((a: number, r: any) => a + Number(r.resolved || 0), 0);
      const overallEff   = trendTotal > 0 ? ((trendResolved / trendTotal) * 100).toFixed(1) + '%' : '—';

      const trendRows = [
        ...trend.map((r: any) => [
          String(r.day),
          String(r.incidents),
          String(r.resolved),
          Number(r.incidents) > 0 ? ((Number(r.resolved) / Number(r.incidents)) * 100).toFixed(0) + '%' : '—'
        ]),
        ['TOTAL', String(trendTotal), String(trendResolved), overallEff]
      ];

      autoTable(doc, {
        startY: 164,
        head: [["Day", "Incidents", "Resolved", "Efficiency"]],
        body: trendRows,
        theme: "grid",
        headStyles: { fillColor: [G.r, G.g, G.b], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 9, cellPadding: 4 },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' }
        },
        didParseCell: (hookData: any) => {
          if (hookData.row.index === trendRows.length - 1) {
            hookData.cell.styles.fillColor = [226, 232, 240];
            hookData.cell.styles.fontStyle = 'bold';
          }
        }
      });

      // ── Incident Type Breakdown ────────────────────────────────────────────
      const afterTrend: number = (doc as any).lastAutoTable?.finalY ?? 0;

      if (types.length > 0) {
        doc.addPage();
        doc.setTextColor(DK.r, DK.g, DK.b);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("Incident Type Breakdown", 14, 20);

        autoTable(doc, {
          startY: 26,
          head: [["Incident Type", "Count", "% of Total"]],
          body: types.map((t: any) => [
            String(t.type),
            String(t.count),
            totalIncidents > 0 ? ((Number(t.count) / totalIncidents) * 100).toFixed(1) + '%' : '—'
          ]),
          theme: "striped",
          headStyles: { fillColor: [DK.r, DK.g, DK.b], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
          bodyStyles: { fontSize: 9, cellPadding: 4 },
          columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' } }
        });

        // ── Status Breakdown (same page, right column) ─────────────────────
        if (pie.length > 0) {
          const afterTypesY: number = (doc as any).lastAutoTable?.finalY ?? 60;
          doc.setTextColor(DK.r, DK.g, DK.b);
          doc.setFontSize(13);
          doc.setFont("helvetica", "bold");
          doc.text("Status Breakdown", 14, afterTypesY + 14);

          autoTable(doc, {
            startY: afterTypesY + 20,
            head: [["Status", "Count", "% of Total"]],
            body: pie.map((p: any) => [
              String(p.name),
              String(p.value),
              totalIncidents > 0 ? ((Number(p.value) / totalIncidents) * 100).toFixed(1) + '%' : '—'
            ]),
            theme: "striped",
            headStyles: { fillColor: [DK.r, DK.g, DK.b], textColor: [255, 255, 255], fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9, cellPadding: 4 },
            columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' }, 2: { halign: 'center' } }
          });
        }
      }

      // ── Footer on every page ───────────────────────────────────────────────
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(MU.r, MU.g, MU.b);
        doc.text(`SafeCampus Proprietary Data  ·  Page ${i} of ${pageCount}`, 105, 287, { align: "center" });
      }

      doc.save(`SafeCampus-Report-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("PDF report generated successfully!");

    } catch (err: any) {
      console.error("PDF export failed:", err);
      // Surface the real error rather than swallowing it
      toast.error("Export Failed", {
        description: err?.message || "An unexpected error occurred while generating the report."
      });
    } finally {
      setIsExporting(false);
    }
  };

  const reports = [
    { name: "Weekly Safety Report", date: "Apr 21 - Apr 27, 2026", size: "2.4 MB" },
    { name: "Monthly Trend Analysis", date: "April 2026", size: "5.1 MB" },
    { name: "Hotspot Heat Map Export", date: "Q1 2026", size: "1.8 MB" },
    { name: "Officer Response Audit", date: "April 2026", size: "3.2 MB" },
  ];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Calculating analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end"
        >
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
              Reports & insights
            </p>
            <h1 className="mt-1 font-display text-4xl font-bold tracking-tight">
              Safety Analytics
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Trends, resolutions, and institutional reports
            </p>
          </div>
          <Button variant="hero" size="sm" onClick={handleExport} disabled={isExporting}>
            {isExporting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="h-4 w-4" /> Export PDF</>
            )}
          </Button>
        </motion.div>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {(() => {
            const totalInc = data?.totalIncidents
              ?? (data?.statusBreakdown?.reduce((a: number, s: any) => a + (s.count || 0), 0) ?? 0);
            const resolvedCount = data?.statusBreakdown?.find((s: any) => s.status === 'RESOLVED')?.count ?? 0;
            const resRate = data?.resolutionRate
              ?? (totalInc > 0 ? ((resolvedCount / totalInc) * 100).toFixed(1) + '%' : '0%');
            return [
              { label: "Total incidents",    value: totalInc || "—",    change: data?.incidentChange || "+0.0%",    color: data?.incidentChange?.startsWith('-') ? "text-primary" : "text-destructive" },
              { label: "Resolution rate",    value: resRate,            change: data?.resRateChange || "+0.0%",     color: "text-primary" },
              { label: "Avg. response time", value: data?.avgResponseTime || "—", change: data?.avgResponseChange || "—", color: "text-primary" },
            ];
          })().map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border/60 bg-surface p-6"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="font-display text-3xl font-bold">{k.value}</div>
                <div className={`flex items-center gap-1 text-xs font-medium ${k.color}`}>
                  {k.change?.startsWith('-') ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />} {k.change}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl border border-border/60 bg-surface p-6 lg:col-span-2"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">
                Incidents this week
              </h3>
              <span className="font-mono text-xs text-muted-foreground">7d</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="grad-incidents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.66 0.22 25)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.66 0.22 25)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad-resolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.74 0.16 158)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.74 0.16 158)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.30 0.025 250)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" stroke="oklch(0.68 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 250)",
                    border: "1px solid oklch(0.30 0.025 250)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="incidents" stroke="oklch(0.66 0.22 25)" strokeWidth={2} fill="url(#grad-incidents)" />
                <Area type="monotone" dataKey="resolved" stroke="oklch(0.74 0.16 158)" strokeWidth={2} fill="url(#grad-resolved)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border/60 bg-surface p-6"
          >
            <h3 className="mb-4 font-display text-base font-semibold">
              Status breakdown
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pie}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pie.map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 250)",
                    border: "1px solid oklch(0.30 0.025 250)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-2">
              {pie.map((p: any) => (
                <div key={p.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{p.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border/60 bg-surface p-6 lg:col-span-2"
          >
            <h3 className="mb-4 font-display text-base font-semibold">
              Incidents by type
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={types}>
                <CartesianGrid stroke="oklch(0.30 0.025 250)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="type" stroke="oklch(0.68 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.02 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "oklch(0.30 0.025 250 / 0.3)" }}
                  contentStyle={{
                    background: "oklch(0.20 0.025 250)",
                    border: "1px solid oklch(0.30 0.025 250)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" fill="oklch(0.74 0.16 158)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-border/60 bg-surface p-6"
          >
            <h3 className="mb-4 font-display text-base font-semibold">
              Auto-generated reports
            </h3>
            <div className="space-y-2">
              {reports.map((r) => (
                <div
                  key={r.name}
                  className="group flex items-center justify-between rounded-lg border border-border/40 bg-background/40 p-3 transition-all hover:border-primary/40 hover:bg-secondary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.date} · {r.size}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon-sm" onClick={handleExport} disabled={isExporting}>
                    {isExporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
