'use client';

// =============================================================================
// PARAMÈTRES DE RÉMUNÉRATION DES LIVREURS (TÂCHE D1)
// Thème sombre admin, validation et toasts en français
// =============================================================================

import React, { useEffect, useState } from 'react';
import { getCourierPaySettingsAction, updateCourierPaySettingsAction } from '@/actions/missions';
import { useToast } from '@/hooks/use-toast';
import { Coins, Save, Loader2, Info } from 'lucide-react';

export function CourierPaySettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payCollection, setPayCollection] = useState<string>('');
  const [payDelivery, setPayDelivery] = useState<string>('');

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      const res = await getCourierPaySettingsAction();
      if (res.success) {
        setPayCollection(res.payCollection !== null && res.payCollection !== undefined ? String(res.payCollection) : '');
        setPayDelivery(res.payDelivery !== null && res.payDelivery !== undefined ? String(res.payDelivery) : '');
      } else if (res.error) {
        toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
      }
      setLoading(false);
    }
    loadSettings();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valCol = Number(payCollection);
    const valDel = Number(payDelivery);

    if (isNaN(valCol) || valCol < 0 || isNaN(valDel) || valDel < 0) {
      toast({
        title: 'Montants invalides',
        description: 'Veuillez saisir des montants positifs ou nuls en FCFA.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    const res = await updateCourierPaySettingsAction(valCol, valDel);
    setSubmitting(false);

    if (res.success) {
      toast({
        title: 'Paramètres mis à jour',
        description: 'Les montants de rémunération des livreurs ont été enregistrés.',
      });
    } else {
      toast({
        title: 'Erreur',
        description: res.error || 'Impossible d\'enregistrer les paramètres.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex justify-center items-center">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin mr-2" />
        <span className="text-slate-400 text-sm">Chargement de la rémunération livreurs...</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Rémunération des livreurs</h3>
          <p className="text-xs text-slate-400">
            Fixez le montant forfaitaire en FCFA attribué au livreur par mission exécutée.
          </p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start space-x-2 text-xs text-amber-300">
        <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          Une mission ne peut pas être créée tant que sa rémunération n&apos;est pas configurée.
          Le montant est copié dans chaque mission à sa création.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Rémunération Collecte (FCFA)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              placeholder="Ex: 1000"
              value={payCollection}
              onChange={(e) => setPayCollection(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Rémunération Livraison (FCFA)
            </label>
            <input
              type="number"
              min="0"
              step="50"
              placeholder="Ex: 1500"
              value={payDelivery}
              onChange={(e) => setPayDelivery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition"
              required
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold rounded-xl flex items-center space-x-2 transition disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Enregistrer la configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
}
