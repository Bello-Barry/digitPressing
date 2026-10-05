import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { InvoicePrintView } from '@/components/invoice/InvoicePrintView';

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

  const invoiceData = data as {
    order: {
      id: string;
      request_code: string;
      ticket_number: string | null;
      status: string;
      client_name: string;
      client_phone: string;
      mode: string;
      subtotal: number;
      delivery_fee: number;
      discount_amount: number;
      total_amount: number;
      items_count_in: number | null;
      created_at: string;
      requested_at: string | null;
    };
    organization: {
      id: string;
      name: string;
      slug: string;
      ticket_prefix: string;
      phone_1: string | null;
      phone_2: string | null;
      email: string | null;
      address: string | null;
      currency: string;
      footer_text: string | null;
    };
    items: Array<{
      id: string;
      service_name: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      notes: string | null;
    }>;
    payments: Array<{
      id: string;
      amount: number;
      method: string;
      collected_at: string;
    }> | null;
    summary: {
      paid_amount: number;
      balance_due: number;
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 py-4 sm:py-8 px-2 sm:px-4 font-sans text-slate-100 print:bg-white print:text-black print:p-0">
      <div className="max-w-2xl mx-auto">
        <InvoicePrintView data={invoiceData} token={token} />
      </div>
    </div>
  );
}
