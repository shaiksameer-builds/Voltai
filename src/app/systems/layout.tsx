import { getSessionUser } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default async function SystemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col lg:flex-row">
      <Sidebar userEmail={user?.email} />
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
