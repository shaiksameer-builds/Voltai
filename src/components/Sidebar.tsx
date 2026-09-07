'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Zap, 
  LayoutDashboard, 
  Sun, 
  UploadCloud, 
  BarChart3, 
  LogOut, 
  Menu, 
  X,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  userEmail?: string;
}

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Properties & Systems', href: '/dashboard', icon: Sun },
    { name: 'Upload CSV Data', href: '/dashboard#upload', icon: UploadCloud },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between bg-zinc-950 px-4 py-3 border-b border-zinc-800 text-white">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="bg-yellow-400 p-1.5 rounded-lg shadow-lg shadow-yellow-400/20 text-black">
            <Zap className="h-5 w-5 fill-black" />
          </div>
          <span className="text-xl font-bold tracking-wider text-white">
            VOLT<span className="text-yellow-400">AI</span>
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-zinc-400 hover:text-yellow-400 focus:outline-none"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar Backdrop for Mobile */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/80 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Sidebar Component */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-zinc-950 border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Header & Logo */}
        <div>
          <div className="p-6 border-b border-zinc-800/60 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-3 group">
              <div className="relative">
                <div className="absolute -inset-1 bg-yellow-400 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-300"></div>
                <div className="relative bg-zinc-900 border border-yellow-400/40 p-2 rounded-xl text-yellow-400 group-hover:bg-yellow-400 group-hover:text-black transition duration-300">
                  <Zap className="h-6 w-6 fill-current" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-wider text-white">
                  VOLT<span className="text-yellow-400">AI</span>
                </h1>
                <p className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 flex items-center gap-1">
                  <Sparkles className="h-2.5 w-2.5 text-yellow-400" /> Solar Analytics
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <div className="px-3 py-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider font-mono">
              Main Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-yellow-400 text-black shadow-lg shadow-yellow-400/20 font-semibold'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-black' : 'text-zinc-400 group-hover:text-yellow-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Account & Logout Footer */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/50">
          {userEmail && (
            <div className="px-3 py-2 mb-2 rounded-lg bg-zinc-900/60 border border-zinc-800/80">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">Signed in as</p>
              <p className="text-xs font-medium text-zinc-200 truncate">{userEmail}</p>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl font-medium text-sm text-red-400 hover:text-red-300 hover:bg-red-950/40 border border-transparent hover:border-red-900/40 transition-all duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
