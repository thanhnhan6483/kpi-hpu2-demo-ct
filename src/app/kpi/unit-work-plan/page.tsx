'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, ChevronRight, ChevronDown, ClipboardList, RefreshCw, Save, Star, Paperclip, UploadCloud, Trash2 } from 'lucide-react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/api';
import { synthesizeTask } from '@/lib/taskResult';
import { fileToBase64 } from '@/lib/fileToBase64';
import AssignTaskModal from '@/components/forms/AssignTaskModal';
import Modal from '@/components/ui/Modal';
import { getProgress, progressColor, isOverdue } from '@/lib/workProgress';
import type { KHCTTask, UnitWorkTask } from '@/types';

interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
}

interface WorkEvidence {
  id: string;
  unitWorkPlanId?: string;
  fileName?: string;
  fileUrl?: string;
  status?: string;
}

interface SoftwareSource { id: string; name: string; description?: string; status?: string; }

const statusMeta: Record<UnitWorkTask['status'], { label: string; cls: string }> = {
  assigned: { label: 'Đã giao', cls: 'badge-info' },
  in_progress: { label: 'Đang thực hiện', cls: 'badge-warning' },
  done: { label: 'Hoàn thành', cls: 'badge-success' },
};

export default function UnitWorkPlanPage() {
  const [tasks, setTasks] = useState<KHCTTask[]>([]);
  const [workTasks, setWorkTasks] = useState<UnitWorkTask[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [evidences, setEvidences] = useState<WorkEvidence[]>([]);
  const [unitFilter, setUnitFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [assignTask, setAssignTask] = useState<KHCTTask | null>(null);
  const [detailTask, setDetailTask] = useState<KHCTTask | null>(null);
  const [reviewJob, setReviewJob] = useState<UnitWorkTask | null>(null);

  const load = () => {
    apiGet<KHCTTask[]>('/api/khct').then(setTasks);
    apiGet<UnitWorkTask[]>('/api/unit-work-plans').then(setWorkTasks);
  };

  useEffect(() => {
    load();
    apiGet<OrgUnit[]>('/api/units').then(setOrgUnits);
    apiGet<WorkEvidence[]>('/api/evidences').then(setEvidences);
  }, []);

  const evidenceByWork = useMemo(() => {
    const map: Record<string, WorkEvidence[]> = {};
    evidences.forEach(ev => {
      if (ev.unitWorkPlanId) (map[ev.unitWorkPlanId] ||= []).push(ev);
    });
    return map;
  }, [evidences]);

  const months = useMemo(
    () => Array.from(new Set(tasks.map(t => t.month).filter(Boolean))).sort(),
    [tasks],
  );

  useEffect(() => {
    if (monthFilter) return;
    const now = new Date();
    const currentMonth = `${now.getMonth() + 1}/${now.getFullYear()}`;
    setMonthFilter(months.includes(currentMonth) ? currentMonth : months[0] || '');
  }, [months, monthFilter]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let base = monthFilter && monthFilter !== 'all' ? tasks.filter(t => t.month === monthFilter) : tasks;
    if (unitFilter) {
      const unitName = orgUnits.find(u => u.id === unitFilter)?.name || '';
      base = base.filter(t => t.responsibleUnit === unitName);
    }
    if (kw) {
      base = base.filter(t =>
        `${t.taskName} ${t.responsibleUnit} ${t.coordinatingUnits}`.toLowerCase().includes(kw)
      );
    }
    return base;
  }, [tasks, unitFilter, keyword, orgUnits, monthFilter]);

  const workByTask = useMemo(() => {
    const map: Record<string, UnitWorkTask[]> = {};
    workTasks.forEach(w => {
      (map[w.khctTaskId] ||= []).push(w);
    });
    return map;
  }, [workTasks]);

  const filteredTaskIds = useMemo(() => new Set(filtered.map(t => t.id)), [filtered]);
  const totalJobs = workTasks.filter(w => filteredTaskIds.has(w.khctTaskId)).length;
  const doneJobs = workTasks.filter(w => filteredTaskIds.has(w.khctTaskId) && w.status === 'done').length;

  const isOpen = (id: string) => open[id] === true;
  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !isOpen(id) }));

  const selectedUnitName = orgUnits.find(u => u.id === unitFilter)?.name || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Kế hoạch đơn vị</h1>
        </div>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Đơn vị</label>
            <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả đơn vị</option>
              {orgUnits.filter(u => u.parentId !== null).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tháng</label>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="all">Tất cả tháng</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tìm kiếm nhiệm vụ</label>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm nhiệm vụ, đơn vị..."
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Nhiệm vụ KHCT', value: filtered.length, icon: ClipboardList, color: 'bg-primary' },
          { label: 'Công việc đã giao', value: totalJobs, icon: Send, color: 'bg-accent-yellow' },
          { label: 'Công việc hoàn thành', value: doneJobs, icon: Send, color: 'bg-accent-green' },
        ].map(x => { const Icon = x.icon; return (
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
        <div className="card-header">Danh sách nhiệm vụ{selectedUnitName ? ` — ${selectedUnitName}` : ''}{monthFilter && monthFilter !== 'all' ? ` — ${monthFilter}` : ''}</div>
        <div className="overflow-x-auto">
          <table className="table table-fixed min-w-[1500px]">
            <thead>
              <tr>
                <th className="w-[18%]">Nhiệm vụ</th>
                <th className="w-[7%]">Chủ trì</th>
                <th className="w-[7%]">Phối hợp</th>
                <th className="w-[6%]">Mã KPI</th>
                <th className="w-[8%]">Chỉ tiêu</th>
                <th className="w-[10%]">Sản phẩm/KQ</th>
                <th className="w-[12%]">Kết quả nhiệm vụ</th>
                <th className="w-[6%]">Trạng thái thực hiện</th>
                <th className="w-[12%]">Kết luận đánh giá</th>
                <th className="w-[6%]">Thời hạn</th>
                <th className="w-[8%]">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(task => {
                const jobs = workByTask[task.id] || [];
                const rowOpen = isOpen(task.id);
                return (
                  <TaskGroup key={task.id} task={task} jobs={jobs} open={rowOpen} onToggle={() => toggle(task.id)}
                  onAssign={() => setAssignTask(task)} onDetail={() => setDetailTask(task)}
                  onReview={setReviewJob} evidenceByWork={evidenceByWork} />
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="text-center text-text-light text-sm py-8">Không có nhiệm vụ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AssignTaskModal task={assignTask} orgUnits={orgUnits} isOpen={!!assignTask} onClose={() => setAssignTask(null)}
        onAssigned={() => { load(); setAssignTask(null); }} />

      <TaskDetailModal task={detailTask} jobs={detailTask ? workByTask[detailTask.id] || [] : []}
        isOpen={!!detailTask} onClose={() => setDetailTask(null)}
        onSaved={() => { load(); }} />

      <ReviewJobModal job={reviewJob} isOpen={!!reviewJob} onClose={() => setReviewJob(null)}
        onSaved={() => { load(); setReviewJob(null); }} />
    </div>
  );
}

function TaskGroup({ task, jobs, open, onToggle, onAssign, onDetail, onReview, evidenceByWork }: {
  task: KHCTTask;
  jobs: UnitWorkTask[];
  open: boolean;
  onToggle: () => void;
  onAssign: () => void;
  onDetail: () => void;
  onReview: (job: UnitWorkTask) => void;
  evidenceByWork: Record<string, WorkEvidence[]>;
}) {
  const kpiCodes = task.kpiCodes.split(';').map(c => c.trim()).filter(Boolean).filter(c => c !== '—');
  const taskStatus = task.taskStatus || 'not_started';
  const taskStatusMeta: Record<string, { label: string; cls: string }> = {
    not_started: { label: 'Chưa bắt đầu', cls: 'badge-info' },
    in_progress: { label: 'Đang thực hiện', cls: 'badge-warning' },
    done: { label: 'Hoàn thành', cls: 'badge-success' },
  };
  const synth = synthesizeTask(task, jobs);
  const jobIds = new Set(jobs.map(j => j.id));
  const taskEvidence = Object.values(evidenceByWork)
    .flatMap(list => list.filter(ev => ev.unitWorkPlanId && jobIds.has(ev.unitWorkPlanId)));
  return (
    <>
      <tr className="bg-bg-cream/60 cursor-pointer hover:bg-bg-cream align-top" onClick={onToggle}>
        <td className="font-bold text-text-dark">
          <span className="inline-flex items-center gap-1.5">
            {open ? <ChevronDown size={16} className="text-text-light shrink-0"/> : <ChevronRight size={16} className="text-text-light shrink-0"/>}
            {task.taskName}
          </span>
        </td>
        <td className="text-sm">{task.responsibleUnit}</td>
        <td className="text-text-light text-sm">{task.coordinatingUnits}</td>
        <td className="text-xs">
          {kpiCodes.length > 0
            ? <span className="font-mono font-bold text-primary">{kpiCodes.join('; ')}</span>
            : <span className="font-medium text-accent-yellow">Riêng</span>}
        </td>
        <td className="text-xs font-medium text-accent-green break-words">{task.chiTieu || '—'}</td>
        <td className="text-text-light text-sm">{task.deliverable}</td>
        <td className="break-words">
          <span className="flex items-center gap-1.5">
            {task.resultSource === 'sync' && task.syncInfo && (
              <span title={`Đồng bộ từ ${task.syncInfo.sourceName} lúc ${task.syncInfo.syncedAt}`}>
                <RefreshCw size={13} className="text-primary shrink-0"/>
              </span>
            )}
            {synth.result ? (
              <span className="text-lg font-mono font-bold text-accent-green leading-none">{synth.result}</span>
            ) : (
              <span className="text-xs text-text-light">Chưa báo cáo</span>
            )}
          </span>
          {taskEvidence.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-text-light mt-1">
              <Paperclip size={11} className="shrink-0"/>
              <span className="truncate">{taskEvidence.map(ev => ev.fileName || ev.id).join(', ')}</span>
            </span>
          )}
        </td>
        <td>
          <span className={`badge ${taskStatusMeta[taskStatus].cls}`}>{taskStatusMeta[taskStatus].label}</span>
        </td>
        <td className="text-xs text-text-dark break-words">{task.taskReviewNote || <span className="text-text-light">—</span>}</td>
        <td className="text-sm">{task.deadline}</td>
        <td>
          <div className="flex flex-col gap-1">
            <button onClick={e => { e.stopPropagation(); onDetail(); }} className="btn-secondary text-xs flex items-center gap-1">
              <Star size={13}/> Báo cáo
            </button>
            <button onClick={e => { e.stopPropagation(); onAssign(); }} className="btn-primary text-xs flex items-center gap-1">
              <Send size={13}/> Phân giao
            </button>
          </div>
        </td>
      </tr>
      <tr className="m-0 border-0">
        <td colSpan={11} className="m-0 border-0 p-0" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
            <div style={{ overflow: 'hidden' }}>
              {jobs.length === 0 && (
                <div className="px-4 py-2 text-xs text-text-light border-b border-border">Chưa phân giao công việc</div>
              )}
              {jobs.length > 0 && (
                <>
                  <div className="flex w-full items-center bg-bg-cream/40 border-b border-border px-3 py-1 pl-8">
                    <div className="w-[22%] shrink-0 text-xs font-semibold text-text-light">Công việc</div>
                    <div className="w-[9%] shrink-0 text-xs font-semibold text-text-light">Trạng thái</div>
                    <div className="w-[9%] shrink-0 text-xs font-semibold text-text-light">Chỉ tiêu</div>
                    <div className="w-[10%] shrink-0 text-xs font-semibold text-text-light">Tiến độ</div>
                    <div className="w-[14%] shrink-0 text-xs font-semibold text-text-light">Kết quả báo cáo</div>
                    <div className="w-[11%] shrink-0 text-xs font-semibold text-text-light">Thời hạn</div>
                    <div className="w-[16%] shrink-0 text-xs font-semibold text-text-light">Đánh giá</div>
                    <div className="w-[9%] shrink-0 text-xs font-semibold text-text-light">Thao tác</div>
                  </div>
                  {jobs.map((job, i) => {
                    const pct = getProgress(job);
                    const overdue = isOverdue(job);
                    return (
                      <div key={job.id} className={`flex w-full items-start border-b border-border px-3 pl-8 ${i === jobs.length - 1 ? 'border-b-2 border-border' : ''}`}>
                        <div className="w-[22%] shrink-0 py-1">
                          <p className="text-sm text-text-dark leading-snug">{job.title}</p>
                          <p className="text-[11px] text-primary font-medium mt-0.5">{job.primaryUserName}</p>
                        </div>
                        <div className="w-[9%] shrink-0 py-1">
                          <span className={`badge ${statusMeta[job.status].cls}`}>{statusMeta[job.status].label}</span>
                        </div>
                        <div className="w-[9%] shrink-0 py-1 text-xs font-medium text-accent-green">{job.chiTieu || '—'}</div>
                        <div className="w-[10%] shrink-0 py-1">
                          <div className="flex items-center gap-1">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${pct}%`, backgroundColor: progressColor(pct) }} />
                            </div>
                            <span className="text-[11px] font-mono font-bold">{pct}%</span>
                          </div>
                        </div>
                        <div className="w-[14%] shrink-0 py-1 text-xs">
                          {job.result
                            ? <span className="text-accent-green">Kết quả: {job.result}{job.chiTieu && <span className="text-text-light"> / Chỉ tiêu: {job.chiTieu}</span>}</span>
                            : <span className="text-text-light">Chưa báo cáo</span>}
                        </div>
                        <div className="w-[11%] shrink-0 py-1 text-sm">
                          <span className={overdue ? 'text-accent-red font-semibold' : ''}>{job.dueDate}</span>
                          {overdue
                            ? <span className="block text-[10px] text-white bg-accent-red rounded px-1 mt-0.5 w-fit">Trễ</span>
                            : <span className="block text-[10px] text-accent-green mt-0.5">Trong hạn</span>}
                        </div>
                        <div className="w-[16%] shrink-0 py-1 pr-2">
                          <p className={`text-xs font-semibold ${job.assessment ? 'text-text-dark' : 'text-text-light'}`}>
                            {job.assessment || '—'}
                          </p>
                          <p className="text-xs text-text-dark break-words leading-snug mt-0.5">{job.reviewNote || ''}</p>
                        </div>
                        <div className="w-[9%] shrink-0 py-1">
                          <button onClick={e => { e.stopPropagation(); onReview(job); }} className="btn-secondary text-[10px] flex items-center gap-1">
                            <Star size={11}/> Đánh giá
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}

const assessmentOptions = ['Chưa đạt', 'Đạt', 'Tốt', 'Rất tốt'];

function TaskDetailModal({ task, jobs, isOpen, onClose, onSaved }: {
  task: KHCTTask | null;
  jobs: UnitWorkTask[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [taskResult, setTaskResult] = useState('');
  const [taskStatus, setTaskStatus] = useState<'not_started' | 'in_progress' | 'done'>('not_started');
  const [taskReviewNote, setTaskReviewNote] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [mode, setMode] = useState<'manual' | 'sync' | 'aggregate'>('manual');
  const [sources, setSources] = useState<SoftwareSource[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<KHCTTask['syncInfo']>(undefined);
  const [evidences, setEvidences] = useState<WorkEvidence[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadEvidences = async (taskId: string) => {
    const list = await apiGet<WorkEvidence[]>(`/api/evidences?unitWorkPlanId=${taskId}`);
    setEvidences(list);
  };

  useEffect(() => {
    if (isOpen && task) {
      setTaskResult(task.taskResult || '');
      setTaskStatus(task.taskStatus || 'not_started');
      setTaskReviewNote(task.taskReviewNote || '');
      setMode(task.resultSource === 'sync' ? 'sync' : 'manual');
      setSelectedSource('');
      setSyncInfo(task.syncInfo);
      loadEvidences(task.id);
      apiGet<SoftwareSource[]>('/api/software-catalog')
        .then(d => setSources(d.filter(s => s.status !== 'inactive')))
        .catch(() => setSources([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id]);

  const handleAggregate = async () => {
    if (!task) return;
    const res = synthesizeTask(task, jobs);
    setTaskStatus(res.status);
    setTaskResult(res.result);
    setMode('aggregate');
  };

  const handleSync = async () => {
    if (!task || !selectedSource) return;
    setSyncing(true);
    const res = await apiPost<{ task: KHCTTask; syncedRecords: number; sourceName: string }>('/api/khct/sync', { taskId: task.id, sourceId: selectedSource });
    setTaskResult(res.task.taskResult || '');
    setTaskStatus(res.task.taskStatus || 'in_progress');
    setMode('sync');
    setSyncInfo(res.task.syncInfo);
    setSyncing(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !task) return;
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const up = await apiPost<{ url: string; fileName: string }>('/api/unit-work-plans/upload', {
        taskId: task.id, fileName: file.name, fileData: base64,
      });
      await apiPost('/api/evidences', {
        unitWorkPlanId: task.id, evidenceType: 'file',
        fileName: up.fileName, fileUrl: up.url, submittedBy: task.responsibleUnit,
      });
      await loadEvidences(task.id);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteEvidence = async (id: string) => {
    await apiDelete(`/api/evidences/${id}`);
    if (task) await loadEvidences(task.id);
  };

  const saveTask = async () => {
    if (!task) return;
    setSavingTask(true);
    await apiPut(`/api/khct/${task.id}`, { taskResult, taskStatus, taskReviewNote, resultSource: mode === 'sync' ? 'sync' : 'manual' });
    setSavingTask(false);
    onSaved();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đánh giá & cập nhật kết quả nhiệm vụ" maxWidth="max-w-4xl">
      {task && (
        <div className="space-y-4">
          <div className="p-3 bg-bg-cream rounded-lg">
            <p className="text-sm font-semibold text-text-dark">{task.taskName}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs text-text-light">
              <div>Chủ trì: <span className="font-medium text-text-dark">{task.responsibleUnit}</span></div>
              <div>Chỉ tiêu: <span className="font-medium text-accent-green">{task.chiTieu || '—'}</span></div>
              <div>Thời hạn: <span className="font-medium text-text-dark">{task.deadline}</span></div>
              <div>Công việc: <span className="font-medium text-text-dark">{jobs.length}</span></div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold text-text-dark mb-3">Cập nhật kết quả</p>

            <div className="flex flex-wrap gap-2 mb-3">
              <button type="button" onClick={() => setMode('manual')}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'manual' ? 'bg-primary text-white border-primary' : 'text-text-dark border-border hover:border-primary'}`}>
                Nhập kết quả thủ công
              </button>
              <button type="button" onClick={() => setMode('sync')}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'sync' ? 'bg-primary text-white border-primary' : 'text-text-dark border-border hover:border-primary'}`}>
                <RefreshCw size={12} className="inline mr-1"/>Đồng bộ từ phần mềm
              </button>
              <button type="button" onClick={handleAggregate}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${mode === 'aggregate' ? 'bg-primary text-white border-primary' : 'text-text-dark border-border hover:border-primary'}`}>
                <ClipboardList size={12} className="inline mr-1"/>Tổng hợp kết quả công việc
              </button>
            </div>

            {mode === 'sync' ? (
              <div className="flex flex-wrap items-end gap-2 mb-3">
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
            ) : mode === 'aggregate' ? (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button type="button" onClick={handleAggregate} className="btn-secondary text-sm flex items-center gap-1">
                  <ClipboardList size={14}/> Tổng hợp kết quả công việc
                </button>
                <span className="text-[11px] text-text-light">Tính % hoàn thành theo tỉ trọng các công việc con.</span>
              </div>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Kết quả thực hiện</label>
                <input value={taskResult} onChange={e => setTaskResult(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
                  placeholder="VD: 73%" />
                {syncInfo && (
                  <span className="flex items-center gap-1 text-[11px] text-text-light mt-1">
                    <RefreshCw size={11} className="text-primary shrink-0"/>
                    Đồng bộ từ {syncInfo.sourceName} lúc {new Date(syncInfo.syncedAt).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Trạng thái</label>
                <select value={taskStatus} onChange={e => setTaskStatus(e.target.value as typeof taskStatus)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
                  <option value="not_started">Chưa bắt đầu</option>
                  <option value="in_progress">Đang thực hiện</option>
                  <option value="done">Hoàn thành</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium mb-1">Kết luận đánh giá</label>
              <textarea rows={2} value={taskReviewNote} onChange={e => setTaskReviewNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-y" />
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
                      <span className="flex-1 min-w-0 truncate">{ev.fileName || ev.id}</span>
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
            <button type="button" onClick={onClose} className="btn-secondary">Đóng</button>
            <button type="button" onClick={saveTask} disabled={savingTask} className="btn-primary flex items-center gap-1">
              <Save size={14}/> {savingTask ? 'Đang lưu...' : 'Lưu kết quả nhiệm vụ'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReviewJobModal({ job, isOpen, onClose, onSaved }: {
  job: UnitWorkTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [assessment, setAssessment] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && job) {
      setAssessment(job.assessment || '');
      setReviewNote(job.reviewNote || '');
    }
  }, [isOpen, job?.id]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    setSaving(true);
    await apiPut(`/api/unit-work-plans/${job.id}`, {
      assessment: assessment || undefined,
      reviewNote,
    });
    setSaving(false);
    onSaved?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Đánh giá công việc" maxWidth="max-w-lg">
      {job && (
        <form onSubmit={handle} className="space-y-4">
          <div className="p-3 bg-bg-cream rounded-lg">
            <p className="text-sm font-semibold text-text-dark">{job.title}</p>
            <p className="text-xs text-text-light mt-1">Người thực hiện: <span className="font-medium text-text-dark">{job.primaryUserName}</span></p>
            {job.result && <p className="text-xs text-accent-green mt-1">Kết quả đã báo cáo: {job.result}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Đánh giá</label>
            <div className="flex flex-wrap gap-1.5">
              {assessmentOptions.map(a => (
                <button key={a} type="button" onClick={() => setAssessment(a)}
                  className={`text-sm px-3 py-1.5 rounded-lg border transition ${assessment === a ? 'bg-primary text-white border-primary' : 'text-text-dark border-border hover:border-primary'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nhận xét</label>
            <textarea rows={3} value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary resize-y"
              placeholder="Nhập nhận xét của đơn vị (nếu có)" />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Lưu đánh giá'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
