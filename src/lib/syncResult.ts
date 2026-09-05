export function buildSyncedResult(raw: string | undefined, sourceName: string, records: number): { text: string; progress: number } {
  const chiTieu = (raw || '').trim();
  if (chiTieu.includes('%')) {
    const pct = Math.floor(Math.random() * 40) + 60;
    return { text: `${pct}%`, progress: pct };
  }
  const m = chiTieu.match(/^(\d+)\s*(.*)$/);
  if (m) {
    const target = parseInt(m[1], 10);
    const unit = m[2].trim();
    const value = Math.max(1, Math.round(target * (0.4 + Math.random() * 0.5)));
    return { text: unit ? `${value} ${unit}` : `${value}`, progress: 70 };
  }
  return { text: `Đồng bộ ${records} bản ghi từ ${sourceName}`, progress: 70 };
}