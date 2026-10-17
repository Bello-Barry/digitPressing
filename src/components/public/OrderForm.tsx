'use client';

// =============================================================================
// COMPOSANT FORMULAIRE DE COMMANDE EN LIGNE (CLIENT SANS COMPTE)
// Mobile-first, validation Zod, honeypot anti-spam, appel Server Action
// Thème Bleu Nuit & Jaune (bg-[#EEF4FF], texte #041C4C, or #FFC72C, bleu royal #0B5CE1)
// =============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitOrderAction } from '@/actions/orders';
import { generateWhatsAppLink, isValidCongoMobile, normalizePhoneNumber } from '@/lib/whatsapp';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  MessageCircle,
  MapPin,
  AlertCircle,
  Truck,
  Building,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ServiceItem {
  id: string;
  name: string;
  category: string | null;
  price: number;
}

interface SelectedOrderItem {
  service_id: string;
  service_name: string;
  quantity: number;
  unit_price: number;
  item_type?: string;
  color?: string;
  pattern?: string;
  brand?: string;
  size?: string;
  item_notes?: string;
  showDetails?: boolean;
}

interface OrderFormProps {
  organization: {
    id: string;
    name: string;
    slug: string;
    ticket_prefix: string;
    phone_1: string | null;
    phone_2: string | null;
  };
  services: ServiceItem[];
}

