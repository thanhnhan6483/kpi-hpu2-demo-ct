'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  AlertTriangle, Calendar, CheckCircle, ClipboardList, Clock, FileText, Target, TrendingUp,
} from 'lucide-react';
import { apiGet } from '@/lib/api';
import academicYearsData from '@/data/academic-years.json';
import {
  GRADE_META,
  PRODUCTIVITY_STATUS_META,
  currentMonthKey,
  finalGradeOf,
  finalScoreOf,
  yearMonths,
} from '@/lib/laborProductivity';
import { positionName } from '@/lib/jobPositionTemplate';
import type { IndividualPlan, IndividualPlanItem, LaborProductivity, UnitWorkTask } from '@/types';

interface AcademicYear { id: string; name: string; startDate: string; endDate: string; status: string; }
interface UnitData { id: string; name: string; code: string; type: string; managerId: string; status: string; }
type IndividualPlanWithItems = IndividualPlan & { items: IndividualPlanItem[] };

const PLAN_STATUS_META: Record<string, { label: string }> = {
  draft: { label: 'Bản nháp' },
  submitted: { label: 'Chờ duyệt' },
  approved: { label: 'Đã duyệt' },
  committed: { label: 'Đã cam kết' },
  in_progress: { label: 'Đang thực hiện' },
};

const TASK_STATUS_META: Record<string, { label: string; cls: string }> = {
  assigned: { label: 'Mới giao', cls: 'badge-info' },
  in_progress: { label: 'Đang thực hiện', cls: 'badge-warning' },
  done: { label: 'Hoàn thành', cls: 'badge-success' },
};

const parseDay = (s?: string): Date | null => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s || '');
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
};

const isDoneTask = (t: UnitWorkTask) => t.status === 'done' || (typeof t.progress === 'number' && t.progress >= 100);

const taskProgress = (t: UnitWorkTask) => (isDoneTask(t) ? 100 : Math.min(100, Math.max(0, typeof t.progress === 'number' ? t.progress : 0)));

