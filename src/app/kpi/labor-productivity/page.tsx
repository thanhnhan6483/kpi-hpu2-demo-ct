'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calculator, Send, Lock, Download, ClipboardList, CheckCheck } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Modal from '@/components/ui/Modal';
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
  PRODUCTIVITY_STATUS_META,
} from '@/lib/laborProductivity';
import type { TemplateItemDef, CriterionAggRow, ProductivityGrade } from '@/lib/laborProductivity';
import type { IndividualTemplateAssignment, LaborProductivity, ProductivityCriterionRow, UnitWorkTask } from '@/types';

interface AcademicYear { id: string; name: string; startDate: string; endDate: string; status: string; }
interface UserBrief { id: string; fullName: string; employeeCode: string; unitId: string; positionId: string; status: string; }
interface UnitData { id: string; name: string; code: string; type: string; managerId: string; status: string; }
interface KpiTemplateBrief { id: string; name: string; targetLevel: string; status: string; }
interface TemplateItemBrief { id: string; templateId: string; indicatorId: string; weight: number; targetValue: number; capRate: number; }

interface DetailState {
  user: UserBrief;
  record: LaborProductivity | null;
  rows: CriterionAggRow[];
  totalScore: number;
  grade: ProductivityGrade;
}

export default function LaborProductivityPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id || 'u001';
  const activeYear = (academicYearsData as AcademicYear[]).find(y => y.status === 'active');
  const [yearId, setYearId] = useState(activeYear?.id || '');
  const [month, setMonth] = useState(currentMonthKey());
  const [unitFilter, setUnitFilter] = useState('');
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [units, setUnits] = useState<UnitData[]>([]);
  const [templates, setTemplates] = useState<KpiTemplateBrief[]>([]);
  const [items, setItems] = useState<TemplateItemBrief[]>([]);
  const [asgs, setAsgs] = useState<IndividualTemplateAssignment[]>([]);
  const [records, setRecords] = useState<LaborProductivity[]>([]);
  const [tasks, setTasks] = useState<UnitWorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [review, setReview] = useState<{ user: UserBrief; record: LaborProductivity } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, un, t, it, a, r, ts] = await Promise.all([
        apiGet<UserBrief[]>('/api/users'),
        apiGet<UnitData[]>('/api/units'),
        apiGet<KpiTemplateBrief[]>('/api/kpi-templates'),
        apiGet<TemplateItemBrief[]>('/api/kpi-template-items'),
        apiGet<IndividualTemplateAssignment[]>(`/api/individual-template-assignments?academicYearId=${yearId}`),
        apiGet<LaborProductivity[]>(`/api/labor-productivity?academicYearId=${yearId}&month=${month}`),
        apiGet<UnitWorkTask[]>('/api/unit-work-plans'),
      ]);
      setUsers(u.filter(x => x.status === 'active'));
      setUnits(un);
      setTemplates(t.filter(x => x.targetLevel === 'individual'));
      setItems(it);
      setAsgs(a);
      setRecords(r);
      setTasks(ts);
      setUnitFilter(prev => prev || (un.find(x => x.type !== 'university') || un[0])?.id || '');
      setMessage('');
    } catch {
      setMessage('Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [yearId, month]);

  useEffect(() => { load(); }, [load]);

  const unit = units.find(x => x.id === unitFilter);
  const unitUsers = users.filter(x => x.unitId === unitFilter);
  const canReview = !!unit && (currentUserId === 'u001' || unit.managerId === currentUserId);

  const monthOptions = useMemo(() => {
    const year = (academicYearsData as AcademicYear[]).find(y => y.id === yearId);
    return year ? yearMonths(year.startDate) : yearMonths();
  }, [yearId]);

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

  const computeUser = (user: UserBrief): { rows: CriterionAggRow[]; totalScore: number; grade: ProductivityGrade } => {
    const asg = asgByUser[user.id];
    if (!asg) return { rows: [], totalScore: 0, grade: 'C' };
    const defs = defsByTpl[asg.kpiTemplateId] || [];
    const userTasks = tasks.filter(t => t.primaryUserId === user.id && t.month === month && t.templateId === asg.kpiTemplateId && !!t.templateItemId);
    const rows = aggregateByCriterion(userTasks, defs, month);
    const totalScore = computeMonthlyTotal(rows);
    return { rows, totalScore, grade: gradeForScore(totalScore) };
  };

  const recordOf = (userId: string) => records.find(r => r.userId === userId);

  const summary = {
    total: unitUsers.length,
    aggregated: unitUsers.filter(u => recordOf(u.id)).length,
    locked: unitUsers.filter(u => recordOf(u.id)?.status === 'locked').length,
    avg: (() => {
      const scored = unitUsers.map(u => recordOf(u.id)).filter(r => !!r) as LaborProductivity[];
      if (scored.length === 0) return 0;
      return Math.round((scored.reduce((s, r) => s + r.totalScore, 0) / scored.length) * 10) / 10;
    })(),
  };

  const handleAggregate = async (user: UserBrief) => {
    const asg = asgByUser[user.id];
    if (!asg) return;
    const existing = recordOf(user.id);
    if (existing && existing.status === 'locked') return;
    const { rows, totalScore, grade } = computeUser(user);
    const record = await apiPost<LaborProductivity>('/api/labor-productivity', {
      userId: user.id,
      userName: user.fullName,
      unitId: user.unitId,
      unitName: unit?.name || user.unitId,
      academicYearId: yearId,
      month,
      templateId: asg.kpiTemplateId,
      templateName: tplName[asg.kpiTemplateId] || asg.kpiTemplateId,
      criterionRows: rows as ProductivityCriterionRow[],
      totalScore,
      grade,
    });
    setRecords(prev => [...prev.filter(r => r.id !== record.id), record]);
    setMessage(`Đã tổng hợp tháng ${month} cho ${user.fullName}: ${totalScore} điểm (xếp loại ${grade}).`);
  };

  const handleSubmit = async (user: UserBrief) => {
    const rec = recordOf(user.id);
    if (!rec) return;
    const updated = await apiPut<LaborProductivity>(`/api/labor-productivity/${rec.id}`, {
      status: 'self_reviewed',
      submittedAt: new Date().toISOString(),
    });
    setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    setMessage(`Đã gửi đánh giá tháng ${month} của ${user.fullName} cho trưởng đơn vị.`);
  };

  const handleReview = async (record: LaborProductivity, action: 'manager_reviewed' | 'locked', note: string, mgrGrade: string) => {
    const now = new Date().toISOString();
    const updated = await apiPut<LaborProductivity>(`/api/labor-productivity/${record.id}`, {
      status: action,
      managerNote: note,
      managerGrade: mgrGrade || '',
      reviewedAt: now,
      ...(action === 'locked' ? { lockedAt: now } : {}),
    });
    setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    setReview(null);
    setMessage(`Đã ${action === 'locked' ? 'chốt' : 'cập nhật nhận xét'} kết quả tháng ${month}.`);
  };

  const openDetail = (user: UserBrief) => {
    const rec = recordOf(user.id);
    const computed = computeUser(user);
    setDetail({ user, record: rec || null, rows: computed.rows, totalScore: rec?.totalScore ?? computed.totalScore, grade: rec?.grade ?? computed.grade });
  };

  const exportCsv = () => {
    const header = ['Họ tên', 'Mã NV', 'Bộ KPI mẫu', 'Tiêu chí đạt/Tổng', 'Điểm', 'Xếp loại', 'Trạng thái'];
    const lines = unitUsers.map(u => {
      const asg = asgByUser[u.id];
      const rec = recordOf(u.id);
      const computed = computeUser(u);
      const active = computed.rows.filter(r => r.totalTasks > 0).length;
      const totalDefs = asg ? (defsByTpl[asg.kpiTemplateId] || []).length : 0;
      const score = rec?.totalScore ?? computed.totalScore;
      const grade = rec?.grade ?? computed.grade;
      const status = rec ? PRODUCTIVITY_STATUS_META[rec.status].label : 'Chưa tổng hợp';
      return [
        u.fullName, u.employeeCode,
        asg ? tplName[asg.kpiTemplateId] || asg.kpiTemplateId : 'Chưa gán',
        `${active}/${totalDefs}`, String(score), grade, status,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = '\uFEFF' + [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nang-suat-lao-dong-${month.replace('/', '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: 'Nhân sự trong đơn vị', value: summary.total, icon: ClipboardList, color: 'bg-primary' },
    { label: 'Đã tổng hợp', value: summary.aggregated, icon: Calculator, color: 'bg-accent-yellow' },
    { label: 'Đã chốt', value: summary.locked, icon: CheckCheck, color: 'bg-accent-green' },
    { label: 'Điểm trung bình', value: summary.avg, icon: Send, color: 'bg-accent-red' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Năng suất lao động hàng tháng</h1>
          <p className="text-sm text-text-light mt-1">
            Tổng hợp công việc theo tiêu chí Bộ KPI mẫu, tự xếp loại A/B/C và gửi trưởng đơn vị kiểm tra, chốt.
          </p>
        </div>
        <button onClick={exportCsv} className="btn-secondary text-xs flex items-center gap-1">
          <Download size={14} /> Xuất CSV
        </button>
      </div>

      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-text-dark">{message}</div>
      )}

      <div className="rounded-lg border border-border bg-bg-cream px-4 py-3 text-xs text-text-light">
        Cách tính: điểm tiêu chí = min(% thực hiện, 100) × hệ số minh chứng (có minh chứng 1.0, thiếu 0.5); điểm tháng = Σ(điểm × trọng số) / Σ trọng số (chỉ tính tiêu chí có công việc trong tháng). Xếp loại: A ≥ 90, B ≥ 70, C &lt; 70.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(x => { const Icon = x.icon; return (
          <div key={x.label} className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-text-light text-xs">{x.label}</p>
              <p className="text-2xl font-heading font-bold text-primary mt-1">{x.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${x.color}`}><Icon size={21} className="text-white"/></div>
          </div>
        ); })}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <select value={yearId} onChange={e => setYearId(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
          {(academicYearsData as AcademicYear[]).map(y => (
            <option key={y.id} value={y.id}>{y.name}{y.status === 'active' ? ' (hiện tại)' : ''}</option>
          ))}
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
          {monthOptions.map(m => <option key={m} value={m}>Tháng {m}</option>)}
        </select>
        <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
          {units.filter(u => u.type !== 'university').map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <span className="text-xs text-text-light">
          Trưởng đơn vị: <span className="font-medium text-text-dark">{unit?.managerId || '-'}</span>
          {canReview && <span className="ml-1 badge badge-success">Bạn có quyền kiểm tra</span>}
        </span>
      </div>

      <div className="card">
        <div className="card-header">Bảng năng suất {month} — {unit?.name || ''}</div>
        <div className="p-0">
          <div className="overflow-x-auto"><table className="table">
            <thead>
              <tr>
                <th>Nhân sự</th>
                <th>Bộ KPI mẫu</th>
                <th>Tiêu chí đạt/Tổng</th>
                <th>Điểm</th>
                <th>Xếp loại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {unitUsers.map(u => {
                const asg = asgByUser[u.id];
                const rec = recordOf(u.id);
                const computed = computeUser(u);
                const active = computed.rows.filter(r => r.totalTasks > 0).length;
                const totalDefs = asg ? (defsByTpl[asg.kpiTemplateId] || []).length : 0;
                const score = rec?.totalScore ?? computed.totalScore;
                const grade = rec?.grade ?? computed.grade;
                const isReviewable = canReview && !!rec && rec.status !== 'locked';
                const isLocked = !!rec && rec.status === 'locked';
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="flex flex-col">
                        <span className="font-medium">{u.fullName}</span>
                        <span className="text-[11px] text-text-light font-mono">{u.employeeCode}</span>
                      </span>
                    </td>
                    <td className="text-sm">{asg ? tplName[asg.kpiTemplateId] || asg.kpiTemplateId : <span className="text-text-light">Chưa gán</span>}</td>
                    <td className="text-sm">{active}/{totalDefs} tiêu chí</td>
                    <td className="font-mono font-bold text-sm">{score}</td>
                    <td><span className={`badge ${GRADE_META[grade].cls}`}>{GRADE_META[grade].label}</span></td>
                    <td>
                      {rec ? (
                        <span className="badge">{PRODUCTIVITY_STATUS_META[rec.status]?.label || rec.status}</span>
                      ) : (
                        <span className="badge badge-info">Chưa tổng hợp</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => openDetail(u)} className="btn-secondary text-xs flex items-center gap-1">
                          <Calculator size={12}/> Chi tiết
                        </button>
                        {asg && !isLocked && (
                          <button onClick={() => handleAggregate(u)} className="btn-secondary text-xs flex items-center gap-1">
                            <Send size={12}/> Tổng hợp
                          </button>
                        )}
                        {rec && rec.status === 'draft' && (
                          <button onClick={() => handleSubmit(u)} className="btn-primary text-xs flex items-center gap-1">
                            <Send size={12}/> Gửi
                          </button>
                        )}
                        {isReviewable && (
                          <button onClick={() => setReview({ user: u, record: rec })} className="btn-primary text-xs flex items-center gap-1">
                            <Lock size={12}/> Kiểm tra
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {unitUsers.length === 0 && (
                <tr><td colSpan={7} className="text-center text-text-light text-sm py-8">Đơn vị chưa có nhân sự nào</td></tr>
              )}
            </tbody>
          </table></div>
        </div>
        {loading && <div className="p-8 text-center text-text-light">Đang tải...</div>}
      </div>

      {detail && (
        <DetailModal
          state={detail}
          month={month}
          onClose={() => setDetail(null)}
        />
      )}

      {review && (
        <ReviewModal
          user={review.user}
          record={review.record}
          month={month}
          onClose={() => setReview(null)}
          onSubmit={(note, mgrGrade) => handleReview(review.record, 'manager_reviewed', note, mgrGrade)}
          onLock={(note, mgrGrade) => handleReview(review.record, 'locked', note, mgrGrade)}
        />
      )}
    </div>
  );
}

function DetailModal({ state, month, onClose }: { state: DetailState; month: string; onClose: () => void }) {
  const { user, record, rows, totalScore, grade } = state;
  return (
    <Modal isOpen onClose={onClose} title={`Năng suất lao động — ${user.fullName} (Tháng ${month})`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="p-3 bg-bg-cream rounded-lg">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-text-dark">{user.fullName}</span>
            <span className="text-xs text-text-light font-mono">{user.employeeCode}</span>
            {record && (
              <span className={`badge ${PRODUCTIVITY_STATUS_META[record.status]?.label ? PRODUCTIVITY_STATUS_META[record.status].cls : 'badge-info'}`}>
                {PRODUCTIVITY_STATUS_META[record.status]?.label || record.status}
              </span>
            )}
            {!record && <span className="badge badge-info">Dự kiến (chưa lưu)</span>}
            <span className="font-mono font-bold text-primary">{totalScore} điểm</span>
            <span className={`badge ${GRADE_META[grade].cls}`}>{GRADE_META[grade].label}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table text-sm">
            <thead>
              <tr><th>Tiêu chí</th><th>Chỉ tiêu</th><th>Hoàn thành</th><th>% thực hiện</th><th>Minh chứng</th><th>Điểm</th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.templateItemId || r.criterionCode}>
                  <td>
                    <span className="font-mono text-xs text-primary">{r.criterionCode}</span>
                    <span className="block text-text-dark">{r.criterionName}</span>
                  </td>
                  <td className="text-xs text-accent-green">{r.target}</td>
                  <td className="text-sm">{r.completedTasks}/{r.totalTasks}</td>
                  <td className="text-sm">{r.resultPct}%</td>
                  <td className="text-sm">{r.hasEvidence ? <span className="badge badge-success">Có</span> : <span className="badge badge-warning">Thiếu</span>}</td>
                  <td className="font-mono font-bold">{r.score}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="text-center text-text-light text-sm py-6">Người này chưa có Bộ KPI mẫu</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {record && (record.selfNote || record.managerNote) && (
          <div className="space-y-2 text-sm">
            {record.selfNote && (
              <p className="text-text-light"><span className="font-medium text-text-dark">Tự nhận xét:</span> {record.selfNote}</p>
            )}
            {record.managerNote && (
              <p className="text-text-light"><span className="font-medium text-text-dark">Nhận xét trưởng đơn vị:</span> {record.managerNote}</p>
            )}
            {record.managerGrade && (
              <p className="text-text-light"><span className="font-medium text-text-dark">Xếp loại trưởng đơn vị:</span> {record.managerGrade}</p>
            )}
          </div>
        )}
        <div className="flex justify-end pt-4 border-t">
          <button onClick={onClose} className="btn-secondary">Đóng</button>
        </div>
      </div>
    </Modal>
  );
}

function ReviewModal({ user, record, month, onClose, onSubmit, onLock }: {
  user: UserBrief;
  record: LaborProductivity;
  month: string;
  onClose: () => void;
  onSubmit: (note: string, mgrGrade: string) => void;
  onLock: (note: string, mgrGrade: string) => void;
}) {
  const [note, setNote] = useState(record.managerNote || '');
  const [grade, setGrade] = useState(record.managerGrade || '');

  return (
    <Modal isOpen onClose={onClose} title={`Kiểm tra năng suất — ${user.fullName} (Tháng ${month})`} maxWidth="max-w-2xl">
      <div className="space-y-4">
        <div className="p-3 bg-bg-cream rounded-lg flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-text-dark">{user.fullName}</span>
          <span className="font-mono font-bold text-primary">{record.totalScore} điểm</span>
          <span className={`badge ${GRADE_META[record.grade].cls}`}>{GRADE_META[record.grade].label}</span>
          <span className={`badge ${PRODUCTIVITY_STATUS_META[record.status].cls}`}>{PRODUCTIVITY_STATUS_META[record.status].label}</span>
        </div>
        <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
          <table className="table text-sm">
            <thead>
              <tr><th>Tiêu chí</th><th>Hoàn thành</th><th>% thực hiện</th><th>Điểm</th></tr>
            </thead>
            <tbody>
              {record.criterionRows.filter(r => r.totalTasks > 0).map(r => (
                <tr key={r.templateItemId || r.criterionCode}>
                  <td><span className="font-mono text-xs text-primary">{r.criterionCode}</span> <span className="text-text-dark">{r.criterionName}</span></td>
                  <td className="text-sm">{r.completedTasks}/{r.totalTasks}</td>
                  <td className="text-sm">{r.resultPct}%</td>
                  <td className="font-mono font-bold">{r.score}</td>
                </tr>
              ))}
              {record.criterionRows.length === 0 && (
                <tr><td colSpan={4} className="text-center text-text-light text-sm py-6">Chưa có tiêu chí nào được tổng hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Nhận xét của trưởng đơn vị</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-y"
            placeholder="Nhận xét về kết quả năng suất tháng (nếu có)" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Xếp loại theo trưởng đơn vị</label>
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary">
            <option value="">Theo điểm tự động</option>
            <option value="A">A - Xuất sắc</option>
            <option value="B">B - Hoàn thành tốt</option>
            <option value="C">C - Cần cải thiện</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
          <button type="button" onClick={() => onSubmit(note, grade)} className="btn-secondary flex items-center gap-1">
            <CheckCheck size={14}/> Lưu nhận xét
          </button>
          <button type="button" onClick={() => onLock(note, grade)} className="btn-primary flex items-center gap-1">
            <Lock size={14}/> Chốt kết quả
          </button>
        </div>
      </div>
    </Modal>
  );
}