import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-center">
      <p className="text-4xl font-bold text-slate-900">404</p>
      <p className="text-sm text-slate-500">Page not found.</p>
      <Link to="/" className="text-sm font-medium text-brand-700 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
