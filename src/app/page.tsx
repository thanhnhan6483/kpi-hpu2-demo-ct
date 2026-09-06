"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  Building,
  Download,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { apiGet } from "@/lib/api";
import { getProgress } from "@/lib/workProgress";
import {
  academicYearOfMonth,
  activeIndicatorCodes,
  buildIndicatorRows,
  downloadCsv,
} from "@/lib/indicatorReport";
import type {
  IndicatorRow,
  IndicatorStatusKey,
  MeasurementUnit,
  WorkEvidence,
} from "@/lib/indicatorReport";
import type {
  KHCTTask,
  KPIGroup,
  SchoolKPICatalog,
  SyncLog,
  UnitWorkReport,
  UnitWorkTask,
} from "@/types";

// Palette biểu đồ theo theme: xanh dương (#1f5ca9) + xanh ngọc (#00afef)
const CTU_BLUE = "#1f5ca9";
const CTU_TEAL = "#00afef";
const chartPalette = [
  CTU_BLUE,
  CTU_TEAL,
  "#174a86",
  "#5b93d1",
  "#66c6ea",
  "#0094cc",
  "#4caf50",
  "#ff9800",
  "#9c27b0",
  "#f44336",
  "#00bcd4",
  "#e91e63",
  "#8d6e63",
];

const gradeColors: Record<string, string> = {
  "Xuất sắc": "#4caf50",
  Tốt: "#2196f3",
  Đạt: "#ff9800",
  "Cần cải thiện": "#ffc107",
  "Không đạt": "#f44336",
};

const chipBg: Record<IndicatorStatusKey, string> = {
  ok: "bg-accent-green",
  partial: "bg-accent-yellow",
  updating: "bg-primary",
  fail: "bg-accent-red",
  no_data: "bg-gray-300 text-gray-600",
};

const statusRank: Record<IndicatorStatusKey, number> = {
  fail: 0,
  partial: 1,
  updating: 2,
  no_data: 3,
  ok: 4,
};

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    const step = Math.max(1, Math.ceil(end / 60));
    const timer = setInterval(() => {
      start += step;
      if (start >= end) {
        start = end;
        clearInterval(timer);
      }
      setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}</>;
}

function shortName(s: string): string {
  return s.length > 14 ? `${s.slice(0, 14)}…` : s;
}

function timeAgo(ts: number): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return `${Math.floor(days / 30)} tháng trước`;
}

function monthShort(month: string): string {
  return month.replace(/\/20(\d{2})$/, "/$1");
}

function monthOrder(month: string): number {
  const [m, y] = month.split("/").map(s => Number(s));
  return (y || 0) * 12 + (m || 0);
}

const gradeForScore = (score: number | null) => {
  if (score === null) return "Chưa có dữ liệu";
  if (score >= 90) return "Xuất sắc";
  if (score >= 75) return "Tốt";
  if (score >= 60) return "Đạt";
  if (score >= 40) return "Cần cải thiện";
  return "Không đạt";
};

