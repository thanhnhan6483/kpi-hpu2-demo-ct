import { readDb, writeDb, generateId } from '@/lib/db';
import { buildSyncedResult } from '@/lib/syncResult';
import type { KHCTTask, UnitWorkTask } from '@/types';

interface SoftwareSource { id: string; name: string; description?: string; status?: string; }

export interface KpiCriterionSlot {
  templateId: string;
  templateItemId: string;
  criterionCode: string;
}

export interface SyncUserRef {
  id: string;
  fullName: string;
  unitId: string;
  unitName: string;
}

export interface SyncMonthResult {
  createdAtCount: number;
  refreshedCount: number;
  skippedCount: number;
  khctTotal: number;
  softwareName: string;
}

const FALLBACK_SOURCE = 'Phần mềm ngoài';

const statusFromProgress = (p: number): UnitWorkTask['status'] =>
  p >= 100 ? 'done' : p >= 70 ? 'in_progress' : 'assigned';

const randomRecords = () => Math.floor(Math.random() * 80) + 20;

export function khctTasksForUnitMonth(unitName: string, month: string): KHCTTask[] {
  const all = readDb<KHCTTask>('khct-catalog');
  const name = (unitName || '').trim();
  return all.filter(t => t.status === 'active' && t.month === month && (t.responsibleUnit || '').trim() === name);
}

export function criterionFor(criteria: KpiCriterionSlot[], index: number): KpiCriterionSlot | undefined {
  if (!criteria || criteria.length === 0) return undefined;
  return criteria[index % criteria.length];
}

export function syncMonthFromSources(info: {
  user: SyncUserRef;
  month: string;
  criteria: KpiCriterionSlot[];
}): SyncMonthResult {
  const { user, month, criteria } = info;
  const now = new Date().toISOString();
  const tasks = readDb<UnitWorkTask>('unit-work-plans');
  const sources = readDb<SoftwareSource>('software-catalog');
  const sourceOf = (id?: string) => sources.find(s => s.id === id) || sources[0];

  let refreshedCount = 0;
  for (const t of tasks) {
    if (t.primaryUserId !== user.id || t.month !== month) continue;
    if (t.resultSource !== 'sync') continue;
    const source = sourceOf(t.syncInfo?.sourceId);
    const sourceName = source?.name || FALLBACK_SOURCE;
    const synced = buildSyncedResult(t.chiTieu, sourceName, randomRecords());
    t.result = synced.text;
    t.progress = synced.progress;
    t.status = statusFromProgress(synced.progress);
    t.syncInfo = { sourceId: source?.id || 'sw001', sourceName, syncedAt: now };
    t.updatedAt = now;
    refreshedCount++;
  }

  const khctTasks = khctTasksForUnitMonth(user.unitName, month);
  let createdAtCount = 0;
  khctTasks.forEach((khct, i) => {
    const dup = tasks.some(t => t.khctTaskId === khct.id && t.primaryUserId === user.id);
    if (dup) return;
    const criterion = criterionFor(criteria, i);
    const source = khct.softwareId ? sourceOf(khct.softwareId) : (sources.length > 0 ? sources[i % sources.length] : undefined);
    const sourceName = source?.name || FALLBACK_SOURCE;
    const synced = buildSyncedResult(khct.chiTieu, sourceName, randomRecords());
    tasks.push({
      id: `uwp${generateId()}`,
      khctTaskId: khct.id,
      taskName: khct.taskName,
      unitId: user.unitId,
      unitName: user.unitName,
      title: khct.taskName,
      primaryUserId: user.id,
      primaryUserName: user.fullName,
      templateId: criterion?.templateId,
      templateItemId: criterion?.templateItemId,
      criterionCode: criterion?.criterionCode,
      month,
      chiTieu: khct.chiTieu,
      result: synced.text,
      resultSource: 'sync',
      syncInfo: { sourceId: source?.id || 'sw001', sourceName, syncedAt: now },
      progress: synced.progress,
      dueDate: khct.deadline || month,
      note: khct.deliverable || '',
      status: statusFromProgress(synced.progress),
      createdAt: now,
      updatedAt: now,
    });
    createdAtCount++;
  });
  writeDb('unit-work-plans', tasks);

  return {
    createdAtCount,
    refreshedCount,
    skippedCount: Math.max(0, khctTasks.length - createdAtCount),
    khctTotal: khctTasks.length,
    softwareName: sourceOf('sw001')?.name || FALLBACK_SOURCE,
  };
}