// =============================================================================
// 2. RESET MOT DE PASSE - src/app/auth/reset-password/page.tsx
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Lock, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

const _resetPasswordSchema = z.object({
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(6, 'Confirmez votre mot de passe'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const _router = useRouter();
  const _searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    // Récupérer les tokens depuis l'URL
    const _access_token = searchParams.get('access_token');
    const _refresh_token = searchParams.get('refresh_token');
    
    if (access_token && refresh_token) {
      setAccessToken(access_token);
      setRefreshToken(refresh_token);
    } else {
      // Rediriger vers la page de demande si pas de tokens
      router.push('/auth/forgot-password');
    }
  }, [searchParams, router]);

  const _onSubmit = async (data: ResetPasswordData) => {
    try {
      setIsLoading(true);

      if (!accessToken || !refreshToken) {
        throw new Error('Tokens de réinitialisation manquants');
      }

      // Définir la session avec les tokens
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        throw sessionError;
      }

      // Mettre à jour le mot de passe
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
    } catch (error: any) {
      console.error('Erreur reset password:', error);
      alert('Erreur lors de la réinitialisation. Le lien a peut-être expiré.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md w-full bg-white rounded-lg shadow-soft p-8"
        >
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-6 w-6 text-success" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              Mot de passe mis à jour !
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre mot de passe a été mis à jour avec succès. Vous pouvez maintenant vous connecter.
            </p>
            <div className="mt-6">
              <Button className="w-full" asChild>
                <Link href="/auth/login">Se connecter</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Nouveau mot de passe
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choisissez un mot de passe sécurisé pour votre compte.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <Input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              label="Nouveau mot de passe"
              placeholder="Votre nouveau mot de passe"
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              error={errors.password?.message}
            />

            <Input
              {...register('confirmPassword')}
              type={showConfirmPassword ? 'text' : 'password'}
              label="Confirmer le mot de passe"
              placeholder="Confirmez votre mot de passe"
              leftIcon={<Lock className="h-4 w-4" />}
              rightIcon={
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
              error={errors.confirmPassword?.message}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading || !accessToken}
              loading={isLoading}
              loadingText="Mise à jour..."
            >
              Mettre à jour le mot de passe
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}