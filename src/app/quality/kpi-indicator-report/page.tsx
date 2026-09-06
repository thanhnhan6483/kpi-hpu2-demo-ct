'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Paperclip, Download, Target } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { KHCTTask, UnitWorkTask, SchoolKPICatalog, KPIGroup } from '@/types';
import {
  academicYearOfMonth,
  activeIndicatorCodes,
  buildIndicatorRows,
  downloadCsv,
  statusClsMap,
  statusLabelMap,
  statusMeta,
} from '@/lib/indicatorReport';
import type { IndicatorRow, IndicatorStatusKey, MeasurementUnit, WorkEvidence } from '@/lib/indicatorReport';

export default function KpiIndicatorReportPage() {
  const [indicators, setIndicators] = useState<SchoolKPICatalog[]>([]);
  const [tasks, setTasks] = useState<KHCTTask[]>([]);
  const [workTasks, setWorkTasks] = useState<UnitWorkTask[]>([]);
  const [evidences, setEvidences] = useState<WorkEvidence[]>([]);
  const [groups, setGroups] = useState<KPIGroup[]>([]);
  const [units, setUnits] = useState<MeasurementUnit[]>([]);

  const [yearFilter, setYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const [ind, t, w, ev, g, mu] = await Promise.all([
      apiGet<SchoolKPICatalog[]>('/api/school-kpi-catalog'),
      apiGet<KHCTTask[]>('/api/khct'),
      apiGet<UnitWorkTask[]>('/api/unit-work-plans'),
      apiGet<WorkEvidence[]>('/api/evidences'),
      apiGet<KPIGroup[]>('/api/kpi-groups'),
      apiGet<MeasurementUnit[]>('/api/measurement-units'),
    ]);
    setIndicators(ind);
    setTasks(t);
    setWorkTasks(w);
    setEvidences(ev);
    setGroups(g);
    setUnits(mu);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCodes = useMemo(
    () => activeIndicatorCodes(indicators),
    [indicators],
  );

  const matchedTasks = useMemo(
    () => tasks.filter(t =>
      (t.kpiCodes || '').split(';').map(c => c.trim()).filter(Boolean).some(c => activeCodes.has(c))
    ),
    [tasks, activeCodes],
  );

  const yearOptions = useMemo(
    () => Array.from(new Set(matchedTasks.map(t => academicYearOfMonth(t.month)).filter(Boolean))).sort().reverse(),
    [matchedTasks],
  );

  const tasksInScope = useMemo(
    () => (yearFilter ? matchedTasks.filter(t => academicYearOfMonth(t.month) === yearFilter) : matchedTasks),
    [matchedTasks, yearFilter],
  );

  const indicatorRows = useMemo<IndicatorRow[]>(
    () => buildIndicatorRows({ indicators, tasks: tasksInScope, workTasks, evidences, groups, units }),
    [indicators, tasksInScope, workTasks, evidences, groups, units],
  );

  const filteredRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return indicatorRows.filter(row => {
      if (groupFilter && row.indicator.categoryId !== groupFilter) return false;
      if (statusFilter && row.statusKey !== statusFilter) return false;
      if (!kw) return true;
      const taskHit = row.tasks.some(r => r.task.taskName.toLowerCase().includes(kw));
      return (
        row.indicator.code.toLowerCase().includes(kw) ||
        row.indicator.name.toLowerCase().includes(kw) ||
        taskHit
      );
    });
  }, [indicatorRows, groupFilter, statusFilter, keyword]);

  const stats = useMemo(() => {
    const okCount = filteredRows.filter(r => r.statusKey === 'ok').length;
    const failCount = filteredRows.filter(r => r.statusKey === 'fail' || r.statusKey === 'partial').length;
    const noDataCount = filteredRows.filter(r => r.statusKey === 'no_data' || r.statusKey === 'updating').length;
    const taskTotal = filteredRows.reduce((s, r) => s + r.tasks.length, 0);
    const reachTotal = filteredRows.reduce((s, r) => s + r.doneOk, 0);
    const withData = okCount + failCount;
    const completionRate = withData > 0 ? Math.round((okCount / withData) * 100) : 0;
    const taskRate = taskTotal > 0 ? Math.round((reachTotal / taskTotal) * 100) : 0;
    return { total: filteredRows.length, okCount, failCount, noDataCount, reachTotal, taskTotal, completionRate, taskRate };
  }, [filteredRows]);

  const exportCsv = () => {
    const headers = ['Mã KPI', 'Chỉ tiêu', 'Nhóm lĩnh vực', 'ĐVT', 'Chu kỳ', 'Chỉ tiêu giao', 'Số nhiệm vụ', 'Nhiệm vụ đạt', 'Nhiệm vụ chưa đạt', 'Trạng thái'];
    const rows = filteredRows.map(r => [
      r.indicator.code,
      r.indicator.name,
      r.groupName,
      r.unitName || '—',
      r.indicator.cycle || '—',
      r.indicator.target || '—',
      r.tasks.length,
      r.doneOk,
      r.fail,
      r.statusLabel,
    ]);
    downloadCsv(`baocao_chitieu_kpi_${yearFilter || 'nam-hoc'}.csv`, headers, rows);
  };

  const toggle = (code: string) => setOpen(o => ({ ...o, [code]: !o[code] }));
  const isOpen = (code: string) => open[code] === true;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-dark">Báo cáo chỉ tiêu KPI của trường</h1>
        <p className="text-text-light text-sm mt-1">Tổng hợp từ kế hoạch đơn vị (nhiệm vụ) đã triển khai theo từng chỉ tiêu KPI</p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Năm học</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả năm học</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Trạng thái</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(statusMeta) as IndicatorStatusKey[]).map(k => <option key={k} value={k}>{statusMeta[k].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nhóm lĩnh vực</label>
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả nhóm</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tìm kiếm</label>
            <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="Mã KPI, tên chỉ tiêu, nhiệm vụ..."
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[
          { label: 'Tổng chỉ tiêu KPI', value: stats.total, color: 'bg-primary', sub: `tỷ lệ đạt ${stats.completionRate}%` },
          { label: 'Chỉ tiêu đạt', value: stats.okCount, color: 'bg-accent-green', sub: `/${stats.okCount + stats.failCount} chỉ tiêu có dữ liệu` },
          { label: 'Chỉ tiêu chưa đạt', value: stats.failCount, color: 'bg-accent-red', sub: 'gồm cả đạt một phần' },
          { label: 'Chỉ tiêu chưa có dữ liệu', value: stats.noDataCount, color: 'bg-accent-yellow', sub: 'chưa có nhiệm vụ/kết quả' },
          { label: 'Nhiệm vụ đạt', value: `${stats.reachTotal}/${stats.taskTotal}`, color: 'bg-accent-green', sub: `${stats.taskRate}%` },
        ].map(x => (
          <div key={x.label} className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-text-light text-xs">{x.label}</p>
              <p className="text-2xl font-heading font-bold text-primary mt-1">{x.value}</p>
              {x.sub && <p className="text-[11px] text-text-light mt-0.5">{x.sub}</p>}
            </div>
            <div className={`p-3 rounded-lg ${x.color}`}><Target size={21} className="text-white" /></div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end">
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-1">
          <Download size={14} /> Xuất CSV
        </button>
      </div>

      <div className="card">
        <div className="card-header">Chỉ tiêu KPI{yearFilter ? ` — Năm học ${yearFilter}` : ''}</div>
        <div className="overflow-x-auto">
          <table className="table table-fixed min-w-[1100px]">
            <thead>
              <tr>
                <th className="w-[10%]">Mã KPI</th>
                <th className="w-[30%]">Chỉ tiêu</th>
                <th className="w-[14%]">Nhóm lĩnh vực</th>
                <th className="w-[10%]">Số nhiệm vụ</th>
                <th className="w-[14%]">Kết quả</th>
                <th className="w-[12%]">Trạng thái</th>
                <th className="w-[10%]">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const opened = isOpen(row.indicator.code);
                return (
                  <IndicatorGroup key={row.indicator.code} row={row} opened={opened}
                    onToggle={() => toggle(row.indicator.code)} />
                );
              })}
              {filteredRows.length === 0 && (
                <tr><td colSpan={7} className="text-center text-text-light text-sm py-8">Không có chỉ tiêu phù hợp</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function IndicatorGroup({ row, opened, onToggle }: {
  row: IndicatorRow;
  opened: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="bg-bg-cream/60 cursor-pointer hover:bg-bg-cream align-top" onClick={onToggle}>
        <td className="text-sm">
          <span className="inline-flex items-center gap-1.5">
            {opened ? <ChevronDown size={15} className="text-text-light shrink-0" /> : <ChevronRight size={15} className="text-text-light shrink-0" />}
            <span className="font-mono font-bold text-primary">{row.indicator.code}</span>
          </span>
        </td>
        <td className="text-sm">
          <p className="font-semibold text-text-dark leading-snug">{row.indicator.name}</p>
          <p className="text-xs text-text-light mt-0.5">
            Chỉ tiêu giao: <b className="text-text-dark">{row.indicator.target || '—'}{row.unitName && row.unitName !== '%' && !(row.indicator.target || '').includes('%') ? ` ${row.unitName}` : ''}</b>
            {row.indicator.cycle ? ` · ${row.indicator.cycle}` : ''}
          </p>
        </td>
        <td className="text-xs text-text-dark">{row.groupName}</td>
        <td className="text-sm">{row.tasks.length}</td>
        <td className="text-sm">
          <span className="text-lg font-mono font-bold text-accent-green leading-none">{row.doneOk}</span>
          <span className="text-text-light">/{row.tasks.length} đạt</span>
          {row.gapText && <p className="text-xs text-accent-red mt-0.5">{row.gapText}</p>}
        </td>
        <td><span className={`badge ${row.statusCls}`}>{row.statusLabel}</span></td>
        <td>
          <button onClick={e => { e.stopPropagation(); onToggle(); }} className="btn-secondary text-xs">
            {opened ? 'Thu gọn' : 'Xem nhiệm vụ'}
          </button>
        </td>
      </tr>
      <tr className="m-0 border-0">
        <td colSpan={7} className="m-0 border-0 p-0" style={{ overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateRows: opened ? '1fr' : '0fr', transition: 'grid-template-rows 0.3s ease' }}>
            <div style={{ overflow: 'hidden' }}>
              <div className="overflow-x-auto border-t border-border">
                {row.tasks.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-text-light">Chưa có nhiệm vụ triển khai trong kỳ.</div>
                ) : (
                  <table className="w-full min-w-[1000px] bg-white">
                    <thead>
                      <tr className="bg-bg-cream/40">
                        <th className="w-[28%]">Nhiệm vụ</th>
                        <th className="w-[10%]">Chủ trì</th>
                        <th className="w-[12%]">Chỉ tiêu</th>
                        <th className="w-[18%]">Kết quả nhiệm vụ</th>
                        <th className="w-[12%]">Trạng thái thực hiện</th>
                        <th className="w-[20%]">Kết luận đánh giá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.tasks.map(r => {
                        const kpiCodes = r.task.kpiCodes.split(';').map(c => c.trim()).filter(Boolean).filter(c => c !== '—');
                        return (
                          <tr key={r.task.id} className="align-top border-b border-border">
                            <td className="p-2 pl-3">
                              <p className="text-sm font-medium text-text-dark leading-snug">{r.task.taskName}</p>
                              <p className="text-[11px] text-text-light mt-0.5">
                                Tháng {r.task.month} · {kpiCodes.join('; ')}
                              </p>
                            </td>
                            <td className="p-2 text-sm">{r.task.responsibleUnit}</td>
                            <td className="p-2 text-xs font-medium text-accent-green">{r.task.chiTieu || '—'}</td>
                            <td className="p-2">
                              <span className="flex items-center gap-1.5">
                                {r.task.resultSource === 'sync' && r.task.syncInfo && (
                                  <span title={`Đồng bộ từ ${r.task.syncInfo.sourceName} lúc ${r.task.syncInfo.syncedAt}`}>
                                    <RefreshCw size={13} className="text-primary shrink-0" />
                                  </span>
                                )}
                                {r.task.taskResult ? (
                                  <span className="text-base font-mono font-bold text-accent-green leading-none">{r.task.taskResult}</span>
                                ) : r.synth.result ? (
                                  <span className="text-base font-mono font-bold text-accent-green leading-none">{r.synth.result}</span>
                                ) : (
                                  <span className="text-xs text-text-light">Chưa báo cáo</span>
                                )}
                              </span>
                              {r.evidenceNames.length > 0 && (
                                <span className="flex items-center gap-1 text-[11px] text-text-light mt-1">
                                  <Paperclip size={11} className="shrink-0" />
                                  <span className="truncate max-w-[220px]">{r.evidenceNames.join(', ')}</span>
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              <span className={`badge ${statusClsMap[r.task.taskStatus || r.synth.status] ?? 'badge-info'}`}>
                                {statusLabelMap[r.task.taskStatus || r.synth.status] || 'Chưa thực hiện'}
                              </span>
                            </td>
                            <td className="p-2 text-xs text-text-dark">{r.task.taskReviewNote || <span className="text-text-light">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  );
}