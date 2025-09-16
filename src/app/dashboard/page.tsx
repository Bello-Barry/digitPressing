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
import { Input } from '@/components/ui/input';
import { useAuth } from '@/store/auth';
import { useTodayStats, useInvoiceActions } from '@/store/invoices';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

// Composants du dashboard
import { StatCard } from '@/components/dashboard/stat-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { RevenueChart } from '@/components/dashboard/revenue-chart';

const DashboardPage = () => {
  const router = useRouter();
  const { user } = useAuth();
  const { todayStats, fetchTodayStats } = useTodayStats();
  const { fetchInvoices } = useInvoiceActions();

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
      fetchTodayStats();
      fetchInvoices({ reset: true });
    }
  }, [user, fetchTodayStats, fetchInvoices]);

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

  const stats = [
    {
      title: "Revenus du jour",
      value: formatCurrency(todayStats?.totalRevenue || 0),
      description: `${todayStats?.paidInvoices || 0} facture(s) payée(s)`,
      icon: Euro,
      trend: todayStats?.totalRevenue > 0 ? 'up' : 'neutral',
      color: 'success',
    },
    {
      title: "Factures créées",
      value: todayStats?.totalInvoices || 0,
      description: "Aujourd'hui",
      icon: Package,
      trend: todayStats?.totalInvoices > 0 ? 'up' : 'neutral',
      color: 'primary',
    },
    {
      title: "En attente",
      value: todayStats?.pendingInvoices || 0,
      description: "À récupérer",
      icon: Clock,
      trend: todayStats?.pendingInvoices > 0 ? 'down' : 'up',
      color: 'warning',
    },
    {
      title: "Ticket moyen",
      value: formatCurrency(todayStats?.averageTicket || 0),
      description: "Ce jour",
      icon: TrendingUp,
      trend: 'neutral',
      color: 'secondary',
    },
  ];

  const quickActions = [
    {
      title: "Nouvelle facture",
      description: "Créer une facture client",
      icon: Plus,
      href: "/invoices/new",
      color: "primary",
      shortcut: "Ctrl+N",
    },
    {
      title: "Rechercher",
      description: "Trouver une facture",
      icon: Search,
      href: "/invoices/search",
      color: "secondary",
      shortcut: "Ctrl+F",
    },
    {
      title: "Retraits",
      description: "Gérer les retraits",
      icon: CheckCircle,
      href: "/invoices/withdrawals",
      color: "success",
    },
    {
      title: "Revenus",
      description: "Voir les revenus",
      icon: Euro,
      href: "/revenue",
      color: "warning",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
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
            <Button onClick={() => router.push('/invoices/new')}>
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

        {/* Alertes et notifications */}
        {todayStats && todayStats.pendingInvoices > 10 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="rounded-lg border border-warning bg-warning/5 p-4"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-warning-foreground">
                  Attention : Nombreuses factures en attente
                </h3>
                <p className="mt-1 text-sm text-warning-foreground/80">
                  Vous avez {todayStats.pendingInvoices} factures en attente de retrait. 
                  Pensez à contacter vos clients.
                </p>
                <div className="mt-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => router.push('/invoices?filter=pending')}
                  >
                    Voir les factures en attente
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