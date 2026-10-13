'use client';

import React, { useState } from 'react';
import { recordExpenseAction, voidExpenseAction, getExpensesAction, getExpenseSummaryAction } from '@/actions/expenses';
import {
  Receipt,
  Plus,
  Filter,
  DollarSign,
  Calendar,
  X,
  Loader2,
  AlertTriangle,
  Check,
  Ban,
  TrendingUp,
  PieChart,
  Shield,
  FileText,
  Building,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  kind: string;
  counts_in_result: boolean;
  owner_only: boolean;
  cashier_allowed: boolean;
  note_required: boolean;
}

interface Expense {
  id: string;
  amount: number;
  expense_date: string;
  method: string;
  from_till: boolean;
  payee: string | null;
  reference: string | null;
  note: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  created_by: string | null;
  voided_at: string | null;
  void_reason: string | null;
  category?: Category;
}

interface ExpenseSummary {
  period: string;
  startDate: string;
  totalEncaissement: number;
  encaissementCash: number;
  encaissementMoMo: number;
  totalAllExpenses: number;
  cashExpensesFromTill: number;
  totalResultExpenses: number;
  netResult: number;
  categoryBreakdown: { name: string; kind: string; total: number; countsInResult: boolean }[];
}

interface ExpensesListClientProps {
  initialExpenses: Expense[];
  categories: Category[];
  cashierLimit: number;
  userRole: string;
  initialSummary?: ExpenseSummary | null;
}

const KIND_GROUP_LABELS: Record<string, string> = {
  DAILY: 'Dépenses Courantes (Ration, Carburant...)',
  FIXED: 'Charges Fixes (Loyer, Salaires, Électricité...)',
  TAX: 'Impôts et Taxes (Patente, Mairie...)',
  TRANSFER: 'Mouvements de Trésorerie (Retrait, Banque...)',
  OTHER: 'Autres Charges',
};

