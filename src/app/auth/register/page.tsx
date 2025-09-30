'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Lock, User, AlertCircle, Building2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuthActions } from '@/store/auth';

const registerSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().min(1, 'L\'email est requis').email('Format d\'email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  confirmPassword: z.string(),
  pressingId: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type RegisterData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterData) => {
    try {
      setIsLoading(true);
      setServerError(null);

      await signUp(
        data.email,
        data.password,
        data.fullName,
        data.pressingId
      );

      // Redirection vers la page de confirmation
      router.push('/auth/verify-email');

    } catch (error: any) {
      console.error('Erreur inscription:', error);
      setServerError(
        error.message || 
        'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto w-full max-w-md"
        >
          <div className="text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center text-sm text-primary hover:text-primary/80 mb-8"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Link>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Créer votre compte
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Rejoignez Digit Pressing pour gérer votre pressing facilement
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {/* Erreur serveur */}
            {serverError && (
              <div className="rounded-md bg-destructive/10 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <div className="ml-3">
                    <p className="text-sm text-destructive">{serverError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Nom complet */}
            <div className="space-y-2">
              <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
                Nom complet
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  {...register('fullName')}
                  type="text"
                  id="fullName"
                  className="block w-full pl-10 pr-3 py-2 border border-input rounded-md shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Jean Dupont"
                />
              </div>
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Adresse email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  className="block w-full pl-10 pr-3 py-2 border border-input rounded-md shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="nom@exemple.com"
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* ID Pressing (optionnel) */}
            <div className="space-y-2">
              <label htmlFor="pressingId" className="block text-sm font-medium text-foreground">
                ID Pressing <span className="text-muted-foreground">(optionnel)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  {...register('pressingId')}
                  type="text"
                  id="pressingId"
                  className="block w-full pl-10 pr-3 py-2 border border-input rounded-md shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Laissez vide si vous créez un nouveau pressing"
                />
              </div>
              {errors.pressingId && (
                <p className="text-sm text-destructive">{errors.pressingId.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Si vous rejoignez un pressing existant, entrez son ID. Sinon, laissez vide.
              </p>
            </div>

            {/* Mot de passe */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Mot de passe
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
            </div>

            {/* Confirmation mot de passe */}
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

            {/* Bouton de soumission */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Création en cours...' : 'Créer mon compte'}
            </Button>

            {/* Lien vers connexion */}
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Vous avez déjà un compte ? </span>
              <Link href="/auth/login" className="text-primary hover:text-primary/80 font-medium">
                Se connecter
              </Link>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}