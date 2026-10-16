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
import { CategoryAccordions } from '@/components/public/CategoryAccordions';
import { PublicBottomNav } from '@/components/public/PublicBottomNav';
import { IronIcon } from '@/components/icons/IronIcon';
import { SuitIcon } from '@/components/icons/SuitIcon';
import {
  Shirt,
  BedDouble,
  Footprints,
  Sparkles,
  Truck,
  ShieldCheck,
  Timer,
  Leaf,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  ArrowRight,
  CalendarCheck,
  ExternalLink,
  Layers,
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
    // Utilise la config par défaut en cas d'absence de connexion DB
  }

  const isLb = slug === 'lb-pressing';
  const title = isLb
    ? 'LB Pressing | Blanchisserie & Nettoyage à sec à Brazzaville'
    : `${orgName} | Pressing & Blanchisserie Haute Qualité`;
  const description = orgSlogan || BRAND_CONFIG.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: isLb ? 'LB Pressing' : orgName,
      url: `https://digit-pressing.vercel.app/${slug}`,
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

// Composant pour rendre l'icône appropriée par son nom de clé
function RenderCategoryIcon({ iconKey, className = 'w-6 h-6' }: { iconKey: string; className?: string }) {
  switch (iconKey) {
    case 'Shirt':
      return <Shirt className={className} />;
    case 'Suit':
      return <SuitIcon className={className} />;
    case 'Iron':
      return <IronIcon className={className} />;
    case 'BedDouble':
      return <BedDouble className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Footprints':
      return <Footprints className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'Truck':
      return <Truck className={className} />;
    case 'Timer':
      return <Timer className={className} />;
    case 'Leaf':
      return <Leaf className={className} />;
    default:
      return <Layers className={className} />;
  }
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

  // 1. Calcul des prix minimums réels par catégorie
  const categorySummaries = calculateCategoryMinPrices(services);

  // 2. Regroupement pour les accordéons
  const legacyCategoryLabels: Record<string, string> = {
    vetement: 'Vêtements du quotidien',
    ceremonie: 'Costumes & Cérémonie',
    costume: 'Costumes & Cérémonie',
    traditionnel: 'Tenues Traditionnelles',
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

  // Coordonnées & Liens
  const primaryPhone = org.phone_1 || BRAND_CONFIG.contact.phone1;
  const secondaryPhone = org.phone_2 || BRAND_CONFIG.contact.phone2;
  const whatsappUrl = generateWhatsAppLink(
    primaryPhone,
    `Bonjour ${org.name} 👋 Je souhaite commander ou me renseigner sur vos tarifs de pressing.`
  );

  // Photos de l'atelier réelles présentes sur le disque
  const availablePhotos = getAvailablePhotos();
  const hasHeroPhoto = availablePhotos.some((p) => p.src === BRAND_CONFIG.photos.hero.src);
  const heroPhoto = hasHeroPhoto ? BRAND_CONFIG.photos.hero : null;

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#041C4C] flex flex-col font-sans selection:bg-[#FFC72C] selection:text-[#041C4C] pb-20 md:pb-0">
      {/* 1. EN-TÊTE : BLEU NUIT (#041C4C), LOGO + BOUTON COMMANDER DORÉ */}
      <header className="sticky top-0 z-40 bg-[#041C4C] text-white shadow-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/${slug}`} className="flex items-center space-x-3 group">
            {slug === 'lb-pressing' ? (
              <div className="flex items-center space-x-2">
                <Image
                  src={BRAND_CONFIG.assets.logos.horizontalDark}
                  alt={BRAND_CONFIG.name}
                  width={150}
                  height={38}
                  priority
                  className="h-8 md:h-9 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFC72C] text-[#041C4C] font-black flex items-center justify-center shadow-md">
                  {org.ticket_prefix}
                </div>
                <div>
                  <h1 className="font-extrabold text-base md:text-lg leading-tight tracking-tight text-white">
                    {org.name}
                  </h1>
                  <p className="text-[11px] text-[#FFC72C] font-medium">Brazzaville, Congo</p>
                </div>
              </div>
            )}
          </Link>

          <div className="flex items-center space-x-2">
            <Link
              href={`/${slug}/commander`}
              className="px-4 py-2 text-xs font-extrabold bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] rounded-xl shadow-md flex items-center transition active:scale-95 min-h-[38px]"
            >
              Commander
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL DANS L'ORDRE EXIGÉ */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 md:py-8 space-y-10">
        {/* 2. ACCUEIL (HERO) : PHOTO ARRIÈRE-PLAN PLEIN ÉCRAN + VOILE BLEU NUIT (75-85% OPACITÉ) */}
        <section className="relative overflow-hidden rounded-3xl bg-[#041C4C] text-white shadow-xl min-h-[360px] max-h-[560px] flex items-center">
          {/* Photo d'arrière-plan avec dégradé bleu nuit */}
          {heroPhoto ? (
            <div className="absolute inset-0 z-0">
              <Image
                src={heroPhoto.src}
                alt={heroPhoto.alt}
                fill
                priority
                sizes="(max-width: 896px) 100vw, 896px"
                className="object-cover object-center"
                quality={70}
              />
              {/* Voile bleu nuit à 80% opacité */}
              <div className="absolute inset-0 bg-[#041C4C]/80 bg-gradient-to-t from-[#041C4C] via-[#041C4C]/85 to-[#041C4C]/75" />
            </div>
          ) : (
            <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#041C4C] via-[#06296e] to-[#041C4C]" />
          )}

          <div className="relative z-10 p-6 md:p-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#FFC72C]/20 border border-[#FFC72C]/40 text-[#FFC72C] text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Qualité & Soin Premium</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
              {BRAND_CONFIG.slogan}
            </h2>

            <p className="text-slate-100 text-sm md:text-base leading-relaxed font-medium">
              {org.slogan || BRAND_CONFIG.heroSubtitle}
            </p>

            <div className="pt-3 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/${slug}/commander`}
                className="px-6 py-3.5 bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] font-extrabold rounded-xl shadow-lg flex items-center justify-center text-sm transition active:scale-95 min-h-[48px]"
              >
                <CalendarCheck className="w-4 h-4 mr-2" />
                Commander maintenant
              </Link>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3.5 bg-transparent hover:bg-white/10 text-white font-bold rounded-xl border-2 border-white/80 flex items-center justify-center text-sm transition min-h-[48px]"
              >
                <MessageCircle className="w-4 h-4 mr-2 text-emerald-400" />
                Écrire sur WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* 3. SERVICES : GRILLE DE 2 COLONNES DE TUILES D'ICÔNES DE CATÉGORIE AVEC PRIX "À PARTIR DE" */}
        {categorySummaries.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold text-[#041C4C] flex items-center">
                  <Shirt className="w-5 h-5 mr-2 text-[#0B5CE1]" />
                  Nos Catégories de Soin
                </h3>
                <p className="text-xs text-slate-500">
                  Sélectionnez une catégorie pour consulter la grille tarifaire complète
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:gap-4">
              {categorySummaries.map((cat) => (
                <a
                  key={cat.rawCategory}
                  href={`#cat-${cat.rawCategory}`}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:border-[#FFC72C] transition flex flex-col justify-between group space-y-3"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F7F9FC] text-[#041C4C] group-hover:bg-[#FFC72C] transition flex items-center justify-center shrink-0 border border-slate-200/60">
                      <RenderCategoryIcon iconKey={cat.iconKey} className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#041C4C] text-xs md:text-sm group-hover:text-[#0B5CE1] transition line-clamp-1">
                        {cat.displayCategory}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {cat.count} {cat.count > 1 ? 'articles' : 'article'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">à partir de</span>
                    <span className="font-mono font-black text-[#041C4C] bg-[#FFC72C]/20 px-2 py-0.5 rounded-md">
                      {cat.minPrice.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* 4. POURQUOI NOUS CHOISIR (4 ÉLÉMENTS DE LA CONFIGURATION) */}
        <section className="space-y-4">
          <div className="text-center space-y-1">
            <h3 className="text-xl font-extrabold text-[#041C4C]">Pourquoi nous choisir ?</h3>
            <p className="text-xs text-slate-500">Nos engagements qualité au quotidien à Brazzaville</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {BRAND_CONFIG.whyUs.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2 flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#F5A300] flex items-center justify-center border border-amber-200/60">
                  <RenderCategoryIcon iconKey={item.iconKey} className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#041C4C]">{item.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. COMMENT ÇA MARCHE (4 ÉTAPES NUMÉROTÉES AVEC ICÔNE) */}
        <section className="p-6 md:p-8 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
          <div className="text-center space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0B5CE1]">
              Simplicité & Rapidité
            </span>
            <h3 className="text-xl font-extrabold text-[#041C4C]">Comment ça marche ?</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative">
            {BRAND_CONFIG.howItWorks.map((step) => (
              <div key={step.step} className="space-y-2 relative">
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 rounded-full bg-[#FFC72C] text-[#041C4C] font-black text-xs flex items-center justify-center shadow-sm">
                    {step.step}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#F7F9FC] text-[#041C4C] flex items-center justify-center">
                    <RenderCategoryIcon iconKey={step.iconKey} className="w-4 h-4" />
                  </div>
                </div>

                <h4 className="font-bold text-xs md:text-sm text-[#041C4C]">{step.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. TARIFS : SECTIONS REPLIABLES PAR CATÉGORIE AVEC BOUTON COMMANDER PERSISTANT */}
        <section id="tarifs" className="space-y-4 scroll-mt-20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-[#041C4C]">Grille Tarifaire Complète</h3>
              <p className="text-xs text-slate-500">Tarifs officiels transparents en FCFA</p>
            </div>
          </div>

          <CategoryAccordions slug={slug} servicesByCategory={servicesByCategory} />
        </section>

        {/* 7. NOTRE ATELIER : GALERIE DE PHOTOS (AFFICHÉE UNIQUEMENT SI DES IMAGES EXISTENT SUR LE DISQUE) */}
        {availablePhotos.length > 0 && (
          <section className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-xl font-extrabold text-[#041C4C]">Notre Atelier</h3>
              <p className="text-xs text-slate-500">Découvrez le soin apporté à vos vêtements</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
              {availablePhotos.map((photo, idx) => (
                <div
                  key={idx}
                  className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm group bg-slate-100"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 300px"
                    className="object-cover group-hover:scale-105 transition duration-300"
                    quality={70}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
                  <p className="absolute bottom-3 left-3 right-3 text-xs font-bold text-white drop-shadow-md">
                    {photo.title}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 8. INFORMATIONS PRATIQUES & CONTACT */}
        <section className="rounded-3xl bg-white border border-slate-200/80 p-6 md:p-8 space-y-4 shadow-sm">
          <h3 className="text-lg font-extrabold text-[#041C4C]">Informations Pratiques</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-700">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-[#0B5CE1] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#041C4C]">Adresse de l'Atelier</p>
                  <p className="text-slate-600 mt-0.5">{org.address || BRAND_CONFIG.contact.address}</p>
                  <a
                    href={BRAND_CONFIG.contact.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[#0B5CE1] hover:underline font-bold mt-1.5"
                  >
                    Itinéraire Google Maps
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-[#0B5CE1] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-[#041C4C]">Horaires d'Ouverture</p>
                  <p className="text-slate-600 mt-0.5">{BRAND_CONFIG.contact.schedule}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="font-bold text-[#041C4C]">Téléphones & Contact Réactif</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`tel:${primaryPhone}`}
                  className="px-3.5 py-2 rounded-xl bg-[#F7F9FC] border border-slate-200 hover:border-[#0B5CE1] text-[#041C4C] font-mono font-bold flex items-center transition"
                >
                  <Phone className="w-3.5 h-3.5 mr-2 text-[#0B5CE1]" />
                  {formatPhoneDisplay(primaryPhone)}
                </a>

                {secondaryPhone && (
                  <a
                    href={`tel:${secondaryPhone}`}
                    className="px-3.5 py-2 rounded-xl bg-[#F7F9FC] border border-slate-200 hover:border-[#0B5CE1] text-[#041C4C] font-mono font-bold flex items-center transition"
                  >
                    <Phone className="w-3.5 h-3.5 mr-2 text-[#0B5CE1]" />
                    {formatPhoneDisplay(secondaryPhone)}
                  </a>
                )}

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center transition"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-2" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9. PIED DE PAGE BLEU NUIT (#041C4C) AVEC LIEN DISCRET "ACCÈS PERSONNEL" */}
      <footer className="bg-[#041C4C] text-white py-8 border-t border-slate-800 text-center text-xs space-y-3">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center justify-center space-y-3">
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

      {/* D. BARRE DE NAVIGATION FIXE SUR MOBILE */}
      <PublicBottomNav slug={slug} phone1={primaryPhone} orgName={org.name} />
    </div>
  );
}
