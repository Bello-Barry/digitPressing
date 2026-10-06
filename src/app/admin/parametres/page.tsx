import React from 'react';
import { getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { OrganizationSettingsClient } from '@/components/admin/OrganizationSettingsClient';
import { Settings } from 'lucide-react';

export default async function AdminParametresPage() {
  const profile = await getServerUserMembership();

  if (!profile?.membership?.is_active) {
    redirect('/admin/login');
  }

  // Seuls les rôles autorisés (OWNER, MANAGER) ont accès aux paramètres.
  if (profile.membership.role !== 'OWNER' && profile.membership.role !== 'MANAGER') {
    return (
      <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-3">
        <h1 className="text-xl font-bold text-red-400">Accès Refusé (403)</h1>
        <p className="text-xs text-slate-400">
          Vous n'avez pas les privilèges nécessaires pour accéder à la configuration de l'établissement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Settings className="w-5 h-5 mr-2 text-amber-400" />
            Paramètres de l'Établissement
          </h1>
          <p className="text-xs text-slate-400">
            Configurez les informations officielles de {profile.organization?.name || 'LB Pressing'}.
          </p>
        </div>
      </div>

      <OrganizationSettingsClient
        organization={profile.organization}
        userRole={profile.membership.role}
      />
    </div>
  );
}
