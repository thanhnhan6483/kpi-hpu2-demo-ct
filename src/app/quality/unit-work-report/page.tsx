'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, FilePlus2, FileText, Download, Trash2, Eye, Calendar, RefreshCw, Paperclip } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { synthesizeTask } from '@/lib/taskResult';
import Modal from '@/components/ui/Modal';
import type { KHCTTask, UnitWorkTask, UnitWorkReport, UnitWorkReportRow } from '@/types';

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

const statusLabelMap: Record<string, string> = {
  done: 'Hoàn thành',
  in_progress: 'Đang thực hiện',
  not_started: 'Chưa thực hiện',
};

const statusClsMap: Record<string, string> = {
  done: 'badge-success',
  in_progress: 'badge-warning',
  not_started: 'badge-info',
};

function csvEscape(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportReportCsv(report: UnitWorkReport) {
  const headers = ['Nhiệm vụ', 'Chủ trì', 'Mã KPI', 'Chỉ tiêu', 'Sản phẩm/KQ', 'Trạng thái', 'Kết quả', 'CV hoàn thành'];
  const lines = [headers.join(',')];
  report.rows.forEach(r => {
    lines.push([
      csvEscape(r.taskName),
      csvEscape(r.responsibleUnit),
      csvEscape(r.kpiCodes),
      csvEscape(r.chiTieu || ''),
      csvEscape(r.deliverable),
      csvEscape(r.statusLabel),
      csvEscape(r.taskResult || ''),
      `${r.doneSub}/${r.totalSub}`,
    ].join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `baocao_nhiemvu_${report.month.replace(/\//g, '-')}_${report.unitFilterName || 'tat-ca-don-vi'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function UnitWorkReportPage() {
  const [tasks, setTasks] = useState<KHCTTask[]>([]);
  const [workTasks, setWorkTasks] = useState<UnitWorkTask[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrgUnit[]>([]);
  const [reports, setReports] = useState<UnitWorkReport[]>([]);
  const [months, setMonths] = useState<string[]>([]);

  const [month, setMonth] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<'preview' | 'history'>('preview');
  const [viewReport, setViewReport] = useState<UnitWorkReport | null>(null);
  const [saving, setSaving] = useState(false);
  const [evidences, setEvidences] = useState<WorkEvidence[]>([]);

  const loadRebuild = useCallback(async (preserveMonth?: boolean) => {
    const [t, w, u, r, ev] = await Promise.all([
      apiGet<KHCTTask[]>('/api/khct'),
      apiGet<UnitWorkTask[]>('/api/unit-work-plans'),
      apiGet<OrgUnit[]>('/api/units'),
      apiGet<UnitWorkReport[]>('/api/unit-work-reports'),
      apiGet<WorkEvidence[]>('/api/evidences'),
    ]);
    setTasks(t);
    setWorkTasks(w);
    setOrgUnits(u);
    setReports(r);
    setEvidences(ev);
    const ms = Array.from(new Set(t.map(x => x.month).filter(Boolean))).sort();
    setMonths(ms);
    const now = new Date();
    const currentMonth = `${now.getMonth() + 1}/${now.getFullYear()}`;
    const defaultMonth = ms.includes(currentMonth) ? currentMonth : (ms[0] || '');
    if (!preserveMonth) {
      setMonth(defaultMonth);
    } else if (month && month !== 'all' && !ms.includes(month)) {
      setMonth(defaultMonth);
    }
  }, [month]);

  useEffect(() => {
    loadRebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedUnitName = orgUnits.find(u => u.id === unitFilter)?.name || '';

  const filteredTasks = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let base = month && month !== 'all' ? tasks.filter(t => t.month === month) : tasks;
    if (unitFilter) {
      base = base.filter(t => t.responsibleUnit === selectedUnitName);
    }
    if (kw) {
      base = base.filter(t =>
        `${t.taskName} ${t.responsibleUnit} ${t.coordinatingUnits}`.toLowerCase().includes(kw)
      );
    }
    return base;
  }, [tasks, month, unitFilter, selectedUnitName, keyword]);

  const workByTask = useMemo(() => {
    const map: Record<string, UnitWorkTask[]> = {};
    workTasks.forEach(w => {
      (map[w.khctTaskId] ||= []).push(w);
    });
    return map;
  }, [workTasks]);

  const evidenceByWork = useMemo(() => {
    const map: Record<string, WorkEvidence[]> = {};
    evidences.forEach(ev => {
      if (ev.unitWorkPlanId) (map[ev.unitWorkPlanId] ||= []).push(ev);
    });
    return map;
  }, [evidences]);

  const buildRows = useMemo<UnitWorkReportRow[]>(() => {
    const rows: UnitWorkReportRow[] = [];
    filteredTasks.forEach(task => {
      const jobs = workByTask[task.id] || [];
      const synth = synthesizeTask(task, jobs);
      const { result: taskResult, totalSub, doneSub } = synth;
      const status = task.taskStatus || synth.status;
      const jobIds = new Set(jobs.map(j => j.id));
      const taskEvidence = Object.values(evidenceByWork)
        .flatMap(list => list.filter(ev => ev.unitWorkPlanId && jobIds.has(ev.unitWorkPlanId)));

      rows.push({
        khctTaskId: task.id,
        taskName: task.taskName,
        responsibleUnit: task.responsibleUnit,
        coordinatingUnits: task.coordinatingUnits,
        kpiCodes: task.kpiCodes,
        chiTieu: task.chiTieu || '',
        deliverable: task.deliverable,
        deadline: task.deadline,
        status,
        statusLabel: statusLabelMap[status],
        taskResult,
        taskReviewNote: task.taskReviewNote,
        resultSource: task.resultSource,
        syncInfo: task.syncInfo,
        evidenceNames: taskEvidence.map(ev => ev.fileName || ev.id),
        doneSub,
        totalSub,
      });
    });
    return rows;
  }, [filteredTasks, workByTask, evidenceByWork]);

  const summary = useMemo(() => {
    const totalTasks = buildRows.length;
    const doneTasks = buildRows.filter(r => r.status === 'done').length;
    const inProgressTasks = buildRows.filter(r => r.status === 'in_progress').length;
    const notStartedTasks = buildRows.filter(r => r.status === 'not_started').length;
    const totalSub = buildRows.reduce((s, r) => s + r.totalSub, 0);
    const doneSub = buildRows.reduce((s, r) => s + r.doneSub, 0);
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    return { totalTasks, doneTasks, inProgressTasks, notStartedTasks, totalSub, doneSub, completionRate };
  }, [buildRows]);

  const createReport = async () => {
    if (buildRows.length === 0) return;
    setSaving(true);
    const report = await apiPost<UnitWorkReport>('/api/unit-work-reports', {
      month,
      unitFilterName: selectedUnitName,
      unitIds: unitFilter ? [unitFilter] : [],
      rows: buildRows,
      summary,
    });
    setSaving(false);
    const fresh = await apiGet<UnitWorkReport[]>('/api/unit-work-reports');
    setReports(fresh);
    setTab('history');
    setViewReport(report);
  };

  const deleteReport = async (id: string) => {
    await apiDelete(`/api/unit-work-reports/${id}`);
    const fresh = await apiGet<UnitWorkReport[]>('/api/unit-work-reports');
    setReports(fresh);
    if (viewReport?.id === id) setViewReport(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Báo cáo kết quả nhiệm vụ</h1>
          <p className="text-sm text-text-light mt-1">Tổng hợp kết quả thực hiện nhiệm vụ theo tháng và so sánh với chỉ tiêu.</p>
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
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="all">Tất cả tháng</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tìm kiếm</label>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Tìm nhiệm vụ, đơn vị..."
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Nhiệm vụ KHCT', value: summary.totalTasks, color: 'bg-primary' },
          { label: 'Hoàn thành', value: summary.doneTasks, color: 'bg-accent-green' },
          { label: 'Đang thực hiện', value: summary.inProgressTasks, color: 'bg-accent-yellow' },
          { label: 'Tỷ lệ hoàn thành', value: `${summary.completionRate}%`, color: 'bg-accent-green' },
        ].map(x => (
          <div key={x.label} className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-text-light text-xs">{x.label}</p>
              <p className="text-2xl font-heading font-bold text-primary mt-1">{x.value}</p>
            </div>
            <div className={`p-3 rounded-lg ${x.color}`}><ClipboardList size={21} className="text-white" /></div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 bg-bg-cream rounded-lg">
          {([
            { id: 'preview', label: 'Tổng hợp' },
            { id: 'history', label: `Báo cáo đã lập (${reports.length})` },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${tab === t.id ? 'bg-white shadow-sm text-primary' : 'text-text-light hover:text-text-dark'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'preview' && (
          <button onClick={createReport} disabled={saving || buildRows.length === 0 || !month || month === 'all'}
            className="btn-primary flex items-center gap-1">
            <FilePlus2 size={15} /> {saving ? 'Đang lập...' : 'Lập báo cáo'}
          </button>
        )}
      </div>

      {tab === 'preview' && (
        <div className="card">
          <div className="card-header">Danh sách nhiệm vụ{selectedUnitName ? ` — ${selectedUnitName}` : ''}{month && month !== 'all' ? ` — ${month}` : ''}</div>
          <div className="overflow-x-auto">
            <table className="table table-fixed min-w-[1400px]">
              <thead>
                <tr>
                  <th className="w-[24%]">Nhiệm vụ</th>
                  <th className="w-[8%]">Chủ trì</th>
                  <th className="w-[8%]">Phối hợp</th>
                  <th className="w-[9%]">Mã KPI</th>
                  <th className="w-[10%]">Chỉ tiêu</th>
                  <th className="w-[10%]">Sản phẩm/KQ</th>
                  <th className="w-[13%]">Kết quả nhiệm vụ</th>
                  <th className="w-[9%]">Trạng thái thực hiện</th>
                  <th className="w-[13%]">Kết luận đánh giá</th>
                </tr>
              </thead>
              <tbody>
                {buildRows.map(row => {
                  const kpiCodes = row.kpiCodes.split(';').map(c => c.trim()).filter(Boolean).filter(c => c !== '—');
                  return (
                    <tr key={row.khctTaskId} className="align-top">
                      <td className="font-bold text-text-dark">{row.taskName}</td>
                      <td className="text-sm">{row.responsibleUnit}</td>
                      <td className="text-sm text-text-light">{row.coordinatingUnits}</td>
                      <td className="text-xs">
                        {kpiCodes.length > 0
                          ? <span className="font-mono font-bold text-primary">{kpiCodes.join('; ')}</span>
                          : <span className="font-medium text-accent-yellow">Riêng</span>}
                      </td>
                      <td className="text-xs font-medium text-accent-green break-words">{row.chiTieu || '—'}</td>
                      <td className="text-sm text-text-light">{row.deliverable}</td>
                      <td className="break-words">
                        <span className="flex items-center gap-1.5">
                          {row.resultSource === 'sync' && row.syncInfo && (
                            <span title={`Đồng bộ từ ${row.syncInfo.sourceName} lúc ${row.syncInfo.syncedAt}`}>
                              <RefreshCw size={13} className="text-primary shrink-0"/>
                            </span>
                          )}
                          {row.taskResult ? (
                            <span className="text-lg font-mono font-bold text-accent-green leading-none">{row.taskResult}</span>
                          ) : (
                            <span className="text-xs text-text-light">Chưa báo cáo</span>
                          )}
                        </span>
                        {row.evidenceNames && row.evidenceNames.length > 0 && (
                          <span className="flex items-center gap-1 text-[11px] text-text-light mt-1">
                            <Paperclip size={11} className="shrink-0"/>
                            <span className="truncate">{row.evidenceNames.join(', ')}</span>
                          </span>
                        )}
                      </td>
                      <td><span className={`badge ${statusClsMap[row.status]}`}>{row.statusLabel}</span></td>
                      <td className="text-xs text-text-dark break-words">{row.taskReviewNote || <span className="text-text-light">—</span>}</td>
                    </tr>
                  );
                })}
                {buildRows.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-text-light text-sm py-8">Không có nhiệm vụ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          <div className="card-header">Báo cáo đã lập</div>
          <div className="overflow-x-auto">
            <table className="table min-w-[800px]">
              <thead>
                <tr>
                  <th className="w-[14%]">Tháng</th>
                  <th className="w-[22%]">Đơn vị</th>
                  <th className="w-[16%]">Ngày lập</th>
                  <th className="w-[10%]">Số nhiệm vụ</th>
                  <th className="w-[14%]">Tỷ lệ hoàn thành</th>
                  <th className="w-[24%]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id} className="align-middle">
                    <td className="text-sm font-medium">{r.month}</td>
                    <td className="text-sm">{r.unitFilterName || 'Tất cả đơn vị'}</td>
                    <td className="text-sm text-text-light">{new Date(r.createdAt).toLocaleDateString('vi-VN')} {new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="text-sm">{r.summary.totalTasks}</td>
                    <td className="text-sm">
                      <span className={`badge ${r.summary.completionRate >= 80 ? 'badge-success' : r.summary.completionRate >= 40 ? 'badge-warning' : 'badge-danger'}`}>
                        {r.summary.completionRate}%
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <button onClick={() => setViewReport(r)} className="btn-secondary text-xs flex items-center gap-1">
                          <Eye size={12} /> Xem
                        </button>
                        <button onClick={() => exportReportCsv(r)} className="btn-secondary text-xs flex items-center gap-1">
                          <Download size={12} /> CSV
                        </button>
                        <button onClick={() => deleteReport(r.id)} className="btn-secondary text-xs flex items-center gap-1 text-accent-red">
                          <Trash2 size={12} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-text-light text-sm py-8">Chưa có báo cáo nào. Vào tab Tổng hợp để lập báo cáo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ReportDetailModal report={viewReport} isOpen={!!viewReport} onClose={() => setViewReport(null)}
        onExport={() => viewReport && exportReportCsv(viewReport)} />
    </div>
  );
}

function ReportDetailModal({ report, isOpen, onClose, onExport }: {
  report: UnitWorkReport | null;
  isOpen: boolean;
  onClose: () => void;
  onExport: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết báo cáo" maxWidth="max-w-5xl">
      {report && (
        <div className="space-y-4">
          <div className="p-3 bg-bg-cream rounded-lg flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-text-light"><Calendar size={14} /> Tháng: <b className="text-text-dark">{report.month}</b></span>
            <span>Đơn vị: <b className="text-text-dark">{report.unitFilterName || 'Tất cả đơn vị'}</b></span>
            <span>Ngày lập: <b className="text-text-dark">{new Date(report.createdAt).toLocaleString('vi-VN')}</b></span>
            <span>Nhiệm vụ: <b className="text-text-dark">{report.summary.totalTasks}</b></span>
            <span>Tỷ lệ hoàn thành: <b className="text-accent-green">{report.summary.completionRate}%</b></span>
          </div>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="table min-w-[900px]">
              <thead className="sticky top-0">
                <tr>
                  <th className="w-[30%]">Nhiệm vụ</th>
                  <th className="w-[10%]">Chủ trì</th>
                  <th className="w-[12%]">Chỉ tiêu</th>
                  <th className="w-[14%]">Kết quả</th>
                  <th className="w-[10%]">Trạng thái</th>
                  <th className="w-[10%]">CV hoàn thành</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map(r => (
                  <tr key={r.khctTaskId} className="align-top">
                    <td className="text-sm font-medium">{r.taskName}</td>
                    <td className="text-sm">{r.responsibleUnit}</td>
                    <td className="text-xs text-accent-green">{r.chiTieu || '—'}</td>
                    <td className="text-xs">{r.taskResult || '—'}</td>
                    <td><span className={`badge ${statusClsMap[r.status]}`}>{r.statusLabel}</span></td>
                    <td className="text-sm">{r.doneSub}/{r.totalSub}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button onClick={onClose} className="btn-secondary">Đóng</button>
            <button onClick={onExport} className="btn-primary flex items-center gap-1"><FileText size={14} /> Xuất CSV</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
