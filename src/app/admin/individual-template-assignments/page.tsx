'use client';

import { Plus, Edit, Trash2, UserCheck } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/ui/Modal';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import academicYearsData from '@/data/academic-years.json';
import { positionName } from '@/lib/jobPositionTemplate';

interface UserData {
  id: string;
  username: string;
  fullName: string;
  email: string;
  employeeCode: string;
  unitId: string;
  positionId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

interface UnitData {
  id: string;
  name: string;
  code: string;
  type: string;
  managerId: string;
  status: string;
}

interface KpiTemplate {
  id: string;
  name: string;
  targetLevel: string;
  status: string;
}

interface Assignment {
  id: string;
  userId: string;
  academicYearId: string;
  kpiTemplateId: string;
  status: 'active' | 'inactive';
  assignedAt: string;
  updatedAt: string;
}

interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

const templateStatusText: Record<string, string> = {
  draft: 'Nháp',
  submitted: 'Đã nộp',
  approved: 'Đã duyệt',
  active: 'Đang dùng',
  locked: 'Đã khóa',
  inactive: 'Ngừng dùng',
};

export default function IndividualTemplateAssignmentsPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [units, setUnits] = useState<UnitData[]>([]);
  const [templates, setTemplates] = useState<KpiTemplate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [yearId, setYearId] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const [usersData, unitsData, tplData, assignmentData] = await Promise.all([
        apiGet<UserData[]>('/api/users'),
        apiGet<UnitData[]>('/api/units'),
        apiGet<KpiTemplate[]>('/api/kpi-templates'),
        apiGet<Assignment[]>('/api/individual-template-assignments'),
      ]);
      setUsers(usersData.filter(u => u.status === 'active'));
      setUnits(unitsData);
      setTemplates(tplData.filter(t => t.targetLevel === 'individual'));
      setAssignments(assignmentData);
      setLoadError('');
    } catch {
      setLoadError('Không tải được dữ liệu.');
    }
  }, []);

  useEffect(() => {
    load();
    const activeYear = (academicYearsData as AcademicYear[]).find(y => y.status === 'active');
    if (activeYear) setYearId(activeYear.id);
  }, [load]);

  const unitNames: Record<string, UnitData> = {};
  units.forEach(u => { unitNames[u.id] = u; });

  const yearName = (academicYearsData as AcademicYear[]).find(y => y.id === yearId)?.name || yearId;

  const filteredUsers = users.filter(u => !unitFilter || u.unitId === unitFilter);

  const getAssignment = (userId: string) => assignments.find(a => a.userId === userId && a.academicYearId === yearId);

  const handleSave = async (data: { kpiTemplateId: string; status: 'active' | 'inactive' }) => {
    if (!editUser) return;
    const existing = getAssignment(editUser.id);
    try {
      if (existing) {
        await apiPut(`/api/individual-template-assignments/${existing.id}`, data);
      } else {
        await apiPost('/api/individual-template-assignments', {
          ...data,
          userId: editUser.id,
          academicYearId: yearId,
        });
      }
      setShowModal(false);
      setEditUser(null);
      load();
    } catch {
      setMessage('Lưu thất bại. Kiểm tra lại dữ liệu.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bỏ gán Bộ KPI mẫu cho nhân sự này?')) return;
    await apiDelete(`/api/individual-template-assignments/${id}`);
    load();
  };

  const unitOptions = filteredUsers.length !== users.length
    ? units.filter(u => u.id === unitFilter)
    : units.filter(u => filteredUsers.some(x => x.unitId === u.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-dark">Gán Bộ KPI mẫu cá nhân</h1>
          <p className="text-sm text-text-light mt-1">
            Gán Bộ KPI mẫu cho từng nhân sự theo năm học.
          </p>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-text-dark">
          {message}
        </div>
      )}
      {loadError && (
        <div className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-4 py-2 text-sm text-accent-red">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-light">Năm học</label>
          <select value={yearId} onChange={e => setYearId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
            {(academicYearsData as AcademicYear[]).map(y => (
              <option key={y.id} value={y.id}>{y.name}{y.status === 'active' ? ' (hiện tại)' : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-light">Đơn vị</label>
          <select value={unitFilter} onChange={e => setUnitFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-white text-text-dark text-sm focus:outline-none focus:border-primary">
            <option value="">-- Tất cả --</option>
            {unitOptions.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-text-light">
          Hiển thị {filteredUsers.length} nhân sự · {filteredUsers.filter(u => getAssignment(u.id)).length} đã gán
        </span>
      </div>

      <div className="card">
        <div className="p-0">
          <div className="overflow-x-auto"><table className="table">
            <thead>
              <tr><th>Nhân sự</th><th>Đơn vị</th><th>Vị trí</th><th>Bộ KPI mẫu</th><th>Trạng thái</th><th>Thao tác</th></tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const asg = getAssignment(u.id);
                const unit = unitNames[u.unitId];
                return (
                  <tr key={u.id}>
                    <td>
                      <span className="flex flex-col">
                        <span className="font-medium">{u.fullName}</span>
                        <span className="text-[11px] text-text-light font-mono">{u.employeeCode}</span>
                      </span>
                    </td>
                    <td className="text-sm">{unit?.name || u.unitId}</td>
                    <td className="text-sm">{positionName(u.positionId) || '-'}</td>
                    <td className="text-sm">
                      {asg && templates.find(t => t.id === asg.kpiTemplateId) ? (
                        <span className="flex flex-col">
                          <span>{templates.find(t => t.id === asg.kpiTemplateId)?.name}</span>
                          <span className="text-[10px] text-text-light uppercase">
                            {templateStatusText[templates.find(t => t.id === asg.kpiTemplateId)?.status || ''] || asg.kpiTemplateId}
                          </span>
                        </span>
                      ) : (
                        <span className="text-text-light">Chưa gán</span>
                      )}
                    </td>
                    <td>
                      {asg ? (
                        <span className="badge badge-success">Đã gán</span>
                      ) : (
                        <span className="badge badge-warning">Chưa gán</span>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditUser(u); setShowModal(true); }}
                          className="p-1 text-accent-yellow hover:bg-accent-yellow/10 rounded"
                          title="Gán / đổi Bộ KPI mẫu"
                        >
                          {asg ? <Edit size={14} /> : <Plus size={14} />}
                        </button>
                        {asg && (
                          <button onClick={() => handleDelete(asg.id)} className="p-1 text-accent-red hover:bg-accent-red/10 rounded"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={6} className="text-center text-text-light text-sm py-8">
                  {users.length === 0 ? 'Chưa có nhân sự' : 'Không có nhân sự trong phạm vi đã chọn'}
                </td></tr>
              )}
            </tbody>
          </table></div>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditUser(null); }} title={editUser ? `Gán Bộ KPI mẫu — ${editUser.fullName}` : ''}>
        {editUser && (
          <AssignmentForm
            key={editUser.id}
            user={editUser}
            unit={unitNames[editUser.unitId]}
            templates={templates}
            existing={getAssignment(editUser.id)}
            onCancel={() => { setShowModal(false); setEditUser(null); }}
            onSubmit={(data) => handleSave(data)}
            yearName={yearName}
          />
        )}
      </Modal>
    </div>
  );
}

function AssignmentForm({ user, unit, templates, existing, onCancel, onSubmit, yearName }: {
  user: UserData;
  unit?: UnitData;
  templates: KpiTemplate[];
  existing?: Assignment;
  onCancel: () => void;
  onSubmit: (data: { kpiTemplateId: string; status: 'active' | 'inactive' }) => void;
  yearName: string;
}) {
  const [templateId, setTemplateId] = useState(existing?.kpiTemplateId || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(existing?.status || 'active');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ kpiTemplateId: templateId, status });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Nhân sự</label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-cream px-3 py-2 text-sm">
            <UserCheck size={16} className="text-text-light" />
            <span>{user.fullName} ({user.employeeCode})</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Năm học</label>
          <input type="text" value={yearName} readOnly
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-cream text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Đơn vị</label>
          <input type="text" value={unit?.name || ''} readOnly
            className="w-full px-3 py-2 rounded-lg border border-border bg-bg-cream text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-dark mb-1">Trạng thái</label>
          <select value={status} onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary">
            <option value="active">Đang áp dụng</option>
            <option value="inactive">Ngừng áp dụng</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-text-dark mb-1">Bộ KPI mẫu cá nhân *</label>
        <select value={templateId} onChange={e => setTemplateId(e.target.value)} required
          className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:border-primary">
          <option value="">-- Chọn Bộ KPI mẫu --</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name} ({templateStatusText[t.status] || t.status})</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t">
        <button type="button" onClick={onCancel} className="btn-secondary">Hủy</button>
        <button type="submit" className="btn-primary">{existing ? 'Cập nhật' : 'Gán Bộ KPI mẫu'}</button>
      </div>
    </form>
  );
}