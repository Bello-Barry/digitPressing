import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateWhatsAppLink, formatPhoneDisplay } from '@/lib/whatsapp';
import { BRAND_CONFIG } from '@/config/brand';
import {
  calculateCategoryMinPrices,
  getAvailablePhotos,
} from '@/lib/showcase';
import { PublicBottomNav } from '@/components/public/PublicBottomNav';
import { pickServiceIcon, MotorbikeIcon, HangerIcon } from '@/components/icons/service-icons';
import {
  ArrowRight,
  CalendarCheck,
  MessageCircle,
  MapPin,
  Clock,
  Phone,
  ExternalLink,
  Sparkles,
  Timer,
  Leaf,
  Truck,
  Package,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  let orgName = BRAND_CONFIG.name;
  let orgSlogan = BRAND_CONFIG.slogan;

  try {
    const db = await createServerSupabaseClient();
    const { data: org } = await db
      .from('organizations')
      .select('name, slogan')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (org) {
      orgName = org.name;
      if (org.slogan) orgSlogan = org.slogan;
    }
  } catch {
    // Mode hors-ligne / fallback
  }

  const isLb = slug === 'lb-pressing';
  const title = isLb
    ? 'LB Pressing | Application de Blanchisserie & Pressing'
    : `${orgName} | Pressing & Blanchisserie Haute Qualité`;
  const description = orgSlogan || BRAND_CONFIG.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: isLb ? 'LB Pressing' : orgName,
      url: `${BRAND_CONFIG.siteUrl}/${slug}`,
      images: [
        {
          url: `${BRAND_CONFIG.siteUrl}${BRAND_CONFIG.assets.ogImage}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BRAND_CONFIG.siteUrl}${BRAND_CONFIG.assets.ogImage}`],
    },
  };
}

