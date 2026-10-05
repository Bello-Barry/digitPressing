'use client';

// =============================================================================
// NAVBAR ADMINISTRATION - DIGIT PRESSING
// Navigation responsive mobile-first, rôle utilisateur, déconnexion
// =============================================================================

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getAdminMembershipAction, adminSignOutAction } from '@/actions/auth';
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Shirt,
  DollarSign,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';

export function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{
    email?: string;
    role?: string;
    orgName?: string;
  } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const data = await getAdminMembershipAction();
      if (data) {
        setProfile({
          email: data.user.email,
          role: data.membership?.role || (data.isPlatformAdmin ? 'ADMIN' : 'USER'),
          orgName: data.organization?.name || 'LB Pressing',
        });
      }
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    try {
      await adminSignOutAction();
      router.push('/admin/login');
    } catch (e) {
      console.error('Erreur déconnexion:', e);
    }
  };

  // Ne pas afficher la navbar sur la page de login
  if (pathname === '/admin/login') {
    return null;
  }

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/commandes', label: 'Commandes', icon: ShoppingBag },
    { href: '/admin/clients', label: 'Clients', icon: Users },
    { href: '/admin/services', label: 'Services', icon: Shirt },
    { href: '/admin/paiements', label: 'Caisse', icon: DollarSign },
  ];
  const visibleNavLinks = profile?.role === 'DELIVERY'
    ? navLinks.filter((link) => link.href === '/admin' || link.href === '/admin/commandes')
    : navLinks;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo & Org Badge */}
        <div className="flex items-center space-x-3">
          <Link href="/admin" className="flex items-center space-x-2">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black flex items-center justify-center text-sm shadow-md shadow-amber-500/20">
              LB
            </span>
            <span className="font-extrabold text-white text-base tracking-tight">
              {profile?.orgName || 'LB Pressing'}
            </span>
          </Link>

          {profile?.role && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Shield className="w-3 h-3 mr-1" />
              {profile.role}
            </span>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {visibleNavLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User profile & Déconnexion Desktop */}
        <div className="hidden sm:flex items-center space-x-3">
          {profile?.email && (
            <span className="text-xs text-slate-400 font-mono truncate max-w-[150px]">
              {profile.email}
            </span>
          )}

          <button
            onClick={handleLogout}
            title="Se déconnecter"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-400 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile menu toggle button */}
        <div className="md:hidden flex items-center space-x-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-800 text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 space-y-2">
          {profile?.role && (
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 text-xs">
              <span className="text-slate-400 truncate">{profile.email}</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-bold text-[10px]">
                {profile.role}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {visibleNavLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800/60">
            <button
              onClick={handleLogout}
              className="w-full py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-950 text-red-400 text-xs font-semibold flex items-center justify-center space-x-2 transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
