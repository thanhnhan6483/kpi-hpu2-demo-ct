'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  BarChart2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Target,
  FileText,
  TrendingUp,
  ClipboardList,
  Download,
  Paperclip,
} from 'lucide-react';
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
} from 'recharts';
import { apiGet } from '@/lib/api';
import { synthesizeTask } from '@/lib/taskResult';
import { getProgress } from '@/lib/workProgress';
import {
  academicYearOfMonth,
  downloadCsv,
  statusClsMap,
  statusLabelMap,
} from '@/lib/indicatorReport';
import type { WorkEvidence } from '@/lib/indicatorReport';
import type { KHCTTask, UnitKPICatalog, UnitWorkReport, UnitWorkTask } from '@/types';

const CTU_BLUE = '#1f5ca9';
const CTU_TEAL = '#00afef';
const chartPalette = [
  CTU_BLUE,
  CTU_TEAL,
  '#174a86',
  '#5b93d1',
  '#66c6ea',
  '#0094cc',
  '#4caf50',
  '#ff9800',
  '#9c27b0',
  '#f44336',
];

const jobStatusLabel: Record<string, string> = {
  assigned: 'Đã giao',
  in_progress: 'Đang thực hiện',
  done: 'Hoàn thành',
};

const jobStatusCls: Record<string, string> = {
  assigned: 'badge-info',
  in_progress: 'badge-warning',
  done: 'badge-success',
};

interface OrgUnit {
  id: string;
  parentId: string | null;
  name: string;
  code?: string;
  type?: string;
  managerId?: string;
  status?: string;
}

function shortName(s: string): string {
  return s.length > 18 ? `${s.slice(0, 18)}…` : s;
}

function monthShort(month: string): string {
  return month.replace(/\/20(\d{2})$/, '/$1');
}

function monthOrder(month: string): number {
  const [m, y] = month.split('/').map(s => Number(s));
  return (y || 0) * 12 + (m || 0);
}

