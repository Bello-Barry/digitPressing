'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'L\'email est requis').email('Format d\'email invalide'),
});

type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setEmailSent(true);
    } catch (error: any) {
      console.error('Erreur reset password:', error);
      // En cas d'erreur, on montre quand même le message de succès pour des raisons de sécurité
      setEmailSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
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
            <h2 className="mt-4 text-xl font-bold text-foreground">Email envoyé !</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Si un compte existe avec l'adresse <strong>{getValues('email')}</strong>, 
              vous recevrez un lien de réinitialisation dans quelques minutes.
            </p>
            <div className="mt-6 space-y-3">
              <Button className="w-full" asChild>
                <Link href="/auth/login">Retour à la connexion</Link>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setEmailSent(false)}>
                Envoyer à une autre adresse
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
            <Link
              href="/auth/login"
              className="inline-flex items-center text-sm text-primary hover:text-primary/80 mb-8"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour à la connexion
            </Link>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Mot de passe oublié ?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
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

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}