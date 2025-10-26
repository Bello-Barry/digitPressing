'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import {
  Shirt,
  Users,
  TrendingUp,
  Shield,
  Smartphone,
  Zap,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import { motion } from 'framer-motion'; 
// ✅ Lazy load de framer-motion pour améliorer les performances


const HomePage = () => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // ✅ Redirection automatique si déjà connecté
  useEffect(() => {
    if (user && !isLoading) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  // ✅ Écran de chargement temporaire
  if (user && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">
            Redirection vers le tableau de bord...
          </p>
        </div>
      </div>
    );
  }

  // ✅ Données
  const features = [
    {
      icon: Shirt,
      title: 'Gestion des factures',
      description:
        'Créez, modifiez et suivez toutes vos factures en temps réel avec un système numérique complet.',
    },
    {
      icon: TrendingUp,
      title: 'Suivi des revenus',
      description:
        'Analysez automatiquement vos revenus et performances grâce à des statistiques précises.',
    },
    {
      icon: Users,
      title: 'Multi-utilisateurs',
      description:
        'Attribuez des rôles et permissions adaptés à chaque membre de votre équipe.',
    },
    {
      icon: Shield,
      title: 'Sécurité renforcée',
      description:
        'Toutes vos données sont chiffrées et sauvegardées automatiquement dans le cloud.',
    },
    {
      icon: Smartphone,
      title: 'Accessible partout',
      description:
        "Utilisez Digit Pressing sur tous vos appareils, même hors ligne, grâce à la technologie PWA.",
    },
    {
      icon: Zap,
      title: 'Ultra rapide',
      description:
        "Une interface fluide et optimisée pour une utilisation professionnelle quotidienne.",
    },
  ];

  const benefits = [
    'Fini les cahiers de factures perdus ou abîmés',
    'Calcul automatique des revenus sans erreur',
    'Recherche instantanée de n’importe quelle facture',
    'Sauvegarde automatique de toutes vos données',
    'Accès depuis n’importe quel appareil connecté',
    'Interface intuitive, aucune formation nécessaire',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* ✅ Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-2"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Shirt className="h-4 w-4" />
            </div>
            <span className="text-xl font-bold">Digit Pressing</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center space-x-4"
          >
            <Button
              variant="ghost"
              onClick={() => router.push('/auth/login')}
              className="hidden sm:inline-flex"
            >
              Se connecter
            </Button>
            <Button onClick={() => router.push('/auth/login')}>
              Commencer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </header>

      <main>
        {/* ✅ Hero Section */}
        <section className="py-20 lg:py-32 text-center">
          <div className="container mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                Modernisez votre <span className="text-gradient">pressing</span>
              </h1>
              <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
                Remplacez vos cahiers par une solution digitale complète.
                Gérez vos factures, calculez vos revenus et suivez votre activité
                en temps réel.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-10 flex items-center justify-center gap-x-6"
            >
              <Button size="lg" onClick={() => router.push('/auth/login')}>
                Commencer gratuitement
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button variant="outline" size="lg">
                Voir la démo
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ✅ Features */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl mb-4">
              Tout ce dont vous avez besoin
            </h2>
            <p className="text-lg text-muted-foreground mb-16">
              Une solution complète pour moderniser la gestion de votre pressing
            </p>

            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="card group hover:shadow-soft transition-all duration-300 p-6 border rounded-lg bg-background"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mx-auto mb-4 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ✅ Benefits */}
        <section className="py-20">
          <div className="container grid grid-cols-1 gap-16 lg:grid-cols-2 items-center">
            <div>
              <h2 className="text-3xl font-bold sm:text-4xl">
                Pourquoi choisir Digit Pressing ?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Rejoignez les pressings modernes qui ont déjà fait le choix du numérique.
              </p>

              <ul className="mt-8 space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.li
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{benefit}</span>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-8">
                <Button size="lg" onClick={() => router.push('/auth/login')}>
                  Essayer maintenant
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7 }}
              className="rounded-2xl border bg-background p-8 shadow-soft"
            >
              <div className="space-y-4">
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                <div className="h-8 w-full bg-muted rounded animate-pulse" />
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-12 bg-success/20 rounded animate-pulse" />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ✅ CTA */}
        <section className="py-20 bg-primary text-center text-primary-foreground">
          <div className="container max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Prêt à moderniser votre pressing ?
            </h2>
            <p className="mt-4 text-lg opacity-90">
              Commencez dès aujourd’hui et découvrez la différence du numérique.
            </p>
            <div className="mt-8 flex items-center justify-center">
              <Button
                size="lg"
                variant="secondary"
                onClick={() => router.push('/auth/login')}
              >
                Créer mon compte
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ✅ Footer */}
      <footer className="border-t bg-background">
        <div className="container py-12 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Digit Pressing. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
