import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrganizationBySlug, getActiveServices } from '@/lib/supabase';
import { OrderForm } from '@/components/public/OrderForm';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrderPage({ params }: PageProps) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);

  if (!org) {
    notFound();
  }

  const services = await getActiveServices(org.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center text-xs font-semibold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-amber-400" />
            Accueil {org.name}
          </Link>

          <div className="flex items-center space-x-1.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Commande directe sans compte</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Étape simple & rapide</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Commander votre Pressing en Ligne
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            Sélectionnez vos vêtements, renseignez votre numéro WhatsApp et confirmez votre demande.
          </p>
        </div>

        <OrderForm
          organization={{
            id: org.id,
            name: org.name,
            slug: org.slug,
            ticket_prefix: org.ticket_prefix,
            phone_1: org.phone_1,
            phone_2: org.phone_2,
          }}
          services={services.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            price: Number(s.price),
          }))}
        />
      </main>
    </div>
  );
}
