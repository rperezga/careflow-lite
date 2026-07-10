import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Drawer } from '../components/ui/Drawer';
import { Input } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { api } from '../lib/api';
import { humanLabel, patientStatusColor, riskColor } from '../lib/domain';
import { timeAgo } from '../lib/time';
import type { Patient, PatientsResponse } from '../lib/types';
import { useApiData } from '../lib/useApi';
import { PageHeader } from './PagePlaceholder';
import { PatientForm } from './patients/PatientForm';

const LIMIT = 10;

export default function PatientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = user?.role === 'admin' || user?.role === 'staff';
  const canDelete = user?.role === 'admin';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  // Debounce the search box so we do not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const path = useMemo(() => {
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('limit', String(LIMIT));
    if (search.trim()) p.set('search', search.trim());
    if (risk) p.set('riskLevel', risk);
    if (status) p.set('status', status);
    return `/patients?${p.toString()}`;
  }, [page, search, risk, status]);

  const { data, loading, error, refetch } = useApiData<PatientsResponse>(path);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [toDelete, setToDelete] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);

  function onSaved() {
    setDrawerOpen(false);
    setEditing(null);
    refetch();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.del(`/patients/${toDelete.id}`);
      setToDelete(null);
      refetch();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Search, filter and manage the patient panel."
        action={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null);
                setDrawerOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> Add patient
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by name or member ID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Select
            aria-label="Filter by risk"
            value={risk}
            onChange={(e) => {
              setRisk(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Member ID</th>
              <th className="px-4 py-3">Risk</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3" colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              data?.patients.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer hover:bg-brand-50/50"
                  onClick={() => navigate(`/patients/${p.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {p.firstName} {p.lastName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.memberId}</td>
                  <td className="px-4 py-3">
                    <Badge color={riskColor[p.riskLevel]} dot>
                      {humanLabel(p.riskLevel)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={patientStatusColor[p.status]} dot>
                      {humanLabel(p.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{timeAgo(p.updatedAt)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(p);
                            setDrawerOpen(true);
                          }}
                          aria-label="Edit"
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setToDelete(p)}
                          aria-label="Delete"
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {!loading && data && data.patients.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            No patients match your filters.
          </div>
        )}
        {error && !loading && (
          <div className="p-6 text-sm text-red-700">Could not load patients.</div>
        )}
        {data && (
          <div className="border-t border-slate-100 px-2">
            <Pagination page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit patient' : 'Add patient'}
      >
        <PatientForm
          patient={editing ?? undefined}
          onSaved={onSaved}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete patient?"
        loading={deleting}
        message={
          <>
            This permanently removes{' '}
            <span className="font-medium">
              {toDelete?.firstName} {toDelete?.lastName}
            </span>
            . This cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
