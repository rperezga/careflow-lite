import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Drawer } from '../components/ui/Drawer';
import { Skeleton } from '../components/ui/Skeleton';
import { api } from '../lib/api';
import { humanLabel, patientStatusColor, riskColor } from '../lib/domain';
import type { Patient } from '../lib/types';
import { useApiData } from '../lib/useApi';
import { PatientForm } from './patients/PatientForm';

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'staff';
  const canDelete = user?.role === 'admin';

  const { data, loading, error, refetch } = useApiData<{ patient: Patient }>(
    `/patients/${id ?? ''}`,
  );
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    setDeleting(true);
    try {
      await api.del(`/patients/${id ?? ''}`);
      navigate('/patients');
    } finally {
      setDeleting(false);
    }
  }

  const patient = data?.patient;

  return (
    <div>
      <Link
        to="/patients"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </Link>

      {loading && (
        <Card className="p-6">
          <Skeleton className="h-40 w-full" />
        </Card>
      )}
      {error && !loading && (
        <Card className="p-6 text-sm text-red-700">Could not load this patient.</Card>
      )}

      {patient && (
        <>
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <Badge color={riskColor[patient.riskLevel]} dot>
                    {humanLabel(patient.riskLevel)} risk
                  </Badge>
                  <Badge color={patientStatusColor[patient.status]} dot>
                    {humanLabel(patient.status)}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                {canManage && (
                  <Button variant="secondary" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" /> Edit
                  </Button>
                )}
                {canDelete && (
                  <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                    <Trash2 className="h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Fact label="Member ID" value={patient.memberId} mono />
              <Fact label="Date of birth" value={patient.dateOfBirth || '—'} />
              <Fact label="Phone" value={patient.phone || '—'} />
              <Fact label="Email" value={patient.email || '—'} />
              <Fact
                label="Care manager"
                value={patient.primaryCareManager ? 'Assigned' : 'Unassigned'}
              />
              <Fact label="Updated" value={new Date(patient.updatedAt).toLocaleDateString()} />
            </dl>

            {patient.notes && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{patient.notes}</p>
              </div>
            )}
          </Card>

          <Card className="mt-6 p-6">
            <h2 className="text-base font-semibold text-slate-900">Care tasks</h2>
            <p className="mt-1 text-sm text-slate-500">
              This patient&apos;s tasks will appear here — coming in #11.
            </p>
          </Card>

          <Drawer open={editOpen} onClose={() => setEditOpen(false)} title="Edit patient">
            <PatientForm
              patient={patient}
              onSaved={() => {
                setEditOpen(false);
                refetch();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </Drawer>

          <ConfirmDialog
            open={confirmOpen}
            title="Delete patient?"
            loading={deleting}
            message={
              <>
                This permanently removes{' '}
                <span className="font-medium">
                  {patient.firstName} {patient.lastName}
                </span>
                . This cannot be undone.
              </>
            }
            onConfirm={onDelete}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      )}
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={
          mono ? 'mt-0.5 font-mono text-sm text-slate-800' : 'mt-0.5 text-sm text-slate-800'
        }
      >
        {value}
      </dd>
    </div>
  );
}
