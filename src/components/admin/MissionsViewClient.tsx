'use client';

// =============================================================================
// INTERFACE MISSIONS DE LIVRAISON ET COLLECTE (TÂCHE D1)
// Mobile-first, français, thème sombre admin, rafraîchissement & toasts
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  listMissionsAction,
  listOpenMissionsAction,
  acceptMissionAction,
  declineMissionAction,
  reassignMissionAction,
  cancelMissionAction,
  advanceMissionAction,
  failMissionAction,
  getMissionDetailsAction,
  getActiveCouriersAction,
  MissionItem,
} from '@/actions/missions';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import { useToast } from '@/hooks/use-toast';
import {
  Truck,
  PackageCheck,
  Clock,
  Phone,
  MessageSquare,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  XCircle,
  UserCheck,
  RefreshCw,
  Loader2,
  ChevronRight,
  Filter,
  Coins,
  FileText,
} from 'lucide-react';

const FAIL_REASONS = [
  'Client absent',
  'Adresse incorrecte',
  'Client injoignable',
  'Refus du client',
  'Autre (préciser dans la note)',
];

export function MissionsViewClient() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Données
  const [userRole, setUserRole] = useState<string>('DELIVERY');
  const [userId, setUserId] = useState<string>('');
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const [openMissions, setOpenMissions] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<{ id: string; name: string }[]>([]);

  // Onglets pour livreur
  const [courierTab, setCourierTab] = useState<'DISPONIBLES' | 'MES_MISSIONS'>('DISPONIBLES');

  // Filtre statut pour gestionnaires
  const [statusFilter, setStatusFilter] = useState<string>('TOUTES');
  const [courierFilter, setCourierFilter] = useState<string>('TOUS');

  // Détails confidentiels d'une mission sélectionnée
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [missionDetails, setMissionDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modales
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectItemCount, setCollectItemCount] = useState<number>(1);

  const [failModalOpen, setFailModalOpen] = useState(false);
  const [failReasonSelect, setFailReasonSelect] = useState(FAIL_REASONS[0]);
  const [failReasonNote, setFailReasonNote] = useState('');

  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState('');

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [activeActionMissionId, setActiveActionMissionId] = useState<string | null>(null);

  // Formateur FCFA
  const formatMoney = (amount: number) => {
    return `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;
  };

  // Chargement des données
  const loadData = useCallback(async () => {
    setRefreshing(true);
    const [listRes, openRes, courRes] = await Promise.all([
      listMissionsAction(),
      listOpenMissionsAction(),
      getActiveCouriersAction(),
    ]);

    if (listRes.success && listRes.missions) {
      setMissions(listRes.missions);
      if (listRes.userRole) setUserRole(listRes.userRole);
      if (listRes.userId) setUserId(listRes.userId);
    } else if (listRes.error) {
      toast({ title: 'Erreur', description: listRes.error, variant: 'destructive' });
    }

    if (openRes.success && openRes.openMissions) {
      setOpenMissions(openRes.openMissions);
    }

    if (courRes.success && courRes.couriers) {
      setCouriers(courRes.couriers);
    }

    setLoading(false);
    setRefreshing(false);
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Chargement des détails d'une mission
  const handleSelectMission = async (missionId: string) => {
    if (selectedMissionId === missionId) {
      setSelectedMissionId(null);
      setMissionDetails(null);
      return;
    }

    setSelectedMissionId(missionId);
    setLoadingDetails(true);
    const res = await getMissionDetailsAction(missionId);
    setLoadingDetails(false);

    if (res.success && res.details) {
      setMissionDetails(res.details);
    } else {
      toast({
        title: 'Erreur',
        description: res.error || 'Impossible d\'accéder aux détails de la mission.',
        variant: 'destructive',
      });
      setSelectedMissionId(null);
      setMissionDetails(null);
    }
  };

  // Acceptation de mission
  const handleAccept = async (missionId: string) => {
    setSubmitting(true);
    const res = await acceptMissionAction(missionId);
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Mission acceptée', description: 'Consultez vos missions en cours pour commencer le trajet.' });
      loadData();
      handleSelectMission(missionId);
      setCourierTab('MES_MISSIONS');
    } else {
      toast({ title: 'Erreur', description: res.error || 'Impossible d\'accepter la mission.', variant: 'destructive' });
    }
  };

  // Avancement de statut
  const handleAdvance = async (missionId: string, nextStatus: string) => {
    if (nextStatus === 'COLLECTED') {
      setActiveActionMissionId(missionId);
      setCollectItemCount(1);
      setCollectModalOpen(true);
      return;
    }

    setSubmitting(true);
    const res = await advanceMissionAction(missionId, nextStatus);
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Étape mise à jour', description: 'La mission est passée à l\'étape suivante.' });
      loadData();
      if (selectedMissionId === missionId) {
        handleSelectMission(missionId);
      }
    } else {
      toast({ title: 'Erreur', description: res.error || 'Échec de la transition.', variant: 'destructive' });
    }
  };

  // Validation de la collecte avec nombre d'articles
  const handleConfirmCollect = async () => {
    if (!activeActionMissionId) return;
    setSubmitting(true);
    const res = await advanceMissionAction(activeActionMissionId, 'COLLECTED', collectItemCount);
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Collecte confirmée', description: `${collectItemCount} pièce(s) enregistrée(s).` });
      setCollectModalOpen(false);
      loadData();
      handleSelectMission(activeActionMissionId);
    } else {
      toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
    }
  };

  // Signalement d'échec
  const handleConfirmFail = async () => {
    if (!activeActionMissionId) return;
    const fullReason = failReasonSelect === 'Autre (préciser dans la note)'
      ? failReasonNote.trim() || 'Échec signalé'
      : failReasonNote.trim() ? `${failReasonSelect} : ${failReasonNote.trim()}` : failReasonSelect;

    setSubmitting(true);
    const res = await failMissionAction(activeActionMissionId, fullReason);
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Échec enregistré', description: 'Le statut de la mission a été mis à jour.' });
      setFailModalOpen(false);
      setFailReasonNote('');
      loadData();
      if (selectedMissionId === activeActionMissionId) {
        handleSelectMission(activeActionMissionId);
      }
    } else {
      toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
    }
  };

  // Réattribution / Attribution par la gestion
  const handleConfirmReassign = async () => {
    if (!activeActionMissionId) return;
    setSubmitting(true);
    const res = await reassignMissionAction(
      activeActionMissionId,
      selectedCourierId || null,
      reassignReason.trim()
    );
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Mission mise à jour', description: 'Attribution/réattribution enregistrée.' });
      setReassignModalOpen(false);
      setReassignReason('');
      loadData();
    } else {
      toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
    }
  };

  // Annulation par la gestion
  const handleConfirmCancel = async () => {
    if (!activeActionMissionId) return;
    setSubmitting(true);
    const res = await cancelMissionAction(activeActionMissionId, cancelReason.trim());
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Mission annulée', description: 'La mission a été marquée comme annulée.' });
      setCancelModalOpen(false);
      setCancelReason('');
      loadData();
    } else {
      toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <p className="text-sm text-slate-400">Chargement des missions...</p>
      </div>
    );
  }

  // Filtrage pour gestionnaires
  const filteredMissions = missions.filter((m) => {
    if (courierFilter !== 'TOUS' && m.assigned_to !== courierFilter) return false;
    if (statusFilter === 'TOUTES') return true;
    if (statusFilter === 'OUVERTES') return m.status === 'OPEN' || m.status === 'ASSIGNED';
    if (statusFilter === 'EN_COURS') return ['ACCEPTED', 'EN_ROUTE', 'AT_CUSTOMER', 'COLLECTED', 'IN_TRANSIT'].includes(m.status);
    if (statusFilter === 'AT_SHOP') return m.status === 'AT_SHOP';
    if (statusFilter === 'CLOTUREES') return ['FAILED', 'CANCELLED'].includes(m.status);
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* En-tête de page */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Truck className="w-6 h-6 mr-2 text-amber-400" />
            Missions & Tournées
          </h1>
          <p className="text-xs text-slate-400">
            {userRole === 'DELIVERY'
              ? 'Missions de collecte et de livraison disponibles'
              : 'Gestion et suivi des missions de l\'établissement'}
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={refreshing}
          className="p-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-xl transition flex items-center space-x-1 text-xs"
          title="Actualiser"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {/* VUE LIVREUR (DELIVERY) */}
      {userRole === 'DELIVERY' && (
        <div className="space-y-4">
          {/* Onglets Livreur */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => setCourierTab('DISPONIBLES')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 ${
                courierTab === 'DISPONIBLES'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span>Disponibles ({openMissions.length})</span>
            </button>

            <button
              onClick={() => setCourierTab('MES_MISSIONS')}
              className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-2 ${
                courierTab === 'MES_MISSIONS'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PackageCheck className="w-4 h-4 shrink-0" />
              <span>Mes missions ({missions.length})</span>
            </button>
          </div>

          {/* Onglet DISPONIBLES (Données anonymisées sans adresse ni téléphone) */}
          {courierTab === 'DISPONIBLES' && (
            <div className="space-y-3">
              {openMissions.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <Truck className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">Aucune mission disponible pour l&apos;instant.</p>
                  <p className="text-xs text-slate-500">
                    Les nouvelles missions de collecte et de livraison apparaîtront ici.
                  </p>
                </div>
              ) : (
                openMissions.map((m) => (
                  <div
                    key={m.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 space-y-3 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                          m.kind === 'COLLECTION'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {m.kind === 'COLLECTION' ? 'Collecte' : 'Livraison'}
                      </span>

                      <span className="text-sm font-black text-amber-400 font-mono">
                        {formatMoney(m.pay_amount)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-slate-300">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 text-amber-400 shrink-0" />
                        <span className="font-semibold">{m.zone_label}</span>
                      </div>

                      <div className="flex items-center text-[11px] text-slate-500">
                        <Clock className="w-3 h-3 mr-1 shrink-0" />
                        <span>{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAccept(m.id)}
                      disabled={submitting}
                      className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <span>Accepter la mission</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Onglet MES MISSIONS */}
          {courierTab === 'MES_MISSIONS' && (
            <div className="space-y-3">
              {missions.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <PackageCheck className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">Vous n&apos;avez aucune mission attribuée.</p>
                  <p className="text-xs text-slate-500">
                    Acceptez une mission disponible dans l&apos;onglet à côté.
                  </p>
                </div>
              ) : (
                missions.map((m) => {
                  const isExpanded = selectedMissionId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
                    >
                      <div
                        onClick={() => handleSelectMission(m.id)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                m.kind === 'COLLECTION'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}
                            >
                              {m.kind === 'COLLECTION' ? 'Collecte' : 'Livraison'}
                            </span>

                            <span className="text-xs font-bold text-white">
                              {m.zone_label}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400">
                            Statut : <span className="text-amber-400 font-semibold">{m.status}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-amber-400 font-mono block">
                            {formatMoney(m.pay_amount)}
                          </span>
                          <span className="text-[10px] text-slate-500">Toucher pour détails</span>
                        </div>
                      </div>

                      {/* Section détaillée pour la mission sélectionnée */}
                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-800 space-y-3">
                          {loadingDetails ? (
                            <div className="flex items-center justify-center py-4 text-xs text-slate-400">
                              <Loader2 className="w-4 h-4 animate-spin mr-2 text-amber-400" />
                              Chargement des informations du client...
                            </div>
                          ) : missionDetails ? (
                            <>
                              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                                <div className="flex justify-between items-center text-slate-300">
                                  <span className="font-semibold text-white">{missionDetails.client_name}</span>
                                  <span className="font-mono text-slate-400">{missionDetails.client_phone}</span>
                                </div>

                                <div className="text-slate-300 font-mono bg-slate-900 p-2 rounded-lg border border-slate-800">
                                  <MapPin className="w-3.5 h-3.5 text-amber-400 inline mr-1" />
                                  {missionDetails.address || 'Adresse non spécifiée'}
                                </div>

                                {missionDetails.instructions && (
                                  <p className="text-slate-400 italic">
                                    Consignes : &quot;{missionDetails.instructions}&quot;
                                  </p>
                                )}
                              </div>

                              {/* Boutons d'action rapide : Appel / WhatsApp */}
                              <div className="grid grid-cols-2 gap-2">
                                {missionDetails.client_phone && (
                                  <>
                                    <a
                                      href={`tel:${missionDetails.client_phone}`}
                                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition"
                                    >
                                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>Appeler</span>
                                    </a>

                                    <a
                                      href={generateWhatsAppLink(
                                        missionDetails.client_phone,
                                        `Bonjour ${missionDetails.client_name}, je suis le livreur pour votre commande LB Pressing.`
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="py-2 px-3 bg-emerald-950/40 hover:bg-emerald-900/60 active:scale-95 text-emerald-300 border border-emerald-800/40 font-semibold text-xs rounded-xl flex items-center justify-center space-x-1.5 transition"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>WhatsApp</span>
                                    </a>
                                  </>
                                )}
                              </div>

                              {/* PROCHAINE ÉTAPE AUTORISÉE UNIQUEMENT */}
                              <div className="pt-2">
                                {m.status === 'ACCEPTED' && (
                                  <button
                                    onClick={() => handleAdvance(m.id, 'EN_ROUTE')}
                                    disabled={submitting}
                                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition"
                                  >
                                    <span>Je pars (En route chez le client)</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                )}

                                {m.status === 'EN_ROUTE' && (
                                  <button
                                    onClick={() => handleAdvance(m.id, 'AT_CUSTOMER')}
                                    disabled={submitting}
                                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition"
                                  >
                                    <span>Je suis arrivé chez le client</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                )}

                                {m.status === 'AT_CUSTOMER' && (
                                  <button
                                    onClick={() => handleAdvance(m.id, 'COLLECTED')}
                                    disabled={submitting}
                                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Collecte confirmée (Saisir le nb de pièces)</span>
                                  </button>
                                )}

                                {m.status === 'COLLECTED' && (
                                  <button
                                    onClick={() => handleAdvance(m.id, 'IN_TRANSIT')}
                                    disabled={submitting}
                                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition"
                                  >
                                    <span>En route vers le pressing</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </button>
                                )}

                                {m.status === 'IN_TRANSIT' && (
                                  <button
                                    onClick={() => handleAdvance(m.id, 'AT_SHOP')}
                                    disabled={submitting}
                                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Arrivé au pressing</span>
                                  </button>
                                )}

                                {m.status === 'AT_SHOP' && (
                                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center text-xs text-emerald-400 font-bold">
                                    Mission déposée au pressing. En attente de contrôle de réception.
                                  </div>
                                )}

                                {/* Bouton échec */}
                                {['ACCEPTED', 'EN_ROUTE', 'AT_CUSTOMER', 'COLLECTED', 'IN_TRANSIT'].includes(m.status) && (
                                  <button
                                    onClick={() => {
                                      setActiveActionMissionId(m.id);
                                      setFailModalOpen(true);
                                    }}
                                    className="w-full mt-2 py-2 text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center justify-center space-x-1 transition"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Signaler un problème</span>
                                  </button>
                                )}
                              </div>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* VUE GESTIONNAIRES (OWNER, MANAGER, CASHIER) */}
      {userRole !== 'DELIVERY' && (
        <div className="space-y-4">
          {/* Filtres de recherche */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold">
              <Filter className="w-4 h-4 text-amber-400" />
              <span>Filtres des missions</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Statut</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none"
                >
                  <option value="TOUTES">Toutes les missions</option>
                  <option value="OUVERTES">Ouvertes / Attribuées</option>
                  <option value="EN_COURS">En cours d&apos;exécution</option>
                  <option value="AT_SHOP">Arrivées au pressing (AT_SHOP)</option>
                  <option value="CLOTUREES">Échouées / Annulées</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Livreur</label>
                <select
                  value={courierFilter}
                  onChange={(e) => setCourierFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none"
                >
                  <option value="TOUS">Tous les livreurs</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tableau / Liste des missions */}
          <div className="space-y-3">
            {filteredMissions.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                <Truck className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">Aucune mission ne correspond aux critères.</p>
              </div>
            ) : (
              filteredMissions.map((m) => (
                <div
                  key={m.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          m.kind === 'COLLECTION'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}
                      >
                        {m.kind === 'COLLECTION' ? 'Collecte' : 'Livraison'}
                      </span>

                      <span className="font-mono text-xs font-bold text-white">
                        {m.ticket_number || m.request_code || 'Commande'}
                      </span>

                      {m.client_name && (
                        <span className="text-xs text-slate-400 font-medium">
                          ({m.client_name})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-black text-amber-400 font-mono">
                        {formatMoney(m.pay_amount)}
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-bold">
                        {m.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    <div>
                      Zone : <span className="font-semibold text-white">{m.zone_label}</span>
                    </div>

                    <div>
                      Livreur :{' '}
                      <span className="font-semibold text-amber-300">
                        {m.assigned_courier_name || 'Non attribué (Ouverte à tous)'}
                      </span>
                    </div>

                    {m.items_count_collected !== null && m.items_count_collected !== undefined && (
                      <div>
                        Articles collectés : <span className="font-bold text-emerald-400">{m.items_count_collected}</span>
                      </div>
                    )}

                    {m.fail_reason && (
                      <div className="col-span-full text-rose-400 font-medium">
                        Motif d&apos;échec : &quot;{m.fail_reason}&quot;
                      </div>
                    )}

                    {m.cancel_reason && (
                      <div className="col-span-full text-amber-400 font-medium">
                        Motif : &quot;{m.cancel_reason}&quot;
                      </div>
                    )}
                  </div>

                  {/* Actions de gestion (OWNER / MANAGER) */}
                  {(userRole === 'OWNER' || userRole === 'MANAGER') && !['AT_SHOP', 'FAILED', 'CANCELLED'].includes(m.status) && (
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800/80">
                      <button
                        onClick={() => {
                          setActiveActionMissionId(m.id);
                          setSelectedCourierId(m.assigned_to || '');
                          setReassignModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Réattribuer</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveActionMissionId(m.id);
                          setCancelModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 active:scale-95 text-rose-300 border border-rose-800/40 text-xs font-semibold rounded-lg flex items-center space-x-1 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Annuler</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODALE COLLECTE CONFIRMÉE */}
      {collectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Confirmation de collecte</h3>
            </div>

            <p className="text-xs text-slate-300">
              Saisissez le nombre exact de vêtements ou pièces récupérés auprès du client.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Nombre de pièces collectées
              </label>
              <input
                type="number"
                min="0"
                value={collectItemCount}
                onChange={(e) => setCollectItemCount(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setCollectModalOpen(false)}
                className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>

              <button
                onClick={handleConfirmCollect}
                disabled={submitting}
                className="w-1/2 py-2 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 text-xs font-bold rounded-xl transition"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE SIGNALEMENT D'ÉCHEC */}
      {failModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Signaler un problème</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Motif principal</label>
                <select
                  value={failReasonSelect}
                  onChange={(e) => setFailReasonSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none"
                >
                  {FAIL_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Précisions (facultatif)</label>
                <textarea
                  rows={2}
                  value={failReasonNote}
                  onChange={(e) => setFailReasonNote(e.target.value)}
                  placeholder="Notes complémentaires..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setFailModalOpen(false)}
                className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Retour
              </button>

              <button
                onClick={handleConfirmFail}
                disabled={submitting}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl transition"
              >
                Signaler l&apos;échec
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE RÉATTRIBUTION */}
      {reassignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-amber-400">
              <UserCheck className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Réattribuer la mission</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Livreur cible</label>
                <select
                  value={selectedCourierId}
                  onChange={(e) => setSelectedCourierId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none"
                >
                  <option value="">Mission ouverte à tous</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Motif obligatoire</label>
                <textarea
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Ex: Réattribution pour optimisation de tournée..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setReassignModalOpen(false)}
                className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>

              <button
                onClick={handleConfirmReassign}
                disabled={submitting || !reassignReason.trim()}
                className="w-1/2 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE ANNULATION */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-2 text-rose-400">
              <XCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Annuler la mission</h3>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                L&apos;annulation d&apos;une mission est irréversible. Un motif obligatoire est exigé pour le journal d&apos;audit.
              </p>

              <div>
                <label className="block text-slate-400 mb-1">Motif d&apos;annulation</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Motif détaillé (ex: demande annulée par le client)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setCancelModalOpen(false)}
                className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Fermer
              </button>

              <button
                onClick={handleConfirmCancel}
                disabled={submitting || !cancelReason.trim()}
                className="w-1/2 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold rounded-xl transition disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
