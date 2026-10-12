'use client';

import React, { useState } from 'react';
import { updatePickupReminderDaysAction } from '@/actions/admin';
import { toast } from 'sonner';
import { BellRing, Save, Loader2 } from 'lucide-react';

interface PickupReminderSettingsProps {
  initialDays: number;
}

export function PickupReminderSettings({ initialDays }: PickupReminderSettingsProps) {
  const [days, setDays] = useState(initialDays);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await updatePickupReminderDaysAction(days);
      if (res.success) {
        toast.success('Délai de relance mis à jour avec succès');
      } else {
        toast.error(res.error || 'Erreur de mise à jour');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
      <div className="flex items-center space-x-2 text-amber-400 border-b border-slate-800/80 pb-3">
        <BellRing className="w-4 h-4" />
        <h2 className="text-sm font-bold text-white">Délai de Relance Linge Prêt</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block text-slate-400 mb-1 font-semibold">
            Déclenchement du rappel automatique (jours après passage au statut PRÊTE)
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="w-32 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
            />
            <span className="text-slate-400 font-medium">jour(s)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Les commandes prêtes depuis au moins ce nombre de jours apparaîtront automatiquement dans la liste des relances à effectuer.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || days < 1 || days > 60}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Enregistrer la modification
        </button>
      </form>
    </section>
  );
}
