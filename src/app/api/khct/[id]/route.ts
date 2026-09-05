import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import type { KHCTTask } from '@/types';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const items = readDb<KHCTTask>('khct-catalog');
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const allowed = ['taskResult', 'taskStatus', 'taskReviewNote', 'resultSource', 'syncInfo'];
  const patch: Partial<KHCTTask> = {};
  allowed.forEach(k => {
    if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  });
  items[index] = { ...items[index], ...patch };
  writeDb('khct-catalog', items);
  return NextResponse.json(items[index]);
}