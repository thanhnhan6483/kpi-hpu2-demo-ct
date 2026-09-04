'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import PagedTable from '@/components/ui/PagedTable';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { KhctForm } from '@/components/forms/kpi-catalog-forms';
import type { KHCTTask, SchoolKPICatalog } from '@/types';

export default function KeHoachCongTacPage() {
  const [khctTasks, setKhctTasks] = useState<KHCTTask[]>([]);
  const [orgUnits, setOrgUnits] = useState<{ id: string; name: string; parentId: string | null; code: string; type: string; status: string }[]>([]);
  const [kpiGroups, setKpiGroups] = useState<{ id: string; name: string }[]>([]);
  const [schoolCatalog, setSchoolCatalog] = useState<SchoolKPICatalog[]>([]);
  const [softwareCatalog, setSoftwareCatalog] = useState<{ id: string; name: string }[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [khctMonthFilter, setKhctMonthFilter] = useState('');
  const [khctFieldFilter, setKhctFieldFilter] = useState('');
  const [khctUnitFilter, setKhctUnitFilter] = useState('');
  const [khctSearch, setKhctSearch] = useState('');

  const loadData = useCallback(async () => {
    const [khct, ou, kg, sc, sw] = await Promise.all([
      apiGet<KHCTTask[]>('/api/khct'),
      apiGet<{ id: string; name: string; parentId: string | null; code: string; type: string; status: string }[]>('/api/units'),
      apiGet<{ id: string; name: string }[]>('/api/kpi-groups'),
      apiGet<SchoolKPICatalog[]>('/api/school-kpi-catalog'),
      apiGet<{ id: string; name: string }[]>('/api/software-catalog'),
    ]);
    setKhctTasks(khct); setOrgUnits(ou); setKpiGroups(kg); setSchoolCatalog(sc); setSoftwareCatalog(sw);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (data: any) => {
    if (editId) {
      await apiPut(`/api/khct/${editId}`, data);
    } else {
      await apiPost('/api/khct', data);
    }
    setShowModal(false); setEditId(null);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa mục này?')) return;
    await apiDelete(`/api/khct/${id}`);
    loadData();
  };

  const softwareName = (id?: string) => softwareCatalog.find(s => s.id === id)?.name || '—';

  const khctFields = useMemo(() => [...new Set(khctTasks.map(t => t.field).filter(Boolean))].sort(), [khctTasks]);
  const khctUnits = useMemo(() => [...new Set(khctTasks.map(t => t.responsibleUnit).filter(Boolean))].sort(), [khctTasks]);

  const filteredKhct = useMemo(() => {
    let list = khctTasks;
    if (khctMonthFilter) list = list.filter(t => t.month === khctMonthFilter);
    if (khctFieldFilter) list = list.filter(t => t.field === khctFieldFilter);
    if (khctUnitFilter) list = list.filter(t => t.responsibleUnit === khctUnitFilter);
    if (khctSearch) {
      const kw = khctSearch.toLowerCase();
      list = list.filter(t =>
        t.taskName.toLowerCase().includes(kw) ||
        t.responsibleUnit.toLowerCase().includes(kw) ||
        t.kpiCodes.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [khctTasks, khctMonthFilter, khctFieldFilter, khctUnitFilter, khctSearch]);

  const khctColumns = [
    { key: 'order', label: 'Mã NV', width: 'w-[5%]', render: (t: KHCTTask) => <span className="text-xs font-mono text-center">{t.order}</span> },
    { key: 'field', label: 'Lĩnh vực', width: 'w-[9%]', render: (t: KHCTTask) => <span className="text-xs text-text-light whitespace-nowrap">{t.field}</span> },
    { key: 'taskName', label: 'Nhiệm vụ', width: 'w-[20%]', render: (t: KHCTTask) => <span className="font-medium break-words text-sm">{t.taskName}</span> },
    { key: 'responsibleUnit', label: 'Đơn vị chủ trì', width: 'w-[11%]', render: (t: KHCTTask) => <span className="text-xs">{t.responsibleUnit}</span> },
    { key: 'coordinatingUnits', label: 'Đơn vị phối hợp', width: 'w-[11%]', render: (t: KHCTTask) => <span className="text-xs text-text-light">{t.coordinatingUnits}</span> },
    { key: 'kpiCodes', label: 'Mã KPI', width: 'w-[9%]', render: (t: KHCTTask) => {
      const codes = t.kpiCodes.split(';').map(c => c.trim()).filter(Boolean).filter(c => c !== '—');
      if (codes.length === 0) return <span className="text-xs font-medium text-accent-yellow">Riêng</span>;
      return (
        <div className="flex flex-wrap gap-0.5">
          {codes.map(code => (
            <span key={code} className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-primary/10 text-primary rounded">
              {code}
            </span>
          ))}
        </div>
      );
    } },
    { key: 'chiTieu', label: 'Chỉ tiêu', width: 'w-[11%]', render: (t: KHCTTask) => t.chiTieu ? <span className="text-xs font-medium text-accent-green break-words">{t.chiTieu}</span> : <span className="text-xs text-text-light">—</span> },
    { key: 'deliverable', label: 'Sản phẩm / Kết quả', width: 'w-[14%]', render: (t: KHCTTask) => <span className="text-xs break-words">{t.deliverable}</span> },
    { key: 'softwareId', label: 'Nguồn dữ liệu', width: 'w-[10%]', render: (t: KHCTTask) => <span className="text-xs text-text-light">{softwareName(t.softwareId)}</span> },
    { key: 'deadline', label: 'Thời gian', width: 'w-[7%]', render: (t: KHCTTask) => <span className="text-xs font-medium">{t.deadline}</span> },
    { key: 'actions', label: 'Thao tác', width: 'w-[4%]', render: (t: KHCTTask) => (
      <div className="flex justify-center gap-1">
        <button onClick={() => { setEditId(t.id); setShowModal(true); }} className="p-1 text-accent-yellow hover:bg-accent-yellow/10 rounded" title="Sửa"><Edit size={13} /></button>
        <button onClick={() => handleDelete(t.id)} className="p-1 text-accent-red hover:bg-accent-red/10 rounded" title="Xóa"><Trash2 size={13} /></button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-heading font-bold text-text-dark">Kế hoạch công tác</h1>
      </div>

      <div className="card p-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <select value={khctMonthFilter} onChange={e => setKhctMonthFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả tháng</option>
              {['8/2026','9/2026','10/2026','11/2026','12/2026','1/2027','2/2027','3/2027','4/2027','5/2027','6/2027','7/2027'].map(m => (
                <option key={m} value={m}>Tháng {m}</option>
              ))}
            </select>
            <select value={khctFieldFilter} onChange={e => setKhctFieldFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả lĩnh vực</option>
              {khctFields.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={khctUnitFilter} onChange={e => setKhctUnitFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
              <option value="">Tất cả đơn vị</option>
              {khctUnits.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <input value={khctSearch} onChange={e => setKhctSearch(e.target.value)} placeholder="Tìm nhiệm vụ..."
              className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary w-[200px]" />
            <button onClick={() => { setEditId(null); setShowModal(true); }} className="btn-primary text-sm flex items-center gap-1">
              <Plus size={15} /> Thêm
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <button className="btn-primary text-sm flex items-center gap-1" onClick={() => {}}>
            <img src="/images/word.png" alt="Word" className="h-4 w-4 object-contain" /> Xuất word
          </button>
          <button className="btn-primary text-sm flex items-center gap-1" onClick={() => {}}>
            <img src="/images/excel.png" alt="Excel" className="h-4 w-4 object-contain" /> Xuất excel
          </button>
          <button className="btn-primary text-sm flex items-center gap-1" onClick={() => {}}>
            <img src="/images/pdf.png" alt="PDF" className="h-4 w-4 object-contain" /> Xuất pdf
          </button>
        </div>
      </div>

      <div className="card">
        <div className="p-0">
          <PagedTable
            data={filteredKhct}
            rowKey={t => t.id}
            pageSize={15}
            columns={khctColumns}
          />
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditId(null); }}
        title={`${editId ? 'Sửa' : 'Thêm'} nhiệm vụ KHCT`} maxWidth="max-w-3xl">
        <KhctForm item={editId ? (khctTasks.find(t => t.id === editId) || null) : null} fields={khctFields} orgUnits={orgUnits} schoolCatalog={schoolCatalog} kpiGroups={kpiGroups} softwareOptions={softwareCatalog} onSubmit={handleSave} onCancel={() => { setShowModal(false); setEditId(null); }} />
      </Modal>
    </div>
  );
}
