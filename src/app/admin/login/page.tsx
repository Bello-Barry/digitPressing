'use client';

// =============================================================================
// PERSONNEL ADMIN LOGIN PAGE (/admin/login)
// Supabase Auth Personnel Portal, Role Authorization
// =============================================================================

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Shirt, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthActions } from '@/store/auth';

const loginSchema = z.object({
  email: z.string().min(1, 'L\'email est requis').email('Format d\'email invalide'),
  password: z.string().min(1, 'Le mot de passe est requis'),
});

type LoginData = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { signIn } = useAuthActions();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginData) => {
    try {
      setIsLoading(true);
      setServerError(null);

      await signIn(data.email, data.password);

      setLoginSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);

    } catch (error: any) {
      console.error('Erreur connexion personnel:', error);
      setServerError(error.message || 'Identifiants incorrects ou compte inactif.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-amber-50 flex flex-col justify-center items-center p-4 font-sans selection:bg-amber-400 selection:text-black">
      <div className="max-w-md w-full bg-neutral-900 border border-amber-500/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-200 p-[2px] mx-auto mb-3">
            <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
              <Shirt className="h-6 w-6 text-amber-400" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wide">Espace Personnel & Administration</h1>
          <p className="text-xs text-neutral-400">Portail sécurisé LB Pressing (Propriétaire, Manager, Caissier, Livreur)</p>
        </div>

        {/* Server Error */}
        {serverError && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 flex items-center gap-3 text-red-300 text-xs">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <p>{serverError}</p>
          </div>
        )}

        {/* Success Alert */}
        {loginSuccess && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 flex items-center gap-3 text-emerald-300 text-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <p>Connexion réussie ! Redirection en cours...</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs text-neutral-300 font-semibold mb-1 block">
              Adresse Email Professionnelle
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 h-4 w-4 text-neutral-500" />
              <Input
                id="email"
                type="email"
                placeholder="agent@lbpressing.cg"
                {...register('email')}
                className="pl-9 bg-black border-neutral-800 text-white h-11 text-sm focus:border-amber-400"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="password" className="text-xs text-neutral-300 font-semibold mb-1 block">
              Mot de Passe
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 h-4 w-4 text-neutral-500" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                className="pl-9 pr-10 bg-black border-neutral-800 text-white h-11 text-sm focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-neutral-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <Link href="/auth/forgot-password" className="text-amber-400 hover:underline">
              Mot de passe oublié ?
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isLoading || loginSuccess}
            className="w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-600 hover:to-yellow-500 text-black font-extrabold text-sm py-6 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all mt-4"
          >
            {isLoading ? 'Connexion en cours...' : 'Accéder au Tableau de Bord'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
