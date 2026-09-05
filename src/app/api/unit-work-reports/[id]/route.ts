import { NextRequest, NextResponse } from 'next/server';
import { readDb, remove } from '@/lib/db';
import type { UnitWorkReport } from '@/types';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = readDb<UnitWorkReport>('unit-work-reports');
  const report = items.find(item => item.id === id);
  if (!report) return NextResponse.json({ error: 'Không tìm thấy báo cáo' }, { status: 404 });
  return NextResponse.json(report);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const removed = remove<UnitWorkReport>('unit-work-reports', id);
  if (!removed) return NextResponse.json({ error: 'Không tìm thấy báo cáo' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
