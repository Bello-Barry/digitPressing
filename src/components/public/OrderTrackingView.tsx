'use client';

// =============================================================================
// COMPOSANT SUIVI DE COMMANDE SANS COMPTE
// Saisie code de demande (D-XXXX) + Téléphone -> Appel RPC sécurisée
// =============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { trackOrderAction } from '@/actions/orders';
import { generateWhatsAppLink, formatPhoneDisplay } from '@/lib/whatsapp';
import {
  Search,
  CheckCircle,
  Clock,
  Shirt,
  Sparkles,
  PackageCheck,
  Truck,
  AlertCircle,
  MessageCircle,
  ArrowRight,
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

  // Auto-recherche si paramètres présents dans l'URL
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
    } catch (err: unknown) {
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
    <div className="space-y-6">
      {/* Formulaire de recherche */}
      <div className="p-5 md:p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center">
          <Search className="w-4 h-4 mr-2 text-amber-400" />
          Consulter l'état de votre commande
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Code de demande ou Ticket
            </label>
            <input
              type="text"
              placeholder="Ex: D-0001 ou LB-0001"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-amber-500 uppercase"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Numéro de téléphone
            </label>
            <input
              type="tel"
              placeholder="Ex: 06 731 1016"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 font-mono text-sm focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="sm:col-span-2 pt-1">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition flex items-center justify-center"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <span className="w-4 h-4 mr-2 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
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
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Résultat du Suivi */}
      {trackingData && (
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400">
                Commande de {trackingData.client_name}
              </span>
              <div className="flex items-center space-x-2 mt-0.5">
                <h3 className="text-xl md:text-2xl font-extrabold font-mono text-white">
                  {trackingData.ticket_number || trackingData.request_code}
                </h3>
                {trackingData.ticket_number && (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-semibold">
                    Ticket officiel
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <p className="text-xs text-slate-400">Montant total estimé</p>
              <p className="text-lg md:text-xl font-extrabold font-mono text-amber-400">
                {Number(trackingData.total_amount).toLocaleString('fr-FR')} FCFA
              </p>
            </div>
          </div>

          {/* État Spécifique Annulé ou Rejeté */}
          {isCancelled ? (
            <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 space-y-1">
              <p className="font-bold text-sm">
                Commande {trackingData.status === 'CANCELLED' ? 'Annulée' : 'Refusée'}
              </p>
              <p className="text-xs text-slate-300">
                Cette commande a été marquée comme {trackingData.status.toLowerCase()}. Veuillez contacter le pressing pour toute question.
              </p>
            </div>
          ) : (
            /* Timeline des étapes */
            <div className="space-y-4">
              <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Progression du traitement
              </h4>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {steps.map((step, idx) => {
                  const isDone = idx < currentIndex;
                  const isCurrent = idx === currentIndex;

                  return (
                    <div key={step.key} className="relative flex items-start space-x-3">
                      <div
                        className={`absolute -left-6 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition ${
                          isDone
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                            : isCurrent
                            ? 'bg-amber-500 border-amber-400 text-slate-950 ring-4 ring-amber-500/20'
                            : 'bg-slate-950 border-slate-800 text-slate-600'
                        }`}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>

                      <div className="space-y-0.5">
                        <p
                          className={`text-xs font-bold ${
                            isCurrent
                              ? 'text-amber-400 font-extrabold'
                              : isDone
                              ? 'text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-[11px] text-slate-400">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact d'assistance */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-400">Une question sur vos vêtements ?</span>
            <a
              href={helpWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Contacter {orgName} sur WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
