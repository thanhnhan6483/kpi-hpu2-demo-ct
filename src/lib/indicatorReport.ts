import type { KHCTTask, UnitWorkTask, SchoolKPICatalog, KPIGroup } from '@/types';
import { parsePct, synthesizeTask } from '@/lib/taskResult';
import type { TaskSynthResult } from '@/lib/taskResult';

export interface ParsedTarget {
  cmp: '>=' | '<=' | '>' | '<' | '=';
  value: number;
  isPct: boolean;
}

export interface WorkEvidence {
  id: string;
  unitWorkPlanId?: string;
  fileName?: string;
  fileUrl?: string;
  status?: string;
}

export interface MeasurementUnit {
  id: string;
  code: string;
  name: string;
  status?: string;
}

export interface IndicatorTaskRow {
  task: KHCTTask;
  jobs: UnitWorkTask[];
  synth: TaskSynthResult;
  evidenceNames: string[];
  hasData: boolean;
  reach: boolean;
}

export type IndicatorStatusKey = 'no_data' | 'updating' | 'fail' | 'partial' | 'ok';

export interface IndicatorRow {
  indicator: SchoolKPICatalog;
  groupId: string;
  groupName: string;
  tasks: IndicatorTaskRow[];
  reported: number;
  unreported: number;
  fail: number;
  doneOk: number;
  statusKey: IndicatorStatusKey;
  statusLabel: string;
  statusCls: string;
  unitName: string;
  gapText: string;
}

export const statusLabelMap: Record<string, string> = {
  done: 'Hoàn thành',
  in_progress: 'Đang thực hiện',
  not_started: 'Chưa thực hiện',
};

export const statusClsMap: Record<string, string> = {
  done: 'badge-success',
  in_progress: 'badge-warning',
  not_started: 'badge-info',
};

export const statusMeta: Record<IndicatorStatusKey, { label: string; cls: string }> = {
  no_data: { label: 'Chưa có dữ liệu', cls: 'badge-info' },
  updating: { label: 'Đang cập nhật', cls: 'badge-warning' },
  fail: { label: 'Chưa đạt', cls: 'badge-danger' },
  partial: { label: 'Đạt một phần', cls: 'badge-warning' },
  ok: { label: 'Đạt', cls: 'badge-success' },
};

