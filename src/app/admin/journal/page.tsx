'use client';

import React, { useEffect, useState } from 'react';
import { getAuditLogs, getAuditAuthors } from '@/actions/audit';
import { formatAuditAction, AuditLogEntry } from '@/lib/audit-formatter';
import {
  ShieldAlert,
  Clock,
  UserCheck,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  FileText,
  Lock,
} from 'lucide-react';

export default function AuditJournalClient() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [authors, setAuthors] = useState<{ id: string; name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Filtres
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [selectedObjectType, setSelectedObjectType] = useState<string>('');

  // Cartes dépliables
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Chargement initial
  useEffect(() => {
    loadAuthors();
    fetchLogs(true);
  }, [period, selectedAuthor, selectedObjectType]);

  const loadAuthors = async () => {
    try {
      const list = await getAuditAuthors();
      setAuthors(list);
    } catch (e) {
      console.error('Erreur chargement auteurs:', e);
    }
  };

  const fetchLogs = async (isReset = false) => {
    if (isReset) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await getAuditLogs({
        period,
        authorId: selectedAuthor || undefined,
        objectType: selectedObjectType || undefined,
        cursor: isReset ? undefined : nextCursor || undefined,
        limit: 20,
      });

      if (isReset) {
        setLogs(res.logs);
      } else {
        setLogs((prev) => [...prev, ...res.logs]);
      }

      setNextCursor(res.nextCursor);
      setHasNextPage(res.hasNextPage);
    } catch (err: any) {
      console.error('Erreur chargement journal:', err);
      setError(err.message || 'Impossible de charger le journal d\'audit.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (error && error.includes('Accès refusé')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-800 text-red-400 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Accès refusé</h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          Seuls le propriétaire (OWNER) et le gérant (MANAGER) sont autorisés à consulter le journal d'audit de l'établissement.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Journal d'audit
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Traçabilité immuable des activités et modifications de l'établissement.
          </p>
        </div>

        <button
          onClick={() => fetchLogs(true)}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-2 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Barre de Filtres */}
      <div className="bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Filtre Période */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Période
          </label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
          >
            <option value="today">Aujourd'hui</option>
            <option value="7days">7 derniers jours</option>
            <option value="30days">30 derniers jours</option>
            <option value="all">Tout l'historique</option>
          </select>
        </div>

        {/* Filtre Auteur */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Auteur / Utilisateur
          </label>
          <select
            value={selectedAuthor}
            onChange={(e) => setSelectedAuthor(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
          >
            <option value="">Tous les auteurs</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>

        {/* Filtre Type d'Objet */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Module / Élément
          </label>
          <select
            value={selectedObjectType}
            onChange={(e) => setSelectedObjectType(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-amber-500 outline-none"
          >
            <option value="">Tous les modules</option>
            <option value="orders">Commandes</option>
            <option value="payments">Paiements / Caisse</option>
            <option value="services">Services & Tarifs</option>
            <option value="service_costs">Coûts de revient (OWNER)</option>
            <option value="memberships">Personnel / Équipe</option>
            <option value="organizations">Paramètres</option>
          </select>
        </div>
      </div>

      {/* Liste des entrées */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900/50 rounded-2xl border border-slate-800/80">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
          <p className="text-xs text-slate-400 font-medium">Chargement du journal d'audit...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-xs font-medium">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center p-12 bg-slate-900/40 rounded-2xl border border-slate-800 text-slate-400">
          <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-sm font-semibold text-slate-300">Aucune activité enregistrée</p>
          <p className="text-xs text-slate-500 mt-1">
            Aucun événement ne correspond aux critères de recherche sélectionnés.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const formatted = formatAuditAction(log);
            const isExpanded = expandedId === log.id;
            const dateFormatted = new Date(log.created_at).toLocaleString('fr-FR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            const badgeStyles = {
              emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
              amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
              blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
              gray: 'bg-slate-800 text-slate-400 border-slate-700',
            }[formatted.badgeColor];

            return (
              <div
                key={log.id}
                className="bg-slate-900/90 rounded-xl border border-slate-800 overflow-hidden hover:border-slate-700 transition"
              >
                <div
                  onClick={() => toggleExpand(log.id)}
                  className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer select-none"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyles}`}>
                        {log.action}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-100">
                        {formatted.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">{formatted.description}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60 text-xs text-slate-400">
                    <div className="flex items-center space-x-1">
                      <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-medium text-slate-300">
                        {log.user_name}
                      </span>
                      {log.user_role && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {log.user_role}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1 text-slate-500 text-[11px]">
                        <Clock className="w-3 h-3" />
                        <span>{dateFormatted}</span>
                      </div>
                      <button className="p-1 rounded bg-slate-800 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Détail dépliable Avant / Après */}
                {isExpanded && (
                  <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800/80 text-xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {log.before && Object.keys(log.before).length > 0 && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block">
                            Valeur Avant
                          </span>
                          <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                            {JSON.stringify(log.before, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.after && Object.keys(log.after).length > 0 && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                            Valeur Après
                          </span>
                          <pre className="text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                            {JSON.stringify(log.after, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination : Charger plus */}
      {hasNextPage && !loading && (
        <div className="pt-2 text-center">
          <button
            onClick={() => fetchLogs(false)}
            disabled={loadingMore}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/20 transition flex items-center justify-center space-x-2 mx-auto"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Chargement...</span>
              </>
            ) : (
              <span>Charger plus d'entrées</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
