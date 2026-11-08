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
  reassignMissionAction,
  cancelMissionAction,
  advanceMissionAction,
  failMissionAction,
  getMissionDetailsAction,
  getActiveCouriersAction,
  recordDeliveryPaymentAction,
  confirmDeliveryMissionAction,
  getDeliveryCustomerWhatsAppLinkAction,
  authorizeUnpaidDeliveryAction,
  getDeliveryCashHandoverDataAction,
  createDeliveryCashHandoverAction,
  confirmDeliveryCashHandoverAction,
  MissionItem,
} from '@/actions/missions';
import {
  createOrderRevisionDraftAction,
  renewOrderRevisionCodeAction,
  confirmOrderRevisionOtpAction,
  confirmOrderRevisionUnverifiedAction,
  confirmPickupConformAction,
  getOrderItemsForRevisionAction,
  getActiveServicesCatalogAction,
  getOrderRevisionsHistoryAction,
  getUnverifiedRevisionsAction,
} from '@/actions/revisions';
import {
  inspectDeliveryReceiptAction,
  resolveDeliveryReceiptAction,
} from '@/actions/receipts';
import type { ReceiptLineInput } from '@/lib/delivery-receipt';
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

  // Modales Révision de facture (Tâche D2)
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionLines, setRevisionLines] = useState<any[]>([]);
  const [catalogServices, setCatalogServices] = useState<any[]>([]);
  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState<string>('');
  const [revisionNotes, setRevisionNotes] = useState<string>('');
  const [revisionDraft, setRevisionDraft] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState<string>('');
  const [unverifiedReason, setUnverifiedReason] = useState<string>('');
  const [showUnverifiedForm, setShowUnverifiedForm] = useState<boolean>(false);
  const [revisionsHistory, setRevisionsHistory] = useState<any[]>([]);
  const [unverifiedList, setUnverifiedList] = useState<any[]>([]);

  const [activeActionMissionId, setActiveActionMissionId] = useState<string | null>(null);
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, ReceiptLineInput[]>>({});
  const [receiptResolutionNotes, setReceiptResolutionNotes] = useState<Record<string, string>>({});
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, string>>({});
  const [deliveryPayments, setDeliveryPayments] = useState<Record<string, { amount: string; method: 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'OTHER'; reference: string }>>({});
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [cashData, setCashData] = useState<any | null>(null);
  const [cashAmounts, setCashAmounts] = useState<Record<string, { amount: string; note: string }>>({});

  // Formateur FCFA
  const formatMoney = (amount: number) => {
    return `${Number(amount || 0).toLocaleString('fr-FR')} FCFA`;
  };

  const getReceiptDraft = (mission: MissionItem): ReceiptLineInput[] => receiptDrafts[mission.id] ||
    (mission.order_items || []).map((item) => ({
      order_item_id: item.id,
      service_name: item.service_name,
      item_type: item.item_type,
      color: item.color,
      pattern: item.pattern,
      brand: item.brand,
      size: item.size,
      item_notes: item.item_notes,
      expected_quantity: item.quantity,
      received_quantity: item.quantity,
      discrepancy_note: '',
      condition_discrepancy: false,
      condition_note: '',
    }));

  const updateReceiptLine = (mission: MissionItem, index: number, patch: Partial<ReceiptLineInput>) => {
    setReceiptDrafts((current) => {
      const draft = current[mission.id] || getReceiptDraft(mission);
      return { ...current, [mission.id]: draft.map((line, i) => i === index ? { ...line, ...patch } : line) };
    });
  };

  const handleInspectReceipt = async (mission: MissionItem) => {
    setSubmitting(true);
    const result = await inspectDeliveryReceiptAction(mission.id, getReceiptDraft(mission));
    setSubmitting(false);
    if (!result.success) {
      toast({ title: 'Réception non enregistrée', description: result.error, variant: 'destructive' });
      return;
    }
    toast({
      title: result.status === 'CONFORM' ? 'Réception validée' : 'Écart enregistré',
      description: result.ticket_number ? `Ticket ${result.ticket_number} attribué.` : result.message,
      variant: result.status === 'CONFORM' ? 'default' : 'destructive',
    });
    loadData();
  };

  const handleResolveReceipt = async (mission: MissionItem) => {
    setSubmitting(true);
    const result = await resolveDeliveryReceiptAction(mission.id, receiptResolutionNotes[mission.id] || '');
    setSubmitting(false);
    if (!result.success) {
      toast({ title: 'Écart non résolu', description: result.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Écart traité', description: `Réception finalisée${result.ticket_number ? ` : ticket ${result.ticket_number}` : ''}.` });
    loadData();
  };

  // Chargement des données
  const loadData = useCallback(async () => {
    setRefreshing(true);
    const [listRes, openRes, courRes] = await Promise.all([
      listMissionsAction(),
      listOpenMissionsAction(),
      getActiveCouriersAction(),
    ]);
    const cashRes = await getDeliveryCashHandoverDataAction();
    if (cashRes.success) setCashData(cashRes);

    if (listRes.success && listRes.missions) {
      setMissions(listRes.missions);
      if (listRes.userRole) setUserRole(listRes.userRole);
    } else if (listRes.error) {
      toast({ title: 'Erreur', description: listRes.error, variant: 'destructive' });
    }

    if (openRes.success && openRes.openMissions) {
      setOpenMissions(openRes.openMissions);
    }

    if (courRes.success && courRes.couriers) {
      setCouriers(courRes.couriers);
    }

    const unverifiedRes = await getUnverifiedRevisionsAction();
    if (unverifiedRes.success && unverifiedRes.unverifiedRevisions) {
      setUnverifiedList(unverifiedRes.unverifiedRevisions);
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
      // Charger l'historique des révisions pour cette commande
      if (res.details.order_id) {
        const revRes = await getOrderRevisionsHistoryAction(res.details.order_id);
        if (revRes.success && revRes.revisions) {
          setRevisionsHistory(revRes.revisions);
        }
      }
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

  // Validation contrôle conforme
  const handleConfirmConform = async (missionId: string) => {
    setSubmitting(true);
    const res = await confirmPickupConformAction(missionId);
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Contrôle conforme validé', description: 'Le comptage des pièces est vérifié.' });
      loadData();
      if (selectedMissionId === missionId) handleSelectMission(missionId);
    } else {
      toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
    }
  };

  // Ouverture du modal de contrôle chez le client / Révision de facture
  const handleOpenRevisionModal = async (missionId: string) => {
    setActiveActionMissionId(missionId);
    setRevisionDraft(null);
    setOtpInput('');
    setUnverifiedReason('');
    setShowUnverifiedForm(false);
    setRevisionNotes('');

    setSubmitting(true);
    const [detailsRes, catRes] = await Promise.all([
      getMissionDetailsAction(missionId),
      getActiveServicesCatalogAction(),
    ]);

    if (detailsRes.success && detailsRes.details) {
      setMissionDetails(detailsRes.details);
      const itemsRes = await getOrderItemsForRevisionAction(detailsRes.details.order_id);
      if (itemsRes.success && itemsRes.items) {
        setRevisionLines(
          itemsRes.items.map((item: any) => ({
            order_item_id: item.id,
            service_id: item.service_id,
            service_name: item.service_name,
            unit_price: Number(item.unit_price),
            qty_after: item.quantity,
            color: item.color || '',
            pattern: item.pattern || '',
            brand: item.brand || '',
            size: item.size || '',
            item_notes: item.item_notes || '',
          }))
        );
      }
    }

    if (catRes.success && catRes.services) {
      setCatalogServices(catRes.services);
      if (catRes.services.length > 0) setSelectedCatalogServiceId(catRes.services[0].id);
    }
    setSubmitting(false);

    setRevisionModalOpen(true);
  };

  // Ajout d'un article depuis le catalogue à la révision
  const handleAddCatalogItem = () => {
    if (!selectedCatalogServiceId) return;
    const svc = catalogServices.find((s) => s.id === selectedCatalogServiceId);
    if (!svc) return;

    setRevisionLines((prev) => {
      const exists = prev.find((l) => l.service_id === svc.id);
      if (exists) {
        return prev.map((l) => (l.service_id === svc.id ? { ...l, qty_after: l.qty_after + 1 } : l));
      }
      return [
        ...prev,
        {
          service_id: svc.id,
          service_name: svc.name,
          unit_price: svc.price,
          qty_after: 1,
          color: '',
          pattern: '',
          brand: '',
          size: '',
          item_notes: '',
        },
      ];
    });
  };

  // Modification quantité dans révision
  const handleUpdateLineQty = (serviceId: string, newQty: number) => {
    setRevisionLines((prev) =>
      prev
        .map((l) => (l.service_id === serviceId ? { ...l, qty_after: Math.max(0, newQty) } : l))
        .filter((l) => l.qty_after > 0)
    );
  };

  // Soumission du projet de révision (génère l'OTP côté client)
  const handleCreateRevisionDraft = async () => {
    if (!activeActionMissionId || revisionLines.length === 0) {
      toast({ title: 'Erreur', description: 'Sélectionnez au moins un article.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const res = await createOrderRevisionDraftAction(
      activeActionMissionId,
      revisionLines,
      revisionNotes
    );
    setSubmitting(false);

    if (res.success) {
      setRevisionDraft(res);
      toast({
        title: 'Correction de facture enregistrée',
        description: 'Le code de validation à 6 chiffres a été généré sur la page de suivi du client.',
      });
    } else {
      toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
    }
  };

  // Renouvellement du code
  const handleRenewCode = async () => {
    if (!activeActionMissionId) return;
    setSubmitting(true);
    const res = await renewOrderRevisionCodeAction(activeActionMissionId);
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Code renouvelé', description: `${res.renewsLeft ?? 0} renouvellement(s) restant(s).` });
    } else {
      toast({ title: 'Erreur', description: res.error || res.message, variant: 'destructive' });
    }
  };

  // Confirmation par OTP client
  const handleConfirmOtp = async () => {
    if (!activeActionMissionId || otpInput.trim().length !== 6) {
      toast({ title: 'Code invalide', description: 'Entrez un code à 6 chiffres.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const res = await confirmOrderRevisionOtpAction(activeActionMissionId, otpInput.trim());
    setSubmitting(false);

    if (res.success) {
      toast({ title: 'Facture confirmée !', description: 'Les articles et le total ont été mis à jour.' });
      setRevisionModalOpen(false);
      loadData();
      if (selectedMissionId === activeActionMissionId) handleSelectMission(activeActionMissionId);
    } else {
      toast({
        title: 'Erreur validation code',
        description: res.error || `Code incorrect. ${res.attemptsLeft !== undefined ? `${res.attemptsLeft} essai(s) restant(s).` : ''}`,
        variant: 'destructive',
      });
    }
  };

  // Confirmation sans vérification client
  const handleConfirmUnverified = async () => {
    if (!activeActionMissionId || unverifiedReason.trim().length < 5) {
      toast({ title: 'Motif requis', description: 'Saisissez un motif détaillé d\'au moins 5 caractères.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const res = await confirmOrderRevisionUnverifiedAction(activeActionMissionId, unverifiedReason.trim());
    setSubmitting(false);

    if (res.success) {
      toast({
        title: 'Correction enregistrée',
        description: 'Accord non vérifié enregistré',
      });
      setRevisionModalOpen(false);
      setUnverifiedReason('');
      setShowUnverifiedForm(false);
      loadData();
      if (selectedMissionId === activeActionMissionId) handleSelectMission(activeActionMissionId);
    } else {
      toast({ title: 'Erreur', description: res.error, variant: 'destructive' });
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
    if (statusFilter === 'CLOTUREES') return ['COMPLETED', 'FAILED', 'CANCELLED'].includes(m.status);
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

                              {/* ÉTAPE DU CONTRÔLE CHEZ LE CLIENT (Règle 7 & Tâche D2) */}
                              {m.kind === 'COLLECTION' && m.status === 'AT_CUSTOMER' && (
                                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-white flex items-center">
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-amber-400" />
                                      Contrôle physique des vêtements
                                    </span>
                                    {m.pickup_check_status ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                        {m.pickup_check_status === 'CONFORM' ? '✓ Conforme' : '✓ Facture corrigée'}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                                        À vérifier
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleConfirmConform(m.id)}
                                      disabled={submitting}
                                      className="py-2.5 px-3 bg-emerald-600/90 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Vêtements conformes</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleOpenRevisionModal(m.id)}
                                      disabled={submitting}
                                      className="py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 text-amber-400 border border-amber-500/30 font-bold text-xs rounded-xl flex items-center justify-center space-x-1 transition"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>Corriger la facture</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Historique des révisions de facture si présent */}
                              {revisionsHistory.length > 0 && (
                                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                                  <span className="font-bold text-amber-400 text-[11px] uppercase tracking-wider block">
                                    Historique des révisions de facture ({revisionsHistory.length})
                                  </span>
                                  {revisionsHistory.map((rev) => (
                                    <div key={rev.id} className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex justify-between items-center text-[11px]">
                                      <div>
                                        <span className="font-bold text-white">Version v{rev.version_number}</span>
                                        <span className="text-slate-400 ml-2">({rev.status})</span>
                                      </div>
                                      <span className="font-mono text-amber-400 font-bold">{formatMoney(rev.total_after)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

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

                                {m.kind === 'COLLECTION' && m.status === 'AT_CUSTOMER' && (
                                  <button
                                    onClick={() => handleAdvance(m.id, 'COLLECTED')}
                                    disabled={submitting}
                                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Collecte confirmée (Saisir le nb de pièces)</span>
                                  </button>
                                )}

                                {m.kind === 'DELIVERY' && m.status === 'AT_CUSTOMER' && (
                                  <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                                    <div className="text-xs text-emerald-200 font-semibold">Confirmation du client par code, puis paiement du solde avant remise.</div>
                                    <a href="#" onClick={async (event) => { event.preventDefault(); const result = await getDeliveryCustomerWhatsAppLinkAction(m.id); if (result.success && result.url) window.open(result.url, '_blank', 'noopener,noreferrer'); else toast({ title: 'Lien indisponible', description: result.error, variant: 'destructive' }); }} className="block rounded-lg bg-emerald-600 px-3 py-2 text-center text-xs font-bold text-white">Envoyer le lien de suivi sur WhatsApp</a>
                                    {Number(m.delivery_balance_due || 0) > 0 && <div className="space-y-2 rounded-lg bg-slate-950 p-2">
                                      <div className="text-xs text-amber-300">Solde dû : {formatMoney(Number(m.delivery_balance_due))}</div>
                                      <input type="number" min="1" max={m.delivery_balance_due} value={deliveryPayments[m.id]?.amount || String(m.delivery_balance_due)} onChange={(e) => setDeliveryPayments((v) => ({ ...v, [m.id]: { amount: e.target.value, method: v[m.id]?.method || 'CASH', reference: v[m.id]?.reference || '' } }))} className="w-full rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-white" placeholder="Montant encaissé" />
                                      <div className="grid grid-cols-2 gap-2">
                                        <select value={deliveryPayments[m.id]?.method || 'CASH'} onChange={(e) => setDeliveryPayments((v) => ({ ...v, [m.id]: { amount: v[m.id]?.amount || String(m.delivery_balance_due), method: e.target.value as any, reference: v[m.id]?.reference || '' } }))} className="rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-white"><option value="CASH">Espèces</option><option value="MTN_MOMO">MTN MoMo</option><option value="AIRTEL_MONEY">Airtel Money</option><option value="OTHER">Autre</option></select>
                                        <input value={deliveryPayments[m.id]?.reference || ''} onChange={(e) => setDeliveryPayments((v) => ({ ...v, [m.id]: { amount: v[m.id]?.amount || String(m.delivery_balance_due), method: v[m.id]?.method || 'CASH', reference: e.target.value } }))} className="rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-white" placeholder="Référence (si mobile)" />
                                      </div>
                                      <button disabled={submitting} onClick={async () => { setSubmitting(true); const input = deliveryPayments[m.id]; const result = await recordDeliveryPaymentAction(m.id, Number(input?.amount || m.delivery_balance_due), input?.method || 'CASH', input?.reference || ''); setSubmitting(false); if (!result.success) toast({ title: 'Paiement refusé', description: result.error, variant: 'destructive' }); else { toast({ title: 'Paiement enregistré', description: 'Le solde de la commande a été actualisé.' }); loadData(); } }} className="w-full rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Enregistrer le paiement</button>
                                    </div>}
                                    {m.delivery_override_authorized && <p className="text-xs text-amber-300">Dérogation impayée motivée autorisée par un responsable.</p>}
                                    <div className="flex gap-2">
                                      <input inputMode="numeric" maxLength={6} value={deliveryCodes[m.id] || ''} onChange={(e) => setDeliveryCodes((v) => ({ ...v, [m.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 p-2 text-sm text-white tracking-widest" placeholder="Code client à 6 chiffres" />
                                      <button disabled={submitting || (deliveryCodes[m.id] || '').length !== 6} onClick={async () => { setSubmitting(true); const result = await confirmDeliveryMissionAction(m.id, deliveryCodes[m.id] || ''); setSubmitting(false); if (!result.success) toast({ title: 'Remise non confirmée', description: result.error, variant: 'destructive' }); else { toast({ title: 'Livraison confirmée', description: 'Commande et mission clôturées.' }); loadData(); } }} className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Confirmer remise</button>
                                    </div>
                                  </div>
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
          {userRole === 'OWNER' || userRole === 'MANAGER' ? <section className="rounded-2xl border border-amber-500/30 bg-slate-900 p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-amber-300">Dérogations de livraison impayée</h2>
            {missions.filter((m) => m.kind === 'DELIVERY' && m.order_status === 'READY' && Number(m.delivery_balance_due || 0) > 0).map((m) => <div key={`override-${m.id}`} className="rounded-xl bg-slate-950 p-3 space-y-2">
              <div className="text-xs text-white">{m.ticket_number || m.request_code} · {formatMoney(Number(m.delivery_balance_due))} dû</div>
              {m.delivery_override_authorized ? <div className="text-xs text-emerald-300">Dérogation déjà autorisée.</div> : <><textarea value={overrideReasons[m.order_id] || ''} onChange={(e) => setOverrideReasons((v) => ({ ...v, [m.order_id]: e.target.value }))} minLength={5} placeholder="Motif de la dérogation (minimum 5 caractères)" className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"/><button disabled={submitting || (overrideReasons[m.order_id] || '').trim().length < 5} onClick={async () => { setSubmitting(true); const result = await authorizeUnpaidDeliveryAction(m.order_id, overrideReasons[m.order_id] || ''); setSubmitting(false); if (!result.success) toast({ title: 'Dérogation refusée', description: result.error, variant: 'destructive' }); else { toast({ title: 'Dérogation autorisée' }); loadData(); } }} className="w-full rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Autoriser cette remise sans paiement complet</button></>}
            </div>)}
          </section> : null}

          {cashData && <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-white">Remise des espèces des livreurs</h2>
            {userRole === 'DELIVERY' ? <><div className="text-xs text-slate-300">Espèces à remettre : {formatMoney((cashData.unhanded || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0))} ({cashData.unhanded?.length || 0} paiement(s))</div>{cashData.unhanded?.length > 0 && <div className="space-y-2"><input type="number" min="0" value={cashAmounts.new?.amount ?? String(cashData.unhanded.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0))} onChange={(e) => setCashAmounts((v) => ({ ...v, new: { amount: e.target.value, note: '' } }))} className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-white" placeholder="Montant remis au caissier"/><button disabled={submitting} onClick={async () => { setSubmitting(true); const result = await createDeliveryCashHandoverAction(Number(cashAmounts.new?.amount || 0)); setSubmitting(false); if (!result.success) toast({ title: 'Remise non enregistrée', description: result.error, variant: 'destructive' }); else { toast({ title: 'Remise transmise', description: 'Présentez-vous au caissier pour validation.' }); loadData(); } }} className="w-full rounded-md bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950">Déclarer la remise au caissier</button></div>}</> : <div className="space-y-3">{cashData.handovers?.filter((h: any) => h.status === 'PENDING' || h.status === 'DISCREPANCY').map((h: any) => <div key={h.id} className={`rounded-xl border p-3 space-y-2 ${h.status === 'DISCREPANCY' ? 'border-rose-500/50 bg-rose-950/20' : 'border-slate-700 bg-slate-950'}`}><div className="text-xs font-semibold text-white">{h.courier_name} · attendu {formatMoney(Number(h.expected_cash_amount))} · déclaré {formatMoney(Number(h.declared_amount))}</div>{h.status === 'DISCREPANCY' ? <div className="text-xs text-rose-300">Écart {formatMoney(Math.abs(Number(h.discrepancy)))} : {h.resolution_note}</div> : <div className="flex gap-2"><input type="number" min="0" value={cashAmounts[h.id]?.amount || ''} onChange={(e) => setCashAmounts((v) => ({ ...v, [h.id]: { amount: e.target.value, note: v[h.id]?.note || '' } }))} className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-white" placeholder="Montant compté"/><input value={cashAmounts[h.id]?.note || ''} onChange={(e) => setCashAmounts((v) => ({ ...v, [h.id]: { amount: v[h.id]?.amount || '', note: e.target.value } }))} className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-white" placeholder="Motif obligatoire si écart"/><button disabled={!cashAmounts[h.id]?.amount || submitting} onClick={async () => { setSubmitting(true); const result = await confirmDeliveryCashHandoverAction(h.id, Number(cashAmounts[h.id].amount), cashAmounts[h.id].note); setSubmitting(false); if (!result.success) toast({ title: 'Validation refusée', description: result.error, variant: 'destructive' }); else { toast({ title: (result.result as any)?.status === 'DISCREPANCY' ? 'Écart signalé' : 'Remise validée' }); loadData(); } }} className="rounded-md bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Valider</button></div>}</div>)}</div>}
          </section>}

          {/* Liste Accords non vérifiés (Règle 6) */}
          {(userRole === 'OWNER' || userRole === 'MANAGER') && unverifiedList.length > 0 && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-2xl space-y-3 shadow-lg">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Accords non vérifiés chez le client ({unverifiedList.length})</span>
              </div>
              <div className="space-y-2">
                {unverifiedList.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white">
                          {rev.order?.ticket_number || rev.order?.request_code || 'Commande'}
                        </span>
                        {rev.order?.client_name && (
                          <span className="text-slate-400">({rev.order.client_name})</span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold">
                          v{rev.version_number}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300 italic mt-0.5">
                        Motif : &quot;{rev.unverified_reason}&quot;
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-amber-400 block">
                        {formatMoney(rev.total_after)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(rev.confirmed_at || rev.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
                  <option value="CLOTUREES">Terminées / Échouées / Annulées</option>
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

                  {/* D3 : réception physique des collectes arrivées au pressing */}
                  {m.kind === 'COLLECTION' && m.status === 'AT_SHOP' && userRole !== 'DELIVERY' && (
                    <section className="rounded-xl border border-amber-500/30 bg-slate-950 p-3 space-y-3" aria-label="Contrôle de réception au pressing">
                      <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                        <PackageCheck className="w-4 h-4" />
                        Contrôle de réception — comparez chaque ligne à la facture approuvée
                      </div>
                      {m.receipt_status === 'DISCREPANCY' ? (
                        <div className="space-y-3">
                          <p className="text-xs text-rose-300">Écart enregistré. La commande et la mission restent bloquées jusqu’à la décision motivée d’un OWNER ou MANAGER.</p>
                          <div className="space-y-1.5">
                            {(m.receipt_lines || []).map((line) => (
                              <div key={line.id} className="rounded-lg bg-slate-900 p-2 text-[11px] text-slate-300">
                                <div className="font-semibold text-white">{line.service_name}{line.item_type ? ` · ${line.item_type}` : ''}</div>
                                <div>Attendu : {line.expected_quantity} · reçu : {line.received_quantity}</div>
                                {line.discrepancy_note && <div className="text-rose-300">Motif : {line.discrepancy_note}</div>}
                                {line.condition_discrepancy && <div className="text-rose-300">État signalé : {line.condition_note}</div>}
                                {line.item_notes && <div className="text-slate-500">Note de facture : {line.item_notes}</div>}
                              </div>
                            ))}
                          </div>
                          {(userRole === 'OWNER' || userRole === 'MANAGER') && (
                            <div className="space-y-2">
                              <textarea
                                value={receiptResolutionNotes[m.id] || ''}
                                onChange={(event) => setReceiptResolutionNotes((current) => ({ ...current, [m.id]: event.target.value }))}
                                minLength={5}
                                placeholder="Décision du responsable et motif (obligatoire)"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-white"
                                rows={2}
                              />
                              <p className="text-[10px] text-slate-500">Cette décision confirme le comptage reçu. Toute modification du montant facturé doit d’abord passer par une nouvelle version approuvée par le client.</p>
                              <button type="button" onClick={() => handleResolveReceipt(m)} disabled={submitting || (receiptResolutionNotes[m.id] || '').trim().length < 5} className="w-full rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">
                                Traiter l’écart et finaliser la réception
                              </button>
                            </div>
                          )}
                        </div>
                      ) : m.receipt_status ? (
                        <div className="text-xs text-emerald-300">Réception déjà validée ({m.receipt_status}).</div>
                      ) : (
                        <div className="space-y-2">
                          {getReceiptDraft(m).map((line, index) => (
                            <div key={line.order_item_id || `extra-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_90px_1fr] gap-2 rounded-lg bg-slate-900 p-2">
                              <div className="text-[11px] text-slate-200">
                                <span className="font-semibold">{line.service_name}</span>
                                {line.item_type && <span className="text-slate-400"> · {line.item_type}</span>}
                                {(line.color || line.size || line.brand) && <div className="text-slate-500">{[line.color, line.size, line.brand].filter(Boolean).join(' · ')}</div>}
                                {line.item_notes && <div className="text-slate-500">Note facture : {line.item_notes}</div>}
                                <div className="text-slate-400">Facture : {line.expected_quantity}</div>
                              </div>
                              <label className="text-[10px] text-slate-400">Reçu
                                <input type="number" min={0} step={1} value={line.received_quantity} onChange={(event) => updateReceiptLine(m, index, { received_quantity: Number(event.target.value) })} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-sm text-white" />
                              </label>
                              <label className="text-[10px] text-slate-400">Motif si écart
                                <input value={line.discrepancy_note || ''} onChange={(event) => updateReceiptLine(m, index, { discrepancy_note: event.target.value })} placeholder="Ex. pièce manquante" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-white" />
                              </label>
                              <label className="sm:col-span-3 flex items-center gap-2 text-[11px] text-slate-300">
                                <input type="checkbox" checked={Boolean(line.condition_discrepancy)} onChange={(event) => updateReceiptLine(m, index, { condition_discrepancy: event.target.checked })} className="rounded border-slate-600 bg-slate-900 text-amber-500" />
                                État différent de la facture / anomalie physique
                              </label>
                              {line.condition_discrepancy && (
                                <label className="sm:col-span-3 text-[10px] text-slate-400">État constaté (motif obligatoire)
                                  <input value={line.condition_note || ''} onChange={(event) => updateReceiptLine(m, index, { condition_note: event.target.value })} placeholder="Ex. tache, déchirure, vêtement humide" className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-white" />
                                </label>
                              )}
                            </div>
                          ))}
                          <button type="button" onClick={() => setReceiptDrafts((current) => ({ ...current, [m.id]: [...getReceiptDraft(m), { service_name: 'Article hors facture', expected_quantity: 0, received_quantity: 1, discrepancy_note: '', condition_discrepancy: false, condition_note: '' }] }))} className="text-[11px] font-semibold text-amber-300 hover:text-amber-200">+ Signaler un article hors facture</button>
                          <button type="button" onClick={() => handleInspectReceipt(m)} disabled={submitting || getReceiptDraft(m).length === 0} className="w-full rounded-lg bg-emerald-500 px-3 py-2.5 text-xs font-extrabold text-slate-950 disabled:opacity-50">
                            {submitting ? 'Enregistrement…' : 'Valider le contrôle et réceptionner'}
                          </button>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Actions de gestion (OWNER / MANAGER) */}
                  {(userRole === 'OWNER' || userRole === 'MANAGER') && !['AT_SHOP', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(m.status) && (
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

      {/* MODALE REVISION / CONTRÔLE CLIENT (TÂCHE D2) */}
      {revisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-amber-400">
                <FileText className="w-5 h-5" />
                <h3 className="text-base font-bold text-white">Contrôle vêtement & Correction facture</h3>
              </div>
              <button
                onClick={() => setRevisionModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {!revisionDraft ? (
              <div className="space-y-4 text-xs">
                <p className="text-slate-300">
                  Comparez les vêtements reçus aux lignes de la facture. Vous pouvez ajuster les quantités ou ajouter des articles du catalogue. Les prix unitaires du catalogue sont strictement appliqués.
                </p>

                {/* Sélecteur d'article du catalogue à ajouter */}
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <label className="block text-slate-400 font-semibold">Ajouter un article du catalogue</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedCatalogServiceId}
                      onChange={(e) => setSelectedCatalogServiceId(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:outline-none"
                    >
                      {catalogServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatMoney(s.price)})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddCatalogItem}
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>

                {/* Liste des articles en cours de révision */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {revisionLines.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 italic">
                      Aucun article sélectionné. Ajoutez des prestations ci-dessus.
                    </div>
                  ) : (
                    revisionLines.map((line) => (
                      <div
                        key={line.service_id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-white">{line.service_name}</p>
                          <p className="text-[11px] text-slate-400">
                            {formatMoney(line.unit_price)} / unité
                          </p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateLineQty(line.service_id, line.qty_after - 1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center hover:bg-slate-700"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold text-amber-400 w-6 text-center">
                            {line.qty_after}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateLineQty(line.service_id, line.qty_after + 1)}
                            className="w-7 h-7 rounded-lg bg-slate-800 text-white font-bold flex items-center justify-center hover:bg-slate-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Notes / Observations</label>
                  <textarea
                    rows={2}
                    value={revisionNotes}
                    onChange={(e) => setRevisionNotes(e.target.value)}
                    placeholder="Remarques éventuelles sur l'état apparent des vêtements..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCreateRevisionDraft}
                  disabled={submitting || revisionLines.length === 0}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  <span>Générer le code de validation OTP Client</span>
                </button>
              </div>
            ) : (
              /* ÉTAPE DE VALIDATION DU CODE OTP OU DÉCLARATION SANS VÉRIFICATION (Règle 1 & 2) */
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Projet de correction créé
                  </span>
                  <p className="text-xs text-white font-semibold">
                    Le code secret à 6 chiffres est affiché sur l&apos;écran du client.
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Nouveau montant total : <span className="font-bold font-mono text-amber-300">{formatMoney(revisionDraft.totalAfter)}</span>
                  </p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleRenewCode}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold"
                    >
                      Renouveler le code (3 max)
                    </button>
                  </div>
                </div>

                {!showUnverifiedForm ? (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        Saisissez le code à 6 chiffres communiqué par le client
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Ex: 123456"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-center font-mono font-bold text-lg text-white tracking-widest focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmOtp}
                      disabled={submitting || otpInput.trim().length !== 6}
                      className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold rounded-xl flex items-center justify-center space-x-2 transition disabled:opacity-50"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>Confirmer avec le Code Client</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUnverifiedForm(true)}
                      className="w-full py-2 text-amber-400 hover:text-amber-300 font-semibold text-[11px] text-center"
                    >
                      Client sans téléphone / réseau ? (Déclaration sans vérification)
                    </button>
                  </div>
                ) : (
                  /* FORMULAIRE DE DÉCLARATION UNVERIFIED (Règle 8) */
                  <div className="space-y-3 p-3 bg-amber-950/30 border border-amber-800/40 rounded-2xl">
                    <div className="flex items-center space-x-2 text-amber-400 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Validation sans vérification (Alerte Propriétaire)</span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      Un motif obligatoire (≥ 5 caractères) est exigé. Cette opération sera marquée &quot;accord non vérifié&quot; et apparaîtra immédiatement dans les alertes du propriétaire.
                    </p>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Motif obligatoire</label>
                      <textarea
                        rows={2}
                        value={unverifiedReason}
                        onChange={(e) => setUnverifiedReason(e.target.value)}
                        placeholder="Ex: Client sans téléphone portable, téléphone déchargé..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white placeholder-slate-600 focus:outline-none"
                      />
                    </div>

                    <div className="flex space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowUnverifiedForm(false)}
                        className="w-1/2 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
                      >
                        Retour
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmUnverified}
                        disabled={submitting || unverifiedReason.trim().length < 5}
                        className="w-1/2 py-2 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-bold rounded-xl transition disabled:opacity-50"
                      >
                        Valider dérogation
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
