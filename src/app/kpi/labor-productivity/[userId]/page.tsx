'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, CheckCheck, ChevronDown, Lock, RefreshCw, Send } from 'lucide-react';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import academicYearsData from '@/data/academic-years.json';
import {
  aggregateByCriterion,
  computeMonthlyTotal,
  gradeForScore,
  GRADE_META,
  indicatorMeta,
  targetTextOf,
  yearMonths,
  currentMonthKey,
  effectiveProgress,
  PRODUCTIVITY_STATUS_META,
  finalScoreOf,
  finalGradeOf,
} from '@/lib/laborProductivity';
import { positionName } from '@/lib/jobPositionTemplate';
import type { SyncMonthResult } from '@/lib/khctSync';
import type { TemplateItemDef, CriterionAggRow, ProductivityGrade } from '@/lib/laborProductivity';
import type { IndividualTemplateAssignment, LaborProductivity, UnitWorkTask } from '@/types';

interface AcademicYear { id: string; name: string; startDate: string; endDate: string; status: string; }
interface UserBrief { id: string; fullName: string; employeeCode: string; unitId: string; positionId: string; status: string; }
interface UnitData { id: string; name: string; code: string; type: string; managerId: string; status: string; }
interface KpiTemplateBrief { id: string; name: string; targetLevel: string; status: string; }
interface TemplateItemBrief { id: string; templateId: string; indicatorId: string; weight: number; targetValue: number; capRate: number; }

const TASK_STATUS: Record<UnitWorkTask['status'], { label: string; cls: string }> = {
  assigned: { label: 'Chưa bắt đầu', cls: 'badge-info' },
  in_progress: { label: 'Đang thực hiện', cls: 'badge-warning' },
  done: { label: 'Hoàn thành', cls: 'badge-success' },
};

