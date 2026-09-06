import type { UnitWorkTask } from '@/types';
import individualKpisData from '@/data/individual-kpis.json';

export type ProductivityGrade = 'A' | 'B' | 'C';

export interface TemplateItemDef {
  templateItemId: string;
  criterionCode: string;
  criterionName: string;
  target: string;
  unit: string;
  weight: number;
}

export interface CriterionAggRow extends TemplateItemDef {
  completedTasks: number;
  totalTasks: number;
  resultPct: number;
  hasEvidence: boolean;
  score: number;
}

export interface IndicatorMeta {
  name: string;
  target: number;
  unit: string;
}

export const indicatorMeta: Record<string, IndicatorMeta> = {};
(individualKpisData as { kpis: { id: string; name: string; target: number; unit: string }[] }[]).forEach(p => {
  (p.kpis || []).forEach(k => {
    if (!indicatorMeta[k.id]) indicatorMeta[k.id] = { name: k.name, target: k.target, unit: k.unit };
  });
});

export const targetTextOf = (code: string) => {
  const m = indicatorMeta[code];
  return m ? `${m.target}${m.unit}` : '';
};

export const GRADE_META: Record<ProductivityGrade, { label: string; cls: string; min: number }> = {
  A: { label: 'A - Xuất sắc', cls: 'badge-success', min: 90 },
  B: { label: 'B - Hoàn thành tốt', cls: 'badge-warning', min: 70 },
  C: { label: 'C - Cần cải thiện', cls: 'badge-danger', min: 0 },
};

export const gradeForScore = (score: number): ProductivityGrade => {
  if (score >= GRADE_META.A.min) return 'A';
  if (score >= GRADE_META.B.min) return 'B';
  return 'C';
};

export const effectiveProgress = (task: UnitWorkTask): number => {
  if (typeof task.progress === 'number' && !isNaN(task.progress)) {
    return Math.min(100, Math.max(0, task.progress));
  }
  if (task.status === 'done') return 100;
  if (task.status === 'in_progress') return 70;
  return 10;
};

export const hasEvidence = (task: UnitWorkTask): boolean =>
  !!(task.result || task.reportNote);

export function aggregateByCriterion(tasks: UnitWorkTask[], defs: TemplateItemDef[], month: string): CriterionAggRow[] {
  const group = new Map<string, UnitWorkTask[]>();
  tasks.forEach(t => {
    if (!t.month || !t.templateItemId) return;
    if (t.month !== month || !t.templateId) return;
    const list = group.get(t.templateItemId) || [];
    list.push(t);
    group.set(t.templateItemId, list);
  });
  return defs.map(def => {
    const list = group.get(def.templateItemId) || [];
    if (list.length === 0) {
      return { ...def, completedTasks: 0, totalTasks: 0, resultPct: 0, hasEvidence: false, score: 0 };
    }
    const totalTasks = list.length;
    const completedTasks = list.filter(t => t.status === 'done' || effectiveProgress(t) >= 100).length;
    const avgPct = list.reduce((s, t) => s + effectiveProgress(t), 0) / totalTasks;
    const evidence = list.some(hasEvidence);
    const score = Math.min(Math.round(avgPct * 10) / 10, 100) * (evidence ? 1 : 0.5);
    return {
      ...def,
      completedTasks,
      totalTasks,
      resultPct: Math.round(avgPct * 10) / 10,
      hasEvidence: evidence,
      score: Math.round(score * 10) / 10,
    };
  });
}

export function computeMonthlyTotal(rows: CriterionAggRow[]): number {
  const active = rows.filter(r => r.totalTasks > 0);
  const w = active.reduce((s, r) => s + r.weight, 0);
  if (w === 0) return 0;
  const score = active.reduce((s, r) => s + r.score * r.weight, 0) / w;
  return Math.round(score * 10) / 10;
}

export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getFullYear()}`;
};

export function yearMonths(startDate?: string) {
  if (!startDate) return [currentMonthKey()];
  const [y, m] = startDate.split('-').map(Number);
  const res: string[] = [];
  for (let i = 0; i < 12; i++) {
    const mm = ((m - 1 + i) % 12) + 1;
    const yy = y + Math.floor((m - 1 + i) / 12);
    res.push(`${mm}/${yy}`);
  }
  return res;
}

export const PRODUCTIVITY_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Nháp', cls: 'badge-info' },
  self_reviewed: { label: 'Đã tự đánh giá', cls: 'badge-warning' },
  manager_reviewed: { label: 'Đã kiểm tra', cls: 'badge-info' },
  council_reviewed: { label: 'Đã thẩm định (Hội đồng)', cls: 'badge-info' },
  locked: { label: 'Đã chốt', cls: 'badge-success' },
};

export const finalScoreOf = (r: { councilScore?: number; managerScore?: number; totalScore: number }) =>
  r.councilScore ?? r.managerScore ?? r.totalScore;

export const finalGradeOf = (r: { councilGrade?: 'A' | 'B' | 'C' | ''; managerGrade?: 'A' | 'B' | 'C' | ''; grade: ProductivityGrade }): ProductivityGrade =>
  r.councilGrade || r.managerGrade || r.grade;