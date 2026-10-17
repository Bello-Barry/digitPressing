'use client';

// =============================================================================
// COMPOSANT SUIVI DE COMMANDE SANS COMPTE (THÈME BLEU & JAUNE)
// =============================================================================

import React, { useState, useEffect } from 'react';
import { trackOrderAction } from '@/actions/orders';
import { generateWhatsAppLink } from '@/lib/whatsapp';
import {
  Search,
  AlertCircle,
  MessageCircle,
} from 'lucide-react';

interface OrderTrackingProps {
  slug: string;
  initialCode?: string;
  initialPhone?: string;
  orgName: string;
  orgPhone: string;
}

interface TrackingResult {
  request_code: string;
  ticket_number: string | null;
  status: string;
  client_name: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export function OrderTrackingView({
  slug,
  initialCode = '',
  initialPhone = '',
  orgName,
  orgPhone,
}: OrderTrackingProps) {
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState(initialPhone);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingResult | null>(null);

  useEffect(() => {
    if (initialCode && initialPhone) {
      handleSearch(initialCode, initialPhone);
    }
  }, [initialCode, initialPhone]);

  const handleSearch = async (c = code, p = phone) => {
    if (!c.trim() || !p.trim()) {
      setErrorMsg('Veuillez renseigner le code et le numéro de téléphone.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await trackOrderAction(slug, c.trim(), p.trim());
      if (!res.success || !res.tracking) {
        setErrorMsg(res.error || 'Aucune commande trouvée. Vérifiez vos identifiants.');
        setTrackingData(null);
      } else {
        setTrackingData(res.tracking);
      }
    } catch {
      setErrorMsg('Erreur de connexion.');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { key: 'REQUEST', label: 'Demande enregistrée', desc: 'En attente de validation' },
    { key: 'VALIDATED', label: 'Demande validée', desc: 'Prise en charge confirmée' },
    { key: 'RECEIVED', label: 'Linge réceptionné', desc: 'Articles comptés & étiquetés' },
    { key: 'PROCESSING', label: 'En traitement', desc: 'Lavage & repassage soigné' },
    { key: 'READY', label: 'Prêt pour retrait / livraison', desc: 'Votre linge est prêt !' },
    { key: 'DELIVERED', label: 'Commande livrée / remise', desc: 'Terminée' },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case 'REQUEST':
        return 0;
      case 'VALIDATED':
        return 1;
      case 'RECEIVED':
        return 2;
      case 'PROCESSING':
        return 3;
      case 'READY':
        return 4;
      case 'DELIVERED':
        return 5;
      default:
        return 0;
    }
  };

  const currentIndex = trackingData ? getStepIndex(trackingData.status) : 0;
  const isCancelled = trackingData?.status === 'CANCELLED' || trackingData?.status === 'REJECTED';

  const helpWhatsApp = generateWhatsAppLink(
    orgPhone,
    `Bonjour ${orgName} 👋 J'aimerais des informations sur le suivi de ma commande ${code || ''}.`
  );

  return (
    <div className="space-y-5">
      {/* Formulaire de recherche */}
      <div className="p-5 md:p-6 rounded-[24px] bg-white border border-[#D9E4FA] shadow-brand-card space-y-4">
        <h2 className="text-base font-extrabold text-[#041C4C] flex items-center">
          <Search className="w-4 h-4 mr-2 text-[#0B5CE1]" />
          Consulter l'état de votre commande
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#041C4C]">
              Code de demande ou Ticket
            </label>
            <input
              type="text"
              placeholder="Ex: D-0001 ou LB-0001"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              className="w-full h-[48px] px-4 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] placeholder-[#4A5F86]/60 font-mono text-sm focus:outline-none focus:border-[#0B5CE1] uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-[#041C4C]">
              Numéro WhatsApp
            </label>
            <input
              type="tel"
              placeholder="Ex: 06 731 1016"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full h-[48px] px-4 rounded-2xl bg-[#EEF4FF] border border-[#D9E4FA] text-[#041C4C] placeholder-[#4A5F86]/60 font-mono text-sm focus:outline-none focus:border-[#0B5CE1]"
            />
          </div>

          <div className="sm:col-span-2 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[52px] bg-[#FFC72C] hover:bg-[#FFC72C]/90 disabled:opacity-50 text-[#041C4C] font-black rounded-2xl text-sm transition flex items-center justify-center active:scale-95 shadow-xs"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <span className="w-4 h-4 mr-2 border-2 border-[#041C4C] border-t-transparent rounded-full animate-spin" />
                  Recherche en cours...
                </span>
              ) : (
                <span className="flex items-center">
                  <Search className="w-4 h-4 mr-2" />
                  Rechercher ma commande
                </span>
              )}
            </button>
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Résultat du Suivi */}
      {trackingData && (
        <div className="rounded-[24px] bg-white border border-[#D9E4FA] p-6 md:p-8 space-y-6 shadow-brand-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#D9E4FA] gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#0B5CE1]">
                Commande de {trackingData.client_name}
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <h3 className="text-xl md:text-2xl font-black font-mono text-[#041C4C]">
                  {trackingData.ticket_number || trackingData.request_code}
                </h3>
                {trackingData.ticket_number && (
                  <span className="text-xs bg-[#041C4C] text-[#FFC72C] px-2.5 py-0.5 rounded-md font-extrabold">
                    Ticket officiel
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <p className="text-xs text-[#4A5F86]">Montant total estimé</p>
              <p className="text-lg md:text-xl font-black font-mono text-[#041C4C]">
                {Number(trackingData.total_amount).toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          {/* État Spécifique Annulé ou Rejeté */}
          {isCancelled ? (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 space-y-1">
              <p className="font-bold text-sm">
                Commande {trackingData.status === 'CANCELLED' ? 'Annulée' : 'Refusée'}
              </p>
              <p className="text-xs text-slate-600">
                Cette commande a été marquée comme {trackingData.status.toLowerCase()}. Veuillez contacter le pressing pour toute question.
              </p>
            </div>
          ) : (
            /* Timeline des étapes */
            <div className="space-y-4">
              <h4 className="text-xs uppercase font-black tracking-wider text-[#041C4C]">
                Progression du traitement
              </h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#D9E4FA]">
                {steps.map((step, idx) => {
                  const isDone = idx < currentIndex;
                  const isCurrent = idx === currentIndex;

                  return (
                    <div key={step.key} className="relative flex items-start space-x-3">
                      <div
                        className={`absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${
                          isDone
                            ? 'bg-[#0B5CE1] border-[#0B5CE1] text-white'
                            : isCurrent
                            ? 'bg-[#FFC72C] border-[#041C4C] text-[#041C4C] ring-4 ring-[#FFC72C]/30'
                            : 'bg-white border-[#D9E4FA] text-[#4A5F86]'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>

                      <div className="space-y-0.5">
                        <p
                          className={`text-xs font-bold ${
                            isCurrent
                              ? 'text-[#041C4C] font-black'
                              : isDone
                              ? 'text-[#041C4C]'
                              : 'text-[#4A5F86]'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11px] text-[#4A5F86]">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact d'assistance */}
          <div className="pt-4 border-t border-[#D9E4FA] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-[#4A5F86]">Une question sur vos vêtements ?</span>
            <a
              href={helpWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-[#041C4C] hover:text-[#0B5CE1] font-extrabold"
            >
              <MessageCircle className="w-4 h-4 mr-1.5 text-emerald-600" />
              Contacter {orgName} sur WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