export default function UnitDashboardPage() {
  const { data: session } = useSession();
  const manualUnit = useRef(false);

  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [tasks, setTasks] = useState<KHCTTask[]>([]);
  const [jobs, setJobs] = useState<UnitWorkTask[]>([]);
  const [unitKpis, setUnitKpis] = useState<UnitKPICatalog[]>([]);
  const [reports, setReports] = useState<UnitWorkReport[]>([]);
  const [evidences, setEvidences] = useState<WorkEvidence[]>([]);
  const [unitId, setUnitId] = useState('');
  const [year, setYear] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, t, j, k, r, ev] = await Promise.all([
        apiGet<OrgUnit[]>('/api/units'),
        apiGet<KHCTTask[]>('/api/khct'),
        apiGet<UnitWorkTask[]>('/api/unit-work-plans'),
        apiGet<UnitKPICatalog[]>('/api/unit-kpi-catalog'),
        apiGet<UnitWorkReport[]>('/api/unit-work-reports'),
        apiGet<WorkEvidence[]>('/api/evidences'),
      ]);
      setOrgUnits(u);
      setTasks(t);
      setJobs(j);
      setUnitKpis(k);
      setReports(r);
      setEvidences(ev);

      if (!manualUnit.current) {
        const candidates = u.filter(x => x.parentId !== null);
        let defaultId = '';
        if (session?.user?.unitId && candidates.some(c => c.id === session.user.unitId)) {
          defaultId = session.user.unitId;
        }
        if (!defaultId) {
          const countByName: Record<string, number> = {};
          t.forEach(x => {
            if (x.responsibleUnit) countByName[x.responsibleUnit] = (countByName[x.responsibleUnit] || 0) + 1;
          });
          const best = candidates
            .map(c => ({ c, n: countByName[c.name] || 0 }))
            .sort((a, b) => b.n - a.n)[0];
          defaultId = best?.c.id || candidates[0]?.id || '';
        }
        setUnitId(defaultId);
      }

      const years = Array.from(
        new Set(t.map(x => academicYearOfMonth(x.month)).filter(Boolean) as string[]),
      ).sort().reverse();
      setYear(years[0] || '');
    } catch (err) {
      console.error('Không tải được dữ liệu dashboard đơn vị:', err);
    } finally {
      setLoaded(true);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const activeUnit = useMemo(
    () => orgUnits.find(u => u.id === unitId) || null,
    [orgUnits, unitId],
  );

  const unitOptions = useMemo(
    () => orgUnits.filter(u => u.parentId !== null).sort((a, b) => a.name.localeCompare(b.name)),
    [orgUnits],
  );

  const khctTasks = useMemo(() => tasks.filter(t => t.status !== 'inactive'), [tasks]);

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(khctTasks.map(t => academicYearOfMonth(t.month)).filter(Boolean) as string[]),
      ).sort().reverse(),
    [khctTasks],
  );

  const yearTasks = useMemo(
    () => (year ? khctTasks.filter(t => academicYearOfMonth(t.month) === year) : khctTasks),
    [khctTasks, year],
  );

  const unitTasks = useMemo(
    () =>
      activeUnit ? yearTasks.filter(t => t.responsibleUnit === activeUnit.name) : [],
    [yearTasks, activeUnit],
  );

  const unitJobs = useMemo(
    () => (unitId ? jobs.filter(j => j.unitId === unitId) : []),
    [jobs, unitId],
  );

  const unitKpiList = useMemo(
    () => (unitId ? unitKpis.filter(k => k.orgUnitId === unitId) : []),
    [unitKpis, unitId],
  );

  const unitReports = useMemo(
    () => (unitId ? reports.filter(r => r.unitIds.includes(unitId)) : []),
    [reports, unitId],
  );

  const evidenceByJob = useMemo(() => {
    const map: Record<string, WorkEvidence[]> = {};
    evidences.forEach(ev => {
      if (ev.unitWorkPlanId) (map[ev.unitWorkPlanId] ||= []).push(ev);
    });
    return map;
  }, [evidences]);

  const unitJobsByTask = useMemo(() => {
    const map: Record<string, UnitWorkTask[]> = {};
    unitJobs.forEach(w => {
      (map[w.khctTaskId] ||= []).push(w);
    });
    return map;
  }, [unitJobs]);

  const taskRows = useMemo(() => {
    return unitTasks.map(t => {
      const jobsUnit = unitJobsByTask[t.id] || [];
      const synth = synthesizeTask(t, jobsUnit);
      return {
        task: t,
        jobs: jobsUnit,
        synth,
        statusLabel: statusLabelMap[synth.status] || 'Chưa thực hiện',
        statusCls: statusClsMap[synth.status] || 'badge-info',
      };
    });
  }, [unitTasks, unitJobsByTask]);

  const stats = useMemo(() => {
    const done = taskRows.filter(r => r.synth.status === 'done').length;
    const inProgress = taskRows.filter(r => r.synth.status === 'in_progress').length;
    const notStarted = taskRows.filter(r => r.synth.status === 'not_started').length;
    const doneJobs = unitJobs.filter(j => j.status === 'done').length;
    const latestReport = unitReports[0];
    return {
      total: taskRows.length,
      done,
      inProgress,
      notStarted,
      totalJobs: unitJobs.length,
      doneJobs,
      kpiCount: unitKpiList.length,
      reportCount: unitReports.length,
      latestRate: latestReport?.summary.completionRate ?? null,
    };
  }, [taskRows, unitJobs, unitKpiList, unitReports]);

  const pieData = [
    { name: 'Hoàn thành', value: stats.done, color: CTU_TEAL },
    { name: 'Đang thực hiện', value: stats.inProgress, color: '#ffc107' },
    { name: 'Chưa thực hiện', value: stats.notStarted, color: '#9e9e9e' },
  ].filter(d => d.value > 0);

  const monthSeries = useMemo(() => {
    const months = Array.from(new Set(yearTasks.map(t => t.month))).sort(
      (a, b) => monthOrder(a) - monthOrder(b),
    );
    return months.map(m => {
      const list = taskRows.filter(r => r.task.month === m);
      return {
        month: monthShort(m),
        'Hoàn thành': list.filter(r => r.synth.status === 'done').length,
        'Đang thực hiện': list.filter(r => r.synth.status === 'in_progress').length,
        'Chưa thực hiện': list.filter(r => r.synth.status === 'not_started').length,
      };
    });
  }, [yearTasks, taskRows]);

  const fieldData = useMemo(() => {
    const map = new Map<string, { count: number; done: number }>();
    taskRows.forEach(r => {
      const f = r.task.field || 'Khác';
      const cur = map.get(f) || { count: 0, done: 0 };
      cur.count += 1;
      if (r.synth.status === 'done') cur.done += 1;
      map.set(f, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name: shortName(name),
        count: v.count,
        done: v.done,
        rate: v.count > 0 ? Math.round((v.done / v.count) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [taskRows]);

  const now = new Date();
  const nowMonthKey = `${now.getMonth() + 1}/${now.getFullYear()}`;

  const overdue = useMemo(
    () =>
      taskRows
        .filter(r => monthOrder(r.task.month) < monthOrder(nowMonthKey) && r.synth.status !== 'done')
        .sort((a, b) => monthOrder(a.task.month) - monthOrder(b.task.month))
        .slice(0, 4),
    [taskRows, nowMonthKey],
  );

  const sortedTasks = useMemo(
    () =>
      [...taskRows].sort(
        (a, b) =>
          monthOrder(a.task.month) - monthOrder(b.task.month) ||
          a.task.field.localeCompare(b.task.field),
      ),
    [taskRows],
  );

  const orderedJobs = useMemo(() => {
    const rank: Record<string, number> = { in_progress: 0, assigned: 1, done: 2 };
    return [...unitJobs].sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  }, [unitJobs]);

  const exportCsv = () => {
    const headers = ['Tháng', 'Lĩnh vực', 'Nhiệm vụ', 'Chỉ tiêu', 'Kết quả', 'Trạng thái'];
    const rows = sortedTasks.map(r => [
      r.task.month,
      r.task.field,
      r.task.taskName,
      r.task.chiTieu || '—',
      r.task.taskResult || r.synth.result || '—',
      r.statusLabel,
    ]);
    const safeUnit = (activeUnit?.name || 'don-vi').replace(/[^\p{L}\p{N}_]/gu, '-');
    downloadCsv(`bao-cao-don-vi_${safeUnit}_${year || 'tat-ca'}.csv`, headers, rows);
  };

  if (!loaded) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-text-dark">Dashboard đơn vị</h1>
        <p className="text-text-light text-sm">Đang tải dữ liệu…</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Dashboard đơn vị</h1>
          <p className="text-text-light text-sm mt-1">
            Tổng hợp nhiệm vụ, công việc, chỉ tiêu KPI và báo cáo của đơn vị
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={unitId}
            onChange={e => {
              manualUnit.current = true;
              setUnitId(e.target.value);
            }}
            className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary"
          >
            {unitOptions.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
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
          <a href="/quality/unit-work-report" className="btn-secondary text-sm">
            Lập báo cáo
          </a>
          <a href="/kpi/unit-work-plan" className="btn-primary text-sm">
            Cập nhật công việc
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Nhiệm vụ KHCT', value: stats.total, icon: BarChart2, color: 'bg-primary', numeric: true },
          { label: 'Nhiệm vụ hoàn thành', value: stats.done, icon: CheckCircle, color: 'bg-accent-green', numeric: true },
          { label: 'Đang thực hiện', value: stats.inProgress, icon: Clock, color: 'bg-accent-yellow', numeric: true },
          { label: 'Công việc đơn vị', value: `${stats.doneJobs}/${stats.totalJobs}`, icon: ClipboardList, color: 'bg-primary', numeric: false },
          { label: 'Chỉ tiêu KPI đơn vị', value: stats.kpiCount, icon: Target, color: 'bg-primary', numeric: true },
          { label: 'Báo cáo đã lập', value: stats.reportCount, icon: FileText, color: 'bg-accent-green', numeric: true },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card dashboard-stat-card p-4 flex items-center justify-between">
              <div>
                <p className="text-text-light text-xs font-medium uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl font-heading font-bold text-primary mt-1">
                  {stat.numeric ? stat.value : (stat.value as string)}
                </p>
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
            Phân loại nhiệm vụ
          </h3>
          <div className="relative">
            <ResponsiveContainer width={220} height={220}>
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{ name: 'Chưa có dữ liệu', value: 1, color: '#e0e0e0' }]}
                  cx="50%" cy="50%" innerRadius={70} outerRadius={100}
                  dataKey="value" stroke="none"
                >
                  {(pieData.length > 0 ? pieData : [{ name: 'Chưa có dữ liệu', value: 1, color: '#e0e0e0' }]).map(
                    (entry, i) => <Cell key={i} fill={entry.color} />,
                  )}
                </Pie>
                <Tooltip formatter={(v) => [`${v} nhiệm vụ`]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-heading font-bold text-primary">{stats.total}</span>
              <span className="text-[10px] text-text-light mt-0.5">nhiệm vụ</span>
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
          <h3 className="font-heading font-bold text-sm text-text-dark mb-3">Nhiệm vụ theo tháng</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthSeries} margin={{ top: 0, right: 0, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="Hoàn thành" stackId="s" fill="#4caf50" maxBarSize={20} />
              <Bar dataKey="Đang thực hiện" stackId="s" fill="#ffc107" maxBarSize={20} />
              <Bar dataKey="Chưa thực hiện" stackId="s" fill="#9e9e9e" maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card dashboard-card dashboard-chart-card p-4">
          <h3 className="font-heading font-bold text-sm text-text-dark mb-3">
            Nhiệm vụ theo lĩnh vực công tác
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={fieldData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v, name) => [`${v} nhiệm vụ`, name] as [string, string]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
                {fieldData.map((entry, i) => (
                  <Cell key={i} fill={chartPalette[i % chartPalette.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card dashboard-card dashboard-table-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0 flex items-center justify-between">
            <h3 className="text-white">Nhiệm vụ KHCT theo tháng</h3>
            <span className="text-white/80 text-sm">{sortedTasks.length} nhiệm vụ</span>
          </div>
          <div className="dashboard-table-scroll flex-1 min-h-0 overflow-auto">
            {sortedTasks.length === 0 ? (
              <p className="text-sm text-text-light text-center py-6">Đơn vị chưa được giao nhiệm vụ KHCT trong năm học này</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th>Lĩnh vực</th>
                    <th>Nhiệm vụ</th>
                    <th className="text-left">Chỉ tiêu</th>
                    <th className="text-right">Kết quả</th>
                    <th className="text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTasks.map(r => (
                    <tr key={r.task.id}>
                      <td className="font-mono text-sm">{r.task.month}</td>
                      <td className="text-sm">{shortName(r.task.field || '—')}</td>
                      <td className="max-w-sm truncate" title={r.task.taskName}>
                        {r.task.taskName}
                      </td>
                      <td className="text-sm font-mono">{r.task.chiTieu || '—'}</td>
                      <td className="text-right font-mono text-sm">
                        {r.task.taskResult || r.synth.result || '—'}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${r.statusCls}`}>{r.statusLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card dashboard-card dashboard-data-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0">
            <h3 className="text-white">Cảnh báo nhiệm vụ quá hạn</h3>
          </div>
          <div className="dashboard-card-body p-4 flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3">
              {overdue.length === 0 && (
                <p className="text-sm text-text-light text-center py-4">Không có nhiệm vụ quá hạn</p>
              )}
              {overdue.map(w => (
                <div key={w.task.id} className="p-3 bg-bg-cream rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14} className="text-accent-yellow" />
                    <span className="font-medium text-sm text-primary">{w.task.month}</span>
                    <span className={`badge ${w.statusCls} text-[10px] ml-auto`}>{w.statusLabel}</span>
                  </div>
                  <p className="text-sm text-text-dark line-clamp-2">{w.task.taskName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card dashboard-card dashboard-data-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0">
            <h3 className="text-white">Công việc đang triển khai</h3>
          </div>
          <div className="dashboard-card-body p-4 flex-1 min-h-0 overflow-y-auto">
            {orderedJobs.length === 0 && (
              <p className="text-sm text-text-light text-center py-4">Chưa có công việc được giao cho đơn vị</p>
            )}
            <div className="space-y-3">
              {orderedJobs.map(job => {
                const pct = getProgress(job);
                const ev = evidenceByJob[job.id] || [];
                return (
                  <div key={job.id} className="p-3 bg-bg-cream rounded-lg border border-border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <a
                          href="/kpi/my-work-plan"
                          className="font-medium text-sm text-text-dark hover:text-primary line-clamp-2"
                        >
                          {job.title || job.taskName}
                        </a>
                        <div className="flex items-center gap-2 mt-1 text-xs text-text-light">
                          <span>{job.primaryUserName}</span>
                          <span>•</span>
                          <span>{job.dueDate}</span>
                          {ev.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-accent-green">
                              <Paperclip size={11} /> {ev.length}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`badge ${jobStatusCls[job.status]} text-[10px] shrink-0`}>
                        {jobStatusLabel[job.status]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="progress-bar flex-1">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold shrink-0">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card dashboard-card dashboard-data-card flex flex-col overflow-hidden">
          <div className="card-header shrink-0">
            <h3 className="text-white">Chỉ tiêu KPI đơn vị</h3>
          </div>
          <div className="dashboard-card-body p-4 flex-1 min-h-0 overflow-y-auto">
            {unitKpiList.length === 0 && (
              <p className="text-sm text-text-light text-center py-4">Đơn vị chưa được giao chỉ tiêu KPI riêng</p>
            )}
            <div className="space-y-3">
              {unitKpiList.map(k => (
                <div key={k.id} className="p-3 bg-bg-cream rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <span className="badge badge-info text-[10px]">{k.code}</span>
                    <span className="ml-auto text-xs text-text-light">
                      {k.cycle || 'Hàng năm'}
                    </span>
                  </div>
                  <p className="text-sm text-text-dark mt-1 line-clamp-2">{k.name}</p>
                  <div className="mt-1 text-xs text-text-light">
                    Chỉ tiêu giao: <span className="font-mono font-medium">{k.target || '—'}</span>
                    {k.linkedCatalogId && (
                      <span className="ml-2">
                        · Liên kết: <span className="font-mono">{k.linkedCatalogId}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card dashboard-card dashboard-table-card flex flex-col overflow-hidden">
        <div className="card-header shrink-0 flex items-center justify-between">
          <h3 className="text-white">Lịch sử báo cáo đơn vị</h3>
          <span className="text-white/80 text-sm">{unitReports.length} báo cáo</span>
        </div>
        <div className="dashboard-card-body p-4 flex-1 min-h-0 overflow-auto">
          {unitReports.length === 0 ? (
            <p className="text-sm text-text-light text-center py-4">Chưa có báo cáo nào của đơn vị</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th className="text-right">Tổng nhiệm vụ</th>
                  <th className="text-right">Hoàn thành</th>
                  <th className="text-right">Tỷ lệ</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {unitReports.map(r => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm">{r.month}</td>
                    <td className="text-right font-mono text-sm">{r.summary.totalTasks}</td>
                    <td className="text-right font-mono text-sm">{r.summary.doneTasks}</td>
                    <td className="text-right">
                      <span
                        className={`font-bold font-mono text-sm ${
                          r.summary.completionRate >= 60 ? 'text-accent-green' : 'text-accent-yellow'
                        }`}
                      >
                        {r.summary.completionRate}%
                      </span>
                    </td>
                    <td className="text-sm text-text-light">
                      {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                    </td>
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