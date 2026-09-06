'use client';

import { Plus, Edit, Trash2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import kpiGroupsData from '@/data/kpi-groups.json';

interface JobPosition {
  id: string;
  name: string;
  code: string;
  description: string;
  kpiGroupId: string;
  kpiTemplateId?: string;
  approvalLevel: string;
  status: 'active' | 'inactive';
}

interface KpiTemplate {
  id: string;
  name: string;
  targetLevel: string;
  status: string;
}

const groupNames: Record<string, string> = {};
(kpiGroupsData as { id: string; name: string }[]).forEach(g => { groupNames[g.id] = g.name; });

const templateStatusText: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Đã nộp',
  approved: 'Đã duyệt',
  active: 'Đang dùng',
  locked: 'Đã khóa',
  inactive: 'Ngừng dùng',
};

export default function JobPositionsPage() {
  const [items, setItems] = useState<JobPosition[]>([]);
  const [templates, setTemplates] = useState<KpiTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<JobPosition | null>(null);

  const load = useCallback(async () => {
    const [data, tpl] = await Promise.all([
      apiGet<JobPosition[]>('/api/job-positions'),
      apiGet<KpiTemplate[]>('/api/kpi-templates'),
    ]);
    setItems(data);
    setTemplates(tpl.filter(t => t.targetLevel === 'individual'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(
    i =>
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.code.toLowerCase().includes(search.toLowerCase()),
  );

  const templateNames: Record<string, KpiTemplate> = {};
  templates.forEach(t => { templateNames[t.id] = t; });

  const handleSave = async (data: Partial<JobPosition>) => {
    if (editItem) {
      await apiPut(`/api/job-positions/${editItem.id}`, data);
    } else {
      await apiPost('/api/job-positions', data);
    }
    setShowModal(false);
    setEditItem(null);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa vị trí việc làm này?')) return;
    await apiDelete(`/api/job-positions/${id}`);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Vị trí việc làm</h1>
          <p className="text-sm text-text-light mt-1">Danh mục vị trí việc làm cho nhân sự, gắn nhóm KPI và bộ KPI mẫu áp dụng.</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowModal(true); }} className="btn-primary text-xs flex items-center gap-1">
          <Plus size={14} /> Thêm vị trí
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc mã..."
          className="max-w-xs flex-1 px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary"
        />
        <span className="text-xs text-text-light">Hiển thị {filtered.length}/{items.length} vị trí</span>
      </div>

      <div className="card">
        <div className="p-0">
          <div className="overflow-x-auto"><table className="table">
            <thead>
              <tr><th>ID</th><th>Mã</th><th>Tên vị trí</th><th>Nhóm KPI</th><th>Bộ KPI mẫu</th><th>Cấp duyệt</th><th>Trạng thái</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id}>
                  <td><span className="badge badge-info">{item.id}</span></td>
                  <td className="font-mono text-xs">{item.code}</td>
                  <td className="font-medium">{item.name}</td>
                  <td className="text-sm">{groupNames[item.kpiGroupId] || '-'}</td>
                  <td className="text-sm">
                    {item.kpiTemplateId && templateNames[item.kpiTemplateId] ? (
                      <span className="flex flex-col">
                        <span>{templateNames[item.kpiTemplateId].name}</span>
                        <span className="text-[10px] text-text-light uppercase">
                          {templateStatusText[templateNames[item.kpiTemplateId].status] || templateNames[item.kpiTemplateId].status}
                        </span>
                      </span>
                    ) : (
                      <span className="text-text-light">-</span>
                    )}
                  </td>
                  <td className="text-sm">{item.approvalLevel || '-'}</td>
                  <td>
                    {item.status === 'active' ? (
                      <span className="badge badge-success">Đang dùng</span>
                    ) : (
                      <span className="badge badge-warning">Ngừng dùng</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditItem(item); setShowModal(true); }} className="p-1 text-accent-yellow hover:bg-accent-yellow/10 rounded"><Edit size={14} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-accent-red hover:bg-accent-red/10 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center text-text-light text-sm py-8">
                  {items.length === 0 ? 'Chưa có vị trí việc làm nào' : 'Không tìm thấy vị trí việc làm phù hợp'}
                </td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditItem(null); }} title={editItem ? 'Sửa vị trí việc làm' : 'Thêm vị trí việc làm'}>
        <JobPositionForm position={editItem} templates={templates} onSubmit={handleSave} onCancel={() => { setShowModal(false); setEditItem(null); }} />
      </Modal>
    </div>
  );
}

function JobPositionForm({ position, templates, onSubmit, onCancel }: { position: JobPosition | null; templates: KpiTemplate[]; onSubmit: (data: Partial<JobPosition>) => void; onCancel: () => void }) {
  const [name, setName] = useState(position?.name || '');
  const [code, setCode] = useState(position?.code || '');
  const [description, setDescription] = useState(position?.description || '');
  const [kpiGroupId, setKpiGroupId] = useState(position?.kpiGroupId || '');
  const [kpiTemplateId, setKpiTemplateId] = useState(position?.kpiTemplateId || '');
  const [approvalLevel, setApprovalLevel] = useState(position?.approvalLevel || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(position?.status || 'active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, code, description, kpiGroupId, kpiTemplateId, approvalLevel, status });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Tên vị trí *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="VD: Giảng viên"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Mã *</label>
          <input type="text" value={code} onChange={e => setCode(e.target.value)} required placeholder="VD: GV"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Nhóm KPI chính</label>
          <select value={kpiGroupId} onChange={e => setKpiGroupId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
            <option value="">-- Chọn nhóm KPI --</option>
            {Object.entries(groupNames).map(([id, gname]) => (
              <option key={id} value={id}>{gname}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Bộ KPI mẫu</label>
          <select value={kpiTemplateId} onChange={e => setKpiTemplateId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
            <option value="">-- Chưa gắn bộ KPI mẫu --</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({templateStatusText[t.status] || t.status})</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Cấp phê duyệt</label>
          <select value={approvalLevel} onChange={e => setApprovalLevel(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
            <option value="">-- Chọn --</option>
            <option value="Trưởng bộ môn">Trưởng bộ môn</option>
            <option value="Trưởng khoa">Trưởng khoa</option>
            <option value="Trưởng đơn vị">Trưởng đơn vị</option>
            <option value="Ban Giám hiệu">Ban Giám hiệu</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Trạng thái</label>
          <select value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary">
            <option value="active">Đang dùng</option>
            <option value="inactive">Ngừng dùng</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-dark mb-1">Mô tả nhiệm vụ</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:border-primary" />
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">{position ? 'Cập nhật' : 'Thêm mới'}</button>
      </div>
    </form>
  );
}