export default function LaborProductivityDetailPage() {
  const { data: session } = useSession();
  const params = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentUserId = session?.user?.id || 'u001';
  const userId = params.userId;
  const activeYear = (academicYearsData as AcademicYear[]).find(y => y.status === 'active');
  const yearId = activeYear?.id || '';
  const [month, setMonth] = useState(searchParams.get('month') || currentMonthKey());
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [units, setUnits] = useState<UnitData[]>([]);
  const [templates, setTemplates] = useState<KpiTemplateBrief[]>([]);
  const [items, setItems] = useState<TemplateItemBrief[]>([]);
  const [asgs, setAsgs] = useState<IndividualTemplateAssignment[]>([]);
  const [records, setRecords] = useState<LaborProductivity[]>([]);
  const [tasks, setTasks] = useState<UnitWorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scoreText, setScoreText] = useState('');
  const [selGrade, setSelGrade] = useState<ProductivityGrade>('C');
  const [noteText, setNoteText] = useState('');
  const [revScore, setRevScore] = useState('');
  const [revGrade, setRevGrade] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (key: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    const m = searchParams.get('month');
    if (m) setMonth(m);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, un, t, it, a, r, ts] = await Promise.all([
        apiGet<UserBrief[]>('/api/users'),
        apiGet<UnitData[]>('/api/units'),
        apiGet<KpiTemplateBrief[]>('/api/kpi-templates'),
        apiGet<TemplateItemBrief[]>('/api/kpi-template-items'),
        apiGet<IndividualTemplateAssignment[]>(`/api/individual-template-assignments?academicYearId=${yearId}`),
        apiGet<LaborProductivity[]>(`/api/labor-productivity?academicYearId=${yearId}`),
        apiGet<UnitWorkTask[]>('/api/unit-work-plans'),
      ]);
      setUsers(u.filter(x => x.status === 'active'));
      setUnits(un);
      setTemplates(t.filter(x => x.targetLevel === 'individual'));
      setItems(it);
      setAsgs(a);
      setRecords(r);
      setTasks(ts);
      setMessage('');
    } catch {
      setMessage('Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => { load(); }, [load]);

  const monthOptions = useMemo(() => {
    const year = (academicYearsData as AcademicYear[]).find(y => y.id === yearId);
    return year ? yearMonths(year.startDate) : yearMonths();
  }, [yearId]);

  const user = users.find(x => x.id === userId);
  const unit = units.find(x => x.id === user?.unitId);
  const canManage = !!user && (currentUserId === 'u001' || (!!unit && unit.managerId === currentUserId));
  const canCouncil = currentUserId === 'u001' || currentUserId === 'u002';
  const canSaveSelf = !!user && (user.id === currentUserId || canManage);
  const role = (searchParams.get('role') || 'self') as 'self' | 'manager' | 'council';

  const asgByUser: Record<string, IndividualTemplateAssignment> = {};
  asgs.forEach(a => { asgByUser[a.userId] = a; });
  const tplName: Record<string, string> = {};
  templates.forEach(t => { tplName[t.id] = t.name; });
  const itemsByTpl: Record<string, TemplateItemBrief[]> = {};
  items.forEach(i => {
    (itemsByTpl[i.templateId] = itemsByTpl[i.templateId] || []).push(i);
  });

  const defsByTpl: Record<string, TemplateItemDef[]> = {};
  Object.entries(itemsByTpl).forEach(([tplId, list]) => {
    defsByTpl[tplId] = list
      .filter(i => indicatorMeta[i.indicatorId])
      .map(i => ({
        templateItemId: i.id,
        criterionCode: i.indicatorId,
        criterionName: indicatorMeta[i.indicatorId].name,
        target: targetTextOf(i.indicatorId),
        unit: indicatorMeta[i.indicatorId].unit,
        weight: i.weight,
      }));
  });

  const asg = user ? asgByUser[user.id] : undefined;
  const templateName = asg ? (tplName[asg.kpiTemplateId] || asg.kpiTemplateId) : '';
  const rec = records.find(r => r.userId === userId && r.month === month);

  const computed = (() => {
    if (!user || !asg) return { rows: [] as CriterionAggRow[], totalScore: 0, grade: 'C' as ProductivityGrade };
    const defs = defsByTpl[asg.kpiTemplateId] || [];
    const userTasks = tasks.filter(t => t.primaryUserId === user.id && t.month === month && t.templateId === asg.kpiTemplateId && !!t.templateItemId);
    const rows = aggregateByCriterion(userTasks, defs, month);
    const totalScore = computeMonthlyTotal(rows);
    return { rows, totalScore, grade: gradeForScore(totalScore) };
  })();

  const liveTasks = useMemo(() => tasks.filter(t => t.primaryUserId === userId && t.month === month), [tasks, userId, month]);
  const displayScore = rec?.totalScore ?? computed.totalScore;
  const displayGrade = rec?.grade ?? computed.grade;
  const totalCri = computed.rows.length;
  const totalDone = computed.rows.reduce((s, r) => s + r.completedTasks, 0);
  const totalTasks = computed.rows.reduce((s, r) => s + r.totalTasks, 0);

  useEffect(() => {
    setScoreText(String(rec?.totalScore ?? computed.totalScore));
    setSelGrade(rec?.grade ?? computed.grade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.id, month]);

  useEffect(() => {
    if (!rec) {
      setNoteText('');
      setRevScore('');
      setRevGrade('');
      return;
    }
    if (role === 'manager') {
      setNoteText(rec.managerNote || '');
      setRevScore(rec.managerScore != null ? String(rec.managerScore) : '');
      setRevGrade(rec.managerGrade || '');
    } else if (role === 'council') {
      setNoteText(rec.councilNote || '');
      setRevScore(rec.councilScore != null ? String(rec.councilScore) : '');
      setRevGrade(rec.councilGrade || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.id, month, role]);

  const handleSync = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const res = await apiPost<{ synced: SyncMonthResult }>('/api/unit-work-plans/sync-month', { userId: user.id, month });
      const fresh = await apiGet<UnitWorkTask[]>('/api/unit-work-plans');
      setTasks(fresh);
      setMessage(`Đã đồng bộ dữ liệu tháng ${month} cho ${user.fullName}: tạo ${res.synced.createdAtCount}, làm mới ${res.synced.refreshedCount} công việc.`);
    } finally {
      setSyncing(false);
    }
  };

  const parseScore = (value: string): number | undefined => {
    if (value === '') return undefined;
    const n = Number(value);
    if (isNaN(n)) return undefined;
    return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
  };

  const handleSaveSelf = async () => {
    if (!user) return;
    if (rec && rec.status === 'locked') return;
    const n = Number(scoreText);
    if (scoreText === '' || isNaN(n)) return;
    const score = Math.min(100, Math.max(0, Math.round(n * 10) / 10));
    setSaving(true);
    try {
      if (rec) {
        const updated = await apiPut<LaborProductivity>(`/api/labor-productivity/${rec.id}`, { totalScore: score, grade: selGrade });
        setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      } else if (asg) {
        const created = await apiPost<LaborProductivity>('/api/labor-productivity', {
          userId: user.id,
          userName: user.fullName,
          unitId: user.unitId,
          unitName: unit?.name || user.unitId,
          academicYearId: yearId,
          month,
          templateId: asg.kpiTemplateId,
          templateName,
          criterionRows: computed.rows,
          totalScore: score,
          grade: selGrade,
        });
        setRecords(prev => prev.some(r => r.userId === created.userId && r.month === created.month)
          ? prev.map(r => (r.userId !== created.userId || r.month !== created.month ? r : created))
          : [...prev, created]);
      }
      setScoreText(String(score));
      setMessage(`Đã lưu kết quả tự đánh giá tháng ${month} cho ${user.fullName}.`);
    } finally {
      setSaving(false);
    }
  };

  const gradeOf = (r: LaborProductivity, score: number | undefined, base: string) =>
    base || (typeof score === 'number' ? gradeForScore(score) : finalGradeOf(r));

  const handleManagerSave = async () => {
    if (!rec || rec.status === 'locked' || !user) return;
    const now = new Date().toISOString();
    const score = parseScore(revScore);
    const grade = gradeOf(rec, score, revGrade);
    setSaving(true);
    try {
      const updated = await apiPut<LaborProductivity>(`/api/labor-productivity/${rec.id}`, {
        status: 'manager_reviewed',
        managerNote: noteText,
        managerGrade: grade,
        reviewedAt: now,
        ...(typeof score === 'number' ? { managerScore: score } : {}),
      });
      setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setMessage(`Đã lưu đánh giá của trưởng đơn vị tháng ${month} cho ${user.fullName}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleCouncilSave = async (lock: boolean) => {
    if (!rec || rec.status === 'locked' || !user) return;
    const now = new Date().toISOString();
    const score = parseScore(revScore);
    const grade = gradeOf(rec, score, revGrade);
    setSaving(true);
    try {
      const updated = await apiPut<LaborProductivity>(`/api/labor-productivity/${rec.id}`, {
        status: lock ? 'locked' : 'council_reviewed',
        councilNote: noteText,
        councilGrade: grade,
        councilReviewedAt: now,
        councilReviewedBy: currentUserId,
        lockedAt: lock ? now : undefined,
        ...(typeof score === 'number' ? { councilScore: score } : {}),
      });
      setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      setMessage(`${lock ? 'Đã chốt kết quả' : 'Đã lưu đánh giá của Hội đồng'} tháng ${month} cho ${user.fullName}.`);
    } finally {
      setSaving(false);
    }
  };

  const TaskTable = ({ list }: { list: UnitWorkTask[] }) => (
    <div className="overflow-x-auto rounded-lg border border-border mt-1">
      <table className="table text-sm">
        <thead>
          <tr><th>Công việc</th><th>Chỉ tiêu</th><th>Kết quả</th><th>%</th><th>Trạng thái</th><th>Nguồn</th><th>Hạn</th></tr>
        </thead>
        <tbody>
          {list.map(t => (
            <tr key={t.id}>
              <td className="max-w-[220px]">
                <span className="font-medium text-text-dark">{t.taskName || t.title}</span>
                {t.note && <span className="block text-[11px] text-text-light">{t.note}</span>}
              </td>
              <td className="text-xs text-accent-green max-w-[180px] break-words">{t.chiTieu || '—'}</td>
              <td className="text-xs text-text-light max-w-[220px] break-words">{t.result || t.reportNote || '—'}</td>
              <td className="font-mono text-sm">{isNaN(effectiveProgress(t)) ? '—' : `${effectiveProgress(t)}%`}</td>
              <td><span className={`badge ${TASK_STATUS[t.status]?.cls || 'badge-info'}`}>{TASK_STATUS[t.status]?.label || t.status}</span></td>
              <td>{t.resultSource === 'sync'
                ? <span className="badge badge-info whitespace-nowrap">{t.syncInfo?.sourceName || 'Từ phần mềm khác'}</span>
                : <span className="badge whitespace-nowrap">Kế hoạch cá nhân</span>}</td>
              <td className="text-xs text-text-light whitespace-nowrap">{t.dueDate || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/kpi/labor-productivity" className="inline-flex items-center gap-1 text-sm text-text-light hover:text-primary">
            <ArrowLeft size={14}/> Bảng năng suất
          </Link>
          <h1 className="text-2xl font-heading font-bold text-text-dark mt-1">{role === 'manager' ? 'Quản lý ĐG' : role === 'council' ? 'Hội đồng ĐG' : 'Cá nhân ĐG'} — Năng suất lao động</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-light">Tháng:</span>
          <select value={month} onChange={e => { setMonth(e.target.value); router.replace(`/kpi/labor-productivity/${userId}?month=${encodeURIComponent(e.target.value)}${role !== 'self' ? `&role=${role}` : ''}`, { scroll: false }); }}
            className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
            {monthOptions.map(m => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-text-dark">{message}</div>
      )}

      {loading && <div className="p-8 text-center text-text-light">Đang tải...</div>}

      {!loading && !user && (
        <div className="card p-8 text-center text-text-light">Không tìm thấy nhân sự này.</div>
      )}

      {!loading && user && (() => {
        if (role === 'manager' && !canManage) return <div className="card p-8 text-center text-text-light">Bạn không có quyền truy cập màn Quản lý ĐG.</div>;
        if (role === 'council' && !canCouncil) return <div className="card p-8 text-center text-text-light">Bạn không có quyền truy cập màn Hội đồng ĐG.</div>;
        return (
        <>
          <div className="card">
            <div className="card-header flex flex-wrap items-center justify-between gap-3">
              <span>Thông tin nhân sự</span>
              {canManage && (
                <button onClick={handleSync} disabled={syncing} className="bg-white text-primary hover:bg-primary-light font-medium px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-sm">
                  <RefreshCw size={12}/> {syncing ? 'Đang đồng bộ...' : 'Đồng bộ dữ liệu'}
                </button>
              )}
            </div>
            <div className="p-4">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-lg lg:text-xl font-heading font-bold text-text-dark">{user.fullName}</span>
                    <span className="text-xs text-text-light font-mono">{user.employeeCode}</span>
                    {rec ? (
                      <span className={`badge ${PRODUCTIVITY_STATUS_META[rec.status]?.cls || 'badge-info'}`}>{PRODUCTIVITY_STATUS_META[rec.status]?.label || rec.status}</span>
                    ) : (
                      <span className="badge badge-info">Dự kiến (chưa lưu)</span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-bg-cream px-2.5 py-1 rounded-md text-text-light">Đơn vị: <span className="font-medium text-text-dark">{unit?.name || user.unitId}</span></span>
                    <span className="text-xs bg-bg-cream px-2.5 py-1 rounded-md text-text-light">Vị trí: <span className="font-medium text-text-dark">{positionName(user.positionId) || '-'}</span></span>
                    {templateName && (
                      <span className="text-xs bg-bg-cream px-2.5 py-1 rounded-md text-text-light">Bộ KPI mẫu: <span className="font-medium text-text-dark">{templateName}</span></span>
                    )}
                    <span className="text-xs bg-bg-cream px-2.5 py-1 rounded-md text-text-light">Tháng đánh giá: <span className="font-medium text-text-dark">{month}</span></span>
                  </div>
                </div>
                <div className="flex flex-col items-start lg:items-end border-l-2 border-primary pl-4 lg:min-w-[220px]">
                  <span className="text-[11px] uppercase tracking-wide text-text-light">Tự đánh giá</span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="kpi-number leading-none">{displayScore}</span>
                    <span className="text-sm text-text-light">/ 100</span>
                    <span className={`badge ${GRADE_META[displayGrade].cls}`}>{GRADE_META[displayGrade].label}</span>
                  </div>
                  <div className="progress-bar mt-2 w-48 max-w-full">
                    <div className="progress-fill bg-primary" style={{ width: `${Math.min(100, displayScore)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {role !== 'self' && (
            <div className="card">
              <div className="card-header">Kết quả các cấp đánh giá</div>
              <div className="p-4 divide-y divide-border">
                <div className="py-1 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium text-text-dark">Tự đánh giá</p>
                  <p className="mt-0.5 text-sm text-text-light">
                    <span className="font-mono font-bold text-text-dark">{displayScore}</span> điểm
                    <span className={`badge ml-1 ${GRADE_META[displayGrade].cls}`}>{GRADE_META[displayGrade].label}</span>
                  </p>
                  {rec?.selfNote && <p className="mt-1 text-sm text-text-light">{rec.selfNote}</p>}
                </div>
                <div className="py-1">
                  <p className="text-sm font-medium text-text-dark">Quản lý đánh giá</p>
                  <p className="mt-0.5 text-sm text-text-light">
                    {(typeof rec?.managerScore === 'number' || rec?.managerGrade) ? (
                      <>
                        <span className="font-mono font-bold text-text-dark">{rec.managerScore ?? displayScore}</span> điểm
                        {rec.managerGrade && <span className={`badge ml-1 ${GRADE_META[rec.managerGrade as ProductivityGrade]?.cls}`}>{GRADE_META[rec.managerGrade as ProductivityGrade]?.label || rec.managerGrade}</span>}
                      </>
                    ) : <span className="text-text-light">Chưa đánh giá</span>}
                  </p>
                  {rec?.managerNote && <p className="mt-1 text-sm text-text-light">{rec.managerNote}</p>}
                </div>
                <div className="py-1">
                  <p className="text-sm font-medium text-text-dark">Hội đồng đánh giá</p>
                  <p className="mt-0.5 text-sm text-text-light">
                    {(typeof rec?.councilScore === 'number' || rec?.councilGrade) ? (
                      <>
                        <span className="font-mono font-bold text-text-dark">{rec.councilScore ?? rec.managerScore ?? displayScore}</span> điểm
                        {rec.councilGrade && <span className={`badge ml-1 ${GRADE_META[rec.councilGrade as ProductivityGrade]?.cls}`}>{GRADE_META[rec.councilGrade as ProductivityGrade]?.label || rec.councilGrade}</span>}
                      </>
                    ) : <span className="text-text-light">Chưa đánh giá</span>}
                  </p>
                  {rec?.councilNote && <p className="mt-1 text-sm text-text-light">{rec.councilNote}</p>}
                </div>
              </div>
            </div>
          )}

          {role === 'self' && canSaveSelf && (!rec || rec.status !== 'locked') && (
            <div className="card">
              <div className="card-header">Cập nhật kết quả tự đánh giá</div>
              <div className="p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-text-light mb-1">Điểm (0–100)</label>
                    <input type="number" min={0} max={100} step={0.1} value={scoreText}
                      onChange={e => setScoreText(e.target.value)}
                      className="w-28 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-light mb-1">Xếp loại</label>
                    <select value={selGrade} onChange={e => setSelGrade(e.target.value as ProductivityGrade)}
                      className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary">
                      {(Object.keys(GRADE_META) as ProductivityGrade[]).map(g => (
                        <option key={g} value={g}>{GRADE_META[g].label}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={handleSaveSelf} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                    <Send size={14}/> {saving ? 'Đang lưu...' : 'Lưu kết quả'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {role === 'manager' && canManage && rec && rec.status !== 'locked' && (
            <div className="card">
              <div className="card-header">Quản lý đánh giá</div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">Điểm điều chỉnh của trưởng đơn vị</label>
                  <input type="number" min={0} max={100} step={0.1} value={revScore} onChange={e => setRevScore(e.target.value)}
                    className="w-40 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
                    placeholder="Để trống nếu giữ điểm tự đánh giá" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">Xếp loại theo trưởng đơn vị</label>
                  <select value={revGrade} onChange={e => setRevGrade(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary">
                    <option value="">Theo điểm tự động</option>
                    {(Object.keys(GRADE_META) as ProductivityGrade[]).map(g => (
                      <option key={g} value={g}>{GRADE_META[g].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">Nhận xét của trưởng đơn vị</label>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-y"
                    placeholder="Nhận xét về kết quả năng suất tháng (nếu có)" />
                </div>
                <div className="flex justify-end pt-2 border-t">
                  <button type="button" onClick={handleManagerSave} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                    <CheckCheck size={14}/> {saving ? 'Đang lưu...' : 'Lưu nhận xét'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {role === 'council' && canCouncil && rec && rec.status !== 'locked' && (
            <div className="card">
              <div className="card-header">Hội đồng đánh giá</div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">Điểm điều chỉnh của Hội đồng</label>
                  <input type="number" min={0} max={100} step={0.1} value={revScore} onChange={e => setRevScore(e.target.value)}
                    className="w-40 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
                    placeholder="Để trống nếu giữ điểm tự đánh giá" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">Xếp loại theo Hội đồng</label>
                  <select value={revGrade} onChange={e => setRevGrade(e.target.value)}
                    className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary">
                    <option value="">Theo điểm tự động</option>
                    {(Object.keys(GRADE_META) as ProductivityGrade[]).map(g => (
                      <option key={g} value={g}>{GRADE_META[g].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dark mb-1">Nhận xét của Hội đồng</label>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-y"
                    placeholder="Nhận xét về kết quả năng suất tháng (nếu có)" />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => handleCouncilSave(false)} disabled={saving} className="btn-secondary text-sm flex items-center gap-1">
                    <CheckCheck size={14}/> {saving ? 'Đang lưu...' : 'Lưu nhận xét'}
                  </button>
                  <button type="button" onClick={() => handleCouncilSave(true)} disabled={saving} className="btn-primary text-sm flex items-center gap-1">
                    <Lock size={14}/> {saving ? 'Đang chốt...' : 'Khóa kết quả'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header">
              Kết quả tự đánh giá theo tiêu chí
              <span className="ml-2 text-xs font-normal text-text-light">
                {totalCri} tiêu chí · {totalDone}/{totalTasks} công việc hoàn thành · {liveTasks.length} công việc trong tháng
              </span>
            </div>
            <div className="p-0">
              <div className="overflow-x-auto">
                <table className="table text-sm">
                  <thead>
                    <tr><th>Tiêu chí</th><th>Chỉ tiêu</th><th>Hoàn thành</th><th>% thực hiện</th><th>Minh chứng</th><th>Điểm</th></tr>
                  </thead>
                  <tbody>
                    {computed.rows.map(r => {
                      const key = r.templateItemId || r.criterionCode;
                      const list = liveTasks.filter(t => t.templateItemId === r.templateItemId);
                      const open = openItems.has(key);
                      return (
                        <Fragment key={key}>
                          <tr onClick={() => toggleItem(key)} className="cursor-pointer">
                            <td>
                              <button type="button"
                                onClick={e => { e.stopPropagation(); toggleItem(key); }}
                                aria-expanded={open}
                                aria-label={open ? `Thu lại công việc tiêu chí ${r.criterionName}` : `Xem công việc tiêu chí ${r.criterionName}`}
                                className="mr-1.5 align-middle text-text-light hover:text-primary">
                                <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
                              </button>
                              <span className="font-mono text-xs text-primary">{r.criterionCode}</span>
                              <span className="block text-text-dark">{r.criterionName}</span>
                            </td>
                            <td className="text-xs text-accent-green">{r.target}</td>
                            <td className="text-sm">{r.completedTasks}/{r.totalTasks}</td>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="w-9 font-mono text-sm text-right">{r.resultPct}%</span>
                                <div className="progress-bar flex-1 min-w-[60px]">
                                  <div className="progress-fill bg-primary" style={{ width: `${Math.min(100, r.resultPct)}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="text-sm">{r.hasEvidence ? <span className="badge badge-success">Có</span> : <span className="badge badge-warning">Thiếu</span>}</td>
                            <td className="font-mono font-bold">{r.score}</td>
                          </tr>
                          {open && (
                            <tr>
                              <td colSpan={6} className="p-0 border-t-0">
                                {list.length === 0 ? (
                                  <span className="block px-4 py-2 text-xs text-text-light">Chưa có công việc cho tiêu chí này.</span>
                                ) : (
                                  <TaskTable list={list} />
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {computed.rows.length === 0 && (
                      <tr><td colSpan={6} className="text-center text-text-light text-sm py-6">Người này chưa có Bộ KPI mẫu</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {(() => {
                const grouped = new Set(computed.rows.map(r => r.templateItemId));
                const ungrouped = liveTasks.filter(t => !t.templateItemId || !grouped.has(t.templateItemId));
                if (ungrouped.length === 0) return null;
                return (
                  <div className="p-4">
                    <p className="text-sm font-medium text-text-dark mb-1">Chưa gán chỉ tiêu</p>
                    <TaskTable list={ungrouped} />
                  </div>
                );
              })()}
            </div>
          </div>

          {rec && (rec.selfNote || rec.managerNote || rec.councilNote || rec.managerGrade || rec.councilGrade) && (
            <div className="card">
              <div className="card-header">Nhận xét, đánh giá</div>
              <div className="p-4 divide-y divide-border">
                {rec.selfNote && (
                  <div className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-text-dark">Tự nhận xét</p>
                    <p className="mt-1 text-sm text-text-light">{rec.selfNote}</p>
                  </div>
                )}
                {(rec.managerNote || rec.managerGrade || typeof rec.managerScore === 'number') && (
                  <div className="py-2">
                    <p className="text-sm font-medium text-text-dark">Trưởng đơn vị</p>
                    {rec.managerNote && <p className="mt-1 text-sm text-text-light">{rec.managerNote}</p>}
                    {(rec.managerGrade || typeof rec.managerScore === 'number') && (
                      <p className="mt-1 text-sm text-text-light">
                        {typeof rec.managerScore === 'number' && <span>{rec.managerScore} điểm</span>} {rec.managerGrade && `— ${GRADE_META[rec.managerGrade as ProductivityGrade]?.label || rec.managerGrade}`}
                      </p>
                    )}
                  </div>
                )}
                {(rec.councilNote || rec.councilGrade || typeof rec.councilScore === 'number') && (
                  <div className="py-2">
                    <p className="text-sm font-medium text-text-dark">Hội đồng</p>
                    {rec.councilNote && <p className="mt-1 text-sm text-text-light">{rec.councilNote}</p>}
                    {(rec.councilGrade || typeof rec.councilScore === 'number') && (
                      <p className="mt-1 text-sm text-text-light">
                        {typeof rec.councilScore === 'number' && <span>{rec.councilScore} điểm</span>} {rec.councilGrade && `— ${GRADE_META[rec.councilGrade as ProductivityGrade]?.label || rec.councilGrade}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
        );
      })()}
    </div>
  );
}