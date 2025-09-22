'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Plus, 
  TrendingUp, 
  Users, 
  Package, 
  Calendar,
  Euro,
  Clock,
  CheckCircle,
  AlertCircle,
  Search
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/auth';
// Import de vos stores revenue
import { useRevenue, useRevenueActions } from '@/store/revenue';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

// Composants du dashboard
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { RevenueChart } from '@/components/dashboard/revenue-chart';

const _DashboardPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  // Utiliser le store revenue
  const { todayStats, monthStats, isLoading, error } = useRevenue();
  const { fetchRevenueStats, updateTodayRevenue, clearError } = useRevenueActions();

  // Rediriger vers login si non connecté
  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
  }, [user, router]);

  // Charger les données initiales
  useEffect(() => {
    if (user) {
      // Charger les stats du jour et du mois
      fetchRevenueStats('today');
      fetchRevenueStats('month');
      // Mettre à jour le CA du jour
      updateTodayRevenue();
    }
  }, [user, fetchRevenueStats, updateTodayRevenue]);

  // Gérer les erreurs
  useEffect(() => {
    if (error) {
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Préparer les statistiques pour les cards
  const _stats = [
    {
      title: "Revenus du jour",
      value: formatCurrency(todayStats?.totalRevenue || 0),
      description: `${todayStats?.totalTransactions || 0} transaction(s)`,
      icon: Euro,
      trend: (todayStats?.totalRevenue || 0) > 0 ? 'up' : 'neutral',
      color: 'success',
    },
    {
      title: "Revenus du mois",
      value: formatCurrency(monthStats?.totalRevenue || 0),
      description: `${monthStats?.totalTransactions || 0} transactions`,
      icon: TrendingUp,
      trend: (monthStats?.totalRevenue || 0) > 0 ? 'up' : 'neutral',
      color: 'primary',
    },
    {
      title: "Ticket moyen (mois)",
      value: formatCurrency(monthStats?.averageTicket || 0),
      description: "Moyenne mensuelle",
      icon: Package,
      trend: 'neutral',
      color: 'secondary',
    },
    {
      title: "Ticket moyen (jour)",
      value: formatCurrency(todayStats?.averageTicket || 0),
      description: "Moyenne du jour",
      icon: Clock,
      trend: 'neutral',
      color: 'warning',
    },
  ];

  const _quickActions = [
    {
      title: "Nouvelle facture",
      description: "Créer une facture client",
      icon: Plus,
      href: "/invoices/new",
      color: "primary" as const,
      shortcut: "Ctrl+N",
    },
    {
      title: "Rechercher",
      description: "Trouver une facture",
      icon: Search,
      href: "/invoices/search",
      color: "secondary" as const,
      shortcut: "Ctrl+F",
    },
    {
      title: "Retraits",
      description: "Gérer les retraits",
      icon: CheckCircle,
      href: "/invoices/withdrawals",
      color: "success" as const,
    },
    {
      title: "Revenus",
      description: "Voir les revenus détaillés",
      icon: Euro,
      href: "/revenue",
      color: "warning" as const,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Afficher les erreurs */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-destructive font-medium">Erreur</p>
            </div>
            <p className="text-destructive/80 mt-1 text-sm">{error}</p>
          </motion.div>
        )}

        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bonjour, {user.fullName.split(' ')[0]} 👋
            </h1>
            <p className="text-muted-foreground">
              Voici un aperçu de votre activité du {formatDate(new Date())}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              onClick={() => router.push('/invoices/new')}
              disabled={isLoading}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle facture
            </Button>
          </div>
        </motion.div>

        {/* Statistiques principales */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((stat, index) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              description={stat.description}
              icon={stat.icon}
              trend={stat.trend as any}
              color={stat.color as any}
              delay={index * 0.1}
            />
          ))}
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Actions rapides */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1"
          >
            <QuickActions actions={quickActions} />
          </motion.div>

          {/* Graphique des revenus */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2"
          >
            <RevenueChart />
          </motion.div>
        </div>

        {/* Factures récentes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <RecentInvoices />
        </motion.div>

        {/* Alerte si pas de revenus aujourd'hui */}
        {todayStats && todayStats.totalRevenue === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">
                  Aucun revenu enregistré aujourd'hui
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  Il n'y a pas encore de revenus pour la journée du {formatDate(new Date())}.
                  Commencez par créer des factures !
                </p>
                <div className="mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/invoices/new')}
                    className="bg-white hover:bg-yellow-50 border-yellow-300 text-yellow-800"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Créer une facture
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Information sur les revenus du mois */}
        {monthStats && monthStats.totalRevenue > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-lg border border-green-200 bg-green-50 p-4"
          >
            <div className="flex items-start space-x-3">
              <TrendingUp className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-green-800">
                  Excellent travail ce mois !
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  Vous avez généré {formatCurrency(monthStats.totalRevenue)} de chiffre d'affaires 
                  avec {monthStats.totalTransactions} transactions.
                  Moyenne journalière : {formatCurrency(monthStats.dailyAverage || 0)}.
                </p>
                <div className="mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/revenue')}
                    className="bg-white hover:bg-green-50 border-green-300 text-green-800"
                  >
                    <Euro className="mr-2 h-4 w-4" />
                    Voir les détails
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;