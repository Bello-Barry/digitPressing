'use client';

// =============================================================================
// STAFF DASHBOARD BY ROLE - SAAS PRESSING
// Tailored views for OWNER, MANAGER, CASHIER, and DELIVERY
// =============================================================================

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Plus, 
  TrendingUp, 
  Package, 
  Euro,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Truck,
  Users,
  ShieldCheck,
  CreditCard,
  MapPin
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/store/auth';
import { useRevenue, useRevenueActions } from '@/store/revenue';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

import { StatCard } from '@/components/dashboard/stat-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentInvoices } from '@/components/dashboard/recent-invoices';
import { RevenueChart } from '@/components/dashboard/revenue-chart';

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const { todayStats, monthStats, isLoading, error } = useRevenue();
  const { fetchRevenueStats, updateTodayRevenue, clearError } = useRevenueActions();

  useEffect(() => {
    if (!user) {
      router.push('/admin/login');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (user) {
      fetchRevenueStats('today');
      fetchRevenueStats('month');
      updateTodayRevenue();
    }
  }, [user, fetchRevenueStats, updateTodayRevenue]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(clearError, 5000);
    return () => clearTimeout(timer);
  }, [error, clearError]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-amber-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
          <p className="text-sm text-neutral-400">Chargement de la session...</p>
        </div>
      </div>
    );
  }

  const role = user.role || 'caissier';

  // Role 1: CASHIER VIEW
  if (role === 'caissier' || role === 'cashier') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Espace Caisse</span>
              <h1 className="text-2xl font-bold">Bonjour, {user.fullName.split(' ')[0]} 👋</h1>
              <p className="text-sm text-muted-foreground">Session active — {formatDate(new Date())}</p>
            </div>
            <Button onClick={() => router.push('/invoices/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Dépôt Client
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Encaissements du jour"
              value={formatCurrency(todayStats?.totalRevenue || 0)}
              description={`${todayStats?.totalTransactions || 0} transaction(s)`}
              icon={Euro}
              trend="neutral"
              color="success"
            />
            <StatCard
              title="Ticket Moyen"
              value={formatCurrency(todayStats?.averageTicket || 0)}
              description="Moyenne par client"
              icon={Clock}
              trend="neutral"
              color="primary"
            />
            <StatCard
              title="Statut Caisse"
              value="Ouverte"
              description="Contrôle régulier"
              icon={CheckCircle}
              trend="neutral"
              color="warning"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <QuickActions actions={[
                { title: 'Nouveau Dépôt', description: 'Enregistrer du linge', icon: Plus, href: '/invoices/new', color: 'primary' },
                { title: 'Rechercher Client', description: 'Retrouver par téléphone', icon: Search, href: '/invoices/search', color: 'secondary' },
                { title: 'Gestion Caisse', description: 'Ouverture / Clôture', icon: CreditCard, href: '/cash-register', color: 'success' },
              ]} />
            </div>
            <div className="lg:col-span-2">
              <RecentInvoices />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Role 2: DELIVERY VIEW
  if (role === 'delivery') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Espace Livraison</span>
            <h1 className="text-2xl font-bold">Tournée de Livraison — {user.fullName.split(' ')[0]}</h1>
            <p className="text-sm text-muted-foreground">Commandes prêtes pour ramassage ou dépôt à domicile</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <StatCard
              title="Livraisons à Effectuer"
              value="4"
              description="Adresses enregistrées"
              icon={Truck}
              trend="neutral"
              color="primary"
            />
            <StatCard
              title="Encaissements à la Livraison"
              value={formatCurrency(14000)}
              description="Non encore réglés"
              icon={Euro}
              trend="neutral"
              color="warning"
            />
          </div>

          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Prochaines Adresses
            </h2>
            <div className="space-y-3">
              <div className="p-4 rounded-lg border bg-muted/30 flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">LB-0043 — Sassou Yvonne</p>
                  <p className="text-xs text-muted-foreground">Bacongo, Case de Passage (Tél: +242 05 544 3322)</p>
                </div>
                <Button size="sm" variant="outline">Naviguer</Button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Role 3: OWNER & MANAGER VIEW (FULL ANALYTICS)
  const stats = [
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bonjour, {user.fullName.split(' ')[0]} 👋
            </h1>
            <p className="text-muted-foreground">
              Aperçu global de l'activité du {formatDate(new Date())}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button onClick={() => router.push('/invoices/new')} disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Facture
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <QuickActions actions={[
              { title: "Nouvelle facture", description: "Créer une facture client", icon: Plus, href: "/invoices/new", color: "primary" },
              { title: "Rechercher", description: "Trouver une facture", icon: Search, href: "/invoices/search", color: "secondary" },
              { title: "Équipe", description: "Membres & Rôles", icon: Users, href: "/users", color: "success" },
              { title: "Revenus", description: "Statistiques avancées", icon: Euro, href: "/revenue", color: "warning" },
            ]} />
          </div>

          <div className="lg:col-span-2">
            <RevenueChart />
          </div>
        </div>

        <div>
          <RecentInvoices />
        </div>
      </div>
    </DashboardLayout>
  );
}
