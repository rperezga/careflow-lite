import { Bell, HelpCircle, Search } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Badge, roleColor } from '../components/ui/Badge';

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Topbar() {
  const { user } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-6">
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Search patients or tasks…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
        />
      </div>

      <div className="ml-auto flex items-center gap-4">
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="Help">
          <HelpCircle className="h-5 w-5" />
        </button>
        {user && (
          <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
            <div className="text-right leading-tight">
              <div className="text-sm font-semibold text-slate-900">{user.name}</div>
              <Badge color={roleColor[user.role]} className="mt-0.5">
                {user.role}
              </Badge>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {initialsOf(user.name)}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
