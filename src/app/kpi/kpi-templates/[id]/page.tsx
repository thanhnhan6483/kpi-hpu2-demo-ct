'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Send, CheckCircle, Lock, Unlock, Play, ArrowLeft, Save, X, AlertCircle, FileText } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { SchoolKPICatalog, UnitKPICatalog, IndividualKPICatalog, KPITemplateItem } from '@/types';
import { indicatorLabel } from '@/lib/kpiIndicatorLabels';

interface KPITemplate {
  id: string;
  name: string;
  targetLevel: 'school' | 'unit' | 'department' | 'individual';
  status: 'draft' | 'submitted' | 'approved' | 'active' | 'locked' | 'inactive';
  description: string;
  indicatorCount: number;
  totalWeight: number;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  activatedAt?: string;
  lockedAt?: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Chờ duyệt', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Đã duyệt', color: 'bg-green-100 text-green-700' },
  active: { label: 'Đang áp dụng', color: 'bg-blue-100 text-blue-700' },
  locked: { label: 'Đã khóa', color: 'bg-red-100 text-red-600' },
  inactive: { label: 'Ngừng sử dụng', color: 'bg-gray-100 text-gray-400' },
};

const levelLabels: Record<string, string> = { school: 'Cấp Trường', unit: 'Cấp Đơn vị', department: 'Cấp Bộ môn', individual: 'Cấp Cá nhân' };

const levelToCatalog: Record<string, string> = {
  school: 'school-catalog',
  unit: 'unit-catalog',
  department: 'unit-catalog',
  individual: 'individual-catalog',
};