export function OrderForm({ organization, services }: OrderFormProps) {
  const router = useRouter();
  // État des articles du panier
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]);

  // Coordonnées client
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [mode, setMode] = useState<'DROP_OFF' | 'PICKUP' | 'DELIVERY'>('DROP_OFF');
  const [address, setAddress] = useState('');
  const [desiredDate, setDesiredDate] = useState('');
  const [notes, setNotes] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Anti-spam piège invisible

  // État de chargement et confirmation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<{
    requestCode: string;
    totalAmount: number;
  } | null>(null);

  // Filtre recherche service
  const [searchFilter, setSearchFilter] = useState('');

  // Calcul du sous-total
  const subtotal = selectedItems.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  // Gestion de l'ajout d'article
  const handleAddItem = (service: ServiceItem) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.service_id === service.id);
      if (existing) {
        return prev.map((i) =>
          i.service_id === service.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          service_id: service.id,
          service_name: service.name,
          quantity: 1,
          unit_price: Number(service.price),
          item_type: service.name,
          showDetails: false,
        },
      ];
    });
  };

  const handleUpdateQuantity = (serviceId: string, delta: number) => {
    setSelectedItems((prev) =>
      prev
        .map((item) => {
          if (item.service_id === serviceId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as typeof prev
    );
  };

  const handleUpdateItemAttribute = (
    serviceId: string,
    field: keyof SelectedOrderItem,
    value: string
  ) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.service_id === serviceId ? { ...item, [field]: value } : item))
    );
  };

  const toggleItemDetails = (serviceId: string) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.service_id === serviceId ? { ...item, showDetails: !item.showDetails } : item
      )
    );
  };

  const handleRemoveItem = (serviceId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.service_id !== serviceId));
  };

  // Soumission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (selectedItems.length === 0) {
      setErrorMsg('Veuillez sélectionner au moins un article.');
      return;
    }

    if (!clientName.trim() || clientName.trim().length < 2) {
      setErrorMsg('Veuillez renseigner votre nom complet.');
      return;
    }

    if (!clientPhone.trim() || !isValidCongoMobile(normalizePhoneNumber(clientPhone))) {
      setErrorMsg('Numéro invalide : exemple 06 731 1016');
      return;
    }

    if ((mode === 'PICKUP' || mode === 'DELIVERY') && (!address || address.trim().length < 3)) {
      setErrorMsg('L\'adresse exacte est requise pour le ramassage ou la livraison.');
      return;
    }

    setIsSubmitting(true);

    try {
      const itemsPayload = selectedItems.map((item) => ({
        service_id: item.service_id,
        service_name: item.service_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        item_type: item.item_type || item.service_name,
        color: item.color || null,
        pattern: item.pattern || null,
        brand: item.brand || null,
        size: item.size || null,
        item_notes: item.item_notes || null,
      }));

      const res = await submitOrderAction({
        org_id: organization.id,
        client_name: clientName,
        client_phone: clientPhone,
        mode,
        address: address.trim() || null,
        notes: notes ? `Note : ${notes}` : null,
        requested_at: desiredDate ? new Date(desiredDate).toISOString() : null,
        items: itemsPayload,
        honeypot,
      });

      if (!res.success || !res.requestCode) {
        setErrorMsg(res.error || 'Une erreur est survenue lors de l\'enregistrement.');
        setIsSubmitting(false);
        return;
      }

      setConfirmedOrder({
        requestCode: res.requestCode,
        totalAmount: res.totalAmount ?? subtotal,
      });
      router.refresh();
    } catch {
      setErrorMsg('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ÉCRAN DE CONFIRMATION AVEC BOUTON WHATSAPP
  if (confirmedOrder) {
    const pressingPhone = organization.phone_1 || '067311016';
    const whatsappText = `Bonjour ${organization.name} 👋
Je confirme ma demande en ligne *${confirmedOrder.requestCode}* pour *${clientName}*.
Montant estimé : *${confirmedOrder.totalAmount.toLocaleString('fr-FR')} FCFA*.
Numéro client : ${clientPhone}.
Merci de me confirmer la prise en charge !`;

    const whatsappLink = generateWhatsAppLink(pressingPhone, whatsappText);

    return (
      <div className="rounded-[24px] bg-white border border-[#D9E4FA] p-6 md:p-8 space-y-6 text-center shadow-brand-card">
        <div className="w-16 h-16 bg-[#EEF4FF] text-[#041C4C] rounded-full flex items-center justify-center mx-auto border border-[#D9E4FA]">
          <CheckCircle2 className="w-8 h-8 text-[#0B5CE1]" />
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase font-black tracking-wider text-[#0B5CE1]">
            Demande enregistrée avec succès
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-[#041C4C]">
            Merci pour votre commande, {clientName} !
          </h2>
          <p className="text-xs md:text-sm text-[#4A5F86] max-w-md mx-auto">
            Votre demande a bien été transmise à l'équipe de{' '}
            <span className="font-bold text-[#041C4C]">{organization.name}</span>.
          </p>
        </div>

        {/* Code de suivi réel */}
        <div className="p-5 rounded-2xl bg-[#041C4C] text-white border border-[#041C4C] max-w-sm mx-auto space-y-1 shadow-md">
          <p className="text-xs text-[#FFC72C] font-extrabold uppercase tracking-wider">Votre code de suivi unique :</p>
          <p className="text-3xl font-black font-mono tracking-widest text-white">
            {confirmedOrder.requestCode}
          </p>
          <p className="text-[11px] text-slate-300">
            Conservez ce code pour suivre l'état de votre linge
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-3 pt-2">
          {/* Bouton WhatsApp prérempli */}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-[56px] px-6 bg-[#FFC72C] hover:bg-[#FFC72C]/90 text-[#041C4C] font-black rounded-2xl shadow-brand-card flex items-center justify-center text-sm transition active:scale-95"
          >
            <MessageCircle className="w-5 h-5 mr-2 text-emerald-700 fill-emerald-700/10" />
            Confirmer sur WhatsApp avec {organization.name}
          </a>

          {/* Suivi en ligne */}
          <Link
            href={`/${organization.slug}/suivi?code=${confirmedOrder.requestCode}&tel=${encodeURIComponent(
              clientPhone
            )}`}
            className="w-full h-[52px] px-6 bg-white border-2 border-[#041C4C] text-[#041C4C] font-extrabold rounded-2xl flex items-center justify-center text-xs transition active:scale-95 shadow-xs"
          >
            <Search className="w-4 h-4 mr-2 text-[#0B5CE1]" />
            Voir ma page de suivi en ligne
          </Link>
        </div>

        <p className="text-[11px] text-[#4A5F86]">
          Un reçu officiel avec ticket numéroté sera généré dès le comptage physique de votre linge au pressing.
        </p>
      </div>
    );
  }

  // FORMULAIRE PRINCIPAL
  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Champ Honeypot invisible */}
      <input
        type="text"
        name="website_honeypot_field"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Étape 1 : Coordonnées Client */}
      <div className="p-5 md:p-6 rounded-[24px] bg-white border border-[#D9E4FA] shadow-brand-card space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-[#D9E4FA]">
          <span className="w-7 h-7 rounded-full bg-[#FFC72C] text-[#041C4C] font-black text-xs flex items-center justify-center shadow-xs">
            1
          </span>
          <h2 className="font-extrabold text-[#041C4C] text-base">Vos Coordonnées (Sans inscription)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#041C4C]">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Jean Koumou"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full h-[48px] px-4 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] placeholder-[#4A5F86]/60 text-sm focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#041C4C]">
              Numéro WhatsApp <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="Ex: 06 731 1016"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full h-[48px] px-4 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] placeholder-[#4A5F86]/60 text-sm font-mono focus:outline-none focus:border-[#0B5CE1] transition"
            />
            <p className="text-[11px] text-[#4A5F86]">
              Sert au suivi et à l'envoi de votre reçu officiel.
            </p>
          </div>
        </div>
      </div>

      {/* Étape 2 : Mode de dépôt & Adresse */}
      <div className="p-5 md:p-6 rounded-[24px] bg-white border border-[#D9E4FA] shadow-brand-card space-y-4">
        <div className="flex items-center space-x-2.5 pb-3 border-b border-[#D9E4FA]">
          <span className="w-7 h-7 rounded-full bg-[#FFC72C] text-[#041C4C] font-black text-xs flex items-center justify-center shadow-xs">
            2
          </span>
          <h2 className="font-extrabold text-[#041C4C] text-base">Mode de Dépôt / Retrait</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setMode('DROP_OFF')}
            className={`p-4 rounded-2xl border text-left flex items-start space-x-3 transition ${
              mode === 'DROP_OFF'
                ? 'bg-[#041C4C] border-[#041C4C] text-white shadow-md'
                : 'bg-[#EEF4FF] border-[#D9E4FA] text-[#041C4C] hover:border-[#0B5CE1]'
            }`}
          >
            <Building className={`w-5 h-5 shrink-0 ${mode === 'DROP_OFF' ? 'text-[#FFC72C]' : 'text-[#0B5CE1]'}`} />
            <div>
              <p className="text-xs font-black">Dépôt au Pressing</p>
              <p className={`text-[11px] mt-0.5 ${mode === 'DROP_OFF' ? 'text-slate-200' : 'text-[#4A5F86]'}`}>Je dépose mes habits</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('PICKUP')}
            className={`p-4 rounded-2xl border text-left flex items-start space-x-3 transition ${
              mode === 'PICKUP'
                ? 'bg-[#041C4C] border-[#041C4C] text-white shadow-md'
                : 'bg-[#EEF4FF] border-[#D9E4FA] text-[#041C4C] hover:border-[#0B5CE1]'
            }`}
          >
            <Truck className={`w-5 h-5 shrink-0 ${mode === 'PICKUP' ? 'text-[#FFC72C]' : 'text-[#0B5CE1]'}`} />
            <div>
              <p className="text-xs font-black">Collecte à domicile</p>
              <p className={`text-[11px] mt-0.5 ${mode === 'PICKUP' ? 'text-slate-200' : 'text-[#4A5F86]'}`}>Un coursier passe</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('DELIVERY')}
            className={`p-4 rounded-2xl border text-left flex items-start space-x-3 transition ${
              mode === 'DELIVERY'
                ? 'bg-[#041C4C] border-[#041C4C] text-white shadow-md'
                : 'bg-[#EEF4FF] border-[#D9E4FA] text-[#041C4C] hover:border-[#0B5CE1]'
            }`}
          >
            <MapPin className={`w-5 h-5 shrink-0 ${mode === 'DELIVERY' ? 'text-[#FFC72C]' : 'text-[#0B5CE1]'}`} />
            <div>
              <p className="text-xs font-black">Livraison complète</p>
              <p className={`text-[11px] mt-0.5 ${mode === 'DELIVERY' ? 'text-slate-200' : 'text-[#4A5F86]'}`}>Collecte et retour</p>
            </div>
          </button>
        </div>

        {(mode === 'PICKUP' || mode === 'DELIVERY') && (
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-extrabold text-[#041C4C]">
              Adresse précise (Quartier, Rue, Repère) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Moungali, Rue Mbaka, en face de la pharmacie..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full h-[48px] px-4 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] placeholder-[#4A5F86]/60 text-sm focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#041C4C]">
              Date souhaitée (Optionnel)
            </label>
            <input
              type="date"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
              className="w-full h-[44px] px-3.5 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#041C4C]">
              Consignes particulières (Optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex: Taches sur col, repassage doux..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-[44px] px-3.5 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] placeholder-[#4A5F86]/60 text-xs focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>
        </div>
      </div>

      {/* Étape 3 : Choix des Vêtements & Caractéristiques */}
      <div className="p-5 md:p-6 rounded-[24px] bg-white border border-[#D9E4FA] shadow-brand-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#D9E4FA] gap-2">
          <div className="flex items-center space-x-2.5">
            <span className="w-7 h-7 rounded-full bg-[#FFC72C] text-[#041C4C] font-black text-xs flex items-center justify-center shadow-xs">
              3
            </span>
            <h2 className="font-extrabold text-[#041C4C] text-base">Sélection des Articles</h2>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher un habit..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3.5 py-2 pl-9 rounded-xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] placeholder-[#4A5F86]/60 text-xs w-full sm:w-52 focus:outline-none focus:border-[#0B5CE1]"
            />
            <Search className="w-4 h-4 text-[#4A5F86] absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Liste des services à cliquer */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {filteredServices.map((service) => {
            const inCart = selectedItems.find((i) => i.service_id === service.id);
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => handleAddItem(service)}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  inCart
                    ? 'bg-[#041C4C] border-[#041C4C] text-white shadow-sm'
                    : 'bg-[#EEF4FF] border-[#D9E4FA] text-[#041C4C] hover:border-[#0B5CE1]'
                }`}
              >
                <div>
                  <p className="text-xs font-extrabold truncate">{service.name}</p>
                  <p className={`text-[11px] font-mono font-black mt-0.5 ${inCart ? 'text-[#FFC72C]' : 'text-[#041C4C]'}`}>
                    {Number(service.price).toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className={`text-[10px] truncate ${inCart ? 'text-slate-300' : 'text-[#4A5F86]'}`}>{service.category}</span>
                  {inCart ? (
                    <span className="bg-[#FFC72C] text-[#041C4C] font-black px-1.5 py-0.2 rounded text-[10px]">
                      x{inCart.quantity}
                    </span>
                  ) : (
                    <Plus className="w-4 h-4 text-[#0B5CE1]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Panier des articles */}
        {selectedItems.length > 0 && (
          <div className="pt-3 border-t border-[#D9E4FA] space-y-3">
            <h3 className="text-xs uppercase font-black text-[#041C4C] tracking-wider">
              Articles sélectionnés ({selectedItems.reduce((acc, i) => acc + i.quantity, 0)})
            </h3>

            <div className="space-y-3">
              {selectedItems.map((item) => (
                <div
                  key={item.service_id}
                  className="p-4 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 pr-2">
                      <p className="text-xs font-extrabold text-[#041C4C]">{item.service_name}</p>
                      <p className="text-[11px] text-[#4A5F86] font-mono">
                        {item.unit_price.toLocaleString('fr-FR')} FCFA / un.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.service_id, -1)}
                        className="w-8 h-8 rounded-xl bg-white border border-[#D9E4FA] hover:bg-slate-100 text-[#041C4C] flex items-center justify-center transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-6 text-center text-xs font-black font-mono text-[#041C4C]">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.service_id, 1)}
                        className="w-8 h-8 rounded-xl bg-white border border-[#D9E4FA] hover:bg-slate-100 text-[#041C4C] flex items-center justify-center transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-20 text-right text-xs font-black font-mono text-[#041C4C]">
                        {(item.quantity * item.unit_price).toLocaleString('fr-FR')} FCFA
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleItemDetails(item.service_id)}
                        className="p-1.5 rounded-xl bg-[#FFC72C] text-[#041C4C] text-[11px] font-bold flex items-center transition ml-1 shadow-2xs"
                        title="Ajouter détails physiques"
                      >
                        {item.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.service_id)}
                        className="p-1 text-[#4A5F86] hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Résumé des détails */}
                  {(item.color || item.brand || item.size || item.pattern || item.item_notes) && !item.showDetails && (
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-[#041C4C] pt-1">
                      {item.color && <span className="bg-white border border-[#D9E4FA] px-2 py-0.5 rounded-md font-medium">Couleur: {item.color}</span>}
                      {item.pattern && <span className="bg-white border border-[#D9E4FA] px-2 py-0.5 rounded-md font-medium">Motif: {item.pattern}</span>}
                      {item.brand && <span className="bg-white border border-[#D9E4FA] px-2 py-0.5 rounded-md font-medium">Marque: {item.brand}</span>}
                      {item.size && <span className="bg-white border border-[#D9E4FA] px-2 py-0.5 rounded-md font-medium">Taille: {item.size}</span>}
                      {item.item_notes && <span className="bg-[#FFC72C]/40 px-2 py-0.5 rounded-md font-bold">Note: {item.item_notes}</span>}
                    </div>
                  )}

                  {/* Formulaire détails */}
                  {item.showDetails && (
                    <div className="pt-2 border-t border-[#D9E4FA] grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] text-[#4A5F86] mb-0.5 font-bold">Couleur</label>
                        <input
                          type="text"
                          placeholder="ex: Blanc, Bleu"
                          value={item.color || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'color', e.target.value)}
                          className="w-full bg-white border border-[#D9E4FA] rounded-xl px-3 py-1.5 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#4A5F86] mb-0.5 font-bold">Motif</label>
                        <input
                          type="text"
                          placeholder="ex: Uni, Rayé"
                          value={item.pattern || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'pattern', e.target.value)}
                          className="w-full bg-white border border-[#D9E4FA] rounded-xl px-3 py-1.5 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#4A5F86] mb-0.5 font-bold">Marque</label>
                        <input
                          type="text"
                          placeholder="ex: Zara, Boss"
                          value={item.brand || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'brand', e.target.value)}
                          className="w-full bg-white border border-[#D9E4FA] rounded-xl px-3 py-1.5 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-[#4A5F86] mb-0.5 font-bold">Taille</label>
                        <input
                          type="text"
                          placeholder="ex: M, L, 42"
                          value={item.size || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'size', e.target.value)}
                          className="w-full bg-white border border-[#D9E4FA] rounded-xl px-3 py-1.5 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <label className="block text-[10px] text-[#4A5F86] mb-0.5 font-bold">Remarques</label>
                        <input
                          type="text"
                          placeholder="ex: Tache col, bouton manquant..."
                          value={item.item_notes || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'item_notes', e.target.value)}
                          className="w-full bg-white border border-[#D9E4FA] rounded-xl px-3 py-1.5 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="p-4 rounded-2xl bg-[#041C4C] text-white flex items-center justify-between shadow-md">
              <span className="text-xs font-extrabold text-[#FFC72C]">Total estimé de la commande :</span>
              <span className="text-base font-black font-mono text-white">
                {subtotal.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Validation */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || selectedItems.length === 0}
          className="w-full h-[56px] px-6 bg-[#FFC72C] hover:bg-[#FFC72C]/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#041C4C] font-black rounded-2xl shadow-brand-card flex items-center justify-center text-sm md:text-base transition active:scale-95"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <span className="w-4 h-4 mr-2 border-2 border-[#041C4C] border-t-transparent rounded-full animate-spin" />
              Enregistrement en cours...
            </span>
          ) : (
            <span className="flex items-center">
              <ShoppingBag className="w-5 h-5 mr-2" />
              Valider ma commande ({subtotal.toLocaleString('fr-FR')} FCFA)
            </span>
          )}
        </button>
        <p className="text-center text-[11px] text-[#4A5F86] mt-2">
          Aucun paiement immédiat requis. Vous recevrez un code de suivi et pourrez confirmer sur WhatsApp.
        </p>
      </div>
    </form>
  );
}
