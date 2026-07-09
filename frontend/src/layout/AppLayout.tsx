import { Outlet } from 'react-router-dom';
import { DEMO_DISCLAIMER } from '../lib/types';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
        <footer className="flex shrink-0 items-center justify-between border-t border-slate-200 bg-white px-6 py-2 text-xs text-slate-500">
          <span>Careflow · demo</span>
          <span>{DEMO_DISCLAIMER}</span>
        </footer>
      </div>
    </div>
  );
}
