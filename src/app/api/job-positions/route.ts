import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';
import type { JobPosition } from '@/types';

export async function GET() {
  return NextResponse.json(readDb<JobPosition>('job-positions'));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!name || !code) {
    return NextResponse.json({ error: 'Tên vị trí và mã không được để trống' }, { status: 400 });
  }
  const items = readDb<JobPosition>('job-positions');
  if (items.some(i => i.code === code)) {
    return NextResponse.json({ error: `Mã "${code}" đã tồn tại` }, { status: 409 });
  }
  const newItem: JobPosition = {
    id: `jp${generateId()}`,
    name,
    code,
    description: body.description || '',
    kpiGroupId: body.kpiGroupId || '',
    kpiTemplateId: typeof body.kpiTemplateId === 'string' ? body.kpiTemplateId : '',
    approvalLevel: body.approvalLevel || '',
    status: body.status === 'inactive' ? 'inactive' : 'active',
  };
  items.push(newItem);
  writeDb('job-positions', items);
  return NextResponse.json(newItem, { status: 201 });
}
