import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';
import type { LaborProductivity } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const unitId = searchParams.get('unitId');
  const month = searchParams.get('month');
  const academicYearId = searchParams.get('academicYearId');
  let items = readDb<LaborProductivity>('labor-productivity');
  if (userId) items = items.filter(i => i.userId === userId);
  if (unitId) items = items.filter(i => i.unitId === unitId);
  if (month) items = items.filter(i => i.month === month);
  if (academicYearId) items = items.filter(i => i.academicYearId === academicYearId);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const month = typeof body.month === 'string' ? body.month : '';
  const academicYearId = typeof body.academicYearId === 'string' ? body.academicYearId : '';
  if (!userId || !month || !academicYearId) {
    return NextResponse.json({ error: 'Thiếu userId, month hoặc academicYearId' }, { status: 400 });
  }
  const items = readDb<LaborProductivity>('labor-productivity');
  const existingIndex = items.findIndex(i => i.userId === userId && i.month === month && i.academicYearId === academicYearId);
  const now = new Date().toISOString();
  if (existingIndex >= 0) {
    items[existingIndex] = { ...items[existingIndex], ...body, updatedAt: now };
    writeDb('labor-productivity', items);
    return NextResponse.json(items[existingIndex]);
  }
  const newItem: LaborProductivity = {
    id: `lpr${generateId()}`,
    userId,
    userName: body.userName || '',
    unitId: body.unitId || '',
    unitName: body.unitName || '',
    academicYearId,
    month,
    templateId: body.templateId || '',
    templateName: body.templateName || '',
    status: body.status === 'self_reviewed' || body.status === 'manager_reviewed' || body.status === 'council_reviewed' || body.status === 'locked' ? body.status : 'draft',
    criterionRows: Array.isArray(body.criterionRows) ? body.criterionRows : [],
    totalScore: typeof body.totalScore === 'number' ? body.totalScore : 0,
    grade: body.grade === 'A' || body.grade === 'B' || body.grade === 'C' ? body.grade : 'C',
    selfNote: body.selfNote || '',
    managerNote: body.managerNote || '',
    managerGrade: body.managerGrade,
    managerScore: typeof body.managerScore === 'number' ? body.managerScore : undefined,
    councilNote: body.councilNote || '',
    councilGrade: body.councilGrade,
    councilScore: typeof body.councilScore === 'number' ? body.councilScore : undefined,
    councilReviewedAt: body.councilReviewedAt || '',
    councilReviewedBy: body.councilReviewedBy || '',
    submittedAt: body.submittedAt || '',
    reviewedAt: body.reviewedAt || '',
    lockedAt: body.lockedAt || '',
    createdAt: now,
    updatedAt: now,
  };
  items.push(newItem);
  writeDb('labor-productivity', items);
  return NextResponse.json(newItem, { status: 201 });
}