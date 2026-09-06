'use client';

import { useState, useEffect, useMemo } from 'react';
import { Send, ClipboardCheck, AlertTriangle, CheckCircle, Save, RefreshCw, Paperclip, Trash2, UploadCloud, Plus, Layers } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api';
import { getProgress, progressColor, isOverdue } from '@/lib/workProgress';
import { fileToBase64 } from '@/lib/fileToBase64';
import Modal from '@/components/ui/Modal';
import academicYearsData from '@/data/academic-years.json';
import unitsData from '@/data/units.json';
import { indicatorMeta, currentMonthKey, yearMonths } from '@/lib/laborProductivity';
import { positionName, suggestedTemplateIdForPosition } from '@/lib/jobPositionTemplate';
import type { UnitWorkTask, IndividualTemplateAssignment } from '@/types';

interface SoftwareSource { id: string; name: string; description?: string; status?: string; }
interface WorkEvidence {
  id: string;
  unitWorkPlanId?: string;
  evidenceType: 'file' | 'url' | 'system_log' | 'survey' | 'email';
  fileName?: string;
  fileUrl?: string;
  externalUrl?: string;
  submittedAt: string;
  submittedBy: string;
}

const statusMeta: Record<UnitWorkTask['status'], { label: string; cls: string }> = {
  assigned: { label: 'Đã giao', cls: 'badge-info' },
  in_progress: { label: 'Đang thực hiện', cls: 'badge-warning' },
  done: { label: 'Hoàn thành', cls: 'badge-success' },
};

const statusOrder: Array<UnitWorkTask['status'] | 'all'> = ['all', 'assigned', 'in_progress', 'done'];

interface AcademicYear { id: string; name: string; startDate: string; endDate: string; status: string; }
interface UserBrief { id: string; fullName: string; employeeCode: string; unitId: string; positionId: string; status: string; }
interface KpiTemplateBrief { id: string; name: string; targetLevel: string; status: string; }
interface MyCriterion {
  id: string;
  code: string;
  name: string;
  target: number;
  unit: string;
  weight: number;
}

const unitNames: Record<string, string> = {};
(unitsData as { id: string; name: string }[]).forEach(u => { unitNames[u.id] = u.name; });

const unitTypeById: Record<string, string> = {};
(unitsData as { id: string; type: string }[]).forEach(u => { unitTypeById[u.id] = u.type; });

const lastDayOfMonth = (key: string) => {
  const [mo, yr] = key.split('/').map(Number);
  return new Date(yr, mo, 0).toISOString().split('T')[0];
};

