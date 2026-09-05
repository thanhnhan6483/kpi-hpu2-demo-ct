'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, ClipboardList, Send, FilePlus2, FileText, Download, Trash2, Eye, Calendar } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import Modal from '@/components/ui/Modal';
import type { KHCTTask, UnitWorkTask, UnitWorkReport, UnitWorkReportRow } from '@/types';

interface OrgUnit {
  id: string;
  name: string;
  parentId: string | null;
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
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<'preview' | 'history'>('preview');
  const [viewReport, setViewReport] = useState<UnitWorkReport | null>(null);
  const [saving, setSaving] = useState(false);

  const loadRebuild = useCallback(async (preserveMonth?: boolean) => {
    const [t, w, u, r] = await Promise.all([
      apiGet<KHCTTask[]>('/api/khct'),
      apiGet<UnitWorkTask[]>('/api/unit-work-plans'),
      apiGet<OrgUnit[]>('/api/units'),
      apiGet<UnitWorkReport[]>('/api/unit-work-reports'),
    ]);
    setTasks(t);
    setWorkTasks(w);
    setOrgUnits(u);
    setReports(r);
    const ms = Array.from(new Set(t.map(x => x.month).filter(Boolean))).sort();
    setMonths(ms);
    if (!preserveMonth) {
      setMonth(ms[0] || '');
    } else if (!ms.includes(month)) {
      setMonth(ms[0] || '');
    }
  }, [month]);

