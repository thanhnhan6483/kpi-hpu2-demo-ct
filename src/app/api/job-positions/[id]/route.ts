import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import type { JobPosition } from '@/types';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = readDb<JobPosition>('job-positions');
  const item = items.find(i => i.id === id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const items = readDb<JobPosition>('job-positions');
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const name = typeof body.name === 'string' ? body.name.trim() : items[index].name;
  const code = typeof body.code === 'string' ? body.code.trim() : items[index].code;
  if (!name || !code) {
    return NextResponse.json({ error: 'Tên vị trí và mã không được để trống' }, { status: 400 });
  }
  if (items.some(i => i.id !== id && i.code === code)) {
    return NextResponse.json({ error: `Mã "${code}" đã tồn tại` }, { status: 409 });
  }
  const updated: JobPosition = {
    ...items[index],
    name,
    code,
    description: typeof body.description === 'string' ? body.description : items[index].description,
    kpiGroupId: typeof body.kpiGroupId === 'string' ? body.kpiGroupId : items[index].kpiGroupId,
    kpiTemplateId: typeof body.kpiTemplateId === 'string' ? body.kpiTemplateId : items[index].kpiTemplateId,
    approvalLevel: typeof body.approvalLevel === 'string' ? body.approvalLevel : items[index].approvalLevel,
    status: body.status === 'active' || body.status === 'inactive' ? body.status : items[index].status,
  };
  items[index] = updated;
  writeDb('job-positions', items);
  return NextResponse.json(items[index]);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = readDb<JobPosition>('job-positions');
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  writeDb('job-positions', filtered);
  return NextResponse.json({ success: true });
}
