import React from 'react';
import { AdminNavbar } from '@/components/admin/AdminNavbar';

export const metadata = {
  title: 'LB Pressing Admin | Équipe & Staff',
  description: 'Gestion de l\'équipe et des membres du personnel LB Pressing.',
};

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <AdminNavbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