export default function DashboardPage() {
  const [indicators, setIndicators] = useState<SchoolKPICatalog[]>([]);
  const [tasks, setTasks] = useState<KHCTTask[]>([]);
  const [workTasks, setWorkTasks] = useState<UnitWorkTask[]>([]);
  const [evidences, setEvidences] = useState<WorkEvidence[]>([]);
  const [groups, setGroups] = useState<KPIGroup[]>([]);
  const [units, setUnits] = useState<MeasurementUnit[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [reports, setReports] = useState<UnitWorkReport[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedYear, setSelectedYear] = useState("");

  const load = useCallback(async () => {
    const [ind, t, w, ev, g, mu, sl, rp] = await Promise.all([
      apiGet<SchoolKPICatalog[]>("/api/school-kpi-catalog"),
      apiGet<KHCTTask[]>("/api/khct"),
      apiGet<UnitWorkTask[]>("/api/unit-work-plans"),
      apiGet<WorkEvidence[]>("/api/evidences"),
      apiGet<KPIGroup[]>("/api/kpi-groups"),
      apiGet<MeasurementUnit[]>("/api/measurement-units"),
      apiGet<SyncLog[]>("/api/sync-logs"),
      apiGet<UnitWorkReport[]>("/api/unit-work-reports"),
    ]);
    setIndicators(ind);
    setTasks(t);
    setWorkTasks(w);
    setEvidences(ev);
    setGroups(g);
    setUnits(mu);
    setSyncLogs(sl);
    setReports(rp);
    const years = Array.from(
      new Set(t.map(x => academicYearOfMonth(x.month)).filter(Boolean) as string[]),
    ).sort().reverse();
    setSelectedYear(years[0] || "");
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCodes = useMemo(() => activeIndicatorCodes(indicators), [indicators]);

  const khctTasks = useMemo(() => tasks.filter(t => t.status !== "inactive"), [tasks]);

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(khctTasks.map(t => academicYearOfMonth(t.month)).filter(Boolean) as string[]),
      ).sort().reverse(),
    [khctTasks],
  );

  const yearTasks = useMemo(
    () =>
      selectedYear
        ? khctTasks.filter(t => academicYearOfMonth(t.month) === selectedYear)
        : khctTasks,
    [khctTasks, selectedYear],
  );

  const indicatorRows = useMemo<IndicatorRow[]>(
    () => buildIndicatorRows({ indicators, tasks: yearTasks, workTasks, evidences, groups, units }),
    [indicators, yearTasks, workTasks, evidences, groups, units],
  );

  const stats = useMemo(() => {
    const okCount = indicatorRows.filter(r => r.statusKey === "ok").length;
    const failCount = indicatorRows.filter(r => r.statusKey === "fail" || r.statusKey === "partial").length;
    const noDataCount = indicatorRows.filter(r => r.statusKey === "no_data" || r.statusKey === "updating").length;
    const known = okCount + failCount;
    return {
      total: indicatorRows.length,
      okCount,
      failCount,
      noDataCount,
      completionRate: known > 0 ? Math.round((okCount / known) * 100) : 0,
    };
  }, [indicatorRows]);

  const groupStats = useMemo(() => {
    const groupsById = new Map<string, string>();
    groups.forEach(g => groupsById.set(g.id, g.name));
    const byGroup = new Map<string, IndicatorRow[]>();
    indicatorRows.forEach(r => {
      const list = byGroup.get(r.groupId) || [];
      list.push(r);
      byGroup.set(r.groupId, list);
    });
    return Array.from(byGroup.entries()).map(([id, rows], index) => {
      const ok = rows.filter(r => r.statusKey === "ok").length;
      const rate = rows.length > 0 ? Math.round((ok / rows.length) * 100) : 0;
      return {
        id,
        name: groupsById.get(id) || id,
        rows,
        ok,
        rate,
        color: chartPalette[index % chartPalette.length],
      };
    });
  }, [indicatorRows, groups]);

  const pieData = [
    { name: "Đạt", value: stats.okCount, color: CTU_TEAL },
    { name: "Đạt một phần", value: indicatorRows.filter(r => r.statusKey === "partial").length, color: "#ffc107" },
    { name: "Chưa đạt", value: indicatorRows.filter(r => r.statusKey === "fail").length, color: "#f44336" },
    { name: "Chưa có dữ liệu", value: stats.noDataCount, color: "#9e9e9e" },
  ].filter(d => d.value > 0);

  const barData = groupStats.map((g, i) => ({
    name: shortName(g.name),
    rate: g.rate,
    fill: chartPalette[i % chartPalette.length],
  }));

  const radarData = groupStats.map(g => ({
    category: shortName(g.name),
    "Thực tế": g.rate,
    "Mục tiêu": 100,
  }));

  const warningItems = useMemo(
    () =>
      [...indicatorRows]
        .filter(r => r.statusKey === "fail" || r.statusKey === "partial" || r.statusKey === "updating")
        .sort(
          (a, b) =>
            statusRank[a.statusKey] - statusRank[b.statusKey] ||
            a.indicator.code.localeCompare(b.indicator.code),
        )
        .slice(0, 4),
    [indicatorRows],
  );

  const jobsByUnit = useMemo(() => {
    const map = new Map<string, { unitId: string; unitName: string; list: UnitWorkTask[] }>();
    workTasks.forEach(w => {
      const cur = map.get(w.unitId) || { unitId: w.unitId, unitName: w.unitName, list: [] };
      cur.list.push(w);
      map.set(w.unitId, cur);
    });
    return Array.from(map.values());
  }, [workTasks]);

  const jobTotal = jobsByUnit.reduce((s, u) => s + u.list.length, 0);
  const jobDone = jobsByUnit.reduce((s, u) => s + u.list.filter(j => j.status === "done").length, 0);

  const unitRanking = useMemo(
    () =>
      jobsByUnit
        .map(u => {
          const done = u.list.filter(j => j.status === "done").length;
          const score =
            u.list.length > 0
              ? Math.round(u.list.reduce((s, j) => s + getProgress(j), 0) / u.list.length)
              : null;
          return { id: u.unitId, name: u.unitName, total: u.list.length, done, score, grade: gradeForScore(score) };
        })
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.total - a.total),
    [jobsByUnit],
  );

  interface ActivityItem {
    id: string;
    type: "sync" | "report";
    action: string;
    detail: string;
    user: string;
    badge: string;
    ts: number;
  }

  const activities = useMemo<ActivityItem[]>(() => {
    const syncItems: ActivityItem[] = syncLogs.map(s => ({
      id: `sl_${s.id}`,
      type: "sync",
      action: "Đồng bộ dữ liệu",
      detail: `${s.recordsSuccess}/${s.recordsTotal} bản ghi`,
      user: "Hệ thống",
      badge: s.syncType === "manual" ? "Thủ công" : "Định kỳ",
      ts: Date.parse(s.startedAt) || 0,
    }));
    const reportItems: ActivityItem[] = reports.map(r => ({
      id: `uwr_${r.id}`,
      type: "report",
      action: `Lập báo cáo KPI tháng ${r.month}`,
      detail: `${r.summary.doneTasks}/${r.summary.totalTasks} nhiệm vụ hoàn thành`,
      user: r.unitFilterName,
      badge: r.unitFilterName,
      ts: Date.parse(r.createdAt) || 0,
    }));
    return [...syncItems, ...reportItems].sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [syncLogs, reports]);

  const activityColor: Record<string, string> = {
    sync: "#2196f3",
    report: "#4caf50",
  };

  const sortedRows = useMemo(
    () =>
      [...indicatorRows].sort(
        (a, b) =>
          statusRank[a.statusKey] - statusRank[b.statusKey] ||
          a.indicator.code.localeCompare(b.indicator.code),
      ),
    [indicatorRows],
  );

  const heatmap = useMemo(() => {
    const months = Array.from(new Set(yearTasks.map(t => t.month))).sort((a, b) => monthOrder(a) - monthOrder(b));
    const unitNames = Array.from(new Set(yearTasks.map(t => t.responsibleUnit).filter(Boolean)));
    const cell: Record<string, number> = {};
    yearTasks.forEach(t => {
      const k = `${t.responsibleUnit}||${t.month}`;
      cell[k] = (cell[k] || 0) + 1;
    });
    const rows = unitNames
      .map(unit => {
        const counts = months.map(m => cell[`${unit}||${m}`] || 0);
        return { unit, counts, total: counts.reduce((s, c) => s + c, 0) };
      })
      .sort((a, b) => b.total - a.total);
    return { months, rows };
  }, [yearTasks]);

  const heatColor = (c: number) => {
    if (c === 0) return "bg-gray-50 text-gray-400";
    if (c < 6) return "bg-blue-50 text-blue-700";
    if (c < 12) return "bg-blue-100 text-blue-700";
    if (c < 20) return "bg-teal-100 text-teal-700";
    return "bg-green-200 text-green-800";
  };

  const exportCsv = () => {
    const headers = [
      "Mã KPI",
      "Tên KPI",
      "Lĩnh vực",
      "ĐVT",
      "Chỉ tiêu giao",
      "Số nhiệm vụ",
      "NV đạt",
      "NV chưa đạt",
      "Trạng thái",
    ];
    const rows = sortedRows.map(r => [
      r.indicator.code,
      r.indicator.name,
      r.groupName,
      r.unitName || "—",
      r.indicator.target || "—",
      r.tasks.length,
      r.doneOk,
      r.fail,
      r.statusLabel,
    ]);
    downloadCsv(`tong-quan-kpi_${selectedYear || "tat-ca"}.csv`, headers, rows);
  };

  if (!loaded) {
    return (
      <div className="dashboard-page space-y-6">
        <h1 className="text-2xl font-heading font-bold text-text-dark">Tổng quan Hệ thống KPI</h1>
        <p className="text-text-light text-sm">Đang tải dữ liệu…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">
            Tổng quan Hệ thống KPI
          </h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>
                Năm học {y}
              </option>
            ))}
          </select>
          <button onClick={exportCsv} className="btn-secondary text-sm flex items-center gap-1">
            <Download size={14} />
            Xuất báo cáo
          </button>
          <a href="/quality/kpi-indicator-report" className="btn-secondary text-sm">
            Báo cáo chi tiết
          </a>
          <a href="/admin/ke-hoach-cong-tac" className="btn-primary text-sm">
            Cập nhật KPI
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {
            label: "Tổng chỉ tiêu KPI",
            value: stats.total,
            icon: BarChart2,
            color: "bg-primary",
            numeric: true,
          },
          {
            label: "Chỉ tiêu đạt",
            value: stats.okCount,
            icon: CheckCircle,
            color: "bg-accent-green",
            numeric: true,
          },
          {
            label: "Chưa đạt",
            value: stats.failCount,
            icon: AlertTriangle,
            color: "bg-accent-red",
            numeric: true,
          },
          {
            label: "Chưa có dữ liệu",
            value: stats.noDataCount,
            icon: Clock,
            color: "bg-accent-yellow",
            numeric: true,
          },
          {
            label: "Nhiệm vụ KHCT",
            value: yearTasks.length,
            icon: Target,
            color: "bg-primary",
            numeric: true,
          },
          {
            label: "Công việc đơn vị",
            value: `${jobDone}/${jobTotal}`,
            icon: Building,
            color: "bg-primary",
            numeric: false,
          },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="card dashboard-stat-card p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-text-light text-xs font-medium uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className="text-2xl font-heading font-bold text-primary mt-1">
                  {stat.numeric ? (
                    <AnimatedNumber value={stat.value as number} />
                  ) : (
                    (stat.value as string)
                  )}
                </p>
                {stat.label === "Công việc đơn vị" && (
                  <p className="text-[10px] text-text-light mt-0.5">
                    {jobsByUnit.length} đơn vị triển khai
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-lg ${stat.color} shrink-0`}>
                <Icon size={22} className="text-white" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card dashboard-card dashboard-chart-card p-4 flex flex-col items-center justify-center">
          <h3 className="font-heading font-bold text-sm text-text-dark mb-3 self-start">
            Phân loại KPI
          </h3>
          <div className="relative">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: "Chưa có dữ liệu", value: 1, color: "#e0e0e0" }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  dataKey="value"
                  stroke="none"
                >
                  {(pieData.length > 0 ? pieData : [{ name: "Chưa có dữ liệu", value: 1, color: "#e0e0e0" }]).map(
                    (entry, i) => <Cell key={i} fill={entry.color} />,
                  )}
                </Pie>
                <Tooltip formatter={(v) => [`${v} KPI`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-heading font-bold text-primary">
                <AnimatedNumber value={stats.completionRate} />%
              </span>
              <span className="text-[10px] text-text-light mt-0.5">hoàn thành</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span>{d.name}</span>
                <span className="font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card dashboard-card dashboard-chart-card p-4 lg:col-span-1">
          <h3 className="font-heading font-bold text-sm text-text-dark mb-3">
            Chỉ tiêu đạt theo lĩnh vực
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v}%`, "Chỉ tiêu đạt"]} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card dashboard-card dashboard-chart-card p-4">
          <h3 className="font-heading font-bold text-sm text-text-dark mb-3">
            Đa chiều lĩnh vực
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <PolarGrid stroke="#e0e0e0" />
              <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar name="Mục tiêu" dataKey="Mục tiêu" stroke="#e0e0e0" fill="#e0e0e0" fillOpacity={0.1} />
              <Radar name="Thực tế" dataKey="Thực tế" stroke="#0d47a1" fill="#0d47a1" fillOpacity={0.15} />
              <Tooltip formatter={(v) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card dashboard-card dashboard-data-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0 flex items-center justify-between">
            <h3 className="text-white">Bảng theo dõi KPI</h3>
            <span className="text-white/80 text-sm">{indicatorRows.length} chỉ tiêu</span>
          </div>
          <div className="dashboard-card-body p-4 flex-1 min-h-0 overflow-y-auto">
            {groupStats.map(g => (
              <div key={g.id} className="mb-4 last:mb-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-sm font-medium text-text-dark">{g.name}</span>
                  <span className="text-xs text-text-light">({g.rows.length} KPI)</span>
                  <span
                    className={`ml-auto text-xs font-bold ${g.rate >= 100 ? "text-accent-green" : g.rate >= 60 ? "text-accent-yellow" : "text-accent-red"}`}
                  >
                    {g.rate}%
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                  {g.rows.map(r => (
                    <a
                      key={r.indicator.code}
                      href="/quality/kpi-indicator-report"
                      className={`${chipBg[r.statusKey]} rounded-lg p-2 text-white hover:brightness-110 transition-all block text-center`}
                      title={`${r.indicator.code} – ${r.indicator.name} (${r.statusLabel})`}
                    >
                      <div className="text-[10px] font-bold opacity-90 truncate">
                        {r.indicator.code}
                      </div>
                      <div className="text-[11px] font-semibold leading-tight">
                        {r.tasks.length > 0 ? `${r.doneOk}/${r.tasks.length}` : "—"}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card dashboard-card dashboard-data-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0">
            <h3 className="text-white">Cảnh báo sớm</h3>
          </div>
          <div className="dashboard-card-body p-4 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              {warningItems.length === 0 && (
                <p className="text-sm text-text-light text-center py-4">Không có cảnh báo</p>
              )}
              {warningItems.map(w => (
                <div key={w.indicator.code} className="p-3 bg-bg-cream rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className="text-accent-yellow" />
                    <a
                      href="/quality/kpi-indicator-report"
                      className="font-medium text-sm text-primary hover:underline"
                    >
                      {w.indicator.code}
                    </a>
                    <span className={`badge ${w.statusCls} text-[10px] ml-auto`}>
                      {w.statusLabel}
                    </span>
                  </div>
                  <p className="text-sm text-text-dark line-clamp-2">{w.indicator.name}</p>
                  <div className="mt-2 text-xs text-text-light">
                    Nhiệm vụ đạt {w.doneOk}/{w.tasks.length}
                    {w.gapText && <span className="ml-2 text-accent-red font-medium">{w.gapText}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card dashboard-top-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0">
            <h3 className="text-white">Xếp hạng đơn vị</h3>
          </div>
          <div className="p-4 flex-1 min-h-0" style={{ overflowY: "auto" }}>
            <div className="space-y-3">
              {unitRanking.length === 0 && (
                <p className="text-sm text-text-light text-center py-4">Chưa có dữ liệu công việc đơn vị</p>
              )}
              {unitRanking.map((unit, idx) => (
                <div key={unit.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-bg-cream">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      idx < 3 ? "bg-primary text-white" : "bg-gray-100 text-text-light"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <a
                        href="/kpi/unit-work-plan"
                        className="font-medium text-sm text-text-dark hover:text-primary truncate"
                      >
                        {unit.name}
                      </a>
                      <span
                        className="text-sm font-bold shrink-0 ml-2"
                        style={{ color: unit.score === null ? "#9ca3af" : gradeColors[unit.grade] }}
                      >
                        {unit.score === null ? "—" : unit.score}
                        {unit.score !== null && "%"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="progress-bar flex-1">
                        <div
                          className="progress-fill"
                          style={{
                            width: unit.score === null ? "0%" : `${unit.score}%`,
                            backgroundColor: unit.score === null ? "#e5e7eb" : gradeColors[unit.grade],
                          }}
                        />
                      </div>
                      <span className="text-xs shrink-0 text-text-light">
                        {unit.done}/{unit.total} hoàn thành
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card dashboard-top-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0">
            <h3 className="text-white">Hoạt động gần đây</h3>
          </div>
          <div className="p-4 flex-1 min-h-0" style={{ overflowY: "auto" }}>
            <div className="space-y-3">
              {activities.length === 0 && (
                <p className="text-sm text-text-light text-center py-4">Chưa có hoạt động</p>
              )}
              {activities.map(activity => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-bg-cream"
                >
                  <div className="mt-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: activityColor[activity.type] }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={activity.type === "sync" ? "/admin/sync-logs" : "/quality/unit-work-report"}
                        className="font-medium text-sm text-text-dark hover:text-primary truncate"
                      >
                        {activity.action}
                      </a>
                      <span className="badge badge-info text-[10px] shrink-0">{activity.badge}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-text-light">
                      <span className="max-w-xs truncate">{activity.detail}</span>
                      <span>•</span>
                      <span>{activity.user}</span>
                      <span>•</span>
                      <span>{timeAgo(activity.ts)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card dashboard-table-card flex flex-col overflow-hidden">
        <div className="card-header shrink-0 flex items-center justify-between">
          <h3 className="text-white">Bảng xếp loại KPI cấp Trường</h3>
          <span className="text-white/80 text-sm">Sắp xếp theo trạng thái cần lưu ý</span>
        </div>
        <div className="dashboard-table-scroll flex-1 min-h-0 overflow-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Mã KPI</th>
                <th>Tên KPI</th>
                <th>Lĩnh vực</th>
                <th className="text-left">ĐVT</th>
                <th className="text-left">Chỉ tiêu giao</th>
                <th className="text-right">Số NV</th>
                <th className="text-right">NV đạt</th>
                <th className="text-right">NV chưa đạt</th>
                <th className="text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(r => (
                <tr key={r.indicator.code}>
                  <td>
                    <a href="/quality/kpi-indicator-report">
                      <span className="badge badge-info hover:bg-primary-light cursor-pointer">
                        {r.indicator.code}
                      </span>
                    </a>
                  </td>
                  <td className="font-medium max-w-xs truncate" title={r.indicator.name}>
                    {r.indicator.name}
                  </td>
                  <td className="text-sm">{r.groupName}</td>
                  <td className="text-sm">{r.unitName || "—"}</td>
                  <td className="text-sm font-mono">{r.indicator.target || "—"}</td>
                  <td className="text-right font-mono text-sm">{r.tasks.length}</td>
                  <td className="text-right font-bold font-mono text-sm text-accent-green">{r.doneOk}</td>
                  <td className="text-right font-mono text-sm text-accent-red">{r.fail}</td>
                  <td className="text-center">
                    <span className={`badge ${r.statusCls}`}>{r.statusLabel}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card dashboard-card dashboard-table-card flex flex-col overflow-hidden">
        <div className="card-header shrink-0">
          <h3 className="text-white flex items-center gap-2">
            <Building size={16} /> Nhiệm vụ theo Đơn vị × Tháng
          </h3>
        </div>
        <div className="dashboard-card-body p-4 flex-1 min-h-0 overflow-auto">
          {heatmap.rows.length === 0 ? (
            <p className="text-sm text-text-light text-center py-4">Chưa có dữ liệu nhiệm vụ trong năm học này</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Đơn vị</th>
                  {heatmap.months.map(m => (
                    <th key={m} className="text-center py-2 px-3 font-medium text-xs" title={m}>
                      {monthShort(m)}
                    </th>
                  ))}
                  <th className="text-center py-2 px-3 font-medium">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map(row => (
                  <tr key={row.unit} className="border-b">
                    <td className="py-2 px-3">
                      <span className="font-medium text-xs">{row.unit}</span>
                    </td>
                    {row.counts.map((c, i) => (
                      <td
                        key={`${row.unit}_${heatmap.months[i]}`}
                        className={`text-center py-2 px-3 text-xs font-medium ${heatColor(c)}`}
                        title={`${row.unit} – ${heatmap.months[i]}: ${c} nhiệm vụ`}
                      >
                        {c === 0 ? "–" : c}
                      </td>
                    ))}
                    <td className="text-center py-2 px-3 text-xs font-bold">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}