  useEffect(() => {
    loadRebuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedUnitName = orgUnits.find(u => u.id === unitFilter)?.name || '';

  const filteredTasks = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let base = tasks.filter(t => t.month === month);
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

  const buildRows = useMemo<UnitWorkReportRow[]>(() => {
    const rows: UnitWorkReportRow[] = [];
    filteredTasks.forEach(task => {
      const jobs = workByTask[task.id] || [];
      const doneSub = jobs.filter(j => j.status === 'done').length;
      const totalSub = jobs.length;

      let status: UnitWorkReportRow['status'];
      if (task.taskStatus && ['done', 'in_progress', 'not_started'].includes(task.taskStatus)) {
        status = task.taskStatus;
      } else if (totalSub > 0) {
        if (doneSub === totalSub) status = 'done';
        else if (doneSub > 0 || jobs.some(j => j.status === 'in_progress')) status = 'in_progress';
        else status = 'not_started';
      } else {
        status = task.taskStatus === 'in_progress' ? 'in_progress' : 'not_started';
      }

      let taskResult = task.taskResult || '';
      if (!taskResult && totalSub > 0) {
        taskResult = `Hoàn thành ${doneSub}/${totalSub}`;
      }

      rows.push({
        khctTaskId: task.id,
        taskName: task.taskName,
        responsibleUnit: task.responsibleUnit,
        kpiCodes: task.kpiCodes,
        chiTieu: task.chiTieu || '',
        deliverable: task.deliverable,
        deadline: task.deadline,
        status,
        statusLabel: statusLabelMap[status],
        taskResult,
        doneSub,
        totalSub,
        subTasks: jobs.map(j => ({
          title: j.title,
          chiTieu: j.chiTieu || '',
          result: j.result || '',
          status: j.status,
          assessment: j.assessment || '',
          dueDate: j.dueDate,
        })),
      });
    });
    return rows;
  }, [filteredTasks, workByTask]);

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

  const isOpen = (id: string) => open[id] === true;
  const toggle = (id: string) => setOpen(o => ({ ...o, [id]: !isOpen(id) }));

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
            <label className="block text-sm font-medium mb-1">Tháng</label>
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Chọn tháng</option>
              {months.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Đơn vị</label>
            <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả đơn vị</option>
              {orgUnits.filter(u => u.parentId !== null).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
          <button onClick={createReport} disabled={saving || buildRows.length === 0}
            className="btn-primary flex items-center gap-1">
            <FilePlus2 size={15} /> {saving ? 'Đang lập...' : 'Lập báo cáo'}
          </button>
        )}
      </div>

      {tab === 'preview' && (
        <div className="card">
          <div className="card-header">Danh sách nhiệm vụ{selectedUnitName ? ` — ${selectedUnitName}` : ''}{month ? ` — ${month}` : ''}</div>
          <div className="overflow-x-auto">
            <table className="table table-fixed min-w-[1100px]">
              <thead>
                <tr>
                  <th className="w-[30%]">Nhiệm vụ</th>
                  <th className="w-[10%]">Chủ trì</th>
                  <th className="w-[8%]">Mã KPI</th>
                  <th className="w-[13%]">Chỉ tiêu</th>
                  <th className="w-[13%]">Kết quả</th>
                  <th className="w-[10%]">Trạng thái</th>
                  <th className="w-[8%]">CV hoàn thành</th>
                  <th className="w-[8%]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {buildRows.map(row => {
                  const kpiCodes = row.kpiCodes.split(';').map(c => c.trim()).filter(Boolean).filter(c => c !== '—');
                  const rowOpen = isOpen(row.khctTaskId);
                  return (
                    <ReportGroup key={row.khctTaskId} row={row} kpiCodes={kpiCodes} open={rowOpen}
                      onToggle={() => toggle(row.khctTaskId)} />
                  );
                })}
                {buildRows.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-text-light text-sm py-8">Không có nhiệm vụ</td></tr>
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

function ReportGroup({ row, kpiCodes, open, onToggle }: {
  row: UnitWorkReportRow;
  kpiCodes: string[];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="bg-bg-cream/60 cursor-pointer hover:bg-bg-cream align-top" onClick={onToggle}>
        <td className="font-bold text-text-dark">
          <span className="inline-flex items-center gap-1.5">
            {open ? <ChevronDown size={16} className="text-text-light shrink-0" /> : <ChevronRight size={16} className="text-text-light shrink-0" />}
            {row.taskName}
          </span>
        </td>
        <td className="text-sm">{row.responsibleUnit}</td>
        <td className="text-xs">
          {kpiCodes.length > 0
            ? <span className="font-mono font-bold text-primary">{kpiCodes.join('; ')}</span>
            : <span className="font-medium text-accent-yellow">Riêng</span>}
        </td>
        <td className="text-xs font-medium text-accent-green break-words">{row.chiTieu || '—'}</td>
        <td className="text-xs text-text-dark break-words">{row.taskResult || 'Chưa báo cáo'}</td>
        <td><span className={`badge ${statusClsMap[row.status]}`}>{row.statusLabel}</span></td>
        <td className="text-sm">{row.doneSub}/{row.totalSub}</td>
        <td>
          <div className="flex flex-wrap gap-1">
            <button onClick={e => { e.stopPropagation(); onToggle(); }} className="btn-secondary text-xs flex items-center gap-1">
              <Send size={12} /> {row.subTasks && row.subTasks.length > 0 ? 'Công việc' : 'Chi tiết'}
            </button>
          </div>
        </td>
      </tr>
      {row.subTasks && row.subTasks.length > 0 && (
        <tr className="m-0 border-0">
          <td colSpan={8} className="m-0 border-0 p-0" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
              <div style={{ overflow: 'hidden' }}>
                <div className="flex w-full items-center bg-bg-cream/40 border-b border-border px-3 py-1 pl-8">
                  <div className="w-[26%] shrink-0 text-xs font-semibold text-text-light">Công việc</div>
                  <div className="w-[14%] shrink-0 text-xs font-semibold text-text-light">Chỉ tiêu</div>
                  <div className="w-[18%] shrink-0 text-xs font-semibold text-text-light">Kết quả báo cáo</div>
                  <div className="w-[14%] shrink-0 text-xs font-semibold text-text-light">Đánh giá</div>
                  <div className="w-[12%] shrink-0 text-xs font-semibold text-text-light">Thời hạn</div>
                  <div className="w-[16%] shrink-0 text-xs font-semibold text-text-light">Trạng thái</div>
                </div>
                {row.subTasks.map((job, i) => (
                  <div key={i} className={`flex w-full items-start border-b border-border px-3 pl-8 ${i === (row.subTasks || []).length - 1 ? 'border-b-0' : ''}`}>
                    <div className="w-[26%] shrink-0 py-1">
                      <p className="text-sm text-text-dark leading-snug">{job.title}</p>
                    </div>
                    <div className="w-[14%] shrink-0 py-1 text-xs font-medium text-accent-green">{job.chiTieu || '—'}</div>
                    <div className="w-[18%] shrink-0 py-1 text-xs">
                      {job.result
                        ? <span className="text-accent-green">{job.result}</span>
                        : <span className="text-text-light">Chưa báo cáo</span>}
                    </div>
                    <div className="w-[14%] shrink-0 py-1 text-xs font-semibold">{job.assessment || '—'}</div>
                    <div className="w-[12%] shrink-0 py-1 text-sm">{job.dueDate}</div>
                    <div className="w-[16%] shrink-0 py-1">
                      <span className={`badge ${statusClsMap[job.status] ?? 'badge-info'}`}>{statusLabelMap[job.status] || job.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
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
