import { Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, roleColor } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Drawer';
import { Select } from '../components/ui/Select';
import { Skeleton } from '../components/ui/Skeleton';
import { api } from '../lib/api';
import { humanLabel } from '../lib/domain';
import { ROLES } from '../lib/types';
import type { AdminUser } from '../lib/types';
import { useApiData } from '../lib/useApi';
import { PageHeader } from './PagePlaceholder';
import { UserForm } from './users/UserForm';

export default function UsersPage() {
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');

  const path = useMemo(() => {
    const p = new URLSearchParams();
    if (role) p.set('role', role);
    if (active) p.set('active', active);
    const q = p.toString();
    return q ? `/users?${q}` : '/users';
  }, [role, active]);

  const { data, loading, error, refetch } = useApiData<{ users: AdminUser[] }>(path);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(u: AdminUser) {
    setBusyId(u.id);
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      refetch();
    } finally {
      setBusyId(null);
    }
  }

  function onSaved() {
    setDrawerOpen(false);
    setEditing(null);
    refetch();
  }

  const users = data?.users ?? [];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage team members and their roles."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {humanLabel(r)}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            value={active}
            onChange={(e) => setActive(e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))}
            {!loading &&
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge color={roleColor[u.role]}>{humanLabel(u.role)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.active ? (
                      <Badge color="green" dot>
                        Active
                      </Badge>
                    ) : (
                      <Badge color="slate" dot>
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(u);
                          setDrawerOpen(true);
                        }}
                        aria-label="Edit"
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id}
                        onClick={() => void toggleActive(u)}
                        aria-label={u.active ? 'Deactivate' : 'Activate'}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      >
                        {u.active ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">No users found.</div>
        )}
        {error && !loading && <div className="p-6 text-sm text-red-700">Could not load users.</div>}
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit user' : 'Add user'}
      >
        <UserForm
          user={editing ?? undefined}
          onSaved={onSaved}
          onCancel={() => setDrawerOpen(false)}
        />
      </Drawer>
    </div>
  );
}
