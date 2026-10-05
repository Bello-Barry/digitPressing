import React from 'react';
import { createServerSupabaseClient, getServerUserMembership } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';
import { Shirt, Plus, Clock, Tag } from 'lucide-react';

export default async function AdminServicesPage() {
  const profile = await getServerUserMembership();
  if (!profile?.membership?.is_active) redirect('/admin/login');
  const orgId = profile.membership.organization_id;
  const db = await createServerSupabaseClient();
  const isManagement = profile.membership.role === 'OWNER' || profile.membership.role === 'MANAGER' || profile.isPlatformAdmin;

  const { data: services } = await db
    .from('services')
    .select('*')
    .eq('organization_id', orgId)
    .order('category')
    .order('price');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Shirt className="w-5 h-5 mr-2 text-amber-400" />
            Catalogue des Prestations ({services?.length || 0})
          </h1>
          <p className="text-xs text-slate-400">
            Grille tarifaire officielle de LB Pressing synchronisée avec le site public.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {services && services.length > 0 ? (
          services.map((s: any) => (
            <div
              key={s.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-white text-sm">{s.name}</h3>
                  <span className="font-mono font-bold text-amber-400 text-xs bg-amber-400/10 px-2 py-0.5 rounded-md">
                    {Number(s.price).toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
                {s.description && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.description}</p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="capitalize">{s.category || 'Vêtement'}</span>
                <span className="flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-slate-500" />
                  ~{s.estimated_days || 2}j
                </span>
                {isManagement && s.cost_price != null && (
                  <span className="text-[10px] text-slate-500 font-mono" title="Coût interne">
                    Coût: {Number(s.cost_price).toLocaleString('fr-FR')}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs">
            Aucune prestation enregistrée.
          </div>
        )}
      </div>
    </div>
  );
}
