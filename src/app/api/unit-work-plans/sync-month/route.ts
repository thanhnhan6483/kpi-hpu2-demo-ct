import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';
import { syncMonthFromSources } from '@/lib/khctSync';
import { indicatorMeta } from '@/lib/laborProductivity';
import type { AcademicYear, IndividualTemplateAssignment, SyncLog, User } from '@/types';

interface UnitData { id: string; name: string; }

interface TemplateItemBrief { id: string; templateId: string; indicatorId: string; }

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const month = typeof body.month === 'string' ? body.month : '';
  if (!userId || !month) {
    return NextResponse.json({ error: 'Thiếu userId hoặc month' }, { status: 400 });
  }

  const users = readDb<User>('users');
  const user = users.find(u => u.id === userId && u.status === 'active');
  if (!user) return NextResponse.json({ error: 'Không tìm thấy người dùng' }, { status: 404 });

  const units = readDb<UnitData>('units');
  const unit = units.find(x => x.id === user.unitId);
  const unitName = unit?.name || '';

  let criteria: { templateId: string; templateItemId: string; criterionCode: string }[] = [];
  const years = readDb<AcademicYear>('academic-years');
  const activeYear = years.find(y => y.status === 'active');
  if (activeYear) {
    const asgs = readDb<IndividualTemplateAssignment>('individual-template-assignments');
    const asg = asgs.find(a => a.userId === userId && a.academicYearId === activeYear.id && a.status === 'active');
    if (asg) {
      const items = readDb<TemplateItemBrief>('kpi-template-items');
      criteria = items
        .filter(i => i.templateId === asg.kpiTemplateId && indicatorMeta[i.indicatorId])
        .map(i => ({ templateId: i.templateId, templateItemId: i.id, criterionCode: i.indicatorId }));
    }
  }

  const result = syncMonthFromSources({ user: { id: user.id, fullName: user.fullName, unitId: user.unitId, unitName }, month, criteria });

  const now = new Date().toISOString();
  const logs = readDb<SyncLog>('sync-logs');
  logs.push({
    id: `sl${generateId()}`,
    apiConfigId: 'sw001',
    systemType: 'other',
    syncType: 'manual',
    status: 'success',
    startedAt: now,
    completedAt: now,
    recordsTotal: result.khctTotal + result.refreshedCount,
    recordsSuccess: result.createdAtCount + result.refreshedCount,
    recordsFailed: 0,
    errors: [],
    createdBy: userId,
  });
  writeDb('sync-logs', logs);

  return NextResponse.json({ synced: result, user: { id: user.id, fullName: user.fullName, unitName } });
}