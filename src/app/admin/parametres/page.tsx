import React from 'react';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { requirePermission } from '@/lib/permissions-server';
import { redirect } from 'next/navigation';
import { AccessDenied } from '@/components/admin/AccessDenied';
import { Settings, Building2, MessageSquare, ArrowLeft } from 'lucide-react';
import { PickupReminderSettings } from '@/components/admin/PickupReminderSettings';
import { ExpenseSettings } from '@/components/admin/ExpenseSettings';
import { CourierPaySettings } from '@/components/admin/CourierPaySettings';

export default async function AdminSettingsPage() {
  const auth = await requirePermission('manage_organization_settings');

  if (!auth.authorized || !auth.profile?.membership?.is_active) {
    if (!auth.profile) {
      redirect('/admin/login');
    }
    return (
      <AccessDenied
        title="Accès restreint"
        message="La gestion des paramètres du pressing est strictement réservée au propriétaire (OWNER)."
      />
    );
  }

  const orgId = auth.profile.membership.organization_id;
  const userRole = auth.profile.membership.role;
  const db = await createServerSupabaseClient();

  // Charger les données de l'organisation, des modèles et des catégories de dépenses
  const [orgRes, templatesRes, catRes] = await Promise.all([
    db.from('organizations').select('*').eq('id', orgId).single(),
    db.from('message_templates').select('*').eq('organization_id', orgId).order('event_type'),
    db.from('expense_categories').select('*').eq('organization_id', orgId).order('sort_order'),
  ]);

  if (orgRes.error) {
    console.error('Erreur Supabase lors de la récupération des paramètres de l\'organisation:', orgRes.error);
  }
  if (templatesRes.error) {
    console.error('Erreur Supabase lors de la récupération des modèles de messages:', templatesRes.error);
  }

  const org = orgRes.data;
  const templates = templatesRes.data || [];
  const categories = catRes.data || [];
  const pickupDays = org?.pickup_reminder_days ?? 3;
  const cashierLimit = Number(org?.cashier_expense_limit ?? 10000);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Settings className="w-5 h-5 mr-2 text-amber-400" />
            Paramètres du Pressing
          </h1>
          <p className="text-xs text-slate-400">
            Configuration générale de l'établissement, informations d'en-tête, dépenses et notifications WhatsApp.
          </p>
        </div>

        <Link
          href="/admin"
          className="inline-flex items-center px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Retour au dashboard
        </Link>
      </div>

      {/* Configuration de la rémunération des livreurs */}
      <CourierPaySettings />

      {/* Configuration du délai de relance */}
      <PickupReminderSettings initialDays={pickupDays} />

      {/* Configuration du plafond caissier et des catégories de dépenses */}
      <ExpenseSettings initialLimit={cashierLimit} categories={categories} userRole={userRole} />

      {/* Identité de l'Établissement */}
      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex items-center space-x-2 text-amber-400 border-b border-slate-800/80 pb-3">
          <Building2 className="w-4 h-4" />
          <h2 className="text-sm font-bold text-white">Identité & Coordonnées</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Nom de l'établissement</label>
            <input
              type="text"
              readOnly
              value={org?.name || ''}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none cursor-not-allowed opacity-90"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Slug public (URL)</label>
            <input
              type="text"
              readOnly
              value={org?.slug || ''}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono focus:outline-none cursor-not-allowed opacity-90"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Téléphone Principal (WhatsApp)</label>
            <input
              type="text"
              readOnly
              value={org?.phone_1 || 'Non renseigné'}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none cursor-not-allowed opacity-90"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Téléphone Secondaire</label>
            <input
              type="text"
              readOnly
              value={org?.phone_2 || 'Non renseigné'}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none cursor-not-allowed opacity-90"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Devise & Unité Monétaire</label>
            <input
              type="text"
              readOnly
              value={org?.currency || 'FCFA'}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none cursor-not-allowed opacity-90"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Préfixe des Tickets</label>
            <input
              type="text"
              readOnly
              value={org?.ticket_prefix || 'LB'}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none cursor-not-allowed opacity-90"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-slate-400 mb-1 font-semibold">Adresse Physique</label>
            <input
              type="text"
              readOnly
              value={org?.address || 'Non renseignée'}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none cursor-not-allowed opacity-90"
            />
          </div>
        </div>
      </section>

      {/* Modèles de Messages / WhatsApp */}
      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex items-center space-x-2 text-amber-400 border-b border-slate-800/80 pb-3">
          <MessageSquare className="w-4 h-4" />
          <h2 className="text-sm font-bold text-white">Modèles de Notifications WhatsApp</h2>
        </div>

        {templates.length > 0 ? (
          <div className="space-y-3">
            {templates.map((tpl: any) => (
              <div key={tpl.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-amber-400 uppercase">
                    {tpl.event_type}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${tpl.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    {tpl.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  {tpl.template_body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 italic text-center py-4">
            Aucun modèle de notification configuré pour cette organisation.
          </p>
        )}
      </section>
    </div>
  );
}