export default async function PublicOrgHomePage({ params }: PageProps) {
  const { slug } = await params;

  let org: {
    id: string;
    name: string;
    slug: string;
    ticket_prefix: string;
    phone_1: string | null;
    phone_2: string | null;
    slogan: string | null;
    address: string | null;
    footer_text: string | null;
  } | null = null;

  let rawServices: Array<{
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    price: number | string;
    estimated_days?: number | null;
  }> = [];

  try {
    const db = await createServerSupabaseClient();
    const { data: dbOrg } = await db
      .from('organizations')
      .select('id, name, slug, ticket_prefix, phone_1, phone_2, slogan, address, footer_text')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (dbOrg) {
      org = dbOrg;
      const { data: dbServices } = await db
        .from('services')
        .select('id, name, description, category, price, estimated_days')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('category')
        .order('price');

      rawServices = dbServices || [];
    }
  } catch {
    // Mode dev / hors-ligne sans connexion Supabase active
  }

  // Fallback dev/default pour lb-pressing si la DB est absente
  if (!org && slug === 'lb-pressing') {
    org = {
      id: 'lb-pressing-id',
      name: BRAND_CONFIG.name,
      slug: 'lb-pressing',
      ticket_prefix: 'LB',
      phone_1: BRAND_CONFIG.contact.phone1,
      phone_2: BRAND_CONFIG.contact.phone2,
      slogan: BRAND_CONFIG.slogan,
      address: BRAND_CONFIG.contact.address,
      footer_text: `© ${new Date().getFullYear()} ${BRAND_CONFIG.name} — Brazzaville, Congo.`,
    };

    rawServices = [
      { id: '1', name: 'Chemise classique', description: 'Lavage et repassage sur cintre', category: 'vetement', price: 1500, estimated_days: 2 },
      { id: '2', name: 'Pantalon de ville', description: 'Nettoyage à sec et pliage', category: 'vetement', price: 2000, estimated_days: 2 },
      { id: '3', name: 'Costume 2 pièces', description: 'Nettoyage à sec haute qualité', category: 'costume', price: 5000, estimated_days: 3 },
      { id: '4', name: 'Robe de soirée', description: 'Traitement délicat des perles et tissus', category: 'ceremonie', price: 6000, estimated_days: 3 },
      { id: '5', name: 'Bazin 2 pièces', description: 'Repassage traditionnel et amidonnage', category: 'traditionnel', price: 4000, estimated_days: 3 },
      { id: '6', name: 'Drap 2 places', description: 'Lavage, désinfection et repassage', category: 'maison', price: 2500, estimated_days: 2 },
      { id: '7', name: 'Veste en cuir', description: 'Nourrissage du cuir et nettoyage', category: 'cuir', price: 8000, estimated_days: 4 },
      { id: '8', name: 'Baskets / Chaussures', description: 'Nettoyage complet intérieur et semelles', category: 'chaussure', price: 3500, estimated_days: 2 },
    ];
  }

  if (!org) {
    notFound();
  }

  const services = rawServices;

  // Calcul des prix minimums par catégorie pour les tuiles de services
  const categorySummaries = calculateCategoryMinPrices(services);
  // Afficher maximum 6 tuiles sur la page d'accueil
  const homeServiceTiles = categorySummaries.slice(0, 6);

  // Coordonnées & Liens
  const primaryPhone = org.phone_1 || BRAND_CONFIG.contact.phone1;
  const secondaryPhone = org.phone_2 || BRAND_CONFIG.contact.phone2;
  const whatsappUrl = generateWhatsAppLink(
    primaryPhone,
    `Bonjour ${org.name} 👋 Je souhaite passer une commande ou obtenir des informations sur vos tarifs.`
  );

  // Photos du carrousel de vitrine
  const availablePhotos = getAvailablePhotos();

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#041C4C] flex flex-col font-sans selection:bg-[#FFC72C] selection:text-[#041C4C] pb-20 md:pb-0">
      {/* 1. EN-TÊTE : BLEU NUIT (#041C4C), LOGO + BOUTON COMMANDER DORÉ */}
      <header className="sticky top-0 z-40 bg-[#041C4C] text-white shadow-md border-b border-slate-800">
        <div className="max-w-md md:max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href={`/${slug}`} className="flex items-center space-x-2.5 group">
            <Image
              src={BRAND_CONFIG.assets.logos.horizontalDark}
              alt={BRAND_CONFIG.name}
              width={140}
              height={36}
              priority
              className="h-8 w-auto object-contain"
            />
          </Link>

          <Link
            href={`/${slug}/commander`}
            className="px-3.5 py-1.5 text-xs font-extrabold bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] rounded-xl shadow-md flex items-center transition active:scale-95 min-h-[36px]"
          >
            Commander
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>
      </header>

      {/* CONTENU PRINCIPAL CLIENT - STRUCTURE COMPACTE APPLICATION */}
      <main className="flex-1 max-w-md md:max-w-3xl mx-auto w-full px-4 py-4 space-y-5">
        {/* 2. BLOC D'ACCUEIL : CARTE 24px JUSTE SOUS L'EN-TÊTE + BOUTONS EN DESSOUS */}
        <section className="space-y-3">
          <div className="relative overflow-hidden rounded-[24px] bg-[#041C4C] text-white shadow-lg h-[380px] md:h-[420px] flex items-end">
            {/* Photos du carrousel en fondu enchaîné CSS */}
            {availablePhotos.length > 0 ? (
              <div className="absolute inset-0 z-0 overflow-hidden">
                {availablePhotos.map((photo, idx) => (
                  <div
                    key={photo.src}
                    className={`absolute inset-0 transition-opacity duration-1000 ${
                      availablePhotos.length > 1 ? `hero-slide-${idx % 3}` : 'opacity-100'
                    }`}
                  >
                    <Image
                      src={photo.src}
                      alt={photo.alt}
                      fill
                      priority={idx === 0}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      sizes="(max-width: 768px) 100vw, 768px"
                      className="object-cover"
                      style={{ objectPosition: photo.objectPosition || 'center center' }}
                      quality={75}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#041C4C] via-[#06296e] to-[#041C4C]" />
            )}

            {/* Dégradé bleu nuit ne couvrant QUE le bas (55% de la hauteur) pour que le titre soit lisible */}
            <div className="absolute inset-x-0 bottom-0 h-[55%] z-10 bg-gradient-to-t from-[#041C4C]/95 via-[#041C4C]/60 to-transparent pointer-events-none" />

            {/* Contenu textuel dans le bas de la carte (Strictement 1 slogan) */}
            <div className="relative z-20 p-5 space-y-1.5 w-full">
              <h1 className="text-2xl md:text-3xl font-black text-white leading-tight tracking-tight drop-shadow-sm">
                {BRAND_CONFIG.slogan}
              </h1>
              <p className="text-slate-200 text-xs md:text-sm font-medium leading-normal drop-shadow">
                {BRAND_CONFIG.heroSubtitle}
              </p>
            </div>
          </div>

          {/* DEUX BOUTONS SOUS LA CARTE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Link
              href={`/${slug}/commander`}
              className="px-5 py-3.5 bg-[#FFC72C] hover:bg-[#F5A300] active:bg-[#F5A300] text-[#041C4C] font-extrabold rounded-2xl shadow-md flex items-center justify-center text-sm transition active:scale-95 min-h-[48px]"
            >
              <CalendarCheck className="w-4 h-4 mr-2 stroke-[2.5]" />
              Commander maintenant
            </Link>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 bg-white hover:bg-slate-50 text-[#041C4C] font-bold rounded-2xl border-2 border-slate-200 flex items-center justify-center text-sm transition active:scale-95 min-h-[48px] shadow-sm"
            >
              <MessageCircle className="w-4 h-4 mr-2 text-emerald-600 fill-emerald-600/10" />
              Écrire sur WhatsApp
            </a>
          </div>
        </section>

        {/* 3. PASTILLES DE CONFIANCE DÉFILANTES / COMPACTES */}
        <section className="overflow-x-auto scrollbar-none -mx-4 px-4 py-1">
          <div className="flex space-x-2.5 w-max">
            {BRAND_CONFIG.whyUs.map((item) => (
              <div
                key={item.id}
                className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-xs shrink-0"
              >
                {item.id === 'soigne' && <Sparkles className="w-4 h-4 text-[#F5A300]" />}
                {item.id === 'delais' && <Timer className="w-4 h-4 text-[#0B5CE1]" />}
                {item.id === 'qualite' && <Leaf className="w-4 h-4 text-emerald-600" />}
                {item.id === 'livraison' && <Truck className="w-4 h-4 text-[#041C4C]" />}
                <span className="text-xs font-bold text-[#041C4C] whitespace-nowrap">
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. TUILES DE SERVICES (NOS SERVICES) - GRILLE D'APPLICATION MOBILE */}
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-[#041C4C] tracking-tight">
              Nos services
            </h2>
            <Link
              href={`/${slug}/tarifs`}
              className="text-xs font-bold text-[#0B5CE1] hover:underline flex items-center"
            >
              Voir tout
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>

          {/* Grille de tuiles de services */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {homeServiceTiles.map((cat) => (
              <Link
                key={cat.rawCategory}
                href={`/${slug}/tarifs#cat-${cat.rawCategory}`}
                className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:border-[#FFC72C] active:bg-[#FFC72C]/10 transition flex flex-col items-center justify-between text-center min-h-[140px] space-y-2 group"
              >
                {/* Icône dans un carré arrondi de 56px */}
                <div className="w-14 h-14 rounded-2xl bg-[#F7F9FC] text-[#041C4C] group-hover:bg-[#FFC72C] transition flex items-center justify-center shrink-0 border border-slate-200/60 shadow-xs">
                  {pickServiceIcon(cat.displayCategory, 'w-7 h-7 text-[#041C4C]')}
                </div>

                {/* Nom complet centré sur 2 lignes max */}
                <span className="font-bold text-[#041C4C] text-sm leading-tight line-clamp-2 text-center">
                  {cat.displayCategory}
                </span>

                {/* Petite pastille dorée sur UNE seule ligne */}
                {cat.shortPriceBadge ? (
                  <span className="text-[11px] font-mono font-black text-[#041C4C] bg-[#FFC72C] px-2 py-0.5 rounded-md whitespace-nowrap inline-block shadow-2xs">
                    {cat.shortPriceBadge}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>

          {/* Bouton pour ouvrir tous les services/tarifs */}
          <div className="pt-1">
            <Link
              href={`/${slug}/tarifs`}
              className="w-full py-3 bg-white border border-slate-200 hover:border-[#041C4C] text-[#041C4C] font-bold rounded-2xl shadow-xs flex items-center justify-center text-xs transition active:scale-98"
            >
              Voir tous les services & tarifs
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 text-[#0B5CE1]" />
            </Link>
          </div>
        </section>

        {/* 5. COMMENT ÇA MARCHE : 1 RANGÉE DE 4 ÉTAPES AVEC ICÔNE ET UN MOT */}
        <section className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
          <h2 className="text-sm font-extrabold text-[#041C4C] text-center uppercase tracking-wider">
            Comment ça marche ?
          </h2>

          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Étape 1 : Commandez */}
            <div className="flex flex-col items-center space-y-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#041C4C] flex items-center justify-center border border-amber-200/60 font-bold">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-bold text-[#041C4C]">Commandez</span>
            </div>

            {/* Étape 2 : Collecte */}
            <div className="flex flex-col items-center space-y-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#041C4C] flex items-center justify-center border border-amber-200/60 font-bold">
                <MotorbikeIcon className="w-5 h-5 text-[#041C4C]" />
              </div>
              <span className="text-xs font-bold text-[#041C4C]">Collecte</span>
            </div>

            {/* Étape 3 : Traitement */}
            <div className="flex flex-col items-center space-y-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#041C4C] flex items-center justify-center border border-amber-200/60 font-bold">
                <HangerIcon className="w-5 h-5 text-[#0B5CE1]" />
              </div>
              <span className="text-xs font-bold text-[#041C4C]">Traitement</span>
            </div>

            {/* Étape 4 : Livraison */}
            <div className="flex flex-col items-center space-y-1">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#041C4C] flex items-center justify-center border border-amber-200/60 font-bold">
                <Package className="w-5 h-5 text-[#F5A300]" />
              </div>
              <span className="text-xs font-bold text-[#041C4C]">Livraison</span>
            </div>
          </div>
        </section>

        {/* 6. NOUS CONTACTER : CARTE COMPACTE */}
        <section className="rounded-2xl bg-white border border-slate-200/80 p-4 space-y-3 shadow-xs">
          <h2 className="text-sm font-extrabold text-[#041C4C]">Nous contacter</h2>

          <div className="space-y-2.5 text-xs text-slate-700">
            <div className="flex items-start space-x-2.5">
              <MapPin className="w-4 h-4 text-[#0B5CE1] shrink-0 mt-0.5" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-slate-600 font-medium">
                  {org.address || BRAND_CONFIG.contact.address}
                </span>
                <a
                  href={BRAND_CONFIG.contact.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0B5CE1] font-bold underline shrink-0 ml-2 flex items-center"
                >
                  Itinéraire
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-[#0B5CE1] shrink-0" />
              <span className="text-slate-600 font-medium">
                {BRAND_CONFIG.contact.schedule}
              </span>
            </div>

            <div className="pt-2 flex flex-wrap gap-2">
              <a
                href={`tel:${primaryPhone}`}
                className="px-3 py-2 rounded-xl bg-[#F7F9FC] border border-slate-200 hover:border-[#0B5CE1] text-[#041C4C] font-mono font-bold flex items-center text-xs transition min-h-[38px]"
              >
                <Phone className="w-3.5 h-3.5 mr-1.5 text-[#0B5CE1]" />
                Appeler : {formatPhoneDisplay(primaryPhone)}
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center text-xs transition min-h-[38px]"
              >
                <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 7. PIED DE PAGE BLEU NUIT (#041C4C) AVEC LIEN DISCRET "ACCÈS PERSONNEL" */}
      <footer className="bg-[#041C4C] text-white py-6 border-t border-slate-800 text-center text-xs space-y-2 mt-4">
        <div className="max-w-md mx-auto px-4 flex flex-col items-center justify-center space-y-2">
          <p className="font-medium text-slate-300">
            {org.footer_text || `© ${new Date().getFullYear()} ${org.name} — Brazzaville, Congo.`}
          </p>

          <Link
            href="/admin"
            className="text-[11px] text-slate-400 hover:text-[#FFC72C] transition underline"
          >
            Accès personnel
          </Link>
        </div>
      </footer>

      {/* BARRE DE NAVIGATION FIXE SUR MOBILE */}
      <PublicBottomNav slug={slug} phone1={primaryPhone} orgName={org.name} />
    </div>
  );
}
