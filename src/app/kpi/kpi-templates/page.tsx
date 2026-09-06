'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Edit, Trash2, Send, CheckCircle, Lock, Unlock, Play, FileText, List } from 'lucide-react';
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

export default function KPITemplatesPage() {
  const router = useRouter();
  const [items, setItems] = useState<KPITemplate[]>([]);
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState<KPITemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewItems, setViewItems] = useState<KPITemplateItem[]>([]);
  const [viewName, setViewName] = useState('');
  const [showView, setShowView] = useState(false);
  const [schoolCatalog, setSchoolCatalog] = useState<SchoolKPICatalog[]>([]);
  const [unitCatalog, setUnitCatalog] = useState<UnitKPICatalog[]>([]);
  const [indCatalog, setIndCatalog] = useState<IndividualKPICatalog[]>([]);
  const [measurementUnits, setMeasurementUnits] = useState<{ id: string; name: string }[]>([]);
  const [templateItems, setTemplateItems] = useState<KPITemplateItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [data, sc, uc, ic, mu, ti] = await Promise.all([
        apiGet<KPITemplate[]>('/api/kpi-templates'),
        apiGet<SchoolKPICatalog[]>('/api/school-kpi-catalog'),
        apiGet<UnitKPICatalog[]>('/api/unit-kpi-catalog'),
        apiGet<IndividualKPICatalog[]>('/api/individual-kpi-catalog'),
        apiGet<{ id: string; name: string }[]>('/api/measurement-units'),
        apiGet<KPITemplateItem[]>('/api/kpi-template-items'),
      ]);
      setItems(data);
      setSchoolCatalog(sc.filter(s => s.status === 'active'));
      setUnitCatalog(uc.filter(u => u.status === 'active'));
      setIndCatalog(ic.filter(i => i.status === 'active'));
      setMeasurementUnits(mu);
      setTemplateItems(ti);
    } catch { /* empty */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(i => {
    if (filterLevel && i.targetLevel !== filterLevel) return false;
    if (search) {
      const s = search.toLowerCase();
      return i.name.toLowerCase().includes(s) || i.description.toLowerCase().includes(s);
    }
    return true;
  });

  const handleCreate = async (data: Partial<KPITemplate>) => {
    const newItem = await apiPost<KPITemplate>('/api/kpi-templates', data);
    setItems([...items, newItem]);
    setShowCreate(false);
  };

  const handleStatusChange = async (item: KPITemplate, status: string) => {
    const labels: Record<string, string> = { submitted: 'trình duyệt', approved: 'phê duyệt', active: 'kích hoạt', locked: 'khóa', draft: 'mở khóa', inactive: 'ngừng sử dụng' };
    if (!confirm(`${labels[status] || status} bộ KPI mẫu "${item.name}"?`)) return;
    const updates: Partial<KPITemplate> = { status: status as any };
    if (status === 'approved') updates.approvedAt = new Date().toISOString();
    if (status === 'active') updates.activatedAt = new Date().toISOString();
    if (status === 'locked') updates.lockedAt = new Date().toISOString();
    await apiPut(`/api/kpi-templates/${item.id}`, updates);
    setItems(items.map(i => i.id === item.id ? { ...i, ...updates } : i));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa bộ KPI mẫu này?')) return;
    await apiDelete(`/api/kpi-templates/${id}`);
    setItems(items.filter(i => i.id !== id));
  };

  const openView = (item: KPITemplate) => {
    const found = templateItems.filter(ti => ti.templateId === item.id);
    setViewItems(found);
    setViewName(item.name);
    setShowView(true);
  };

  const resolveName = (indicatorId: string) => {
    const from = (arr: any[]) => arr.find((x: any) => x.id === indicatorId);
    const found = from(schoolCatalog) || from(unitCatalog) || from(indCatalog);
    if (found) return `${found.code} — ${found.name}`;
    const label = indicatorLabel(indicatorId);
    return label ? `${label.code} — ${label.name}` : indicatorId;
  };

  const resolveUnit = (indicatorId: string) => {
    const from = (arr: any[]) => arr.find((x: any) => x.id === indicatorId);
    const found = from(schoolCatalog) || from(unitCatalog) || from(indCatalog);
    if (found) {
      const unit = measurementUnits.find(m => m.id === found.unitId);
      return unit?.name || '';
    }
    return indicatorLabel(indicatorId)?.unit || '';
  };

  const Form = ({ onSubmit, onClose, initial }: { onSubmit: (d: Partial<KPITemplate>) => void; onClose?: () => void; initial?: KPITemplate }) => {
    const [form, setForm] = useState(initial || { name: '', targetLevel: 'school' as const, description: '' });
    return (
      <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <div><label className="block text-sm font-medium mb-1">Tên bộ KPI mẫu *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" required /></div>
        <div><label className="block text-sm font-medium mb-1">Cấp áp dụng</label><select value={form.targetLevel} onChange={e => setForm({ ...form, targetLevel: e.target.value as any })} className="w-full px-3 py-2 border rounded-lg text-sm"><option value="school">Cấp Trường</option><option value="unit">Cấp Đơn vị</option><option value="department">Cấp Bộ môn</option><option value="individual">Cấp Cá nhân</option></select></div>
        <div><label className="block text-sm font-medium mb-1">Mô tả</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} /></div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Hủy</button><button type="submit" className="btn-primary text-xs">Lưu</button></div>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark flex items-center gap-2"><FileText size={24} /> Bộ KPI mẫu</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1"><Plus size={14} /> Tạo mới</button>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b flex gap-3 flex-wrap">
          <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs">
            <option value="">Tất cả cấp</option>
            <option value="school">Cấp Trường</option>
            <option value="unit">Cấp Đơn vị</option>
            <option value="individual">Cấp Cá nhân</option>
          </select>
          <div className="relative ml-auto"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light" size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..." className="pl-8 pr-3 py-1.5 border rounded-lg text-xs w-56" /></div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>STT</th><th>Tên bộ KPI mẫu</th><th>Cấp</th><th>Số KPI</th><th>Tổng trọng số</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center py-8">Đang tải...</td></tr> :
              filtered.length === 0 ? <tr><td colSpan={7} className="text-center py-8">Chưa có bộ KPI mẫu</td></tr> :
              filtered.map((item, idx) => (
                <tr key={item.id}>
                  <td>{idx + 1}</td>
                  <td><div className="font-medium">{item.name}</div><div className="text-xs text-text-light">{item.description}</div></td>
                  <td><span className="badge badge-info">{levelLabels[item.targetLevel]}</span></td>
                  <td className="text-center"><button onClick={() => openView(item)} className="inline-flex items-center justify-center min-w-[32px] px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/20 transition-colors">{item.indicatorCount}</button></td>
                  <td className="text-center">{item.totalWeight}%</td>
                  <td><span className={`badge ${statusConfig[item.status]?.color}`}>{statusConfig[item.status]?.label}</span></td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => router.push(`/kpi/kpi-templates/${item.id}`)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Xem chi tiết"><List size={14} /></button>
                      {item.status === 'draft' && <button onClick={() => handleStatusChange(item, 'submitted')} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Trình duyệt"><Send size={14} /></button>}
                      {item.status === 'submitted' && <button onClick={() => handleStatusChange(item, 'approved')} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Phê duyệt"><CheckCircle size={14} /></button>}
                      {item.status === 'approved' && <button onClick={() => handleStatusChange(item, 'active')} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Kích hoạt"><Play size={14} /></button>}
                      {item.status === 'active' && <button onClick={() => handleStatusChange(item, 'locked')} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Khóa"><Lock size={14} /></button>}
                      {item.status === 'locked' && <button onClick={() => handleStatusChange(item, 'draft')} className="p-1 text-orange-600 hover:bg-orange-50 rounded" title="Mở khóa"><Unlock size={14} /></button>}
                      {item.status === 'draft' && <button onClick={() => { setSelected(item); setShowEdit(true); }} className="p-1 text-accent-yellow hover:bg-accent-yellow/10 rounded"><Edit size={14} /></button>}
                      {item.status !== 'locked' && item.status !== 'active' && <button onClick={() => handleDelete(item.id)} className="p-1 text-accent-red hover:bg-accent-red/10 rounded"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View items modal */}
      <Modal isOpen={showView} onClose={() => setShowView(false)} title={`Chỉ tiêu trong: ${viewName}`} maxWidth="max-w-3xl">
        {viewItems.length === 0 ? (
          <p className="text-sm text-text-light py-8 text-center">Chưa có chỉ số nào</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-3 py-2 text-xs text-text-light font-medium">STT</th>
                    <th className="text-left px-3 py-2 text-xs text-text-light font-medium">Chỉ số</th>
                    <th className="text-center px-3 py-2 text-xs text-text-light font-medium" style={{width:60}}>ĐVT</th>
                    <th className="text-center px-3 py-2 text-xs text-text-light font-medium" style={{width:70}}>Trọng số</th>
                    <th className="text-center px-3 py-2 text-xs text-text-light font-medium" style={{width:70}}>Mục tiêu</th>
                    <th className="text-center px-3 py-2 text-xs text-text-light font-medium" style={{width:70}}>CapRate</th>
                  </tr>
                </thead>
                <tbody>
                  {viewItems.map((ti, idx) => (
                    <tr key={ti.id} className="border-b border-border/50">
                      <td className="px-3 py-2 text-text-light text-sm">{idx + 1}</td>
                      <td className="px-3 py-2 text-sm">{resolveName(ti.indicatorId)}</td>
                      <td className="px-3 py-2 text-center text-text-light text-xs">{resolveUnit(ti.indicatorId)}</td>
                      <td className="px-3 py-2 text-center text-sm">{ti.weight}%</td>
                      <td className="px-3 py-2 text-center text-sm">{ti.targetValue}</td>
                      <td className="px-3 py-2 text-center text-sm">{ti.capRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-3 mt-3 border-t border-border/50">
              <span className="text-xs text-text-light">Tổng số: <strong>{viewItems.length}</strong> chỉ số · Tổng trọng số: <strong>{viewItems.reduce((s, i) => s + i.weight, 0)}%</strong></span>
            </div>
          </>
        )}
      </Modal>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Tạo bộ KPI mẫu mới"><Form onSubmit={handleCreate} onClose={() => setShowCreate(false)} /></Modal>
      <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setSelected(null); }} title="Chỉnh sửa">{selected && <Form onSubmit={async (d) => { await apiPut(`/api/kpi-templates/${selected.id}`, d); load(); setShowEdit(false); }} onClose={() => { setShowEdit(false); setSelected(null); }} initial={selected} />}</Modal>
    </div>
  );
}
