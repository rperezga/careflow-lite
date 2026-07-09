import { Activity, ClipboardList, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../lib/cn';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/patients', label: 'Patients', icon: Users, end: false },
  { to: '/care-tasks', label: 'Care Tasks', icon: ClipboardList, end: false },
  { to: '/users', label: 'Users', icon: ShieldCheck, end: false, adminOnly: true },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const items = navItems.filter((i) => !i.adminOnly || user?.role === 'admin');

  return (
    <aside className="flex h-screen w-64 flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-3 px-6 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
          <Activity className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <div className="text-base font-bold text-white">Careflow</div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Internal Tool
          </div>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
