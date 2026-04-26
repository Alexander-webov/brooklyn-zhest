import { Sidebar } from '@/components/Sidebar';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <div className="min-h-screen flex relative z-10">
      <Sidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
