import { redirect } from 'next/navigation';

export default function PressingSettingsRedirect() {
  redirect('/admin/services');
}
