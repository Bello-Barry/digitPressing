import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PublicBottomNav } from '@/components/public/PublicBottomNav';
import { CategoryAccordions } from '@/components/public/CategoryAccordions';
import { ArrowLeft, ShoppingCart, Sparkles } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function TarifsPage({ params }: PageProps) {
  const { slug } = await params;
  const db = await createServerSupabaseClient();

  const { data: org } = await db
    .from('organizations')
    .select('id, name, slug, phone_1')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (!org) {
    notFound();
  }

  const { data: rawServices } = await db
    .from('services')
    .select('id, name, description, category, price, estimated_days')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('category')
    .order('price');

  const services = rawServices || [];

  const legacyCategoryLabels: Record<string, string> = {
    vetement: 'Vêtements du quotidien',
    ceremonie: 'Costumes et cérémonie',
    traditionnel: 'Tenues Traditionnelles (Bazin / Pagne)',
    maison: 'Linge de maison',
    cuir: 'Cuir & Daim',
    chaussure: 'Chaussures & Baskets',
    repassage: 'Repassage seul',
    retouche: 'Retouches & Coutures',
    accessoire: 'Accessoires & Sacs',
  };

  const servicesByCategory = services.reduce((acc, s) => {
    const rawCat = (s.category || 'Vêtements').trim();
    const displayCat = legacyCategoryLabels[rawCat.toLowerCase()] || rawCat;
    if (!acc[displayCat]) acc[displayCat] = [];
    acc[displayCat].push(s);
    return acc;
  }, {} as Record<string, typeof services>);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#041C4C] flex flex-col font-sans pb-28 md:pb-12">
      {/* En-tête bleu nuit */}
      <header className="sticky top-0 z-40 bg-[#041C4C] text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center text-xs font-bold text-slate-200 hover:text-[#FFC72C] transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-[#FFC72C]" />
            Retour
          </Link>

          <Link
            href={`/${slug}/commander`}
            className="px-3.5 py-1.5 text-xs font-extrabold bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] rounded-xl shadow-xs flex items-center transition"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
            Commander
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-5 space-y-5">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#FFC72C]/20 text-[#041C4C] border border-amber-300 text-xs font-bold">
            <Sparkles className="w-3 h-3 text-[#F5A300]" />
            <span>Grille Tarifaire Officielle</span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-[#041C4C] tracking-tight">
            Tarifs & Prestations
          </h1>
          <p className="text-xs text-slate-600">
            {org.name} — Tous les tarifs sont nets, en FCFA.
          </p>
        </div>

        {/* Accordéons interactifs par catégorie */}
        <CategoryAccordions slug={slug} servicesByCategory={servicesByCategory} />

        {/* CTA Bas de page */}
        <div className="rounded-2xl bg-white border border-amber-300 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[#041C4C]">Prêt à nous confier votre linge ?</h3>
            <p className="text-xs text-slate-600">
              Commandez en 1 minute sans créer de compte.
            </p>
          </div>
          <Link
            href={`/${slug}/commander`}
            className="w-full sm:w-auto px-4 py-2.5 bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] font-extrabold rounded-xl text-xs flex items-center justify-center transition shadow-2xs"
          >
            Passer ma commande
          </Link>
        </div>
      </main>

      <PublicBottomNav slug={slug} phone1={org.phone_1} orgName={org.name} />
    </div>
  );
}
