import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateWhatsAppLink, formatPhoneDisplay } from '@/lib/whatsapp';
import {
  Phone,
  MessageCircle,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Shirt,
  CalendarCheck,
  Search
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const db = await createServerSupabaseClient();
  const { data: org } = await db.from('organizations').select('name, slogan').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!org) return { title: 'Pressing non trouvé' };

  return {
    title: `${org.name} | Pressing & Blanchisserie Haute Qualité`,
    description: org.slogan || `Commandez votre pressing en ligne chez ${org.name}. Service rapide, soigné et livraison à domicile à Brazzaville.`,
  };
}

export default async function PublicOrgHomePage({ params }: PageProps) {
  const { slug } = await params;
  const db = await createServerSupabaseClient();

  const { data: org } = await db
    .from('organizations')
    .select('id, name, slug, ticket_prefix, phone_1, phone_2, slogan, address, footer_text')
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

  const primaryPhone = org.phone_1 || '067311016';
  const whatsappUrl = generateWhatsAppLink(
    primaryPhone,
    `Bonjour ${org.name} 👋 Je souhaite obtenir des informations sur vos services de pressing.`
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header Mobile & Desktop */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              {org.ticket_prefix}
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight text-white">
                {org.name}
              </h1>
              <p className="text-xs text-amber-400/90 font-medium">Brazzaville, Congo</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Link
              href={`/${slug}/suivi`}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg flex items-center transition"
            >
              <Search className="w-3.5 h-3.5 mr-1 text-amber-400" />
              Suivi
            </Link>
            <Link
              href={`/${slug}/commander`}
              className="px-3.5 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-md shadow-amber-500/20 flex items-center transition"
            >
              Commander
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 md:py-10 space-y-8">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 md:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-4 max-w-xl">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Qualité & Soin Premium</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Vos vêtements traités avec une excellence irréprochable.
            </h2>

            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              {org.slogan || 'Nettoyage à sec, repassage soigné et traitement délicat pour tous vos habits et tissus d\'exception.'}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/${slug}/commander`}
                className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center text-sm transition"
              >
                <CalendarCheck className="w-4 h-4 mr-2" />
                Commander en ligne
              </Link>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center text-sm transition"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Échanger sur WhatsApp
              </a>
            </div>
          </div>
        </section>

        {/* Aperçu des Prestations & Tarifs Réels */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center">
                <Shirt className="w-5 h-5 mr-2 text-amber-400" />
                Nos Prestations & Tarifs
              </h3>
              <p className="text-xs text-slate-400">Tarifs clairs et transparents en FCFA</p>
            </div>
            <Link
              href={`/${slug}/services`}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center"
            >
              Voir tout ({services.length})
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {services.slice(0, 6).map((service) => (
              <div
                key={service.id}
                className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-white text-sm">{service.name}</h4>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md">
                      {Number(service.price).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                  {service.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                      {service.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[11px] text-slate-400">
                  <span className="capitalize">{service.category || 'Vêtement'}</span>
                  <span className="flex items-center text-slate-400">
                    <Clock className="w-3 h-3 mr-1 text-slate-500" />
                    ~{service.estimated_days || 2} jours
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center pt-2">
            <Link
              href={`/${slug}/services`}
              className="inline-flex items-center text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl transition"
            >
              Consulter l'intégralité du catalogue des services
              <ArrowRight className="w-3.5 h-3.5 ml-1.5 text-amber-400" />
            </Link>
          </div>
        </section>

        {/* Garanties & Engagements */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60 flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Linge étiqueté & sécurisé</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Chaque article est compté et tracé avec un ticket officiel unique sans trou.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60 flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Suivi instantané WhatsApp</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Vous recevez votre reçu officiel et êtes prévenu dès que votre commande est prête.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/60 flex items-start space-x-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Ramassage & Livraison</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Option de collecte ou de livraison directement à votre domicile ou bureau.
              </p>
            </div>
          </div>
        </section>

        {/* Informations Pratiques & Contact Réel */}
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <h3 className="text-base font-bold text-white">Coordonnées & Horaires</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{org.address || 'Brazzaville, République du Congo'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Lundi - Samedi : 07h30 - 18h30 (Dimanche fermé)</span>
              </div>
            </div>

            <div className="space-y-2">
              {org.phone_1 && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                  <a href={`tel:${org.phone_1}`} className="hover:text-amber-400 font-mono">
                    {formatPhoneDisplay(org.phone_1)}
                  </a>
                </div>
              )}
              {org.phone_2 && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-amber-400 shrink-0" />
                  <a href={`tel:${org.phone_2}`} className="hover:text-amber-400 font-mono">
                    {formatPhoneDisplay(org.phone_2)}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-400 space-y-2">
        <p>{org.footer_text || `© ${new Date().getFullYear()} ${org.name}. Tous droits réservés.`}</p>
        <p className="text-[11px] text-slate-400">
          Propulsé par <span className="font-semibold text-amber-500">Digit Pressing</span>
        </p>
      </footer>
    </div>
  );
}