export function csvEscape(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function parseTarget(target?: string): ParsedTarget | null {
  if (!target) return null;
  const m = String(target).trim().match(/^(>=|<=|>|<|=)?\s*(\d+(?:[.,]\d+)?)\s*(%)?/);
  if (!m) return null;
  return { cmp: (m[1] || '>=') as ParsedTarget['cmp'], value: Number(m[2].replace(',', '.')), isPct: !!m[3] };
}

export function cmpValue(value: number, t: ParsedTarget): boolean {
  switch (t.cmp) {
    case '>=': return value >= t.value;
    case '<=': return value <= t.value;
    case '>': return value > t.value;
    case '<': return value < t.value;
    default: return Math.abs(value - t.value) < 1e-6;
  }
}

export function academicYearOfMonth(month?: string): string {
  if (!month) return '';
  const [m, y] = month.split('/').map(s => Number(s));
  if (!m || !y) return '';
  const start = m >= 8 ? y : y - 1;
  return `${start}-${start + 1}`;
}

export function downloadCsv(filename: string, headers: string[], rowsArr: (string | number)[][]) {
  const lines = [headers.join(',')];
  rowsArr.forEach(r => lines.push(r.map(cell => csvEscape(cell)).join(',')));
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function activeIndicatorCodes(indicators: SchoolKPICatalog[]): Set<string> {
  return new Set(indicators.filter(i => i.status === 'active').map(i => i.code));
}

export interface BuildIndicatorRowsInput {
  indicators: SchoolKPICatalog[];
  tasks: KHCTTask[];
  workTasks: UnitWorkTask[];
  evidences: WorkEvidence[];
  groups: KPIGroup[];
  units: MeasurementUnit[];
}

function kpiCodesOf(task: KHCTTask): string[] {
  return (task.kpiCodes || '').split(';').map(c => c.trim()).filter(Boolean).filter(c => c !== '—');
}

function buildTaskRow(
  task: KHCTTask,
  target: string | undefined,
  workByTask: Record<string, UnitWorkTask[]>,
  evidenceByWork: Record<string, WorkEvidence[]>,
): IndicatorTaskRow {
  const jobs = workByTask[task.id] || [];
  const synth = synthesizeTask(task, jobs);
  const jobIds = new Set(jobs.map(j => j.id));
  const evidenceNames = Object.values(evidenceByWork)
    .flatMap(list => list.filter(ev => ev.unitWorkPlanId && jobIds.has(ev.unitWorkPlanId)))
    .map(ev => ev.fileName || ev.id);

  const pct = parsePct(synth.result) ?? parsePct(task.taskResult || '');
  const pt = parseTarget(target);
  let reach = task.taskStatus === 'done';
  if (!reach) {
    if (pt) {
      if (pt.isPct && pct != null) reach = cmpValue(pct, pt);
      else if (!pt.isPct && synth.totalSub > 0) reach = cmpValue(synth.doneSub, pt);
      else if (!pt.isPct) reach = synth.status === 'done';
    } else {
      reach = synth.status === 'done';
    }
  }
  const hasData = !!(task.taskStatus || task.taskResult || jobs.length > 0);
  return { task, jobs, synth, evidenceNames, hasData, reach };
}

export function buildIndicatorRows(input: BuildIndicatorRowsInput): IndicatorRow[] {
  const { indicators, tasks, workTasks, evidences, groups, units } = input;
  const activeCodes = activeIndicatorCodes(indicators);
  const active = indicators.filter(i => i.status === 'active');

  const unitById = new Map<string, string>();
  units.forEach(u => unitById.set(u.id, u.name));

  const evidenceByWork: Record<string, WorkEvidence[]> = {};
  evidences.forEach(ev => {
    if (ev.unitWorkPlanId) (evidenceByWork[ev.unitWorkPlanId] ||= []).push(ev);
  });

  const workByTask: Record<string, UnitWorkTask[]> = {};
  workTasks.forEach(w => {
    (workByTask[w.khctTaskId] ||= []).push(w);
  });

  const groupById = new Map<string, string>();
  groups.forEach(g => groupById.set(g.id, g.name));

  const scopedTasks = tasks.filter(t => kpiCodesOf(t).some(c => activeCodes.has(c)));

  return active.map(ind => {
    const unitName = unitById.get(ind.unitId) || '';
    const indicatorTasks = scopedTasks
      .filter(t => kpiCodesOf(t).includes(ind.code))
      .map(t => buildTaskRow(t, ind.target, workByTask, evidenceByWork));
    const reported = indicatorTasks.filter(r => r.hasData).length;
    const fail = indicatorTasks.filter(r => r.hasData && !r.reach).length;
    const unreported = indicatorTasks.length - reported;
    const doneOk = indicatorTasks.filter(r => r.reach).length;

    let statusKey: IndicatorStatusKey;
    if (indicatorTasks.length === 0) statusKey = 'no_data';
    else if (fail > 0) statusKey = 'fail';
    else if (reported === 0) statusKey = 'updating';
    else if (unreported > 0) statusKey = 'partial';
    else statusKey = 'ok';

    let gapText = '';
    if (statusKey === 'fail') {
      const pt = parseTarget(ind.target);
      if (pt && !pt.isPct) {
        const gap = pt.value - doneOk;
        if (gap > 0) gapText = `Thiếu ${gap} nhiệm vụ`;
      }
    }

    const meta = statusMeta[statusKey];
    return {
      indicator: ind,
      groupId: ind.categoryId,
      groupName: groupById.get(ind.categoryId) || ind.categoryId,
      tasks: indicatorTasks,
      reported,
      unreported,
      fail,
      doneOk,
      statusKey,
      statusLabel: meta.label,
      statusCls: meta.cls,
      unitName,
      gapText,
    };
  });
}