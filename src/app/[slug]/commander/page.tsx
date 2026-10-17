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
    <div className="min-h-screen bg-[#EEF4FF] text-[#041C4C] flex flex-col font-sans pb-24 md:pb-8">
      {/* En-tête bleu nuit */}
      <header className="sticky top-0 z-40 bg-[#041C4C] text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center text-xs font-bold text-slate-200 hover:text-[#FFC72C] transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-[#FFC72C]" />
            Accueil {org.name}
          </Link>

          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-[#FFC72C]" />
            <span>Sans création de compte</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-5 space-y-5">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#041C4C] text-[#FFC72C] text-xs font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC72C]" />
            <span>Étape simple & rapide</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-[#041C4C] tracking-tight">
            Commander votre Pressing en Ligne
          </h1>
          <p className="text-xs text-[#4A5F86]">
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