export default function MyWorkPlanPage() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id || 'u009';
  const activeYear = (academicYearsData as AcademicYear[]).find(y => y.status === 'active');
  const activeYearId = activeYear?.id || '';
  const monthOptions = yearMonths(activeYear?.startDate);

  const [tasks, setTasks] = useState<UnitWorkTask[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [templates, setTemplates] = useState<KpiTemplateBrief[]>([]);
  const [assignments, setAssignments] = useState<IndividualTemplateAssignment[]>([]);
  const [myItems, setMyItems] = useState<MyCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UnitWorkTask['status'] | 'all'>('all');
  const [ownOnly, setOwnOnly] = useState(true);
  const [reportJob, setReportJob] = useState<UnitWorkTask | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    const [taskData, userData, tplData, asgData] = await Promise.all([
      apiGet<UnitWorkTask[]>('/api/unit-work-plans'),
      apiGet<UserBrief[]>('/api/users'),
      apiGet<KpiTemplateBrief[]>('/api/kpi-templates'),
      apiGet<IndividualTemplateAssignment[]>('/api/individual-template-assignments'),
    ]);
    setTasks(taskData);
    setUsers(userData);
    setTemplates(tplData);
    setAssignments(asgData);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const currentUser = users.find(u => u.id === currentUserId);
  const myPositionName = positionName(currentUser?.positionId);
  const suggestedForPosition = suggestedTemplateIdForPosition(
    currentUser?.positionId,
    currentUser ? unitTypeById[currentUser.unitId] : undefined
  );
  const suggestedTemplateForPosition = templates.find(t => t.id === suggestedForPosition);
  const myAsg = assignments.find(
    a => a.userId === currentUserId && a.academicYearId === activeYearId && a.status === 'active'
  );
  const myTemplate = templates.find(t => t.id === myAsg?.kpiTemplateId);

  useEffect(() => {
    if (!myAsg) {
      setMyItems([]);
      return;
    }
    let cancelled = false;
    apiGet<{ id: string; templateId: string; indicatorId: string; weight: number }[]>(
      `/api/kpi-template-items?templateId=${myAsg.kpiTemplateId}`
    ).then(items => {
      if (cancelled) return;
      const resolved: MyCriterion[] = items
        .filter(i => indicatorMeta[i.indicatorId])
        .map(i => ({
          id: i.id,
          code: i.indicatorId,
          name: indicatorMeta[i.indicatorId].name,
          target: indicatorMeta[i.indicatorId].target,
          unit: indicatorMeta[i.indicatorId].unit,
          weight: i.weight,
        }));
      setMyItems(resolved);
    }).catch(() => { if (!cancelled) setMyItems([]); });
    return () => { cancelled = true; };
  }, [myAsg]);

  const baseTasks = useMemo(
    () => (ownOnly ? tasks.filter(t => t.primaryUserId === currentUserId) : tasks),
    [tasks, ownOnly, currentUserId],
  );
  const total = baseTasks.length;
  const doneCount = baseTasks.filter(t => t.status === 'done').length;
  const inProgress = baseTasks.filter(t => t.status === 'in_progress').length;
  const overdueCount = baseTasks.filter(isOverdue).length;

  const filtered = useMemo(
    () => (filter === 'all' ? baseTasks : baseTasks.filter(t => t.status === filter)),
    [baseTasks, filter],
  );

  const ownCount = tasks.filter(t => t.primaryUserId === currentUserId).length;

  const filterTabs: Array<{ key: UnitWorkTask['status'] | 'all'; label: string }> = [
    { key: 'all', label: `Tất cả (${total})` },
    { key: 'assigned', label: `Đã giao (${baseTasks.filter(t => t.status === 'assigned').length})` },
    { key: 'in_progress', label: `Đang thực hiện (${inProgress})` },
    { key: 'done', label: `Hoàn thành (${doneCount})` },
  ];

  const stats = [
    { label: 'Công việc được giao', value: total, icon: Send, color: 'bg-primary' },
    { label: 'Đang thực hiện', value: inProgress, icon: ClipboardCheck, color: 'bg-accent-yellow' },
    { label: 'Hoàn thành', value: doneCount, icon: CheckCircle, color: 'bg-accent-green' },
    { label: 'Quá hạn', value: overdueCount, icon: AlertTriangle, color: 'bg-accent-red' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Kế hoạch cá nhân</h1>
          <p className="text-sm text-text-light mt-1">Danh sách công việc được phân công, theo dõi tiến độ và báo cáo kết quả.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <span>Bộ KPI mẫu của tôi</span>
          {myAsg && (
            <button onClick={() => setShowAdd(true)} className="btn-primary text-xs flex items-center gap-1">
              <Plus size={13} /> Thêm công việc
            </button>
          )}
        </div>
        <div className="p-4">
          {myAsg ? (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {myPositionName ? `Vị trí việc làm: ${myPositionName}` : 'Chưa xác định vị trí việc làm'}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
                <span className="text-sm font-semibold text-text-dark">{myTemplate?.name || myAsg.kpiTemplateId}</span>
                <span className="text-xs text-text-light">· Năm học {activeYear?.name}</span>
                <span className="text-xs text-text-light">· Khi thêm công việc, hãy chọn tiêu chí thuộc bộ mẫu để phục vụ đánh giá năng suất lao động hàng tháng.</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {myItems.map(c => (
                  <div key={c.id} className="rounded-lg border border-border bg-bg-cream px-3 py-2">
                    <p className="text-sm font-medium text-text-dark">
                      <span className="font-mono text-xs text-primary">{c.code}</span> — {c.name}
                    </p>
                    <p className="text-[11px] text-text-light mt-0.5">Trọng số {c.weight}% · Chỉ tiêu {c.target}{c.unit}</p>
                  </div>
                ))}
                {myItems.length === 0 && (
                  <p className="text-sm text-text-light col-span-full">Đang tải tiêu chí...</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2 text-sm text-text-light">
              <Layers size={16} className="shrink-0 mt-0.5" />
              <div>
                {myPositionName && <p>Vị trí việc làm của bạn: <span className="font-medium text-text-dark">{myPositionName}</span>.</p>}
                <p>Bạn chưa được gán Bộ KPI mẫu cho năm học {activeYear?.name}.
                  {suggestedTemplateForPosition && <> Bộ KPI mẫu theo vị trí của bạn là <span className="font-medium text-primary">{suggestedTemplateForPosition.name}</span>.</>}
                  {' '}Liên hệ quản trị viên để gán tại <span className="text-primary">Quản trị → Danh mục → Gán Bộ KPI mẫu cá nhân</span>.</p>
              </div>
            </div>
          )}
        </div>
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

      <div className="card">
        <div className="card-header">Công việc của tôi</div>

        <div className="p-4 pb-2 flex flex-wrap items-center gap-2">
          <button onClick={() => setOwnOnly(true)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              ownOnly ? 'bg-primary text-white' : 'bg-bg-cream text-text-dark hover:bg-primary-light'
            }`}>
            Của tôi ({ownCount})
          </button>
          <button onClick={() => setOwnOnly(false)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !ownOnly ? 'bg-primary text-white' : 'bg-bg-cream text-text-dark hover:bg-primary-light'
            }`}>
            Tất cả ({tasks.length})
          </button>
          <span className="text-xs text-text-light ml-1">Phạm vi hiển thị</span>
        </div>

        <div className="p-4 pt-2 flex flex-wrap gap-2">
          {filterTabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === t.key ? 'bg-primary text-white' : 'bg-bg-cream text-text-dark hover:bg-primary-light'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="table table-fixed min-w-[1000px]">
            <thead>
              <tr>
                <th className="w-[26%]">Công việc</th>
                <th className="w-[12%]">Chỉ tiêu</th>
                <th className="w-[9%]">Hạn</th>
                <th className="w-[16%]">Tiến độ</th>
                <th className="w-[14%]">Kết quả</th>
                <th className="w-[10%]">Trạng thái</th>
                <th className="w-[9%]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const pct = getProgress(task);
                const overdue = isOverdue(task);
                return (
                  <tr key={task.id} className="align-top">
                    <td>
                      <p className="font-semibold text-text-dark">{task.title}</p>
                      <p className="text-xs text-text-light mt-0.5 line-clamp-2" title={task.taskName}>{task.taskName}</p>
                      {task.note && <p className="text-xs text-text-light mt-0.5 italic">Ghi chú: {task.note}</p>}
                    </td>
                    <td className="text-xs font-medium text-accent-green">{task.chiTieu || '—'}</td>
                    <td className={`text-sm ${overdue ? 'text-accent-red font-semibold' : ''}`}>
                      {task.dueDate || '—'}
                      {overdue && <span className="block text-[10px] text-accent-red">Quá hạn</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="progress-bar flex-1">
                          <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: progressColor(pct) }} />
                        </div>
                        <span className="text-xs font-mono font-bold">{pct}%</span>
                      </div>
                    </td>
                    <td>
                      {task.result ? (
                        <div className="flex items-center gap-1.5">
                          {task.resultSource === 'sync' && (
                            <span title={task.syncInfo ? `Đồng bộ từ ${task.syncInfo.sourceName} lúc ${task.syncInfo.syncedAt}` : 'Dữ liệu đồng bộ'}>
                              <RefreshCw size={13} className="text-primary shrink-0" />
                            </span>
                          )}
                          <span className="text-sm text-text-dark">{task.result}</span>
                        </div>
                      ) : <span className="text-text-light text-sm">—</span>}
                    </td>
                    <td><span className={`badge ${statusMeta[task.status].cls}`}>{statusMeta[task.status].label}</span></td>
                    <td>
                      <button onClick={() => setReportJob(task)} className="btn-secondary text-xs flex items-center gap-1">
                        <ClipboardCheck size={13}/> Báo cáo
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-text-light text-sm py-8">Không có công việc nào</td></tr>
              )}
            </tbody>
          </table>
          {loading && <div className="p-8 text-center text-text-light">Đang tải...</div>}
        </div>
      </div>

      <ReportModal job={reportJob} isOpen={!!reportJob} onClose={() => setReportJob(null)}
        onSaved={() => { load(); setReportJob(null); }} />

      <AddWorkModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        criteria={myItems}
        templateName={myTemplate?.name || ''}
        templateId={myAsg?.kpiTemplateId || ''}
        currentUser={currentUser}
        unitName={currentUser ? unitNames[currentUser.unitId] || '' : ''}
        monthOptions={monthOptions}
        defaultMonth={currentMonthKey()}
        onSaved={() => { setShowAdd(false); load(); }}
      />
    </div>
  );
}

function ReportModal({ job, isOpen, onClose, onSaved }: {
  job: UnitWorkTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [result, setResult] = useState('');
  const [status, setStatus] = useState<UnitWorkTask['status']>('in_progress');
  const [saving, setSaving] = useState(false);
  const [sources, setSources] = useState<SoftwareSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [evidences, setEvidences] = useState<WorkEvidence[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<'manual' | 'sync'>('manual');
  const [reportNote, setReportNote] = useState('');
  const [progressInput, setProgressInput] = useState('');

  const loadEvidences = async (taskId: string) => {
    const list = await apiGet<WorkEvidence[]>(`/api/evidences?unitWorkPlanId=${taskId}`);
    setEvidences(list);
  };

  useEffect(() => {
    if (isOpen && job) {
      setResult(job.result || '');
      setStatus(job.status && job.status !== 'done' ? job.status : 'done');
      setSaving(false);
      setSelectedSource('');
      setMode(job.resultSource === 'sync' ? 'sync' : 'manual');
      setReportNote(job.reportNote || '');
      setProgressInput(job.progress != null ? String(job.progress) : '');
      loadEvidences(job.id);
      apiGet<SoftwareSource[]>('/api/software-catalog')
        .then(d => setSources(d.filter(s => s.status !== 'inactive')))
        .catch(() => setSources([]));
    }
  }, [isOpen, job?.id]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    setSaving(true);
    const parsed = parseInt(progressInput, 10);
    const progress = status === 'done' ? 100
      : (isNaN(parsed) ? undefined : Math.min(100, Math.max(0, parsed)));
    await apiPut(`/api/unit-work-plans/${job.id}`, { result, status, resultSource: mode, reportNote, progress });
    setSaving(false);
    onSaved?.();
  };

  const handleSync = async () => {
    if (!job || !selectedSource) return;
    setSyncing(true);
    const res = await apiPost<{ task: UnitWorkTask; syncedRecords: number; sourceName: string }>('/api/unit-work-plans/sync', { taskId: job.id, sourceId: selectedSource });
    setResult(res.task.result || '');
    setStatus(res.task.status);
    setMode('sync');
    setProgressInput(res.task.progress != null ? String(res.task.progress) : '');
    setSyncing(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !job) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const up = await apiPost<{ url: string; fileName: string }>('/api/unit-work-plans/upload', {
        taskId: job.id, fileName: file.name, fileData: base64,
      });
      await apiPost('/api/evidences', {
        unitWorkPlanId: job.id, evidenceType: 'file',
        fileName: up.fileName, fileUrl: up.url, submittedBy: job.primaryUserName,
      });
      await loadEvidences(job.id);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    await apiDelete(`/api/evidences/${id}`);
    if (job) await loadEvidences(job.id);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Báo cáo công việc" maxWidth="max-w-2xl">
      {job && (
        <form onSubmit={handle} className="space-y-4">
          <div className="p-3 bg-bg-cream rounded-lg">
            <p className="text-sm font-semibold text-text-dark">{job.title}</p>
            <p className="text-xs text-text-light mt-1">Người phụ trách: <span className="font-medium text-text-dark">{job.primaryUserName}</span></p>
            {job.chiTieu && <p className="text-xs text-accent-green mt-1">Chỉ tiêu: {job.chiTieu}</p>}
            {job.dueDate && <p className="text-xs text-text-light mt-1">Hạn hoàn thành: {job.dueDate}</p>}
            {job.note && <p className="text-xs text-text-light mt-1">Ghi chú: {job.note}</p>}
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-text-dark mb-2">Cập nhật kết quả</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={() => setMode('manual')}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'manual' ? 'bg-primary text-white border-primary' : 'text-text-dark border-border hover:border-primary'}`}>
                Nhập kết quả thủ công
              </button>
              <button type="button" onClick={() => setMode('sync')}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'sync' ? 'bg-primary text-white border-primary' : 'text-text-dark border-border hover:border-primary'}`}>
                <RefreshCw size={12} className="inline mr-1"/>Đồng bộ từ phần mềm
              </button>
            </div>

            {mode === 'sync' ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium mb-1">Nguồn dữ liệu</label>
                    <select value={selectedSource} onChange={e => setSelectedSource(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
                      <option value="">-- Chọn nguồn --</option>
                      {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={handleSync} disabled={!selectedSource || syncing}
                    className="btn-secondary text-sm flex items-center gap-1">
                    <RefreshCw size={14}/> {syncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
                  </button>
                </div>
                <p className="text-[11px] text-text-light">Là dữ liệu mô phỏng minh họa. Kết quả được hệ thống sinh tương đương chỉ tiêu, không sửa tay.</p>
                {result && (
                  <div className="p-3 bg-bg-cream rounded-lg">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-text-dark">
                      <RefreshCw size={14} className="text-primary"/>
                      Kết quả: {result}
                      {job.syncInfo && <span className="text-[11px] font-normal text-text-light ml-auto truncate">Đồng bộ từ {job.syncInfo.sourceName}</span>}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Kết quả thực hiện</label>
                  <input value={result} onChange={e => setResult(e.target.value)} disabled={syncing}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary disabled:bg-bg-cream"
                    placeholder="VD: 100% | 80/80 | Đã hoàn thành" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Trạng thái</label>
                    <select value={status} onChange={e => setStatus(e.target.value as UnitWorkTask['status'])}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
                      <option value="in_progress">Đang thực hiện</option>
                      <option value="done">Hoàn thành</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Tiến độ %</label>
                    <select value={progressInput} onChange={e => setProgressInput(e.target.value)} disabled={syncing}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary disabled:bg-bg-cream">
                      <option value="">-- Chọn --</option>
                      {[10, 25, 50, 75, 90, 100].map(p => (
                        <option key={p} value={p}>{p}%</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Ghi chú báo cáo</label>
              <textarea value={reportNote} onChange={e => setReportNote(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-y"
                placeholder="Nhập ghi chú báo cáo (nếu có)" />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text-dark">File đính kèm</p>
              <label className="btn-secondary text-xs flex items-center gap-1 cursor-pointer disabled:opacity-60">
                <UploadCloud size={13}/>
                {uploading ? 'Đang tải...' : 'Tải lên file'}
                <input type="file" className="hidden" onChange={handleFile} disabled={uploading} />
              </label>
            </div>
            {evidences.length === 0 ? (
              <p className="text-xs text-text-light">Chưa có minh chứng.</p>
            ) : (
              <ul className="space-y-1.5">
                {evidences.map(ev => (
                  <li key={ev.id} className="flex items-center gap-2 text-sm text-text-dark bg-bg-cream rounded-lg px-3 py-2">
                    <Paperclip size={13} className="text-primary shrink-0"/>
                    {ev.fileUrl ? (
                      <a href={ev.fileUrl} target="_blank" rel="noreferrer" className="flex-1 min-w-0 truncate text-primary hover:underline">{ev.fileName || ev.fileUrl}</a>
                    ) : (
                      <span className="flex-1 min-w-0 truncate">{ev.fileName || ev.externalUrl || ev.id}</span>
                    )}
                    <button type="button" onClick={() => handleDeleteEvidence(ev.id)} className="text-accent-red hover:opacity-70" title="Xóa minh chứng">
                      <Trash2 size={14}/>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1">
              <Save size={14}/> {saving ? 'Đang lưu...' : 'Lưu báo cáo'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function AddWorkModal({ isOpen, onClose, criteria, templateName, templateId, currentUser, unitName, monthOptions, defaultMonth, onSaved }: {
  isOpen: boolean;
  onClose: () => void;
  criteria: MyCriterion[];
  templateName: string;
  templateId: string;
  currentUser?: UserBrief;
  unitName: string;
  monthOptions: string[];
  defaultMonth: string;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [criterionId, setCriterionId] = useState('');
  const [month, setMonth] = useState(defaultMonth);
  const [chiTieu, setChiTieu] = useState('');
  const [dueDate, setDueDate] = useState(lastDayOfMonth(defaultMonth));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setCriterionId('');
      setMonth(defaultMonth);
      setChiTieu('');
      setDueDate(lastDayOfMonth(defaultMonth));
      setError('');
      setSaving(false);
    }
  }, [isOpen, defaultMonth]);

  const changeMonth = (m: string) => {
    setMonth(m);
    setDueDate(lastDayOfMonth(m));
  };

  const selectCriterion = (id: string) => {
    setCriterionId(id);
    const c = criteria.find(x => x.id === id);
    if (c) setChiTieu(`${c.target}${c.unit}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) { setError('Không xác định được người dùng hiện tại.'); return; }
    setSaving(true);
    const crit = criteria.find(c => c.id === criterionId);
    try {
      await apiPost('/api/unit-work-plans', {
        khctTaskId: `khct-self-${Date.now()}`,
        title,
        taskName: templateName ? `Bộ KPI mẫu: ${templateName}` : '',
        note: description,
        unitId: currentUser.unitId,
        unitName: unitName || currentUser.unitId,
        primaryUserId: currentUser.id,
        primaryUserName: currentUser.fullName,
        templateId: templateId || undefined,
        templateItemId: crit?.id,
        criterionCode: crit?.code,
        month,
        chiTieu,
        dueDate,
        status: 'assigned',
      });
      onSaved();
    } catch {
      setError('Thêm công việc thất bại. Kiểm tra lại thông tin.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm công việc mới">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Tên công việc *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} required
            placeholder="VD: Xử lý hồ sơ học vụ tháng 9/2026"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Tiêu chí thuộc Bộ KPI mẫu</label>
          <select value={criterionId} onChange={e => selectCriterion(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
            <option value="">-- Chưa gắn tiêu chí --</option>
            {criteria.map(c => (
              <option key={c.id} value={c.id}>{c.code} — {c.name} (trọng số {c.weight}%)</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-dark mb-1">Tháng thực hiện *</label>
            <select value={month} onChange={e => changeMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
              {monthOptions.map(m => <option key={m} value={m}>Tháng {m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-dark mb-1">Hạn hoàn thành</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Chỉ tiêu</label>
          <input value={chiTieu} onChange={e => setChiTieu(e.target.value)}
            placeholder="VD: 95% | 100 hồ sơ"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Mô tả / ghi chú</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-y"
            placeholder="Mô tả nội dung công việc, phạm vi thực hiện (nếu có)" />
        </div>
        {currentUser && (
          <p className="text-xs text-text-light">
            Người phụ trách: <span className="font-medium text-text-dark">{currentUser.fullName}</span>
            {unitName ? ` · ${unitName}` : ''}
          </p>
        )}
        {error && <p className="text-xs text-accent-red">{error}</p>}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1">
            <Save size={14}/> {saving ? 'Đang lưu...' : 'Thêm công việc'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
