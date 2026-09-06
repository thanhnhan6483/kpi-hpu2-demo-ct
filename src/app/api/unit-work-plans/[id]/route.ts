import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import type { UnitWorkTask } from '@/types';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const items = readDb<UnitWorkTask>('unit-work-plans');
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const allowed = ['title', 'primaryUserId', 'primaryUserName', 'templateId', 'templateItemId', 'criterionCode', 'month', 'chiTieu', 'result', 'resultSource', 'reportNote', 'progress', 'assessment', 'reviewNote', 'dueDate', 'note', 'status'];
  const patch: Partial<UnitWorkTask> = {};
  allowed.forEach(k => {
    if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  });
  items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
  writeDb('unit-work-plans', items);
  return NextResponse.json(items[index]);
}