export function ExpensesListClient({
  initialExpenses,
  categories,
  cashierLimit,
  userRole,
  initialSummary,
}: ExpensesListClientProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'summary'>('list');

  // Filtres
  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'all'>('7days');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('');

  // Modal Nouvelle Dépense
  const [showAddModal, setShowAddModal] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState<'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'BANK' | 'OTHER'>('CASH');
  const [fromTill, setFromTill] = useState(userRole === 'CASHIER');
  const [payee, setPayee] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [savingExpense, setSavingExpense] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Annulation
  const [voidingExpenseId, setVoidingExpenseId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [submittingVoid, setSubmittingVoid] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Onglet Résumé (OWNER)
  const [summaryPeriod, setSummaryPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [summaryData, setSummaryData] = useState<ExpenseSummary | null>(initialSummary || null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const isOwner = userRole === 'OWNER';
  const isManager = userRole === 'MANAGER';
  const isCashier = userRole === 'CASHIER';

  // Catégories autorisées pour l'utilisateur en cours
  const availableCategories = categories.filter((cat) => {
    if (isCashier) return cat.cashier_allowed;
    if (isManager) return !cat.owner_only;
    return true; // OWNER voit tout
  });

  const selectedCategoryObj = availableCategories.find((c) => c.id === categoryId);

  // Actualiser la liste selon les filtres
  const handleApplyFilters = async (p = period, cat = selectedCategoryId, m = selectedMethod) => {
    setLoading(true);
    const res = await getExpensesAction({
      period: p,
      categoryId: cat || undefined,
      method: m || undefined,
    });
    if (res.success) {
      setExpenses(res.expenses as Expense[]);
    }
    setLoading(false);
  };

  // Recharger le résumé financier OWNER
  const handleLoadSummary = async (p: 'today' | 'week' | 'month') => {
    setLoadingSummary(true);
    setSummaryPeriod(p);
    const res = await getExpenseSummaryAction(p);
    if (res.success && res.summary) {
      setSummaryData(res.summary as ExpenseSummary);
    }
    setLoadingSummary(false);
  };

  // Saisie nouvelle dépense
  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setFormError('Saisissez un montant valide supérieur à 0 FCFA.');
      return;
    }

    if (!categoryId) {
      setFormError('Veuillez sélectionner une catégorie.');
      return;
    }

    if (isCashier && numAmount > cashierLimit) {
      setFormError(`Au-delà de ton plafond (${cashierLimit.toLocaleString('fr-FR')} FCFA) : demande au gérant.`);
      return;
    }

    if (selectedCategoryObj?.note_required && (!note || note.trim().length < 5)) {
      setFormError('Une note/explication de 5 caractères minimum est requise pour cette catégorie.');
      return;
    }

    setSavingExpense(true);

    const res = await recordExpenseAction({
      categoryId,
      amount: Math.round(numAmount),
      expenseDate,
      method,
      fromTill: method === 'CASH' ? (isCashier ? true : fromTill) : false,
      payee: payee.trim() || undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
      periodStart: periodStart || undefined,
      periodEnd: periodEnd || undefined,
    });

    if (res.success) {
      setShowAddModal(false);
      // Réinitialiser formulaire
      setCategoryId('');
      setAmount('');
      setPayee('');
      setReference('');
      setNote('');
      setPeriodStart('');
      setPeriodEnd('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
      // Rafraîchir la liste
      handleApplyFilters();
      if (isOwner) handleLoadSummary(summaryPeriod);
    } else {
      setFormError(res.error || 'Erreur lors de l\'enregistrement.');
    }

    setSavingExpense(false);
  };

  // Annulation dépense
  const handleConfirmVoid = async () => {
    if (!voidingExpenseId) return;
    setVoidError(null);

    if (!voidReason || voidReason.trim().length < 5) {
      setVoidError('Le motif d\'annulation doit comporter au moins 5 caractères.');
      return;
    }

    setSubmittingVoid(true);
    const res = await voidExpenseAction(voidingExpenseId, voidReason);

    if (res.success) {
      setVoidingExpenseId(null);
      setVoidReason('');
      handleApplyFilters();
      if (isOwner) handleLoadSummary(summaryPeriod);
    } else {
      setVoidError(res.error || 'Erreur lors de l\'annulation.');
    }
    setSubmittingVoid(false);
  };

  return (
    <div className="space-y-6">
      {/* Header avec bouton d'action et onglets Owner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Receipt className="w-6 h-6 mr-2 text-rose-400" />
            Dépenses & Charges
          </h1>
          <p className="text-xs text-slate-400">
            Journal comptable des sorties de caisse et charges du pressing.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {isOwner && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex space-x-1">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'list'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Journal Dépenses
              </button>
              <button
                onClick={() => {
                  setActiveTab('summary');
                  if (!summaryData) handleLoadSummary('month');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 ${
                  activeTab === 'summary'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                <span>Résumé Résultat</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setFormError(null);
              setShowAddModal(true);
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouvelle dépense</span>
          </button>
        </div>
      </div>

      {/* RAPPEL DU PLAFOND CAISSIER */}
      {isCashier && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center justify-between font-mono">
          <span>Plafond autorisé par dépense :</span>
          <span className="font-bold text-white text-sm">{cashierLimit.toLocaleString('fr-FR')} FCFA</span>
        </div>
      )}

      {/* CONTENU ONGLET 1 : LISTE ET FILTRES */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* Barre de Filtres */}
          <div className="bg-slate-900/90 p-3 sm:p-4 rounded-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Période
              </label>
              <select
                value={period}
                onChange={(e) => {
                  const p = e.target.value as any;
                  setPeriod(p);
                  handleApplyFilters(p, selectedCategoryId, selectedMethod);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
              >
                <option value="today">Aujourd'hui</option>
                <option value="7days">7 derniers jours</option>
                <option value="month">Ce mois-ci</option>
                <option value="all">Tout l'historique</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Catégorie
              </label>
              <select
                value={selectedCategoryId}
                onChange={(e) => {
                  const cat = e.target.value;
                  setSelectedCategoryId(cat);
                  handleApplyFilters(period, cat, selectedMethod);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
              >
                <option value="">Toutes les catégories</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Mode de paiement
              </label>
              <select
                value={selectedMethod}
                onChange={(e) => {
                  const m = e.target.value;
                  setSelectedMethod(m);
                  handleApplyFilters(period, selectedCategoryId, m);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
              >
                <option value="">Tous les modes</option>
                <option value="CASH">Espèces (CASH)</option>
                <option value="MTN_MOMO">MTN Mobile Money</option>
                <option value="AIRTEL_MONEY">Airtel Money</option>
                <option value="BANK">Virement / Banque</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
          </div>

          {/* VUE MOBILE (Cartes) */}
          <div className="md:hidden space-y-3">
            {loading ? (
              <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500 mb-2" />
                <p className="text-xs text-slate-400">Chargement des dépenses...</p>
              </div>
            ) : expenses.length > 0 ? (
              expenses.map((exp) => {
                const cat = Array.isArray(exp.category) ? exp.category[0] : exp.category;
                const isVoided = Boolean(exp.voided_at);

                return (
                  <div
                    key={exp.id}
                    className={`p-4 rounded-2xl border space-y-2.5 shadow-md transition ${
                      isVoided
                        ? 'bg-slate-950/60 border-slate-900 opacity-60 line-through'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {cat?.name || 'Catégorie inconnue'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(exp.expense_date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className={`font-mono font-bold text-base ${isVoided ? 'text-slate-500' : 'text-rose-400'}`}>
                          -{Number(exp.amount).toLocaleString('fr-FR')} FCFA
                        </p>
                        <div className="flex items-center justify-end space-x-1 mt-0.5">
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300">
                            {exp.method}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              exp.from_till
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {exp.from_till ? 'Caisse' : 'Hors Caisse'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {(exp.payee || exp.note) && (
                      <div className="text-xs text-slate-300 pt-1 border-t border-slate-800/80 space-y-0.5">
                        {exp.payee && <p><span className="text-slate-500">Bénéficiaire :</span> {exp.payee}</p>}
                        {exp.note && <p><span className="text-slate-500">Note :</span> {exp.note}</p>}
                      </div>
                    )}

                    {isVoided && exp.void_reason && (
                      <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-[11px] space-y-0.5 no-underline">
                        <p className="font-bold flex items-center">
                          <Ban className="w-3 h-3 mr-1 text-rose-400" />
                          Dépense annulée
                        </p>
                        <p className="italic">Motif : {exp.void_reason}</p>
                      </div>
                    )}

                    {!isVoided && (isOwner || (isManager && !cat?.owner_only)) && (
                      <div className="pt-2 border-t border-slate-800 flex justify-end">
                        <button
                          onClick={() => {
                            setVoidError(null);
                            setVoidReason('');
                            setVoidingExpenseId(exp.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-900/80 text-rose-400 border border-rose-900/50 text-[10px] font-bold transition flex items-center"
                        >
                          <Ban className="w-3 h-3 mr-1" />
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                Aucune dépense enregistrée pour les critères sélectionnés.
              </div>
            )}
          </div>

          {/* VUE DESKTOP (Tableau) */}
          <div className="hidden md:block rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold bg-slate-950/40">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Catégorie</th>
                  <th className="py-3.5 px-4">Origine</th>
                  <th className="py-3.5 px-4">Bénéficiaire & Note</th>
                  <th className="py-3.5 px-4 text-right">Montant</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-500 mb-1" />
                      Chargement des dépenses...
                    </td>
                  </tr>
                ) : expenses.length > 0 ? (
                  expenses.map((exp) => {
                    const cat = Array.isArray(exp.category) ? exp.category[0] : exp.category;
                    const isVoided = Boolean(exp.voided_at);

                    return (
                      <tr
                        key={exp.id}
                        className={`hover:bg-slate-800/40 transition ${isVoided ? 'opacity-50 bg-slate-950/40' : ''}`}
                      >
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {new Date(exp.expense_date).toLocaleDateString('fr-FR')}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`font-semibold ${isVoided ? 'line-through text-slate-500' : 'text-white'}`}>
                            {cat?.name || 'Inconnue'}
                          </span>
                          <span className="block text-[10px] text-slate-500 uppercase">{cat?.kind}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                              {exp.method}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                exp.from_till
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              }`}
                            >
                              {exp.from_till ? 'Caisse' : 'Hors Caisse'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-300">
                          {exp.payee && <span className="font-semibold">{exp.payee} — </span>}
                          <span>{exp.note || '—'}</span>
                          {isVoided && exp.void_reason && (
                            <span className="block text-[10px] text-rose-400 italic mt-0.5">
                              Annulée : {exp.void_reason}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-400 text-sm">
                          <span className={isVoided ? 'line-through text-slate-500' : ''}>
                            -{Number(exp.amount).toLocaleString('fr-FR')} FCFA
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {!isVoided && (isOwner || (isManager && !cat?.owner_only)) ? (
                            <button
                              onClick={() => {
                                setVoidError(null);
                                setVoidReason('');
                                setVoidingExpenseId(exp.id);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/80 text-rose-400 border border-rose-900/50 text-[10px] font-bold transition inline-flex items-center"
                            >
                              <Ban className="w-3 h-3 mr-1" />
                              Annuler
                            </button>
                          ) : isVoided ? (
                            <span className="text-[10px] text-rose-500 font-bold">Annulée</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Aucune dépense enregistrée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 2 : RÉSUMÉ FINANCIER & RÉSULTAT (OWNER ONLY) */}
      {activeTab === 'summary' && isOwner && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-emerald-400" />
                Résultat d'Exploitation (Base Caisse)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculé strictement sur les encaissements réels et dépenses d'exploitation (hors mouvements de trésorerie).
              </p>
            </div>

            <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleLoadSummary(p)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition ${
                    summaryPeriod === p ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p === 'today' ? 'Aujourd\'hui' : p === 'week' ? 'Cette Semaine' : 'Ce Mois'}
                </button>
              ))}
            </div>
          </div>

          {loadingSummary ? (
            <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs text-slate-400">Calcul du résultat d'exploitation...</p>
            </div>
          ) : summaryData ? (
            <div className="space-y-6">
              {/* Cartes financières */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">1. Encaissements (CA)</p>
                  <p className="text-2xl font-black font-mono text-emerald-400">
                    +{summaryData.totalEncaissement.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Espèces : {summaryData.encaissementCash.toLocaleString('fr-FR')} | MoMo : {summaryData.encaissementMoMo.toLocaleString('fr-FR')}
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase">2. Dépenses d'Exploitation</p>
                  <p className="text-2xl font-black font-mono text-rose-400">
                    -{summaryData.totalResultExpenses.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Dont sorties caisse : {summaryData.cashExpensesFromTill.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-1 shadow-lg shadow-amber-500/5">
                  <p className="text-xs font-bold text-amber-400 uppercase">3. RÉSULTAT NET (Base Caisse)</p>
                  <p className={`text-2xl font-black font-mono ${summaryData.netResult >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {summaryData.netResult.toLocaleString('fr-FR')} FCFA
                  </p>
                  <p className="text-[11px] text-slate-400 font-medium">
                    = Encaissements − Dépenses
                  </p>
                </div>
              </div>

              {/* Ventilation des charges par catégorie */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center">
                  <PieChart className="w-4 h-4 mr-2 text-amber-400" />
                  Ventilation des Dépenses par Catégorie
                </h3>

                {summaryData.categoryBreakdown.length > 0 ? (
                  <div className="space-y-2">
                    {summaryData.categoryBreakdown.map((item, idx) => {
                      const pct = summaryData.totalAllExpenses > 0
                        ? Math.round((item.total / summaryData.totalAllExpenses) * 100)
                        : 0;

                      return (
                        <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{item.name}</span>
                            <span className="font-mono font-bold text-rose-400">
                              {item.total.toLocaleString('fr-FR')} FCFA ({pct} %)
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-4 text-center">
                    Aucune dépense enregistrée sur cette période.
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* MODAL 1 : NOUVELLE DÉPENSE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-lg space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center">
                <Plus className="w-5 h-5 mr-2 text-amber-400" />
                Enregistrer une Dépense
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900/60 text-rose-300 text-xs font-semibold flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRecordExpense} className="space-y-4 text-xs">
              {/* Choix de Catégorie Groupé */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Catégorie de dépense <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Sélectionnez une catégorie --</option>
                  {['DAILY', 'FIXED', 'TAX', 'TRANSFER', 'OTHER'].map((kind) => {
                    const kindCats = availableCategories.filter((c) => c.kind === kind);
                    if (kindCats.length === 0) return null;

                    return (
                      <optgroup key={kind} label={KIND_GROUP_LABELS[kind] || kind}>
                        {kindCats.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.note_required ? '(*note requise)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              {/* Montant FCFA */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Montant en FCFA (Entier sans décimales) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    placeholder="Ex: 5000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="w-full pl-3 pr-16 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-500 font-mono">FCFA</span>
                </div>

                {isCashier && (
                  <p className="text-[11px] text-amber-400 mt-1 font-mono">
                    Plafond autorisé : {cashierLimit.toLocaleString('fr-FR')} FCFA
                  </p>
                )}
              </div>

              {/* Date & Mode de paiement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Date de la dépense <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    min={isCashier ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined}
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">
                    Mode de paiement <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={method}
                    onChange={(e) => {
                      const m = e.target.value as any;
                      setMethod(m);
                      if (m !== 'CASH') setFromTill(false);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="CASH">Espèces (CASH)</option>
                    <option value="MTN_MOMO">MTN Mobile Money</option>
                    <option value="AIRTEL_MONEY">Airtel Money</option>
                    <option value="BANK">Virement / Banque</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              </div>

              {/* Interrupteur Payé depuis la caisse */}
              {method === 'CASH' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">Payé avec l'argent de la caisse</span>
                    <span className="text-[10px] text-slate-400">Diminue le montant d'espèces attendu lors de la clôture</span>
                  </div>

                  <input
                    type="checkbox"
                    disabled={isCashier}
                    checked={isCashier ? true : fromTill}
                    onChange={(e) => setFromTill(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-500"
                  />
                </div>
              )}

              {/* Bénéficiaire & Référence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Bénéficiaire (Optionnel)</label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ex: Station Total, Employé X"
                    value={payee}
                    onChange={(e) => setPayee(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Référence / Reçu (Optionnel)</label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ex: Facture N° 1042"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Note / Explication */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Note / Motif {selectedCategoryObj?.note_required && <span className="text-rose-400">* (Obligatoire)</span>}
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  placeholder={selectedCategoryObj?.note_required ? 'Explication détaillée obligatoire...' : 'Description optionnelle...'}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Période Début / Fin pour FIXED et TAX */}
              {(selectedCategoryObj?.kind === 'FIXED' || selectedCategoryObj?.kind === 'TAX') && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="font-semibold text-amber-400 block text-[11px]">
                    Période couverte par cette charge (ex: Facture électricité bimestrielle)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-500 text-[10px]">Période début</label>
                      <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-[10px]">Période fin</label>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Boutons d'action */}
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
                  disabled={savingExpense}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center space-x-1.5"
                >
                  {savingExpense && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Valider la dépense</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2 : ANNULATION D'UNE DÉPENSE */}
      {voidingExpenseId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center">
              <Ban className="w-5 h-5 mr-2 text-rose-400" />
              Annuler la Dépense
            </h3>

            <p className="text-xs text-slate-400">
              Cette action enregistre une annulation immuable dans le journal d'audit. La ligne ne sera pas supprimée mais marquée comme annulée.
            </p>

            {voidError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-900/60 text-rose-300 text-xs font-semibold">
                {voidError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">
                  Motif d'annulation <span className="text-rose-400">* (au moins 5 caractères)</span>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Ex: Erreur de saisie de montant, doublon d'écriture..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setVoidingExpenseId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  disabled={submittingVoid}
                  onClick={handleConfirmVoid}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center space-x-1.5"
                >
                  {submittingVoid && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmer l'annulation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
