import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db';
import type { LaborProductivity } from '@/types';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = readDb<LaborProductivity>('labor-productivity');
  const item = items.find(i => i.id === id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const items = readDb<LaborProductivity>('labor-productivity');
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const allowed = [
    'criterionRows', 'totalScore', 'grade', 'status',
    'selfNote', 'managerNote', 'managerGrade', 'managerScore',
    'councilNote', 'councilGrade', 'councilScore', 'councilReviewedAt', 'councilReviewedBy',
    'submittedAt', 'reviewedAt', 'lockedAt',
  ];
  const patch: Partial<LaborProductivity> = {};
  allowed.forEach(k => {
    if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  });
  items[index] = { ...items[index], ...patch, updatedAt: new Date().toISOString() };
  writeDb('labor-productivity', items);
  return NextResponse.json(items[index]);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const items = readDb<LaborProductivity>('labor-productivity');
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length === items.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  writeDb('labor-productivity', filtered);
  return NextResponse.json({ success: true });
}