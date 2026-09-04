import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb, generateId } from '@/lib/db';

interface Software { id: string; name: string; description: string; status: string; }

export async function GET() { return NextResponse.json(readDb<Software>('software-catalog')); }

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items = readDb<Software>('software-catalog');
  const newItem = { id: `sw${generateId()}`, name: body.name, description: body.description || '', status: 'active' };
  items.push(newItem); writeDb('software-catalog', items);
  return NextResponse.json(newItem, { status: 201 });
}
