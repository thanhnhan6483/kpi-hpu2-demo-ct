import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';
import type { KHCTTask } from '@/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month');
  const field = searchParams.get('field');
  let items = readDb<KHCTTask>('khct-catalog');
  if (month) items = items.filter(i => i.month === month);
  if (field) items = items.filter(i => i.field === field);
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items = readDb<KHCTTask>('khct-catalog');
  const newItem: KHCTTask = {
    id: `khct_${generateId()}`,
    month: body.month || '',
    field: body.field || '',
    order: body.order || items.length + 1,
    taskName: body.taskName || '',
    responsibleUnit: body.responsibleUnit || '',
    coordinatingUnits: body.coordinatingUnits || '',
    kpiCodes: body.kpiCodes || '',
    deliverable: body.deliverable || '',
    chiTieu: body.chiTieu || '',
    deadline: body.deadline || '',
    softwareId: body.softwareId || '',
    status: 'active',
  };
  items.push(newItem);
  writeDb('khct-catalog', items);
  return NextResponse.json(newItem, { status: 201 });
}