export default function KPITemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [template, setTemplate] = useState<KPITemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<KPITemplateItem[]>([]);
  const [schoolCatalog, setSchoolCatalog] = useState<SchoolKPICatalog[]>([]);
  const [unitCatalog, setUnitCatalog] = useState<UnitKPICatalog[]>([]);
  const [indCatalog, setIndCatalog] = useState<IndividualKPICatalog[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editInfo, setEditInfo] = useState(false);

  // Add form state
  const [addCatalogId, setAddCatalogId] = useState('');
  const [addWeight, setAddWeight] = useState(5);
  const [addTargetValue, setAddTargetValue] = useState(0);
  const [addCapRate, setAddCapRate] = useState(100);

  // Edit item modal
  const [editItem, setEditItem] = useState<KPITemplateItem | null>(null);
  const [editWeight, setEditWeight] = useState(5);
  const [editTargetValue, setEditTargetValue] = useState(0);
  const [editCapRate, setEditCapRate] = useState(100);

  // Apply to year
  const [showApply, setShowApply] = useState(false);
  const [applyYear, setApplyYear] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ success: boolean; unitsApplied?: number; totalKpisCreated?: number; skippedUnits?: string[] } | null>(null);
  const [academicYears, setAcademicYears] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, ti, sc, uc, ic, mu, ay] = await Promise.all([
        apiGet<KPITemplate>(`/api/kpi-templates/${id}`),
        apiGet<KPITemplateItem[]>(`/api/kpi-template-items?templateId=${id}`),
        apiGet<SchoolKPICatalog[]>('/api/school-kpi-catalog'),
        apiGet<UnitKPICatalog[]>('/api/unit-kpi-catalog'),
        apiGet<IndividualKPICatalog[]>('/api/individual-kpi-catalog'),
        apiGet<{ id: string; name: string }[]>('/api/measurement-units'),
        apiGet<{ id: string; name: string }[]>('/api/academic-years'),
      ]);
      setTemplate(t);
      setTemplateItems(ti);
      setSchoolCatalog(sc.filter(s => s.status === 'active'));
      setUnitCatalog(uc.filter(u => u.status === 'active'));
      setIndCatalog(ic.filter(i => i.status === 'active'));
      setMeasurementUnits(mu);
      setAcademicYears(ay);
    } catch { /* empty */ } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const recalcTemplate = async (items: KPITemplateItem[]) => {
    const count = items.length;
    const totalWeight = items.reduce((s, i) => s + i.weight, 0);
    const updated = await apiPut<KPITemplate>(`/api/kpi-templates/${id}`, {
      indicatorCount: count,
      totalWeight,
    });
    setTemplate(updated);
  };

  const handleStatusChange = async (status: string) => {
    if (!template) return;
    const labels: Record<string, string> = { submitted: 'trình duyệt', approved: 'phê duyệt', active: 'kích hoạt', locked: 'khóa', draft: 'mở khóa', inactive: 'ngừng sử dụng' };
    if (!confirm(`${labels[status] || status} bộ KPI mẫu "${template.name}"?`)) return;
    const updates: Partial<KPITemplate> = { status: status as any };
    if (status === 'approved') updates.approvedAt = new Date().toISOString();
    if (status === 'active') updates.activatedAt = new Date().toISOString();
    if (status === 'locked') updates.lockedAt = new Date().toISOString();
    const updated = await apiPut<KPITemplate>(`/api/kpi-templates/${id}`, updates);
    setTemplate(updated);
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!template) return;
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const updated = await apiPut<KPITemplate>(`/api/kpi-templates/${id}`, {
      name: fd.get('name'),
      description: fd.get('description'),
    });
    setTemplate(updated);
    setEditInfo(false);
  };

  const handleDelete = async () => {
    if (!template || !confirm(`Xóa bộ KPI mẫu "${template.name}"?`)) return;
    await apiDelete(`/api/kpi-templates/${id}`);
    router.push('/kpi/kpi-templates');
  };

  const getCatalogLabel = () => {
    if (!template) return '';
    const catKey = levelToCatalog[template.targetLevel];
    if (catKey === 'school-catalog') return 'Chỉ tiêu Trường';
    if (catKey === 'unit-catalog') return 'KPI Đơn vị';
    if (catKey === 'individual-catalog') return 'KPI Cá nhân';
    return 'Chỉ tiêu';
  };

  const getCatalogOptions = () => {
    if (!template) return [];
    const catKey = levelToCatalog[template.targetLevel];
    const usedIds = new Set(templateItems.map(ti => ti.indicatorId));
    if (catKey === 'school-catalog') return schoolCatalog.filter(s => !usedIds.has(s.id)).map(s => ({ id: s.id, name: s.name, code: s.code }));
    if (catKey === 'unit-catalog') return unitCatalog.filter(u => !usedIds.has(u.id)).map(u => ({ id: u.id, name: u.name, code: u.code }));
    if (catKey === 'individual-catalog') return indCatalog.filter(i => !usedIds.has(i.id)).map(i => ({ id: i.id, name: i.name, code: i.code }));
    return [];
  };

  const getIndicatorName = (indicatorId: string) => {
    const from = (arr: any[]) => arr.find((x: any) => x.id === indicatorId);
    const found = from(schoolCatalog) || from(unitCatalog) || from(indCatalog);
    if (found) return `${found.code} — ${found.name}`;
    const label = indicatorLabel(indicatorId);
    return label ? `${label.code} — ${label.name}` : indicatorId;
  };

  const getIndicatorUnit = (indicatorId: string) => {
    const from = (arr: any[]) => arr.find((x: any) => x.id === indicatorId);
    const found = from(schoolCatalog) || from(unitCatalog) || from(indCatalog);
    if (found) {
      const unit = measurementUnits.find(m => m.id === found.unitId);
      return unit?.name || '';
    }
    return indicatorLabel(indicatorId)?.unit || '';
  };

  const handleAddIndicator = async () => {
    if (!template || !addCatalogId) return;
    const newItem = await apiPost<KPITemplateItem>('/api/kpi-template-items', {
      templateId: template.id,
      indicatorId: addCatalogId,
      weight: addWeight,
      targetValue: addTargetValue,
      capRate: addCapRate,
    });
    const newItems = [...templateItems, newItem];
    setTemplateItems(newItems);
    await recalcTemplate(newItems);
    setAddCatalogId('');
    setAddWeight(5);
    setAddTargetValue(0);
    setAddCapRate(100);
  };

  const handleRemoveIndicator = async (itemId: string) => {
    if (!confirm('Xóa chỉ số này khỏi bộ mẫu?')) return;
    await apiDelete(`/api/kpi-template-items/${itemId}`);
    const newItems = templateItems.filter(ti => ti.id !== itemId);
    setTemplateItems(newItems);
    await recalcTemplate(newItems);
  };

  const handleEditIndicator = async () => {
    if (!editItem) return;
    const updated = await apiPut<KPITemplateItem>(`/api/kpi-template-items/${editItem.id}`, {
      weight: editWeight,
      targetValue: editTargetValue,
      capRate: editCapRate,
    });
    const newItems = templateItems.map(ti => ti.id === editItem.id ? updated : ti);
    setTemplateItems(newItems);
    await recalcTemplate(newItems);
    setEditItem(null);
  };

  if (loading) return <div className="text-center py-20 text-text-light">Đang tải...</div>;
  if (!template) return <div className="text-center py-20 text-text-light">Không tìm thấy bộ KPI mẫu</div>;

  const catalogOptions = getCatalogOptions();
  const showAddForm = levelToCatalog[template.targetLevel] && template.status === 'draft';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/kpi/kpi-templates')} className="p-2 hover:bg-bg-cream rounded-lg">
            <ArrowLeft size={20} className="text-text-light" />
          </button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-text-dark flex items-center gap-2">
              <FileText size={24} /> {template.name}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          {template.status === 'draft' && <button onClick={() => handleStatusChange('submitted')} className="btn-primary text-xs flex items-center gap-1"><Send size={14} /> Trình duyệt</button>}
          {template.status === 'submitted' && <button onClick={() => handleStatusChange('approved')} className="btn-primary text-xs flex items-center gap-1"><CheckCircle size={14} /> Phê duyệt</button>}
          {template.status === 'approved' && <button onClick={() => handleStatusChange('active')} className="btn-primary text-xs flex items-center gap-1"><Play size={14} /> Kích hoạt</button>}
          {(template.status === 'active' || template.status === 'locked') && <button onClick={() => setShowApply(true)} className="btn-primary text-xs flex items-center gap-1" style={{background: '#8b5cf6'}}><Play size={14} /> Áp dụng cho năm học</button>}
          {template.status === 'active' && <button onClick={() => handleStatusChange('locked')} className="btn-primary text-xs flex items-center gap-1"><Lock size={14} /> Khóa</button>}
          {template.status === 'locked' && <button onClick={() => handleStatusChange('draft')} className="btn-primary text-xs flex items-center gap-1" style={{background: '#f97316'}}><Unlock size={14} /> Mở khóa</button>}
          {template.status === 'draft' && <button onClick={() => setEditInfo(true)} className="btn-secondary text-xs flex items-center gap-1"><Edit size={14} /> Sửa thông tin</button>}
          {template.status === 'draft' && <button onClick={handleDelete} className="px-3 py-1.5 border border-accent-red/30 text-accent-red rounded-lg text-xs flex items-center gap-1 hover:bg-red-50"><Trash2 size={14} /> Xóa</button>}
        </div>
      </div>

      {/* Info card */}
      <div className="card">
        <div className="p-4">
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="badge badge-info">{levelLabels[template.targetLevel]}</span>
            <span className={`badge ${statusConfig[template.status]?.color}`}>{statusConfig[template.status]?.label}</span>
            <span className="text-text-light">Số chỉ số: <strong>{template.indicatorCount}</strong></span>
            <span className="text-text-light">Tổng trọng số: <strong>{template.totalWeight}%</strong></span>
            <span className="text-text-light">Mô tả: <strong>{template.description || '—'}</strong></span>
          </div>
        </div>
      </div>

      {/* Edit info modal */}
      <Modal isOpen={editInfo} onClose={() => setEditInfo(false)} title="Sửa thông tin bộ KPI mẫu">
        <form onSubmit={handleSaveInfo} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Tên *</label><input name="name" defaultValue={template.name} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
          <div><label className="block text-sm font-medium mb-1">Mô tả</label><textarea name="description" defaultValue={template.description} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditInfo(false)} className="btn-secondary text-xs">Hủy</button><button type="submit" className="btn-primary text-xs flex items-center gap-1"><Save size={14} /> Lưu</button></div>
        </form>
      </Modal>

      {/* Indicators section */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-white">Danh sách chỉ số KPI trong mẫu</h3>
          <span className="text-xs text-white/70">{templateItems.length} chỉ số</span>
        </div>
        <div className="p-0">
          <table className="table">
            <thead><tr><th>STT</th><th>Chỉ số</th><th>ĐVT</th><th>Trọng số</th><th>Mục tiêu</th><th>CapRate</th><th>Thao tác</th></tr></thead>
            <tbody>
              {templateItems.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-text-light text-sm py-8">Chưa có chỉ số nào</td></tr>
              ) : templateItems.map((ti, idx) => (
                <tr key={ti.id}>
                  <td className="text-text-light">{idx + 1}</td>
                  <td className="font-medium">{getIndicatorName(ti.indicatorId)}</td>
                  <td className="text-text-light text-xs">{getIndicatorUnit(ti.indicatorId)}</td>
                  <td className="text-center">{ti.weight}%</td>
                  <td className="text-center">{ti.targetValue}</td>
                  <td className="text-center">{ti.capRate}%</td>
                  <td>
                    {template.status === 'draft' && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditItem(ti); setEditWeight(ti.weight); setEditTargetValue(ti.targetValue); setEditCapRate(ti.capRate); }} className="p-1 text-accent-yellow hover:bg-accent-yellow/10 rounded"><Edit size={14} /></button>
                        <button onClick={() => handleRemoveIndicator(ti.id)} className="p-1 text-accent-red hover:bg-accent-red/10 rounded"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Only show add form for draft */}
      {template.status === 'draft' && (
        <div className="card">
          <div className="card-header"><h3 className="text-white">Thêm chỉ số từ danh mục {getCatalogLabel()}</h3></div>
          <div className="p-4">
            {!levelToCatalog[template.targetLevel] ? (
              <p className="text-xs text-accent-red flex items-center gap-1"><AlertCircle size={12} /> Chưa có danh mục cho cấp này.</p>
            ) : (
              <div className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-5">
                  <label className="block text-xs font-medium text-text-light mb-1">Chọn chỉ số</label>
                  <select value={addCatalogId} onChange={e => setAddCatalogId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="">-- Chọn --</option>
                    {catalogOptions.map(o => <option key={o.id} value={o.id}>{o.code} — {o.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-light mb-1">Trọng số (%)</label>
                  <input type="number" value={addWeight} onChange={e => setAddWeight(Number(e.target.value))} min={0} max={100} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-light mb-1">Mục tiêu</label>
                  <input type="number" value={addTargetValue} onChange={e => setAddTargetValue(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-text-light mb-1">CapRate (%)</label>
                  <input type="number" value={addCapRate} onChange={e => setAddCapRate(Number(e.target.value))} min={0} max={200} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div className="col-span-1">
                  <button onClick={handleAddIndicator} disabled={!addCatalogId} className="btn-primary text-xs w-full h-[38px] flex items-center justify-center"><Plus size={16} /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Apply to year modal */}
      <Modal isOpen={showApply} onClose={() => { setShowApply(false); setApplyResult(null); }} title="Áp dụng bộ KPI mẫu cho năm học">
        {!applyResult ? (
          <div className="space-y-4">
            <p className="text-sm text-text-light">Chọn năm học để áp dụng bộ mẫu <strong>{template.name}</strong> cho các đơn vị cấp <strong>{levelLabels[template.targetLevel]}</strong>.</p>
            <div>
              <label className="block text-sm font-medium mb-1">Năm học *</label>
              <select value={applyYear} onChange={e => setApplyYear(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="">-- Chọn --</option>
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowApply(false); setApplyResult(null); }} className="btn-secondary text-xs">Hủy</button>
              <button onClick={async () => {
                if (!applyYear) return;
                setApplying(true);
                try {
                  const res = await fetch(`/api/kpi-templates/${id}?action=apply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ academicYearId: applyYear }),
                  });
                  const data = await res.json();
                  setApplyResult(data);
                } catch { setApplyResult({ success: false }); }
                finally { setApplying(false); }
              }} disabled={!applyYear || applying} className="btn-primary text-xs">
                {applying ? 'Đang áp dụng...' : 'Xác nhận áp dụng'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {applyResult.success ? (
              <>
                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                  <CheckCircle size={20} /> Áp dụng thành công!
                </div>
                <p className="text-sm">Đã tạo <strong>{applyResult.unitsApplied}</strong> bộ chỉ tiêu cho các đơn vị với <strong>{applyResult.totalKpisCreated}</strong> chỉ số KPI.</p>
                {applyResult.skippedUnits && applyResult.skippedUnits.length > 0 && (
                  <p className="text-xs text-text-light">Bỏ qua {applyResult.skippedUnits.length} đơn vị đã có dữ liệu: {applyResult.skippedUnits.join(', ')}</p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-lg">
                <AlertCircle size={20} /> Áp dụng thất bại. Vui lòng thử lại.
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => { setShowApply(false); setApplyResult(null); }} className="btn-primary text-xs">Đóng</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit item modal */}
      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Sửa chỉ số trong mẫu">
        <div className="space-y-4">
          {editItem && <p className="text-sm text-text-light">{getIndicatorName(editItem.indicatorId)}</p>}
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">Trọng số (%)</label><input type="number" value={editWeight} onChange={e => setEditWeight(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Mục tiêu</label><input type="number" value={editTargetValue} onChange={e => setEditTargetValue(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">CapRate (%)</label><input type="number" value={editCapRate} onChange={e => setEditCapRate(Number(e.target.value))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
          <div className="flex justify-end gap-2"><button onClick={() => setEditItem(null)} className="btn-secondary text-xs">Hủy</button><button onClick={handleEditIndicator} className="btn-primary text-xs"><Save size={14} /> Lưu</button></div>
        </div>
      </Modal>
    </div>
  );
}
