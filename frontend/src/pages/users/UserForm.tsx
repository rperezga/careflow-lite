import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { ApiError, api } from '../../lib/api';
import { humanLabel } from '../../lib/domain';
import { ROLES } from '../../lib/types';
import type { AdminUser, Role } from '../../lib/types';

export function UserForm({
  user,
  onSaved,
  onCancel,
}: {
  user?: AdminUser;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? 'staff');
  const [active, setActive] = useState(user?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isEdit && user) {
        await api.patch(`/users/${user.id}`, { name, role, active });
      } else {
        await api.post('/users', { name, email, password, role });
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') {
        setError('That email is already in use.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Please check the fields and try again.');
      } else {
        setError('Could not save the user. Please try again.');
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
      <Field label="Name" required>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Email" required>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isEdit}
        />
      </Field>
      {!isEdit && (
        <Field label="Password" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
          />
        </Field>
      )}
      <Field label="Role">
        <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {humanLabel(r)}
            </option>
          ))}
        </Select>
      </Field>
      {isEdit && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
          />
          Active
        </label>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save user
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