export default function PersonalDashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const uid = session?.user?.id || '';
  const activeYear = (academicYearsData as AcademicYear[]).find(y => y.status === 'active');
  const [month, setMonth] = useState(currentMonthKey());
  const [plans, setPlans] = useState<IndividualPlan[]>([]);
  const [tasks, setTasks] = useState<UnitWorkTask[]>([]);
  const [rec, setRec] = useState<LaborProductivity | null>(null);
  const [unitName, setUnitName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [pl, tk, lp, un] = await Promise.all([
        apiGet<IndividualPlan[]>(`/api/individual-plans?userId=${uid}`),
        apiGet<UnitWorkTask[]>(`/api/unit-work-plans?primaryUserId=${uid}`),
        apiGet<LaborProductivity[]>(`/api/labor-productivity?userId=${uid}&month=${encodeURIComponent(month)}&academicYearId=${activeYear?.id || ''}`),
        apiGet<UnitData[]>('/api/units'),
      ]);
      setPlans(pl);
      setTasks(tk);
      setRec(lp[0] || null);
      setUnitName(un.find(x => x.id === session?.user?.unitId)?.name || '');
    } catch { /* empty */ } finally {
      setLoading(false);
    }
  }, [uid, month, activeYear?.id, session?.user?.unitId]);

  useEffect(() => { load(); }, [load]);

  const myPlan = (plans.length ? [...plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null) as IndividualPlanWithItems | null;
  const kpiItems = myPlan?.items || [];
  const monthTasks = tasks.filter(t => !t.month || t.month === month);
  const doneTasks = monthTasks.filter(isDoneTask);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const overdueTasks = monthTasks.filter(t => {
    if (isDoneTask(t)) return false;
    const d = parseDay(t.dueDate);
    return !!d && d.getTime() < todayStart.getTime();
  });
  const upcomingTasks = monthTasks.filter(t => {
    if (isDoneTask(t)) return false;
    const d = parseDay(t.dueDate);
    if (!d) return false;
    const diff = Math.ceil((d.getTime() - todayStart.getTime()) / 86400000);
    return diff >= 0 && diff <= 14;
  });

  const sortedTasks = [...monthTasks].sort((a, b) => {
    const ad = isDoneTask(a) ? Infinity : parseDay(a.dueDate)?.getTime() || 0;
    const bd = isDoneTask(b) ? Infinity : parseDay(b.dueDate)?.getTime() || 0;
    if (ad !== bd) return ad - bd;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });

  const score = rec ? finalScoreOf(rec) : null;
  const grade = rec ? finalGradeOf(rec) : null;
  const statusMeta = rec ? PRODUCTIVITY_STATUS_META[rec.status] : null;

  if (authStatus === 'loading') {
    return <div className="flex items-center justify-center h-64"><p className="text-text-light">Đang tải...</p></div>;
  }

  const alerts: { icon: ReactNode; text: string; rowCls: string; iconCls: string }[] = [];
  if (myPlan && myPlan.status === 'draft') {
    alerts.push({ icon: <FileText size={14} />, text: 'Kế hoạch KPI đang là bản nháp — hãy gửi duyệt.', rowCls: 'bg-yellow-50', iconCls: 'text-accent-yellow' });
  } else if (myPlan && myPlan.status === 'submitted') {
    alerts.push({ icon: <Clock size={14} />, text: 'Kế hoạch KPI đang chờ duyệt.', rowCls: 'bg-blue-50', iconCls: 'text-blue-600' });
  }
  if (!rec) {
    alerts.push({ icon: <FileText size={14} />, text: `Chưa tự đánh giá năng suất tháng ${month}.`, rowCls: 'bg-blue-50', iconCls: 'text-blue-600' });
  } else if (rec.status === 'draft') {
    alerts.push({ icon: <Clock size={14} />, text: `Đã lưu nháp tự đánh giá tháng ${month} — hãy gửi để quản lý xem xét.`, rowCls: 'bg-yellow-50', iconCls: 'text-accent-yellow' });
  }
  if (overdueTasks.length > 0) {
    alerts.push({ icon: <AlertTriangle size={14} />, text: `${overdueTasks.length} công việc đã quá hạn.`, rowCls: 'bg-red-50', iconCls: 'text-accent-red' });
  }
  if (upcomingTasks.length > 0) {
    alerts.push({ icon: <Clock size={14} />, text: `${upcomingTasks.length} công việc sắp đến hạn (≤14 ngày).`, rowCls: 'bg-yellow-50', iconCls: 'text-accent-yellow' });
  }
  if (alerts.length === 0) {
    alerts.push({ icon: <CheckCircle size={14} />, text: 'Không có cảnh báo nào.', rowCls: 'bg-green-50', iconCls: 'text-accent-green' });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Dashboard cá nhân</h1>
          <p className="text-sm text-text-light mt-1">
            <span className="font-medium text-text-dark">{session?.user?.name}</span>
            <span className="font-mono ml-1">{session?.user?.employeeCode}</span>
            <span className="mx-1.5">·</span>{unitName || '—'}
            <span className="mx-1.5">·</span>{positionName(session?.user?.positionId) || '—'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-light">Tháng</span>
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary">
            {yearMonths(activeYear?.startDate).map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-light rounded-lg"><Target size={20} className="text-primary" /></div>
            <div>
              <p className="text-text-light text-sm">Chỉ tiêu KPI</p>
              <p className="text-xl font-bold leading-tight">{kpiItems.length}</p>
              <p className="text-xs text-text-light">{myPlan ? (PLAN_STATUS_META[myPlan.status]?.label || myPlan.status) : 'Chưa có kế hoạch'}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-green/20 rounded-lg"><ClipboardList size={20} className="text-accent-green" /></div>
            <div>
              <p className="text-text-light text-sm">Công việc tháng</p>
              <p className="text-xl font-bold leading-tight">{monthTasks.length}</p>
              <p className="text-xs text-text-light">{doneTasks.length} hoàn thành</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-yellow/20 rounded-lg"><TrendingUp size={20} className="text-accent-yellow" /></div>
            <div className="min-w-0">
              <p className="text-text-light text-sm">Năng suất tháng</p>
              {score !== null ? (
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xl font-bold leading-tight text-primary">{score}</p>
                  <span className={`badge ${GRADE_META[grade as keyof typeof GRADE_META].cls}`}>{GRADE_META[grade as keyof typeof GRADE_META].label}</span>
                </div>
              ) : (
                <p className="text-xl font-bold leading-tight text-text-light">—</p>
              )}
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-red/20 rounded-lg"><AlertTriangle size={20} className="text-accent-red" /></div>
            <div>
              <p className="text-text-light text-sm">Quá hạn</p>
              <p className="text-xl font-bold leading-tight">{overdueTasks.length}</p>
              <p className="text-xs text-text-light">{upcomingTasks.length} sắp hạn</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="card-header flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-white">Chỉ tiêu KPI cá nhân</h3>
            {myPlan && (
              <span className="text-xs text-white/80 font-normal">{PLAN_STATUS_META[myPlan.status]?.label || myPlan.status}</span>
            )}
          </div>
          <div className="p-0 overflow-x-auto">
            {kpiItems.length === 0 ? (
              <div className="p-8 text-center">
                <FileText size={40} className="mx-auto text-text-light mb-3" />
                <p className="text-text-light mb-4">Bạn chưa có kế hoạch KPI cá nhân.</p>
                <Link href="/kpi/my-kpi" className="btn-secondary text-sm inline-flex items-center gap-1">Tạo kế hoạch KPI</Link>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr><th className="w-12">STT</th><th>Chỉ tiêu</th><th className="w-24">Chỉ số</th><th className="w-24">ĐVT</th><th className="w-20">Trọng số</th></tr>
                </thead>
                <tbody>
                  {kpiItems.map((it, i) => (
                    <tr key={it.kpiId}>
                      <td className="text-center text-sm text-text-light">{i + 1}</td>
                      <td className="text-sm font-medium">{it.kpiName}</td>
                      <td className="text-sm font-semibold">{it.target}</td>
                      <td className="text-sm text-text-light">{it.unit}</td>
                      <td className="text-sm">{it.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="text-white">Năng suất lao động tháng</h3></div>
          <div className="p-4">
            {rec && score !== null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="kpi-number leading-none">{score}</span>
                  <span className="text-sm text-text-light">/ 100</span>
                  <span className={`badge ${GRADE_META[grade as keyof typeof GRADE_META].cls}`}>{GRADE_META[grade as keyof typeof GRADE_META].label}</span>
                </div>
                <span className={`badge mt-2 ${statusMeta?.cls || 'badge-info'}`}>{statusMeta?.label || rec.status}</span>
                <div className="progress-bar mt-3">
                  <div className="progress-fill bg-primary" style={{ width: `${Math.min(100, score)}%` }} />
                </div>
                <p className="text-sm text-text-light mt-3">{doneTasks.length}/{monthTasks.length} công việc hoàn thành trong tháng</p>
                <Link href={`/kpi/labor-productivity/${uid}?month=${encodeURIComponent(month)}`} className="btn-primary text-sm mt-4 inline-flex items-center gap-1">
                  Xem chi tiết
                </Link>
              </>
            ) : (
              <>
                <p className="text-sm text-text-light">Chưa có kết quả tự đánh giá năng suất tháng {month}.</p>
                <p className="text-sm text-text-light mt-2">Mở màn Cá nhân ĐG để lưu điểm tự đánh giá.</p>
                <Link href={`/kpi/labor-productivity/${uid}?month=${encodeURIComponent(month)}`} className="btn-primary text-sm mt-4 inline-flex items-center gap-1">
                  Tự đánh giá
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-white">Công việc của tôi (tháng {month})</h3></div>
          <div className="p-0">
            {monthTasks.length === 0 ? (
              <p className="p-8 text-center text-text-light text-sm">Không có công việc nào trong tháng này.</p>
            ) : (
              <div className="divide-y divide-border">
                {sortedTasks.slice(0, 6).map(t => (
                  <div key={t.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium line-clamp-2">{t.title}</p>
                      <span className={`badge whitespace-nowrap ${TASK_STATUS_META[t.status]?.cls || 'badge-info'}`}>{TASK_STATUS_META[t.status]?.label || t.status}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-text-light">
                      <span className="flex items-center gap-1"><Calendar size={12} /> Hạn: {t.dueDate || '—'}</span>
                      <span>{taskProgress(t)}%</span>
                    </div>
                    <div className="progress-bar mt-1">
                      <div className={`progress-fill ${isDoneTask(t) ? 'bg-accent-green' : 'bg-primary'}`} style={{ width: `${taskProgress(t)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-heading font-bold text-sm flex items-center gap-2"><AlertTriangle size={14} /> Cảnh báo & nhắc nhở</h3>
          <div className="space-y-2 mt-3">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-center gap-2 p-2 rounded-lg ${a.rowCls}`}>
                <span className={a.iconCls}>{a.icon}</span>
                <span className="text-sm text-text-dark">{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}