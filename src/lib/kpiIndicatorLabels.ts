import indicatorsData from '@/data/indicators.json';
import unitKpisData from '@/data/unit-kpis.json';
import { indicatorMeta } from '@/lib/laborProductivity';

export interface IndicatorLabel {
  code: string;
  name: string;
  unit?: string;
}

const unitIndicatorMeta: Record<string, IndicatorLabel> = {};
(unitKpisData as { kpis?: { id: string; name: string; unit?: string }[] }[]).forEach(u => {
  (u.kpis || []).forEach(k => {
    if (k.id && !unitIndicatorMeta[k.id]) {
      unitIndicatorMeta[k.id] = { code: k.id, name: k.name, unit: k.unit };
    }
  });
});

export function indicatorLabel(indicatorId: string): IndicatorLabel | null {
  const school = (indicatorsData as { id: string; code: string; name: string; unit: string }[]).find(
    i => i.id === indicatorId || i.code === indicatorId
  );
  if (school) return { code: school.code, name: school.name, unit: school.unit };
  const ind = indicatorMeta[indicatorId];
  if (ind) return { code: indicatorId, name: ind.name, unit: ind.unit };
  return unitIndicatorMeta[indicatorId] || null;
}