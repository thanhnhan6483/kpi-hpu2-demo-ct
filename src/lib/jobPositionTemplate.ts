import positionsData from '@/data/positions.json';
import jobPositionsData from '@/data/job-positions.json';

const positionCodeById: Record<string, string> = {};
(positionsData as { id: string; code: string; name: string }[]).forEach(p => {
  positionCodeById[p.id] = p.code;
});

const jobPositionByCode: Record<string, { name: string; kpiTemplateId?: string }> = {};
(jobPositionsData as { code: string; name: string; kpiTemplateId?: string }[]).forEach(jp => {
  if (!jobPositionByCode[jp.code]) {
    jobPositionByCode[jp.code] = { name: jp.name, kpiTemplateId: jp.kpiTemplateId };
  }
});

const positionNameMap: Record<string, string> = {};
(positionsData as { id: string; name: string }[]).forEach(p => {
  positionNameMap[p.id] = p.name;
});

export function positionName(positionId?: string): string {
  if (!positionId) return '';
  return positionNameMap[positionId] || positionId;
}

export function suggestedTemplateIdForPosition(positionId?: string, unitType?: string): string {
  if (positionId) {
    const jp = jobPositionByCode[positionCodeById[positionId]];
    if (jp?.kpiTemplateId) return jp.kpiTemplateId;
  }
  return unitType === 'faculty' ? 'tpl002' : 'tpl007';
}