import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, api } from '../../lib/api';
import type { Patient, PatientStatus, RiskLevel } from '../../lib/types';

export function PatientForm({
  patient,
  onSaved,
  onCancel,
}: {
  patient?: Patient;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(patient);
  const [firstName, setFirstName] = useState(patient?.firstName ?? '');
  const [lastName, setLastName] = useState(patient?.lastName ?? '');
  const [memberId, setMemberId] = useState(patient?.memberId ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(patient?.dateOfBirth ?? '');
  const [phone, setPhone] = useState(patient?.phone ?? '');
  const [email, setEmail] = useState(patient?.email ?? '');
  const [status, setStatus] = useState<PatientStatus>(patient?.status ?? 'active');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(patient?.riskLevel ?? 'low');
  const [notes, setNotes] = useState(patient?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {
      firstName,
      lastName,
      status,
      riskLevel,
      dateOfBirth: dateOfBirth || undefined,
      phone: phone || undefined,
      email: email || undefined,
      notes: notes || undefined,
    };
    try {
      if (isEdit && patient) {
        await api.patch(`/patients/${patient.id}`, payload);
      } else {
        await api.post('/patients', { ...payload, memberId });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'member_id_taken') {
        setError('That Member ID is already in use.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Please check the fields and try again.');
      } else {
        setError('Could not save the patient. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </Field>
        <Field label="Last name" required>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </Field>
      </div>

      <Field label="Member ID" required>
        <Input
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          required
          disabled={isEdit}
          placeholder="DEMO-10023"
        />
      </Field>

      <Field label="Date of birth">
        <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PatientStatus)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field label="Risk level">
          <Select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
        />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save patient
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
