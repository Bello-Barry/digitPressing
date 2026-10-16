import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { OrderForm } from '@/components/public/OrderForm';
import { PublicBottomNav } from '@/components/public/PublicBottomNav';
import { ArrowLeft, ShieldCheck, Sparkles } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function OrderPage({ params }: PageProps) {
  const { slug } = await params;
  const db = await createServerSupabaseClient();

  const { data: org } = await db
    .from('organizations')
    .select('id, name, slug, ticket_prefix, phone_1, phone_2')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!org) {
    notFound();
  }

  const { data: services } = await db
    .from('services')
    .select('id, name, category, price')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('category')
    .order('price');

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#041C4C] flex flex-col font-sans pb-20 md:pb-0">
      {/* En-tête bleu nuit */}
      <header className="sticky top-0 z-40 bg-[#041C4C] text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center text-xs font-bold text-slate-200 hover:text-[#FFC72C] transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-[#FFC72C]" />
            Accueil {org.name}
          </Link>

          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Sans création de compte</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#FFC72C]/20 text-[#041C4C] border border-amber-300 text-xs font-bold">
            <Sparkles className="w-3 h-3 text-[#F5A300]" />
            <span>Étape simple & rapide</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#041C4C] tracking-tight">
            Commander votre Pressing en Ligne
          </h1>
          <p className="text-xs md:text-sm text-slate-600">
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
          services={(services || []).map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            price: Number(s.price),
          }))}
        />
      </main>

      <PublicBottomNav slug={slug} phone1={org.phone_1} orgName={org.name} />
    </div>
  );
}
