import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { PublicBottomNav } from '@/components/public/PublicBottomNav';
import { ArrowLeft, Clock, ShoppingCart, Sparkles } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ServicesCatalogPage({ params }: PageProps) {
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
    <div className="min-h-screen bg-[#F7F9FC] text-[#041C4C] flex flex-col font-sans pb-20 md:pb-0">
      {/* En-tête bleu nuit */}
      <header className="sticky top-0 z-40 bg-[#041C4C] text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center text-xs font-bold text-slate-200 hover:text-[#FFC72C] transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-[#FFC72C]" />
            Retour à l'accueil
          </Link>

          <Link
            href={`/${slug}/commander`}
            className="px-3.5 py-1.5 text-xs font-extrabold bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] rounded-xl shadow-sm flex items-center transition"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
            Passer commande
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#FFC72C]/20 text-[#041C4C] border border-amber-300 text-xs font-bold">
            <Sparkles className="w-3 h-3 text-[#F5A300]" />
            <span>Grille Tarifaire Officielle</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#041C4C] tracking-tight">
            Catalogue des Prestations & Tarifs
          </h1>
          <p className="text-xs md:text-sm text-slate-600">
            {org.name} — Tous les prix sont indiqués en FCFA pour un traitement soigné et professionnel.
          </p>
        </div>

        {/* Grille par Catégorie */}
        <div className="space-y-8">
          {Object.entries(servicesByCategory).map(([catName, items]) => (
            <div key={catName} className="space-y-3">
              <h2 className="text-base font-extrabold text-[#041C4C] flex items-center border-b border-slate-200 pb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F5A300] mr-2" />
                {catName}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  ({items.length})
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {items.map((service) => (
                  <div
                    key={service.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-[#FFC72C] transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h3 className="font-bold text-[#041C4C] text-sm">
                          {service.name}
                        </h3>
                        <span className="text-xs font-mono font-black text-[#041C4C] bg-[#FFC72C]/20 px-2 py-0.5 rounded-md shrink-0 ml-2">
                          {Number(service.price).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      {service.description && (
                        <p className="text-xs text-slate-500 mt-1">
                          {service.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-slate-400" />
                        Délai moyen : ~{service.estimated_days || 2}j
                      </span>
                      <Link
                        href={`/${slug}/commander`}
                        className="text-[#0B5CE1] hover:underline font-bold text-[11px]"
                      >
                        Ajouter +
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Call to Action */}
        <div className="rounded-2xl bg-white border border-amber-300 p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-[#041C4C]">Prêt à confier votre linge ?</h3>
            <p className="text-xs text-slate-600">
              Commandez en quelques clics sans créer de compte.
            </p>
          </div>
          <Link
            href={`/${slug}/commander`}
            className="w-full sm:w-auto px-5 py-3 bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] font-extrabold rounded-xl text-xs flex items-center justify-center transition"
          >
            Remplir ma demande en ligne
          </Link>
        </div>
      </main>

      <PublicBottomNav slug={slug} phone1={org.phone_1} orgName={org.name} />
    </div>
  );
}
