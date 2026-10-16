'use client';

// =============================================================================
// COMPOSANT FORMULAIRE DE COMMANDE EN LIGNE (CLIENT SANS COMPTE)
// Mobile-first, validation Zod, honeypot anti-spam, appel Server Action
// Caractéristiques physiques par article (Type, Couleur, Motif, Marque, Taille, Remarques)
// Thème Clair Client (bg-[#F7F9FC], texte #041C4C, or #FFC72C, bleu royal #0B5CE1)
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

  // ÉCRAN DE CONFIRMATION AVEC BOUTON WHATSAPP RÉEL
  if (confirmedOrder) {
    const pressingPhone = organization.phone_1 || '067311016';
    const whatsappText = `Bonjour ${organization.name} 👋
Je confirme ma demande en ligne *${confirmedOrder.requestCode}* pour *${clientName}*.
Montant estimé : *${confirmedOrder.totalAmount.toLocaleString('fr-FR')} FCFA*.
Numéro client : ${clientPhone}.
Merci de me confirmer la prise en charge !`;

    const whatsappLink = generateWhatsAppLink(pressingPhone, whatsappText);

    return (
      <div className="rounded-3xl bg-white border border-slate-200/80 p-6 md:p-10 space-y-6 text-center shadow-lg">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs uppercase font-bold tracking-wider text-[#F5A300]">
            Demande enregistrée avec succès
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-[#041C4C]">
            Merci pour votre commande, {clientName} !
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Votre demande a bien été transmise à l'équipe de{' '}
            <span className="font-semibold text-[#041C4C]">{organization.name}</span>.
          </p>
        </div>

        {/* Code de suivi réel */}
        <div className="p-5 rounded-2xl bg-[#F7F9FC] border border-amber-300 max-w-sm mx-auto space-y-1 shadow-inner">
          <p className="text-xs text-slate-500 font-medium">Votre code de suivi unique :</p>
          <p className="text-3xl font-black font-mono tracking-widest text-[#041C4C]">
            {confirmedOrder.requestCode}
          </p>
          <p className="text-[11px] text-slate-500">
            Conservez ce code pour suivre l'état de votre linge
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-3 pt-2">
          {/* Bouton WhatsApp prérempli */}
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-md flex items-center justify-center text-sm transition"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Confirmer sur WhatsApp avec {organization.name}
          </a>

          {/* Suivi en ligne */}
          <Link
            href={`/${organization.slug}/suivi?code=${confirmedOrder.requestCode}&tel=${encodeURIComponent(
              clientPhone
            )}`}
            className="w-full py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-[#041C4C] font-semibold rounded-2xl flex items-center justify-center text-xs transition border border-slate-200"
          >
            <Search className="w-4 h-4 mr-2 text-[#0B5CE1]" />
            Voir ma page de suivi en ligne
          </Link>
        </div>

        <p className="text-[11px] text-slate-500">
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
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Étape 1 : Coordonnées Client */}
      <div className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <span className="w-6 h-6 rounded-full bg-[#FFC72C] text-[#041C4C] font-extrabold text-xs flex items-center justify-center">
            1
          </span>
          <h2 className="font-bold text-[#041C4C] text-base">Vos Coordonnées (Sans inscription)</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Jean Koumou"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F9FC] border border-slate-200 text-[#041C4C] placeholder-slate-400 text-sm focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Numéro WhatsApp <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="Ex: 06 731 1016"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F9FC] border border-slate-200 text-[#041C4C] placeholder-slate-400 text-sm font-mono focus:outline-none focus:border-[#0B5CE1] transition"
            />
            <p className="text-[11px] text-slate-500">
              Sert au suivi et à l'envoi de votre reçu officiel.
            </p>
          </div>
        </div>
      </div>

      {/* Étape 2 : Mode de dépôt & Adresse */}
      <div className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <span className="w-6 h-6 rounded-full bg-[#FFC72C] text-[#041C4C] font-extrabold text-xs flex items-center justify-center">
            2
          </span>
          <h2 className="font-bold text-[#041C4C] text-base">Mode de Dépôt / Retrait</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setMode('DROP_OFF')}
            className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
              mode === 'DROP_OFF'
                ? 'bg-amber-50 border-[#F5A300] text-[#041C4C] ring-2 ring-amber-200'
                : 'bg-[#F7F9FC] border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Building className={`w-5 h-5 shrink-0 ${mode === 'DROP_OFF' ? 'text-[#F5A300]' : 'text-slate-400'}`} />
            <div>
              <p className="text-xs font-bold text-[#041C4C]">Dépôt au Pressing</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Je dépose moi-même mes habits</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('PICKUP')}
            className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
              mode === 'PICKUP'
                ? 'bg-amber-50 border-[#F5A300] text-[#041C4C] ring-2 ring-amber-200'
                : 'bg-[#F7F9FC] border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <Truck className={`w-5 h-5 shrink-0 ${mode === 'PICKUP' ? 'text-[#F5A300]' : 'text-slate-400'}`} />
            <div>
              <p className="text-xs font-bold text-[#041C4C]">Collecte à domicile</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Un coursier passe récupérer</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setMode('DELIVERY')}
            className={`p-3.5 rounded-xl border text-left flex items-start space-x-3 transition ${
              mode === 'DELIVERY'
                ? 'bg-amber-50 border-[#F5A300] text-[#041C4C] ring-2 ring-amber-200'
                : 'bg-[#F7F9FC] border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <MapPin className={`w-5 h-5 shrink-0 ${mode === 'DELIVERY' ? 'text-[#F5A300]' : 'text-slate-400'}`} />
            <div>
              <p className="text-xs font-bold text-[#041C4C]">Livraison complète</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Collecte et retour chez vous</p>
            </div>
          </button>
        </div>

        {(mode === 'PICKUP' || mode === 'DELIVERY') && (
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-700">
              Adresse précise (Quartier, Rue, Repère) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Moungali, Rue Mbaka, en face de la pharmacie..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F9FC] border border-slate-200 text-[#041C4C] placeholder-slate-400 text-sm focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Date souhaitée (Optionnel)
            </label>
            <input
              type="date"
              value={desiredDate}
              onChange={(e) => setDesiredDate(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F9FC] border border-slate-200 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Consignes particulières (Optionnel)
            </label>
            <input
              type="text"
              placeholder="Ex: Taches sur col, lavage délicat..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F7F9FC] border border-slate-200 text-[#041C4C] placeholder-slate-400 text-xs focus:outline-none focus:border-[#0B5CE1] transition"
            />
          </div>
        </div>
      </div>

      {/* Étape 3 : Choix des Vêtements & Caractéristiques */}
      <div className="p-5 md:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-100 gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-6 h-6 rounded-full bg-[#FFC72C] text-[#041C4C] font-extrabold text-xs flex items-center justify-center">
              3
            </span>
            <h2 className="font-bold text-[#041C4C] text-base">Sélection des Articles & Détails</h2>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher un habit..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="px-3 py-1.5 pl-8 rounded-lg bg-[#F7F9FC] border border-slate-200 text-[#041C4C] placeholder-slate-400 text-xs w-full sm:w-48 focus:outline-none focus:border-[#0B5CE1]"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
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
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                  inCart
                    ? 'bg-amber-50 border-[#F5A300] ring-1 ring-amber-300'
                    : 'bg-[#F7F9FC] border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-xs font-bold text-[#041C4C] truncate">{service.name}</p>
                  <p className="text-[11px] font-mono font-extrabold text-[#041C4C] mt-0.5">
                    {Number(service.price).toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="text-[10px] truncate">{service.category}</span>
                  {inCart ? (
                    <span className="bg-[#FFC72C] text-[#041C4C] font-black px-1.5 py-0.2 rounded text-[10px]">
                      x{inCart.quantity}
                    </span>
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-[#0B5CE1]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Panier des articles */}
        {selectedItems.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="text-xs uppercase font-bold text-slate-500 tracking-wider">
              Articles sélectionnés ({selectedItems.reduce((acc, i) => acc + i.quantity, 0)})
            </h3>

            <div className="space-y-3">
              {selectedItems.map((item) => (
                <div
                  key={item.service_id}
                  className="p-3.5 rounded-xl bg-[#F7F9FC] border border-slate-200 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 pr-2">
                      <p className="text-xs font-bold text-[#041C4C]">{item.service_name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {item.unit_price.toLocaleString('fr-FR')} FCFA / un.
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.service_id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-[#041C4C] flex items-center justify-center transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="w-6 text-center text-xs font-bold font-mono text-[#041C4C]">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(item.service_id, 1)}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-[#041C4C] flex items-center justify-center transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <span className="w-20 text-right text-xs font-bold font-mono text-[#041C4C]">
                        {(item.quantity * item.unit_price).toLocaleString('fr-FR')} FCFA
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleItemDetails(item.service_id)}
                        className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-[#041C4C] text-[11px] font-medium flex items-center transition ml-1"
                        title="Ajouter détails physiques"
                      >
                        {item.showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.service_id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Résumé des détails */}
                  {(item.color || item.brand || item.size || item.pattern || item.item_notes) && !item.showDetails && (
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-600 pt-1">
                      {item.color && <span className="bg-slate-200 px-2 py-0.5 rounded">Couleur: {item.color}</span>}
                      {item.pattern && <span className="bg-slate-200 px-2 py-0.5 rounded">Motif: {item.pattern}</span>}
                      {item.brand && <span className="bg-slate-200 px-2 py-0.5 rounded">Marque: {item.brand}</span>}
                      {item.size && <span className="bg-slate-200 px-2 py-0.5 rounded">Taille: {item.size}</span>}
                      {item.item_notes && <span className="bg-amber-200 px-2 py-0.5 rounded">Note: {item.item_notes}</span>}
                    </div>
                  )}

                  {/* Formulaire détails */}
                  {item.showDetails && (
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Couleur</label>
                        <input
                          type="text"
                          placeholder="ex: Blanc, Bleu"
                          value={item.color || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'color', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Motif</label>
                        <input
                          type="text"
                          placeholder="ex: Uni, Rayé"
                          value={item.pattern || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'pattern', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Marque</label>
                        <input
                          type="text"
                          placeholder="ex: Zara, Boss"
                          value={item.brand || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'brand', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Taille</label>
                        <input
                          type="text"
                          placeholder="ex: M, L, 42"
                          value={item.size || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'size', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>

                      <div className="col-span-2 sm:col-span-2">
                        <label className="block text-[10px] text-slate-500 mb-0.5">Remarques</label>
                        <input
                          type="text"
                          placeholder="ex: Tache col, bouton manquant..."
                          value={item.item_notes || ''}
                          onChange={(e) => handleUpdateItemAttribute(item.service_id, 'item_notes', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[#041C4C] text-xs focus:outline-none focus:border-[#0B5CE1]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
              <span className="text-xs font-bold text-[#041C4C]">Total estimé de la commande :</span>
              <span className="text-base font-black font-mono text-[#041C4C]">
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
          className="w-full py-4 px-6 bg-[#FFC72C] hover:bg-[#F5A300] disabled:opacity-50 disabled:cursor-not-allowed text-[#041C4C] font-extrabold rounded-2xl shadow-md flex items-center justify-center text-sm md:text-base transition min-h-[48px]"
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <span className="w-4 h-4 mr-2 border-2 border-[#041C4C] border-t-transparent rounded-full animate-spin" />
              Traitement de votre demande...
            </span>
          ) : (
            <span className="flex items-center">
              <ShoppingBag className="w-5 h-5 mr-2" />
              Valider ma demande de pressing ({subtotal.toLocaleString('fr-FR')} FCFA)
            </span>
          )}
        </button>
        <p className="text-center text-[11px] text-slate-500 mt-2">
          Aucun paiement immédiat requis. Vous recevrez un code de suivi et pourrez confirmer sur WhatsApp.
        </p>
      </div>
    </form>
  );
}
