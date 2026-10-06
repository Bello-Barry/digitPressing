'use client';

import React, { useState } from 'react';
import { updateOrganizationSettingsAction } from '@/actions/admin';
import { Building, Phone, Hash, Save, CheckCircle2, AlertCircle } from 'lucide-react';

interface OrganizationSettingsClientProps {
  organization: any;
  userRole: string;
}

export function OrganizationSettingsClient({ organization, userRole }: OrganizationSettingsClientProps) {
  const [name, setName] = useState(organization?.name || '');
  const [slug, setSlug] = useState(organization?.slug || '');
  const [phone1, setPhone1] = useState(organization?.phone_1 || '');
  const [phone2, setPhone2] = useState(organization?.phone_2 || '');
  const [address, setAddress] = useState(organization?.address || '');
  const [ticketPrefix, setTicketPrefix] = useState(organization?.ticket_prefix || 'LB');

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    if (!organization?.id) {
      setMessage({ type: 'error', text: 'Identifiant d\'organisation introuvable.' });
      setIsSaving(false);
      return;
    }

    const res = await updateOrganizationSettingsAction({
      orgId: organization.id,
      name,
      slug,
      phone_1: phone1,
      phone_2: phone2,
      address,
      ticket_prefix: ticketPrefix,
    });

    setIsSaving(false);

    if (res.success) {
      setMessage({ type: 'success', text: 'Paramètres mis à jour avec succès !' });
    } else {
      setMessage({ type: 'error', text: res.error || 'Erreur lors de la mise à jour.' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center space-x-2 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Informations Générales */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center pb-2 border-b border-slate-800">
          <Building className="w-4 h-4 mr-2 text-amber-400" />
          Informations de l'Établissement
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Nom du pressing</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Identifiant (Slug)</label>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Préfixe de ticket</label>
            <input
              type="text"
              required
              maxLength={6}
              value={ticketPrefix}
              onChange={(e) => setTicketPrefix(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono uppercase focus:outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-slate-500">Ex: LB donnera des tickets de forme LB-00001</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Devise officielle</label>
            <input
              type="text"
              disabled
              value="XAF (FCFA) - Congo (+242)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs font-mono"
            />
          </div>
        </div>
      </div>

      {/* Contacts & Adresse */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center pb-2 border-b border-slate-800">
          <Phone className="w-4 h-4 mr-2 text-amber-400" />
          Contacts WhatsApp & Adresse
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Téléphone Principal (WhatsApp)</label>
            <input
              type="text"
              required
              placeholder="061234567"
              value={phone1}
              onChange={(e) => setPhone1(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Téléphone Secondaire (optionnel)</label>
            <input
              type="text"
              placeholder="051234567"
              value={phone2}
              onChange={(e) => setPhone2(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="text-xs font-semibold text-slate-300">Adresse de l'établissement</label>
            <input
              type="text"
              placeholder="Brazzaville, Congo"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center shadow-lg shadow-amber-500/20 transition"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </div>
    </form>
  );
}
