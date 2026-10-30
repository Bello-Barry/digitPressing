import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { InvoicePrintView } from '@/components/invoice/InvoicePrintView';
import { getActiveRevisionOtpForTrackingAction } from '@/actions/revisions';
import { KeyRound, ShieldAlert } from 'lucide-react';

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

  // Vérifier si un code de validation OTP est en attente pour cette commande
  const otpRes = await getActiveRevisionOtpForTrackingAction(invoiceData.order.id);
  const activeOtp = otpRes.success ? otpRes.activeOtp : null;

  return (
    <div className="min-h-screen bg-slate-950 py-4 sm:py-8 px-2 sm:px-4 font-sans text-slate-100 print:bg-white print:text-black print:p-0 space-y-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Bannière de Code OTP pour le client si une révision est en cours */}
        {activeOtp && activeOtp.otp_code && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-300 space-y-2 text-center shadow-xl print:hidden">
            <div className="flex items-center justify-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Code de validation pour votre livreur</span>
            </div>

            <div className="text-3xl font-black font-mono tracking-widest text-amber-300">
              {activeOtp.otp_code}
            </div>

            <p className="text-xs text-slate-300">
              Communiquez ce code à 6 chiffres à votre livreur pour valider la correction de vos vêtements et le nouveau total de{' '}
              <span className="font-bold text-amber-400 font-mono">
                {Number(activeOtp.total_after || 0).toLocaleString('fr-FR')} FCFA
              </span>.
            </p>
          </div>
        )}

        <InvoicePrintView data={invoiceData} token={token} />
      </div>
    </div>
  );
}
