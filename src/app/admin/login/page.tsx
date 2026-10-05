'use client';

// =============================================================================
// PAGE DE CONNEXION ADMIN - SUPABASE AUTH RÉEL
// =============================================================================

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminSignInAction } from '@/actions/auth';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const result = await adminSignInAction(email, password);

      if (!result.success) {
        setErrorMsg(result.error || 'Identifiants invalides.');
        setIsLoading(false);
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg('Erreur de connexion.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 font-sans text-slate-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black flex items-center justify-center mx-auto text-xl shadow-xl shadow-amber-500/20">
            LB
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            LB Pressing — Administration
          </h1>
          <p className="text-xs text-slate-400">
            Connectez-vous pour gérer les réceptions, commandes et la caisse.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-2xl"
        >
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Adresse e-mail
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="Ex: obusiness715@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 pl-10 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500 transition"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 flex items-center justify-center"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <span className="w-4 h-4 mr-2 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  Connexion...
                </span>
              ) : (
                <span className="flex items-center">
                  Se connecter
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </span>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-[11px] text-slate-500">
          Accès restreint au personnel habilité de LB Pressing.
        </p>
      </div>
    </div>
  );
}
