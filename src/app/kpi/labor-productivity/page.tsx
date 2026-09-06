'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Calculator, Send, ClipboardList, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { apiGet, apiPut } from '@/lib/api';
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
  finalScoreOf,
  finalGradeOf,
} from '@/lib/laborProductivity';
import { positionName } from '@/lib/jobPositionTemplate';
import type { TemplateItemDef, CriterionAggRow, ProductivityGrade } from '@/lib/laborProductivity';
import type { IndividualTemplateAssignment, LaborProductivity, UnitWorkTask } from '@/types';

interface AcademicYear { id: string; name: string; startDate: string; endDate: string; status: string; }
interface UserBrief { id: string; fullName: string; employeeCode: string; unitId: string; positionId: string; status: string; }
interface UnitData { id: string; name: string; code: string; type: string; managerId: string; status: string; }
interface KpiTemplateBrief { id: string; name: string; targetLevel: string; status: string; }
interface TemplateItemBrief { id: string; templateId: string; indicatorId: string; weight: number; targetValue: number; capRate: number; }

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
      setUnitFilter(prev => prev || (un.find(x => x.type !== 'university') || un[0])?.id || '');
      setMessage('');
    } catch {
      setMessage('Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => { load(); }, [load]);

  const unit = units.find(x => x.id === unitFilter);
  const unitUsers = users.filter(x => x.unitId === unitFilter);
  const canReview = !!unit && (currentUserId === 'u001' || unit.managerId === currentUserId);
  const canCouncil = currentUserId === 'u001' || currentUserId === 'u002';

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

  const computeUserFor = (user: UserBrief, m: string): { rows: CriterionAggRow[]; totalScore: number; grade: ProductivityGrade } => {
    const asg = asgByUser[user.id];
    if (!asg) return { rows: [], totalScore: 0, grade: 'C' };
    const defs = defsByTpl[asg.kpiTemplateId] || [];
    const userTasks = tasks.filter(t => t.primaryUserId === user.id && t.month === m && t.templateId === asg.kpiTemplateId && !!t.templateItemId);
    const rows = aggregateByCriterion(userTasks, defs, m);
    const totalScore = computeMonthlyTotal(rows);
    return { rows, totalScore, grade: gradeForScore(totalScore) };
  };

  const computeUser = (user: UserBrief) => computeUserFor(user, month);

  const recordOf = (userId: string) => records.find(r => r.userId === userId && r.month === month);

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

  const handleSubmit = async (user: UserBrief) => {
    const rec = recordOf(user.id);
    if (!rec) return;
    const updated = await apiPut<LaborProductivity>(`/api/labor-productivity/${rec.id}`, {
      status: 'self_reviewed',
      submittedAt: new Date().toISOString(),
    });
    setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    setMessage(`Đã gửi tự đánh giá tháng ${month} của ${user.fullName} cho trưởng đơn vị.`);
  };

  const parseScore = (value: string): number | undefined => {
    if (value === '') return undefined;
    const n = Number(value);
    if (isNaN(n)) return undefined;
    return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
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
            Tự đánh giá → Trưởng đơn vị kiểm tra → Hội đồng thẩm định → Khóa kết quả.
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-text-dark">{message}</div>
      )}

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
                <th>Họ tên</th>
                <th>Vị trí</th>
                <th>Đơn vị</th>
                <th>Tự ĐG</th>
                <th>Trưởng đơn vị</th>
                <th>Hội đồng</th>
                <th>Điểm cuối</th>
                <th>Xếp loại</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {unitUsers.map(u => {
                const rec = recordOf(u.id);
                const computed = computeUser(u);
                const selfScore = rec?.totalScore ?? computed.totalScore;
                const selfGrade = rec?.grade ?? computed.grade;
                const managerCell = rec?.managerGrade ? `${rec.managerScore ?? selfScore} (${rec.managerGrade})` : '';
                const councilCell = rec?.councilGrade ? `${rec.councilScore ?? rec.managerScore ?? selfScore} (${rec.councilGrade})` : '';
                const finalScore = rec ? finalScoreOf(rec) : selfScore;
                const finalGrade = rec ? finalGradeOf(rec) : selfGrade;
                const isOwnerSubmit = currentUserId === 'u001' || currentUserId === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="flex flex-col">
                        <span className="font-medium">{u.fullName}</span>
                        <span className="text-[11px] text-text-light font-mono">{u.employeeCode}</span>
                      </span>
                    </td>
                    <td className="text-sm text-text-light">{positionName(u.positionId) || '-'}</td>
                    <td className="text-sm text-text-light">{rec?.unitName || unit?.name || '-'}</td>
                    <td className="text-sm"><span className="font-mono font-bold">{selfScore}</span> <span className={`badge ${GRADE_META[selfGrade].cls}`}>{GRADE_META[selfGrade].label}</span></td>
                    <td className="text-sm">{managerCell ? <span className="font-mono font-medium">{managerCell}</span> : <span className="text-text-light">—</span>}</td>
                    <td className="text-sm">{councilCell ? <span className="font-mono font-medium">{councilCell}</span> : <span className="text-text-light">—</span>}</td>
                    <td className="font-mono font-bold text-sm">{finalScore}</td>
                    <td><span className={`badge ${GRADE_META[finalGrade].cls}`}>{GRADE_META[finalGrade].label}</span></td>
                    <td>
                      {rec ? (
                        <span className="badge">{PRODUCTIVITY_STATUS_META[rec.status]?.label || rec.status}</span>
                      ) : (
                        <span className="badge badge-info">Chưa gửi</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Link href={`/kpi/labor-productivity/${u.id}?month=${encodeURIComponent(month)}`} className="btn-secondary text-xs flex items-center gap-1">
                          <Calculator size={12}/> Cá nhân ĐG
                        </Link>
                        {rec && rec.status === 'draft' && isOwnerSubmit && (
                          <button onClick={() => handleSubmit(u)} className="btn-primary text-xs flex items-center gap-1">
                            <Send size={12}/> Gửi tự đánh giá
                          </button>
                        )}
                        {canReview && rec && ['self_reviewed', 'manager_reviewed', 'council_reviewed', 'locked'].includes(rec.status) && (
                          <Link href={`/kpi/labor-productivity/${u.id}?role=manager&month=${encodeURIComponent(month)}`} className="btn-primary text-xs flex items-center gap-1">
                            <CheckCheck size={12}/> Quản lý ĐG
                          </Link>
                        )}
                        {canCouncil && rec && ['manager_reviewed', 'council_reviewed', 'locked'].includes(rec.status) && (
                          <Link href={`/kpi/labor-productivity/${u.id}?role=council&month=${encodeURIComponent(month)}`} className="btn-primary text-xs flex items-center gap-1">
                            <ClipboardList size={12}/> Hội đồng ĐG
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {unitUsers.length === 0 && (
                <tr><td colSpan={10} className="text-center text-text-light text-sm py-8">Đơn vị chưa có nhân sự nào</td></tr>
              )}
            </tbody>
          </table></div>
        </div>
        {loading && <div className="p-8 text-center text-text-light">Đang tải...</div>}
      </div>

      </div>
  );
}
