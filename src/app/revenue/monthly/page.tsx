import { redirect } from 'next/navigation';

export default function MonthlyRevenueRedirect() {
  redirect('/admin/paiements');
}
