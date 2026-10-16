import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrganizationBySlug } from '@/lib/supabase';
import { OrderTrackingView } from '@/components/public/OrderTrackingView';
import { PublicBottomNav } from '@/components/public/PublicBottomNav';
import { ArrowLeft, Sparkles } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string; tel?: string }>;
}

export default async function OrderTrackingPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { code, tel } = await searchParams;

  const org = await getOrganizationBySlug(slug);
  if (!org) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#041C4C] flex flex-col font-sans pb-20 md:pb-0">
      {/* En-tête bleu nuit */}
      <header className="sticky top-0 z-40 bg-[#041C4C] text-white border-b border-slate-800 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center text-xs font-bold text-slate-200 hover:text-[#FFC72C] transition"
          >
            <ArrowLeft className="w-4 h-4 mr-1 text-[#FFC72C]" />
            Accueil {org.name}
          </Link>

          <Link
            href={`/${slug}/commander`}
            className="text-xs text-[#FFC72C] hover:underline font-bold"
          >
            Nouvelle commande +
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 md:py-8 space-y-6">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-[#FFC72C]/20 text-[#041C4C] border border-amber-300 text-xs font-bold">
            <Sparkles className="w-3 h-3 text-[#F5A300]" />
            <span>Suivi en Direct</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#041C4C] tracking-tight">
            Suivi de votre Commande
          </h1>
          <p className="text-xs md:text-sm text-slate-600">
            Entrez votre code de suivi (ex: D-0001) et votre numéro de téléphone pour voir l'avancement.
          </p>
        </div>

        <OrderTrackingView
          slug={slug}
          initialCode={code || ''}
          initialPhone={tel || ''}
          orgName={org.name}
          orgPhone={org.phone_1 || '067311016'}
        />
      </main>

      <PublicBottomNav slug={slug} phone1={org.phone_1} orgName={org.name} />
    </div>
  );
}
