'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getServerUserMembership } from '@/lib/supabase-server';

export async function adminSignInAction(email: string, password: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) return { success: false, error: error?.message || 'Identifiants invalides.' };
  const { data: membership } = await supabase.from('memberships')
    .select('is_active').eq('user_id', data.user.id).eq('is_active', true).maybeSingle();
  if (!membership) {
    await supabase.auth.signOut();
    return { success: false, error: 'Aucun accès actif à une organisation.' };
  }
  return { success: true };
}

export async function adminSignOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return { success: true };
}

export async function getAdminMembershipAction() {
  return getServerUserMembership();
}

export async function clientSignOutAction() {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut();
  return { success: !error, error: error?.message };
}

export async function clientRefreshSessionAction() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.refreshSession();
  return { success: !error, error: error?.message, expiresAt: data.session?.expires_at, userId: data.user?.id };
}

export async function clientSignInAction(email: string, password: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return { success: !error && Boolean(data.user), error: error?.message, userId: data.user?.id };
}

export async function clientSignUpAction(input: { email: string; password: string; fullName: string; pressingId?: string; redirectTo?: string }) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: { full_name: input.fullName.trim(), pressing_id: input.pressingId },
      emailRedirectTo: input.redirectTo,
    },
  });
  if (!error && data.user && input.pressingId) {
    const { data: organization } = await supabase.from('organizations').select('id').eq('id', input.pressingId).eq('is_active', true).maybeSingle();
    if (!organization) return { success: false, error: 'Organisation inconnue.' };
  }
  return { success: !error && Boolean(data.user), error: error?.message, userId: data.user?.id, verificationRequired: !data.session };
}

export async function exchangeAuthCodeAction(code: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return { success: !error, error: error?.message };
}

export async function sendPasswordResetWithRedirectAction(email: string, redirectTo: string) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  return { success: !error, error: error?.message };
}

export async function updatePasswordAction(password: string) {
  if (password.length < 8) return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password });
  return { success: !error, error: error?.message };
}
