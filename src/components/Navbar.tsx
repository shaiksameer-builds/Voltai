import Link from 'next/link';
import LogoutButton from './LogoutButton';
import { Sun } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/dashboard" className="flex-shrink-0 flex items-center">
              <Sun className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-slate-900">SolarSaver</span>
            </Link>
          </div>
          <div className="flex items-center">
            <LogoutButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
