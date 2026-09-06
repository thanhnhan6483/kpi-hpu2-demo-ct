import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';
import type { UnitWorkTask } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const khctTaskId = searchParams.get('khctTaskId');
  const unitId = searchParams.get('unitId');
  const primaryUserId = searchParams.get('primaryUserId');
  let items = readDb<UnitWorkTask>('unit-work-plans');
  if (khctTaskId) items = items.filter(i => i.khctTaskId === khctTaskId);
  if (unitId) items = items.filter(i => i.unitId === unitId);
  if (primaryUserId) items = items.filter(i => i.primaryUserId === primaryUserId);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.khctTaskId || !body.title || !body.primaryUserId) {
    return NextResponse.json({ error: 'Thiếu khctTaskId, title hoặc primaryUserId' }, { status: 400 });
  }
  const items = readDb<UnitWorkTask>('unit-work-plans');
  const now = new Date().toISOString();
  const newItem: UnitWorkTask = {
    id: `uwp${generateId()}`,
    khctTaskId: body.khctTaskId,
    taskName: body.taskName || '',
    unitId: body.unitId || '',
    unitName: body.unitName || '',
    title: body.title,
    primaryUserId: body.primaryUserId,
    primaryUserName: body.primaryUserName || '',
    templateId: typeof body.templateId === 'string' ? body.templateId : undefined,
    templateItemId: typeof body.templateItemId === 'string' ? body.templateItemId : undefined,
    criterionCode: typeof body.criterionCode === 'string' ? body.criterionCode : undefined,
    month: typeof body.month === 'string' ? body.month : undefined,
    chiTieu: body.chiTieu || '',
    result: body.result || '',
    dueDate: body.dueDate || '',
    note: body.note || '',
    status: 'assigned',
    createdAt: now,
    updatedAt: now,
  };
  items.push(newItem);
  writeDb('unit-work-plans', items);
  return NextResponse.json(newItem, { status: 201 });
}
