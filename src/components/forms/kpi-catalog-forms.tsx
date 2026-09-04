
'use client';

import { useState } from 'react';
import type { SchoolKPICatalog, KPIGroupCatalog, UnitKPICatalog, IndividualKPICatalog, KHCTTask } from '@/types';

export const KHCT_MONTHS = [
  '8/2026', '9/2026', '10/2026', '11/2026', '12/2026',
  '1/2027', '2/2027', '3/2027', '4/2027', '5/2027', '6/2027', '7/2027',
];

export function KhctForm({ item, fields, orgUnits, schoolCatalog, kpiGroups, softwareOptions, onSubmit, onCancel }: {
  item: KHCTTask | null;
  fields: string[];
  orgUnits: { id: string; name: string; parentId: string | null }[];
  schoolCatalog: SchoolKPICatalog[];
  kpiGroups: { id: string; name: string }[];
  softwareOptions: { id: string; name: string }[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const inputCSS = 'w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary';

  const [month, setMonth] = useState(item?.month || KHCT_MONTHS[0]);
  const [fieldValue, setFieldValue] = useState(item?.field || fields[0] || '');
  const [taskName, setTaskName] = useState(item?.taskName || '');
  const [responsibleUnit, setResponsibleUnit] = useState(item?.responsibleUnit || '');
  const [coordinatingUnits, setCoordinatingUnits] = useState(item?.coordinatingUnits || '');
  const [selectedKpiCodes, setSelectedKpiCodes] = useState<string[]>(item?.kpiCodes && item.kpiCodes !== '—' && item.kpiCodes.trim() ? item.kpiCodes.split(';').map(s => s.trim()).filter(Boolean) : []);
  const [kpiMode, setKpiMode] = useState<'phan-bo' | 'rieng'>(item?.kpiCodes && item.kpiCodes !== '—' && item.kpiCodes.trim() ? 'phan-bo' : 'rieng');
  const [deliverable, setDeliverable] = useState(item?.deliverable || '');
  const [chiTieu, setChiTieu] = useState(item?.chiTieu || '');
  const [deadline, setDeadline] = useState(item?.deadline || '');
  const [softwareId, setSoftwareId] = useState(item?.softwareId || '');

  const toggleKpiCode = (code: string) => {
    setSelectedKpiCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ month, field: fieldValue, taskName, responsibleUnit, coordinatingUnits, kpiCodes: kpiMode === 'rieng' ? '' : selectedKpiCodes.join('; '), deliverable, chiTieu, deadline, softwareId });
  };

  const leafUnits = orgUnits.filter(u => u.parentId !== null);

  return <form onSubmit={handle} className="space-y-4">
    <div className="grid grid-cols-2 gap-4">
      <div><label className="block text-sm font-medium mb-1">Tháng *</label>
        <select value={month} onChange={e => setMonth(e.target.value)} required className={inputCSS}>
          {KHCT_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select></div>
      <div><label className="block text-sm font-medium mb-1">Lĩnh vực công tác *</label>
        <input value={fieldValue} onChange={e => setFieldValue(e.target.value)} required list="khct-fields" className={inputCSS} />
        <datalist id="khct-fields">{fields.map(f => <option key={f} value={f} />)}</datalist></div>
    </div>
    <div><label className="block text-sm font-medium mb-1">Tên nhiệm vụ *</label>
      <textarea value={taskName} onChange={e => setTaskName(e.target.value)} required rows={3} className={inputCSS} /></div>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="block text-sm font-medium mb-1">Đơn vị chủ trì *</label>
        <select value={responsibleUnit} onChange={e => setResponsibleUnit(e.target.value)} required className={inputCSS}>
          <option value="">-- Chọn đơn vị --</option>
          {leafUnits.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select></div>
      <div><label className="block text-sm font-medium mb-1">Đơn vị phối hợp</label>
        <input value={coordinatingUnits} onChange={e => setCoordinatingUnits(e.target.value)} className={inputCSS} placeholder="Phòng Đào tạo; TT. Tin học" /></div>
    </div>
    <div><label className="block text-sm font-medium mb-1">Mã KPI liên quan</label>
      <div className="flex gap-2 mb-2">
        <button type="button" onClick={() => { setKpiMode('phan-bo'); setSelectedKpiCodes([]); }}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${kpiMode === 'phan-bo' ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
          Phân bổ
        </button>
        <button type="button" onClick={() => { setKpiMode('rieng'); setSelectedKpiCodes([]); }}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${kpiMode === 'rieng' ? 'bg-accent-yellow text-white' : 'bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/20'}`}>
          Riêng
        </button>
      </div>
      {kpiMode === 'phan-bo' ? (
        <div className="border border-border rounded-lg bg-white max-h-[200px] overflow-y-auto divide-y divide-border">
          {schoolCatalog.length === 0 && <p className="text-xs text-text-light p-3">Không có chỉ tiêu</p>}
          {kpiGroups.map(grp => {
            const items = schoolCatalog.filter(s => s.categoryId === grp.id);
            if (items.length === 0) return null;
            return (
              <div key={grp.id} className="p-2">
                <p className="text-[11px] font-semibold text-text-light uppercase tracking-wide mb-1.5">{grp.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map(s => {
                    const checked = selectedKpiCodes.includes(s.code);
                    return (
                      <button key={s.id} type="button" onClick={() => toggleKpiCode(s.code)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${checked ? 'bg-primary text-white font-medium' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                        <span className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${checked ? 'bg-white border-white' : 'border-primary/40'}`}>
                          {checked && <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-primary fill-current"><path d="M10 3L4.5 8.5 2 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span className="font-mono font-bold">{s.code}</span>
                        <span className="hidden sm:inline text-text-light">{s.name.length > 30 ? s.name.slice(0, 30) + '…' : s.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-3 bg-accent-yellow/5 border border-accent-yellow/20 rounded-lg text-center">
          <span className="text-sm text-accent-yellow font-medium">Nhiệm vụ riêng của đơn vị — không gắn KPI trường</span>
        </div>
      )}
      {kpiMode === 'phan-bo' && selectedKpiCodes.length > 0 && <p className="text-xs text-text-light mt-1">Đã chọn {selectedKpiCodes.length} chỉ tiêu: {selectedKpiCodes.join('; ')}</p>}
    </div>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="block text-sm font-medium mb-1">Chỉ tiêu đo lường</label>
        <input value={chiTieu} onChange={e => setChiTieu(e.target.value)} className={inputCSS} placeholder="VD: 100% | ≥80% | ≥20" /></div>
      <div><label className="block text-sm font-medium mb-1">Thời gian hoàn thành</label>
        <input value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCSS} placeholder="VD: 8/2026" /></div>
    </div>
    <div><label className="block text-sm font-medium mb-1">Sản phẩm / Kết quả</label>
      <textarea value={deliverable} onChange={e => setDeliverable(e.target.value)} rows={2} className={inputCSS} /></div>
    <div>
      <label className="block text-sm font-medium mb-1">Nguồn dữ liệu đồng bộ</label>
      <select value={softwareId} onChange={e => setSoftwareId(e.target.value)} className={inputCSS}>
        <option value="">-- Không chọn --</option>
        {softwareOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <p className="text-xs text-text-light mt-1">Chọn phần mềm đồng bộ dữ liệu cho nhiệm vụ, hoặc để trống nếu không đồng bộ.</p>
    </div>
    <div className="flex justify-end gap-2 pt-4 border-t">
      <button type="button" onClick={onCancel} className="btn-secondary">Hủy</button>
      <button type="submit" className="btn-primary">{item ? 'Cập nhật' : 'Thêm mới'}</button>
    </div>
  </form>;
}

const field = 'w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary';

export function SchoolCatalogForm({ item, groups, units, objectives, onSubmit, onCancel }: { item: SchoolKPICatalog | null; groups: KPIGroupCatalog[]; units: { id: string; name: string }[]; objectives: { id: string; name: string }[]; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(item?.name || '');
  const [code, setCode] = useState(item?.code || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || groups[0]?.id || '');
  const [strategicObjectiveId, setStrategicObjectiveId] = useState(item?.strategicObjectiveId || '');
  const [formula, setFormula] = useState(item?.formula || '');
  const [unitId, setUnitId] = useState(item?.unitId || 'mu001');
  const [direction, setDirection] = useState(item?.direction || 'higher_better');
  const [requiredEvidence, setRequiredEvidence] = useState(item?.requiredEvidence ?? true);
  const [maxScore, setMaxScore] = useState(item?.maxScore ?? 10);
  const [target, setTarget] = useState(item?.target || '');
  const [cycle, setCycle] = useState(item?.cycle || 'Năm học');

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, code, categoryId, strategicObjectiveId, formula, unitId, direction, requiredEvidence, maxScore: Number(maxScore), target, cycle });
  };

  return <form onSubmit={handle} className="space-y-4">
    <div><label className="block text-sm font-medium mb-1">Nội dung chỉ tiêu *</label><input value={name} onChange={e => setName(e.target.value)} required className={field} /></div>
    <div className="grid grid-cols-2 gap-4">
      <div><label className="block text-sm font-medium mb-1">Mã KPI *</label><input value={code} onChange={e => setCode(e.target.value)} required className={field} /></div>
      <div><label className="block text-sm font-medium mb-1">Nhóm *</label><select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={field}>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
    </div>
    <div><label className="block text-sm font-medium mb-1">Mục tiêu chiến lược</label>
      <select value={strategicObjectiveId} onChange={e => setStrategicObjectiveId(e.target.value)} className={field}>
        <option value="">-- Chọn mục tiêu chiến lược --</option>
        {objectives.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select></div>
    <div className="grid grid-cols-3 gap-4">
      <div><label className="block text-sm font-medium mb-1">Đơn vị đo</label><select value={unitId} onChange={e => setUnitId(e.target.value)} className={field}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      <div><label className="block text-sm font-medium mb-1">Chỉ tiêu năm học</label><input value={target} onChange={e => setTarget(e.target.value)} className={field} /></div>
      <div><label className="block text-sm font-medium mb-1">Chu kỳ</label><select value={cycle} onChange={e => setCycle(e.target.value)} className={field}><option>Năm học</option><option>Học kỳ</option></select></div>
    </div>
    <div><label className="block text-sm font-medium mb-1">Công thức / nguyên tắc đánh giá</label><input value={formula} onChange={e => setFormula(e.target.value)} className={field} /></div>
    <div className="grid grid-cols-3 gap-4">
      <div><label className="block text-sm font-medium mb-1">Hướng đánh giá</label><select value={direction} onChange={e => setDirection(e.target.value as 'higher_better' | 'lower_better')} className={field}><option value="higher_better">Cao hơn tốt hơn</option><option value="lower_better">Thấp hơn tốt hơn</option></select></div>
      <div><label className="block text-sm font-medium mb-1">Minh chứng</label><select value={requiredEvidence ? 'yes' : 'no'} onChange={e => setRequiredEvidence(e.target.value === 'yes')} className={field}><option value="yes">Có yêu cầu</option><option value="no">Không yêu cầu</option></select></div>
      <div><label className="block text-sm font-medium mb-1">Điểm tối đa</label><input type="number" value={maxScore} onChange={e => setMaxScore(Number(e.target.value))} className={field} /></div>
    </div>
    <div className="flex justify-end gap-2 pt-4 border-t"><button type="button" onClick={onCancel} className="btn-secondary">Hủy</button><button type="submit" className="btn-primary">{item ? 'Cập nhật' : 'Thêm mới'}</button></div>
  </form>;
}

export function UnitCatalogForm({ item, orgUnits, units, onSubmit, onCancel }: { item: UnitKPICatalog | null; orgUnits: { id: string; name: string }[]; units: { id: string; name: string }[]; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(item?.name || '');
  const [code, setCode] = useState(item?.code || '');
  const [orgUnitId, setOrgUnitId] = useState(item?.orgUnitId || orgUnits[0]?.id || '');
  const [unitId, setUnitId] = useState(item?.unitId || 'mu001');
  const [target, setTarget] = useState(item?.target || '');
  const [cycle, setCycle] = useState(item?.cycle || 'Năm học');
  const handle = (e: React.FormEvent) => { e.preventDefault(); onSubmit({ name, code, orgUnitId, unitId, target, cycle, linkedCatalogId: null }); };
  return <form onSubmit={handle} className="space-y-4">
    <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">Đơn vị *</label><select value={orgUnitId} onChange={e => setOrgUnitId(e.target.value)} required className={field}>{orgUnits.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Mã KPI</label><input value={code} onChange={e => setCode(e.target.value)} className={field} placeholder="VD: DV-PDT-04" /></div></div>
    <div><label className="block text-sm font-medium mb-1">KPI đơn vị *</label><input value={name} onChange={e => setName(e.target.value)} required className={field} /></div>
    <div className="grid grid-cols-3 gap-4"><div><label className="block text-sm font-medium mb-1">Đơn vị đo</label><select value={unitId} onChange={e => setUnitId(e.target.value)} className={field}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Chỉ tiêu năm học</label><input value={target} onChange={e => setTarget(e.target.value)} className={field} /></div><div><label className="block text-sm font-medium mb-1">Chu kỳ</label><select value={cycle} onChange={e => setCycle(e.target.value)} className={field}><option>Năm học</option><option>Học kỳ</option></select></div></div>
    <div className="flex justify-end gap-2 pt-4 border-t"><button type="button" onClick={onCancel} className="btn-secondary">Hủy</button><button type="submit" className="btn-primary">Thêm mới</button></div>
  </form>;
}

export function IndividualCatalogForm({ item, positionCodes, units, onSubmit, onCancel }: { item: IndividualKPICatalog | null; positionCodes: string[]; units: { id: string; name: string }[]; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(item?.name || '');
  const [code, setCode] = useState(item?.code || '');
  const [positionCode, setPositionCode] = useState(item?.positionCode || positionCodes[0] || 'CV');
  const [unitId, setUnitId] = useState(item?.unitId || 'mu001');
  const [target, setTarget] = useState(item?.target || '');
  const [cycle, setCycle] = useState(item?.cycle || 'Năm học');
  const labels: Record<string,string> = { QL: 'Cán bộ quản lý', GV: 'Giảng viên', CV: 'Chuyên viên' };
  const handle = (e: React.FormEvent) => { e.preventDefault(); onSubmit({ name, code, positionCode, unitId, target, cycle }); };
  return <form onSubmit={handle} className="space-y-4">
    <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium mb-1">KPI cá nhân *</label><input value={name} onChange={e => setName(e.target.value)} required className={field} /></div><div><label className="block text-sm font-medium mb-1">Mã *</label><input value={code} onChange={e => setCode(e.target.value)} required className={field} /></div></div>
    <div className="grid grid-cols-3 gap-4"><div><label className="block text-sm font-medium mb-1">Nhóm đối tượng</label><select value={positionCode} onChange={e => setPositionCode(e.target.value)} className={field}>{positionCodes.map(pc => <option key={pc} value={pc}>{labels[pc] || pc}</option>)}</select></div><div><label className="block text-sm font-medium mb-1">Chỉ tiêu</label><input value={target} onChange={e => setTarget(e.target.value)} className={field} /></div><div><label className="block text-sm font-medium mb-1">Chu kỳ</label><select value={cycle} onChange={e => setCycle(e.target.value)} className={field}><option>Năm học</option><option>Học kỳ</option><option>Tháng/Học kỳ</option></select></div></div>
    <div><label className="block text-sm font-medium mb-1">Đơn vị đo</label><select value={unitId} onChange={e => setUnitId(e.target.value)} className={field}>{units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
    <div className="flex justify-end gap-2 pt-4 border-t"><button type="button" onClick={onCancel} className="btn-secondary">Hủy</button><button type="submit" className="btn-primary">{item ? 'Cập nhật' : 'Thêm mới'}</button></div>
  </form>;
}

export function GroupCatalogForm({ item, onSubmit, onCancel }: { item: KPIGroupCatalog | null; onSubmit: (data: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(item?.name || '');
  const [code, setCode] = useState(item?.code || '');
  const [defaultWeight, setDefaultWeight] = useState(item?.defaultWeight ?? 10);
  const [targetLevel, setTargetLevel] = useState(item?.targetLevel || 'school');
  const handle = (e: React.FormEvent) => { e.preventDefault(); onSubmit({ name, code, defaultWeight, targetLevel }); };
  return <form onSubmit={handle} className="space-y-4">
    <div><label className="block text-sm font-medium mb-1">Tên nhóm *</label><input value={name} onChange={e => setName(e.target.value)} required className={field} /></div>
    <div className="grid grid-cols-3 gap-4"><div><label className="block text-sm font-medium mb-1">Mã *</label><input value={code} onChange={e => setCode(e.target.value)} required className={field} /></div><div><label className="block text-sm font-medium mb-1">Trọng số mặc định *</label><input type="number" value={defaultWeight} onChange={e => setDefaultWeight(Number(e.target.value))} required className={field} /></div><div><label className="block text-sm font-medium mb-1">Cấp</label><select value={targetLevel} onChange={e => setTargetLevel(e.target.value as 'school' | 'unit' | 'individual')} className={field}><option value="school">Trường</option><option value="unit">Đơn vị</option><option value="individual">Cá nhân</option></select></div></div>
    <div className="flex justify-end gap-2 pt-4 border-t"><button type="button" onClick={onCancel} className="btn-secondary">Hủy</button><button type="submit" className="btn-primary">{item ? 'Cập nhật' : 'Thêm mới'}</button></div>
  </form>;
}
