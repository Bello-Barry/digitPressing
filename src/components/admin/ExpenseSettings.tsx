'use client';

import React, { useState } from 'react';
import { updateCashierExpenseLimitAction, createExpenseCategoryAction, updateExpenseCategoryAction } from '@/actions/expenses';
import { DollarSign, Plus, Check, Loader2, Tag, Shield } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  kind: string;
  counts_in_result: boolean;
  owner_only: boolean;
  cashier_allowed: boolean;
  note_required: boolean;
  is_active: boolean;
}

interface ExpenseSettingsProps {
  initialLimit: number;
  categories: Category[];
  userRole: string;
}

const KIND_LABELS: Record<string, string> = {
  DAILY: 'Dépenses Courantes (Ration, Carburant, Consommables)',
  FIXED: 'Charges Fixes (Loyer, Salaires, Électricité)',
  TAX: 'Impôts et Taxes (Patente, Mairie)',
  TRANSFER: 'Mouvements de Trésorerie (Retraits, Banque)',
  OTHER: 'Autres Charges Exceptionnelles',
};

export function ExpenseSettings({ initialLimit, categories: initialCategories, userRole }: ExpenseSettingsProps) {
  const [limit, setLimit] = useState(initialLimit);
  const [savingLimit, setSavingLimit] = useState(false);
  const [limitMsg, setLimitMsg] = useState<{ success?: boolean; text?: string } | null>(null);

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatKind, setNewCatKind] = useState<'DAILY' | 'FIXED' | 'TAX' | 'TRANSFER' | 'OTHER'>('DAILY');
  const [newCashierAllowed, setNewCashierAllowed] = useState(false);
  const [newNoteRequired, setNewNoteRequired] = useState(false);
  const [newOwnerOnly, setNewOwnerOnly] = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const isOwner = userRole === 'OWNER';

  const handleSaveLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLimit(true);
    setLimitMsg(null);

    const res = await updateCashierExpenseLimitAction(limit);
    if (res.success) {
      setLimitMsg({ success: true, text: 'Plafond mis à jour avec succès.' });
    } else {
      setLimitMsg({ success: false, text: res.error || 'Erreur lors de la sauvegarde.' });
    }
    setSavingLimit(false);
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatError(null);
    setCreatingCat(true);

    const res = await createExpenseCategoryAction({
      name: newCatName,
      kind: newCatKind,
      cashierAllowed: newCashierAllowed,
      noteRequired: newNoteRequired,
      ownerOnly: newOwnerOnly,
    });

    if (res.success && res.category) {
      setCategories((prev) => [...prev, res.category as Category]);
      setShowAddModal(false);
      setNewCatName('');
      setNewCashierAllowed(false);
      setNewNoteRequired(false);
      setNewOwnerOnly(false);
    } else {
      setCatError(res.error || 'Échec de création de la catégorie.');
    }
    setCreatingCat(false);
  };

  const handleToggleActive = async (cat: Category) => {
    if (!isOwner) return;
    const updatedStatus = !cat.is_active;
    // Optimistic UI
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, is_active: updatedStatus } : c))
    );

    const res = await updateExpenseCategoryAction(cat.id, { isActive: updatedStatus });
    if (!res.success) {
      // Rollback
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, is_active: cat.is_active } : c))
      );
    }
  };

  const handleToggleCashierAllowed = async (cat: Category) => {
    if (!isOwner) return;
    const updated = !cat.cashier_allowed;
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, cashier_allowed: updated } : c))
    );
    const res = await updateExpenseCategoryAction(cat.id, { cashierAllowed: updated });
    if (!res.success) {
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, cashier_allowed: cat.cashier_allowed } : c))
      );
    }
  };

  const handleSaveRename = async (catId: string) => {
    if (!isOwner || !editingName.trim()) return;
    const res = await updateExpenseCategoryAction(catId, { name: editingName });
    if (res.success) {
      setCategories((prev) =>
        prev.map((c) => (c.id === catId ? { ...c, name: editingName.trim() } : c))
      );
      setEditingCatId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. SECTION PLAFOND DU CAISSIER (OWNER ONLY) */}
      {isOwner && (
        <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
          <div className="flex items-center space-x-2 text-amber-400 border-b border-slate-800/80 pb-3">
            <DollarSign className="w-4 h-4" />
            <h2 className="text-sm font-bold text-white">Plafond de Dépense du Caissier</h2>
          </div>

          <form onSubmit={handleSaveLimit} className="space-y-3">
            <p className="text-xs text-slate-400">
              Montant maximum en FCFA qu'un caissier (CASHIER) peut enregistrer directement depuis la caisse sans validation préalable du gérant.
            </p>

            <div className="flex items-center space-x-3 max-w-md">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full pl-3 pr-16 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">
                  FCFA
                </span>
              </div>

              <button
                type="submit"
                disabled={savingLimit}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center space-x-1.5 shrink-0"
              >
                {savingLimit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Enregistrer</span>
              </button>
            </div>

            {limitMsg && (
              <p className={`text-xs font-semibold ${limitMsg.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {limitMsg.text}
              </p>
            )}
          </form>
        </section>
      )}

      {/* 2. SECTION GESTION DES CATÉGORIES DE DÉPENSES (OWNER ONLY POUR LA MODIFICATION) */}
      <section className="p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2 text-amber-400">
            <Tag className="w-4 h-4" />
            <h2 className="text-sm font-bold text-white">Catégories de Dépenses</h2>
          </div>

          {isOwner && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/20 transition flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter une catégorie</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          {['DAILY', 'FIXED', 'TAX', 'TRANSFER', 'OTHER'].map((kind) => {
            const kindCats = categories.filter((c) => c.kind === kind);
            if (kindCats.length === 0) return null;

            return (
              <div key={kind} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400/90 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  {KIND_LABELS[kind] || kind}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {kindCats.map((cat) => (
                    <div
                      key={cat.id}
                      className={`p-3 rounded-xl border transition flex items-center justify-between ${
                        cat.is_active ? 'bg-slate-950 border-slate-800' : 'bg-slate-950/40 border-slate-800/40 opacity-60'
                      }`}
                    >
                      <div className="space-y-1 pr-2 min-w-0 flex-1">
                        {isOwner && editingCatId === cat.id ? (
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="px-2 py-1 bg-slate-900 border border-slate-700 text-white rounded text-xs w-full outline-none"
                            />
                            <button
                              onClick={() => handleSaveRename(cat.id)}
                              className="p-1 bg-amber-500 text-slate-950 rounded text-xs font-bold"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <p
                            onClick={() => {
                              if (isOwner) {
                                setEditingCatId(cat.id);
                                setEditingName(cat.name);
                              }
                            }}
                            className={`text-xs font-semibold text-white truncate ${isOwner ? 'hover:text-amber-400 cursor-pointer' : ''}`}
                            title={isOwner ? 'Cliquer pour renommer' : ''}
                          >
                            {cat.name}
                          </p>
                        )}

                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          {cat.owner_only && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center">
                              <Shield className="w-2.5 h-2.5 mr-0.5" /> Owner
                            </span>
                          )}
                          {cat.cashier_allowed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Caissier
                            </span>
                          )}
                          {cat.note_required && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              Note requise
                            </span>
                          )}
                        </div>
                      </div>

                      {isOwner && (
                        <div className="flex items-center space-x-2 shrink-0">
                          {/* Toggle Autorisé Caissier */}
                          {kind === 'DAILY' && !cat.owner_only && (
                            <button
                              onClick={() => handleToggleCashierAllowed(cat)}
                              title={cat.cashier_allowed ? 'Bloquer pour caissier' : 'Autoriser au caissier'}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                                cat.cashier_allowed
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {cat.cashier_allowed ? 'Caissier OK' : 'Caissier NON'}
                            </button>
                          )}

                          {/* Toggle Actif/Inactif */}
                          <button
                            onClick={() => handleToggleActive(cat)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                              cat.is_active
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {cat.is_active ? 'Actif' : 'Masqué'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* MODAL NOUVELLE CATÉGORIE (OWNER ONLY) */}
      {isOwner && showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center">
              <Tag className="w-4 h-4 mr-2 text-amber-400" />
              Ajouter une Catégorie de Dépense
            </h3>

            {catError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900/60 text-rose-300 text-xs font-semibold">
                {catError}
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Nom de la catégorie <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Produits d'entretien spécialisés"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Type de dépense <span className="text-rose-400">*</span>
                </label>
                <select
                  value={newCatKind}
                  onChange={(e) => setNewCatKind(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="DAILY">DAILY — Dépenses courantes</option>
                  <option value="FIXED">FIXED — Charges fixes (Loyer, Électricité)</option>
                  <option value="TAX">TAX — Taxes et impôts</option>
                  <option value="TRANSFER">TRANSFER — Mouvements de trésorerie (Retrait)</option>
                  <option value="OTHER">OTHER — Autres dépenses</option>
                </select>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-800">
                {newCatKind === 'DAILY' && (
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newCashierAllowed}
                      onChange={(e) => setNewCashierAllowed(e.target.checked)}
                      className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
                    />
                    <span>Autoriser la saisie par le caissier</span>
                  </label>
                )}

                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNoteRequired}
                    onChange={(e) => setNewNoteRequired(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Note explicative obligatoire lors de la saisie</span>
                </label>

                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newOwnerOnly}
                    onChange={(e) => setNewOwnerOnly(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Réservé exclusivement au Propriétaire (OWNER)</span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingCat}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center space-x-1.5"
                >
                  {creatingCat && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Créer la catégorie</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
