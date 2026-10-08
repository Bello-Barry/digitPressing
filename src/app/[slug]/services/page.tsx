import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { ArrowLeft, Clock, ShoppingCart, Sparkles } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ServicesCatalogPage({ params }: PageProps) {
  const { slug } = await params;
  const db = await createServerSupabaseClient();

  const { data: org } = await db
    .from('organizations')
    .select('id, name, slug')
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

  // Map des anciennes clés vers de beaux titres si besoin
  const legacyCategoryLabels: Record<string, string> = {
    vetement: 'Vêtements',
    ceremonie: 'Costumes et cérémonie',
    traditionnel: 'Tenues Traditionnelles (Bazin / Pagne)',
    maison: 'Linge de maison',
    cuir: 'Cuir & Daim',
    chaussure: 'Chaussures & Baskets',
    retouche: 'Retouches & Coutures',
    accessoire: 'Accessoires & Autres',
  };

  // Regroupement dynamique par catégorie
  const servicesByCategory = services.reduce((acc, s) => {
    const rawCat = s.category || 'Vêtements';
    const displayCat = legacyCategoryLabels[rawCat] || rawCat;
    if (!acc[displayCat]) acc[displayCat] = [];
    acc[displayCat].push(s);
    return acc;
  }, {} as Record<string, typeof services>);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center text-xs font-semibold text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-amber-400" />
            Retour à l'accueil
          </Link>

          <Link
            href={`/${slug}/commander`}
            className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-md shadow-amber-500/20 flex items-center transition"
          >
            <ShoppingCart className="w-3.5 h-3.5 mr-1.5" />
            Passer commande
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>Grille Tarifaire Officielle</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Catalogue des Prestations & Tarifs
          </h1>
          <p className="text-xs md:text-sm text-slate-400">
            {org.name} — Tous les prix sont indiqués en FCFA pour un traitement soigné et professionnel.
          </p>
        </div>

        {/* Grille par Catégorie */}
        <div className="space-y-8">
          {Object.entries(servicesByCategory).map(([catName, items]) => (
            <div key={catName} className="space-y-3">
              <h2 className="text-base font-bold text-amber-400/90 flex items-center border-b border-slate-800 pb-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 mr-2" />
                {catName}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({items.length})
                </span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {items.map((service) => (
                  <div
                    key={service.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h3 className="font-semibold text-white text-sm">
                          {service.name}
                        </h3>
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md shrink-0 ml-2">
                          {Number(service.price).toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                      {service.description && (
                        <p className="text-xs text-slate-400 mt-1">
                          {service.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                      <span className="flex items-center">
                        <Clock className="w-3 h-3 mr-1 text-slate-500" />
                        Délai moyen : ~{service.estimated_days || 2}j
                      </span>
                      <Link
                        href={`/${slug}/commander`}
                        className="text-amber-400 hover:text-amber-300 font-semibold text-[11px]"
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
        <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Prêt à confier votre linge ?</h3>
            <p className="text-xs text-slate-400">
              Commandez en quelques clics sans créer de compte.
            </p>
          </div>
          <Link
            href={`/${slug}/commander`}
            className="w-full sm:w-auto px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center transition"
          >
            Remplir ma demande en ligne
          </Link>
        </div>
      </main>
    </div>
  );
}
