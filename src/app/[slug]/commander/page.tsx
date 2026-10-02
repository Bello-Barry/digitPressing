'use client';

// =============================================================================
// PUBLIC ORDER FORM LB PRESSING (/{slug}/commander)
// Zod Validation, Phone Normalization, Spam Honeypot, Temporary Request Code
// =============================================================================

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  CheckCircle,
  MessageCircle,
  Shirt,
  Truck,
  Plus,
  Minus,
  Calendar,
  Clock,
  MapPin,
  ShieldCheck,
  Search
} from 'lucide-react';
import { LB_PRESSING_ORGANIZATION, LB_PRESSING_SERVICES } from '@/lib/fixtures';
import { formatCurrency, normalizePhoneNumber } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const orderFormSchema = z.object({
  clientName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  whatsappPhone: z.string().min(8, 'Numéro de téléphone valide requis'),
  serviceType: z.enum(['deposit', 'withdrawal', 'both']),
  homeDelivery: z.boolean().default(false),
  deliveryAddress: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  notes: z.string().optional(),
  honeypot: z.string().max(0, 'Spam détecté'), // Anti-spam honeypot
});

type OrderFormData = z.infer<typeof orderFormSchema>;

export default function PublicOrderPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || 'lb-pressing';

  // Selected Service Quantities
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<{
    requestCode: string;
    clientName: string;
    normalizedPhone: string;
    totalAmount: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      clientName: '',
      whatsappPhone: '',
      serviceType: 'deposit',
      homeDelivery: false,
      deliveryAddress: '',
      preferredDate: new Date().toISOString().split('T')[0],
      preferredTime: '10:00',
      notes: '',
      honeypot: '',
    },
  });

  const homeDelivery = watch('homeDelivery');

  const updateQuantity = (articleId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[articleId] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [articleId]: updated };
    });
  };

  // Total Estimation
  const totalEstimation = Object.entries(quantities).reduce((sum, [artId, qty]) => {
    const service = LB_PRESSING_SERVICES.find(s => s.id === artId);
    return sum + (service ? service.defaultPrice * qty : 0);
  }, 0);

  const onSubmit = async (data: OrderFormData) => {
    try {
      setIsSubmitting(true);

      // Verify honeypot anti-spam
      if (data.honeypot && data.honeypot.length > 0) {
        console.warn('Spam submission blocked');
        return;
      }

      // Phone Normalization
      const normalizedPhone = normalizePhoneNumber(data.whatsappPhone, 'CG');

      // Temporary Request Code generation (e.g. D-0042)
      const randomVal = Math.floor(10 + Math.random() * 90);
      const requestCode = `D-00${randomVal}`;

      setSubmittedOrder({
        requestCode,
        clientName: data.clientName,
        normalizedPhone,
        totalAmount: totalEstimation,
      });

    } catch (err) {
      console.error('Erreur lors de la soumission de la demande:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // WhatsApp confirmation url
  const getWhatsAppConfirmUrl = () => {
    if (!submittedOrder) return '#';
    const cleanPhone = LB_PRESSING_ORGANIZATION.settings.whatsappNumber || '242068000000';
    const message = encodeURIComponent(
      `Bonjour LB Pressing, je confirme ma demande de dépôt ${submittedOrder.requestCode} au nom de ${submittedOrder.clientName}.`
    );
    return `https://wa.me/${cleanPhone}?text=${message}`;
  };

  // View 2: Confirmation View after submission
  if (submittedOrder) {
    return (
      <div className="min-h-screen bg-black text-amber-50 flex flex-col font-sans p-4 sm:p-6 justify-center items-center">
        <div className="max-w-md w-full bg-neutral-900 border border-amber-500/40 rounded-2xl p-6 sm:p-8 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400">
            <CheckCircle className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs text-amber-400/80 font-bold uppercase tracking-widest">Demande Enregistrée</span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Merci, {submittedOrder.clientName}</h1>
            <p className="text-xs text-neutral-400">
              Votre demande a bien été reçue par l'équipe LB Pressing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black border border-amber-500/30 space-y-1">
            <span className="text-xs text-neutral-400 block">Code de suivi temporaire</span>
            <span className="text-3xl font-black text-amber-400 tracking-wider block">{submittedOrder.requestCode}</span>
            <span className="text-[11px] text-neutral-500 block">
              Estimation totale : {formatCurrency(submittedOrder.totalAmount)}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href={getWhatsAppConfirmUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Confirmer sur WhatsApp
            </a>

            <Button
              variant="outline"
              onClick={() => router.push(`/${slug}/suivi`)}
              className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-sm py-3 h-11"
            >
              <Search className="mr-2 h-4 w-4" />
              Suivre ma demande
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // View 1: Form View
  return (
    <div className="min-h-screen bg-black text-amber-50 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-amber-500/20 bg-black/90 backdrop-blur-md px-4 lg:px-8 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href={`/${slug}`} className="flex items-center space-x-2 text-amber-300 hover:text-amber-200 text-sm font-semibold">
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </Link>
          <span className="font-extrabold text-white text-lg">{LB_PRESSING_ORGANIZATION.name}</span>
          <span className="text-xs text-amber-400/80 font-bold border border-amber-500/30 px-2.5 py-1 rounded-full">
            Sans Compte
          </span>
        </div>
      </header>

      {/* Form Container */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Demande de Dépôt / Retrait</h1>
          <p className="text-xs sm:text-sm text-neutral-400">
            Remplissez ce formulaire rapide. Aucun mot de passe requis.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Honeypot Spam Prevention */}
          <input
            type="text"
            {...register('honeypot')}
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
          />

          {/* Coordonnées Client */}
          <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/90 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400" />
              1. Vos Informations
            </h2>

            <div className="space-y-3">
              <div>
                <Label htmlFor="clientName" className="text-xs text-neutral-300 font-semibold mb-1 block">
                  Nom Complet *
                </Label>
                <Input
                  id="clientName"
                  placeholder="Ex: Mabiala Matingou"
                  {...register('clientName')}
                  className="bg-black border-neutral-800 text-white h-11 text-sm focus:border-amber-400"
                />
                {errors.clientName && (
                  <p className="text-xs text-red-400 mt-1">{errors.clientName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="whatsappPhone" className="text-xs text-neutral-300 font-semibold mb-1 block">
                  Numéro WhatsApp (pour le suivi) *
                </Label>
                <Input
                  id="whatsappPhone"
                  placeholder="Ex: 066112233"
                  {...register('whatsappPhone')}
                  className="bg-black border-neutral-800 text-white h-11 text-sm focus:border-amber-400"
                />
                {errors.whatsappPhone && (
                  <p className="text-xs text-red-400 mt-1">{errors.whatsappPhone.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Sélection des Services */}
          <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/90 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Shirt className="h-4 w-4 text-amber-400" />
                2. Sélection des Vêtements
              </h2>
              <span className="text-xs font-bold text-amber-400">
                Total estimé: {formatCurrency(totalEstimation)}
              </span>
            </div>

            <div className="space-y-3">
              {LB_PRESSING_SERVICES.map((service) => {
                const qty = quantities[service.id] || 0;
                return (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-black/60"
                  >
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-white">{service.name}</p>
                      <p className="text-[11px] text-amber-400">{formatCurrency(service.defaultPrice)} / unité</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => updateQuantity(service.id, -1)}
                        className="h-8 w-8 rounded-lg border-neutral-700 text-white hover:bg-neutral-800"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold text-white w-6 text-center">{qty}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => updateQuantity(service.id, 1)}
                        className="h-8 w-8 rounded-lg border-amber-500/40 text-amber-300 hover:bg-amber-500/20"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Options de Livraison & Préférences */}
          <div className="p-5 rounded-2xl border border-neutral-800 bg-neutral-900/90 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-400" />
              3. Modalités & Livraison
            </h2>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-black/60">
                <label htmlFor="homeDelivery" className="text-xs sm:text-sm font-bold text-white cursor-pointer">
                  Demander la livraison à domicile
                </label>
                <input
                  type="checkbox"
                  id="homeDelivery"
                  {...register('homeDelivery')}
                  className="h-5 w-5 rounded border-neutral-700 text-amber-500 focus:ring-amber-400"
                />
              </div>

              {homeDelivery && (
                <div>
                  <Label htmlFor="deliveryAddress" className="text-xs text-neutral-300 font-semibold mb-1 block">
                    Adresse complète de livraison
                  </Label>
                  <Input
                    id="deliveryAddress"
                    placeholder="Quartier, Rue, Référence..."
                    {...register('deliveryAddress')}
                    className="bg-black border-neutral-800 text-white h-11 text-sm focus:border-amber-400"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="preferredDate" className="text-xs text-neutral-300 font-semibold mb-1 block">
                    Date souhaitée
                  </Label>
                  <Input
                    id="preferredDate"
                    type="date"
                    {...register('preferredDate')}
                    className="bg-black border-neutral-800 text-white h-11 text-xs focus:border-amber-400"
                  />
                </div>

                <div>
                  <Label htmlFor="preferredTime" className="text-xs text-neutral-300 font-semibold mb-1 block">
                    Heure souhaitée
                  </Label>
                  <Input
                    id="preferredTime"
                    type="time"
                    {...register('preferredTime')}
                    className="bg-black border-neutral-800 text-white h-11 text-xs focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes" className="text-xs text-neutral-300 font-semibold mb-1 block">
                  Instructions ou commentaires (Optionnel)
                </Label>
                <Textarea
                  id="notes"
                  rows={2}
                  placeholder="Ex: Tache particulière sur le col de la chemise..."
                  {...register('notes')}
                  className="bg-black border-neutral-800 text-white text-xs focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-600 hover:to-yellow-500 text-black font-extrabold text-base py-6 rounded-xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all"
          >
            {isSubmitting ? 'Enregistrement...' : 'Envoyer ma demande de dépôt'}
          </Button>
        </form>
      </main>
    </div>
  );
}
