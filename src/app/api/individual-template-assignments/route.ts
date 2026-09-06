import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';
import type { IndividualTemplateAssignment } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const academicYearId = searchParams.get('academicYearId');
  let items = readDb<IndividualTemplateAssignment>('individual-template-assignments');
  if (userId) items = items.filter(i => i.userId === userId);
  if (academicYearId) items = items.filter(i => i.academicYearId === academicYearId);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const academicYearId = typeof body.academicYearId === 'string' ? body.academicYearId : '';
  const kpiTemplateId = typeof body.kpiTemplateId === 'string' ? body.kpiTemplateId : '';
  if (!userId || !academicYearId) {
    return NextResponse.json({ error: 'Thiếu người dùng hoặc năm học' }, { status: 400 });
  }
  if (!kpiTemplateId) {
    return NextResponse.json({ error: 'Chưa chọn Bộ KPI mẫu' }, { status: 400 });
  }
  const items = readDb<IndividualTemplateAssignment>('individual-template-assignments');
  const existing = items.find(i => i.userId === userId && i.academicYearId === academicYearId);
  if (existing) {
    return NextResponse.json({ error: 'Người dùng này đã được gán Bộ KPI mẫu cho năm học này' }, { status: 409 });
  }
  const now = new Date().toISOString();
  const newItem: IndividualTemplateAssignment = {
    id: `ita${generateId()}`,
    userId,
    academicYearId,
    kpiTemplateId,
    status: body.status === 'inactive' ? 'inactive' : 'active',
    assignedAt: now,
    updatedAt: now,
  };
  items.push(newItem);
  writeDb('individual-template-assignments', items);
  return NextResponse.json(newItem, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const academicYearId = typeof body.academicYearId === 'string' ? body.academicYearId : '';
  const kpiTemplateId = typeof body.kpiTemplateId === 'string' ? body.kpiTemplateId : '';
  if (!userId || !academicYearId || !kpiTemplateId) {
    return NextResponse.json({ error: 'Thiếu userId, academicYearId hoặc kpiTemplateId' }, { status: 400 });
  }
  const items = readDb<IndividualTemplateAssignment>('individual-template-assignments');
  const index = items.findIndex(i => i.userId === userId && i.academicYearId === academicYearId);
  if (index === -1) return NextResponse.json({ error: 'Chưa có bản ghi gán cho người dùng này' }, { status: 404 });
  items[index] = {
    ...items[index],
    kpiTemplateId,
    status: body.status === 'inactive' ? 'inactive' : 'active',
    updatedAt: new Date().toISOString(),
  };
  writeDb('individual-template-assignments', items);
  return NextResponse.json(items[index]);
}