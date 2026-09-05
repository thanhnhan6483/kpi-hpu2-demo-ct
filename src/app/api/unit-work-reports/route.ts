import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';
import type { UnitWorkReport } from '@/types';

export async function GET() {
  const items = readDb<UnitWorkReport>('unit-work-reports');
  const sorted = items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(sorted);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { month, unitFilterName, unitIds, rows, summary } = body;
  if (!month || !rows || !summary) {
    return NextResponse.json({ error: 'Thiếu dữ liệu báo cáo (month, rows, summary)' }, { status: 400 });
  }
  const report: UnitWorkReport = {
    id: `uwr_${generateId()}`,
    month,
    unitFilterName: unitFilterName || '',
    unitIds: Array.isArray(unitIds) ? unitIds : [],
    createdAt: new Date().toISOString(),
    rows,
    summary,
  };
  const items = readDb<UnitWorkReport>('unit-work-reports');
  items.push(report);
  writeDb('unit-work-reports', items);
  return NextResponse.json(report, { status: 201 });
}
