import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { InvoicePrintView } from '@/components/invoice/InvoicePrintView';
import { getPendingRevisionForCustomerAction } from '@/actions/revisions';
import { KeyRound, CheckCircle2 } from 'lucide-react';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  return {
    title: `Facture Pressing | Reçu Officiel`,
    description: `Consultez votre facture de pressing en ligne.`,
  };
}

export default async function InvoicePage({ params }: PageProps) {
  const { token } = await params;
  const { data, error } = await supabase.rpc('get_invoice_by_token', {
    p_token: token,
  });

  if (error || !data || !data.order) {
    notFound();
  }

  const invoiceData = data as any;

  // Récupération de la révision en attente avec calcul du code OTP à la volée (Règle 1)
  const revRes = await getPendingRevisionForCustomerAction(token);
  const pendingRev = revRes.success ? revRes.pendingRevision : null;
  const { data: deliveryConfirmation } = await supabase.rpc('get_delivery_confirmation_for_customer', { p_token: token });

  return (
    <div className="min-h-screen bg-slate-950 py-4 sm:py-8 px-2 sm:px-4 font-sans text-slate-100 print:bg-white print:text-black print:p-0 space-y-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Bannière de Code OTP calculé pour le client si une révision est en attente */}
        {pendingRev && pendingRev.code && (
          <div className="p-5 rounded-3xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-300 space-y-3 text-center shadow-xl print:hidden">
            <div className="flex items-center justify-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Correction de commande en cours chez vous</span>
            </div>

            <p className="text-xs text-slate-300">
              Votre livreur a contrôlé vos vêtements. Donnez-lui ce code de confirmation :
            </p>

            <div className="text-4xl font-black font-mono tracking-widest text-amber-300 bg-slate-950/80 py-2.5 px-4 rounded-2xl border border-amber-500/30 inline-block">
              {pendingRev.code}
            </div>

            <p className="text-xs text-slate-300">
              Nouveau montant total de votre commande :{' '}
              <span className="font-bold text-amber-400 font-mono text-sm">
                {Number(pendingRev.total_after || 0).toLocaleString('fr-FR')} FCFA
              </span>
            </p>
          </div>
        )}

        {deliveryConfirmation?.code && (
          <div className="p-5 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-300 space-y-3 text-center shadow-xl print:hidden">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Confirmation de remise</span>
            </div>
            <p className="text-xs text-slate-300">À l’arrivée du livreur, communiquez-lui ce code pour confirmer la remise de votre commande.</p>
            <div className="text-4xl font-black font-mono tracking-widest text-emerald-300 bg-slate-950/80 py-2.5 px-4 rounded-2xl border border-emerald-500/30 inline-block">{deliveryConfirmation.code}</div>
            <p className="text-[11px] text-slate-400">Ce code expire dans 30 minutes.</p>
          </div>
        )}

        <InvoicePrintView data={invoiceData} token={token} />
      </div>
    </div>
  );
}
