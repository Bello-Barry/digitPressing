'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthActions } from '@/store/auth';
import Link from 'next/link';

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  confirmPassword: z.string().min(6, 'Confirmez votre mot de passe'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePassword } = useAuthActions();
  
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  // Vérifier si nous avons un token valide
  useEffect(() => {
    const token = searchParams.get('token');
    const type = searchParams.get('type');
    
    if (type === 'recovery' && token) {
      setIsValidToken(true);
    } else {
      setError('Lien de réinitialisation invalide ou expiré');
    }
  }, [searchParams]);

  const onSubmit = async (data: ResetPasswordData) => {
    try {
      setIsLoading(true);
      setError(null);

      await updatePassword(data.password);
      
      setSuccess(true);
      
      // Redirection après 3 secondes
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);

    } catch (error: any) {
      console.error('Erreur reset password:', error);
      setError(error.message || 'Erreur lors de la réinitialisation du mot de passe');
    } finally {
      setIsLoading(false);
    }
  };

  // Affichage en cas de succès
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md w-full bg-white rounded-lg shadow-soft p-8"
        >
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              Mot de passe modifié !
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre mot de passe a été réinitialisé avec succès. Vous allez être redirigé vers la page de connexion.
            </p>
            <Button className="w-full mt-6" asChild>
              <Link href="/auth/login">Se connecter maintenant</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Affichage en cas de token invalide
  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md w-full bg-white rounded-lg shadow-soft p-8"
        >
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              Lien invalide ou expiré
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ce lien de réinitialisation n'est plus valide. Veuillez demander un nouveau lien.
            </p>
            <div className="mt-6 space-y-3">
              <Button className="w-full" asChild>
                <Link href="/auth/forgot-password">Demander un nouveau lien</Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/auth/login">Retour à la connexion</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Formulaire de réinitialisation
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
              Choisissez un nouveau mot de passe sécurisé pour votre compte
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Erreur */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div className="ml-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nouveau mot de passe */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  {...register('password')}
                  type="password"
                  id="password"
                  className="block w-full pl-10 pr-3 py-2 border border-input rounded-md shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Minimum 6 caractères
              </p>
            </div>

            {/* Confirmation */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  {...register('confirmPassword')}
                  type="password"
                  id="confirmPassword"
                  className="block w-full pl-10 pr-3 py-2 border border-input rounded-md shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
            </Button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-sm text-primary hover:text-primary/80"
              >
                Retour à la connexion
              </Link>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}