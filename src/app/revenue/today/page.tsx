import { redirect } from 'next/navigation';

export default function TodayRevenueRedirect() {
  redirect('/admin/paiements');
}
