'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { 
  Shirt, 
  Users, 
  TrendingUp, 
  Shield, 
  Smartphone, 
  Zap,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

const HomePage = () => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Rediriger vers le dashboard si l'utilisateur est connecté
    if (user && !isLoading) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  // Si l'utilisateur est connecté, montrer un écran de chargement
  if (user && !isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Redirection vers le dashboard...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Shirt,
      title: "Gestion des factures",
      description: "Créez, modifiez et suivez toutes vos factures en temps réel avec un système numérique complet.",
    },
    {
      icon: TrendingUp,
      title: "Suivi des revenus",
      description: "Calculez automatiquement vos revenus quotidiens, mensuels et analysez vos performances.",
    },
    {
      icon: Users,
      title: "Multi-utilisateurs",
      description: "Gérez votre équipe avec des rôles et permissions personnalisés pour chaque employé.",
    },
    {
      icon: Shield,
      title: "Sécurisé",
      description: "Vos données sont protégées avec un chiffrement de niveau entreprise et des sauvegardes automatiques.",
    },
    {
      icon: Smartphone,
      title: "Application mobile",
      description: "Utilisez l'application sur tous vos appareils, même hors ligne grâce à la technologie PWA.",
    },
    {
      icon: Zap,
      title: "Ultra rapide",
      description: "Interface optimisée pour une utilisation quotidienne intensive avec des performances exceptionnelles.",
    },
  ];

  const benefits = [
    "Fini les cahiers de factures perdus ou abîmés",
    "Calcul automatique des revenus sans erreur",
    "Recherche instantanée de n'importe quelle facture",
    "Sauvegarde automatique de toutes vos données",
    "Accès depuis n'importe quel appareil connecté",
    "Interface intuitive, aucune formation nécessaire",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
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
        {/* Hero Section */}
        <section className="py-20 lg:py-32">
          <div className="container">
            <div className="mx-auto max-w-4xl text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                  Modernisez votre{' '}
                  <span className="text-gradient">pressing</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
                  Remplacez vos cahiers de factures par une solution digitale professionnelle. 
                  Gérez vos factures, calculez vos revenus et suivez votre activité en temps réel.
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

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">100%</div>
                  <div className="text-sm text-muted-foreground">Numérique</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">24/7</div>
                  <div className="text-sm text-muted-foreground">Disponible</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">0€</div>
                  <div className="text-sm text-muted-foreground">Frais cachés</div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/30">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tout ce dont vous avez besoin
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Une solution complète pour moderniser la gestion de votre pressing
              </p>
            </div>

            <div className="mx-auto mt-16 max-w-5xl">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="card group hover:shadow-soft transition-all duration-300"
                  >
                    <div className="card-content">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        <feature.icon className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {feature.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20">
          <div className="container">
            <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
              <div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Pourquoi choisir Digit Pressing ?
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Rejoignez les pressing modernes qui ont déjà fait le choix du numérique 
                  pour optimiser leur gestion quotidienne.
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
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7 }}
                className="relative"
              >
                {/* Mock interface */}
                <div className="relative mx-auto max-w-lg">
                  <div className="rounded-2xl bg-background p-8 shadow-soft border">
                    <div className="mb-6">
                      <div className="mb-2 h-4 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-8 w-full bg-muted rounded animate-pulse" />
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-12 bg-success/20 rounded animate-pulse" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-16 bg-warning/20 rounded animate-pulse" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                        <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-14 bg-primary/20 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="mt-6 pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                        <div className="h-6 w-16 bg-primary/30 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-primary">
          <div className="container">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Prêt à moderniser votre pressing ?
              </h2>
              <p className="mt-4 text-lg text-primary-foreground/80">
                Commencez dès aujourd'hui et découvrez la différence qu'une gestion numérique peut faire.
              </p>
              <div className="mt-8 flex items-center justify-center gap-4">
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
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container py-12">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center space-x-2">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-white">
                  <Shirt className="h-3 w-3" />
                </div>
                <span className="font-semibold">Digit Pressing</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                La solution digitale moderne pour tous les pressings professionnels.
              </p>
            </div>

            <div>
              <h3 className="font-semibold">Produit</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Fonctionnalités</a></li>
                <li><a href="#" className="hover:text-foreground">Tarifs</a></li>
                <li><a href="#" className="hover:text-foreground">Sécurité</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold">Support</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground">Guide d'utilisation</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold">Entreprise</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">À propos</a></li>
                <li><a href="#" className="hover:text-foreground">Mentions légales</a></li>
                <li><a href="#" className="hover:text-foreground">Confidentialité</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Digit Pressing. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;