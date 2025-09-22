'use client';

// =============================================================================
// PAGE DASHBOARD REVENUS - Digit PRESSING
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  CreditCard,
  Users,
  Package,
  BarChart3,
  PieChart,
  Download,
  Filter,
  RefreshCw,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  useRevenue,
  useRevenueActions,
  useRevenueFilters,
  useRevenueHelpers
} from '@/store/revenue';
import { useAuth, useUserPermissions } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { formatCurrency, formatDate } from '@/lib/utils';

const _PERIOD_OPTIONS = [
  { value: 'today', label: 'Aujourd\'hui' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Période personnalisée' },
];

const _CHART_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1',
  '#d084d0', '#ffb347', '#87ceeb', '#dda0dd', '#98fb98'
];

export default function RevenuePage() {
  const _router = useRouter();
  const { user } = useAuth();
  const _permissions = useUserPermissions();
  
  // États des stores
  const { 
    dailyRevenues, 
    stats, 
    todayStats, 
    monthStats, 
    chartData, 
    isLoading, 
    error 
  } = useRevenue();
  
  const { 
    fetchDailyRevenues, 
    fetchRevenueStats, 
    fetchChartData, 
    updateTodayRevenue,
    clearError 
  } = useRevenueActions();
  
  const { 
    filters, 
    dateRange, 
    setDateRange, 
    setFilters 
  } = useRevenueFilters();
  
  const { 
    calculateGrowthRate, 
    getTopCategories, 
    getTopPaymentMethods 
  } = useRevenueHelpers();

  // États locaux
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeChart, setActiveChart] = useState<'daily' | 'categories' | 'methods'>('daily');

  // Vérifier les permissions
  const _canViewRevenue = permissions.isOwner || permissions.canViewRevenue;

  useEffect(() => {
    if (user && !canViewRevenue) {
      router.push('/dashboard');
    }
  }, [user, canViewRevenue, router]);

  // Charger les données au montage
  useEffect(() => {
    if (user && canViewRevenue) {
      loadRevenueData();
    }
  }, [user, canViewRevenue]);

  // Charger les données selon la période
  const _loadRevenueData = async () => {
    try {
      // Mettre à jour le CA du jour
      await updateTodayRevenue();
      
      // Charger les stats selon la période
      if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
        await fetchRevenueStats('custom', customStartDate, customEndDate);
        await fetchDailyRevenues(customStartDate, customEndDate);
      } else {
        await fetchRevenueStats(selectedPeriod);
        
        // Définir les dates selon la période
        const _now = new Date();
        let startDate: string;
        let endDate = now.toISOString().split('T')[0];
        
        switch (selectedPeriod) {
          case 'today':
            startDate = endDate;
            break;
          case 'week':
            const _weekStart = new Date(now);
            weekStart.setDate(now.getDate() - 7);
            startDate = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            break;
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        }
        
        setDateRange(startDate, endDate);
        await fetchDailyRevenues(startDate, endDate);
      }
      
      // Charger les données des graphiques
      await fetchChartData('daily');
      await fetchChartData('categories');
      await fetchChartData('payment_methods');
      
    } catch (error) {
      console.error('Erreur lors du chargement des revenus:', error);
    }
  };

  // Gérer le changement de période
  const _handlePeriodChange = (period: typeof selectedPeriod) => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      loadRevenueData();
    }
  };

  // Appliquer la période personnalisée
  const _applyCustomPeriod = () => {
    if (customStartDate && customEndDate) {
      loadRevenueData();
    }
  };

  // Gérer les erreurs
  useEffect(() => {
    if (error) {
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  // Calculs des statistiques de croissance
  const _todayRevenue = todayStats?.totalRevenue || 0;
  const _monthRevenue = monthStats?.totalRevenue || 0;
  const _previousMonthRevenue = monthRevenue * 0.85; // Simulation
  const _growthRate = calculateGrowthRate(monthRevenue, previousMonthRevenue);

  // Top catégories et méthodes de paiement
  const _topCategories = getTopCategories(5);
  const _topPaymentMethods = getTopPaymentMethods();

  if (!user || !canViewRevenue) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-600" />
        <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground mb-4">
          Vous n'avez pas l'autorisation de consulter les revenus.
        </p>
        <Button onClick={() => router.push('/dashboard')}>
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Revenus</h1>
          <p className="text-muted-foreground">
            Analyse des performances financières
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={loadRevenueData}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>

          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtres
          </Button>

          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Filtres de période */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="flex gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={selectedPeriod === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePeriodChange(option.value as typeof selectedPeriod)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {selectedPeriod === 'custom' && (
            <div className="flex gap-2 items-center">
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-40"
              />
              <span>à</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-40"
              />
              <Button 
                onClick={applyCustomPeriod}
                disabled={!customStartDate || !customEndDate}
              >
                Appliquer
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Métriques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">CA du jour</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(todayRevenue)}
              </p>
              <p className="text-sm text-muted-foreground">
                {todayStats?.totalTransactions || 0} transactions
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">CA du mois</p>
              <p className="text-2xl font-bold">
                {formatCurrency(monthRevenue)}
              </p>
              <div className="flex items-center gap-1">
                {growthRate >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-sm ${growthRate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(growthRate)}%
                </span>
              </div>
            </div>
            <BarChart3 className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ticket moyen</p>
              <p className="text-2xl font-bold">
                {formatCurrency(monthStats?.averageTicket || 0)}
              </p>
              <p className="text-sm text-muted-foreground">
                Par transaction
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-2xl font-bold">
                {monthStats?.totalTransactions || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                Ce mois
              </p>
            </div>
            <Package className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution des revenus */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Évolution des revenus</CardTitle>
              <Select value={activeChart} onValueChange={(value: any) => setActiveChart(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Journalier</SelectItem>
                  <SelectItem value="categories">Catégories</SelectItem>
                  <SelectItem value="methods">Paiements</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {activeChart === 'daily' && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value: number) => [formatCurrency(value), 'CA']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ fill: '#8884d8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {activeChart === 'categories' && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.categories}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'CA']}
                  />
                  <Bar dataKey="value" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {activeChart === 'methods' && chartData.paymentMethods.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={chartData.paymentMethods}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                  >
                    {chartData.paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top catégories */}
        <Card>
          <CardHeader>
            <CardTitle>Top catégories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCategories.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucune donnée disponible
                </p>
              ) : (
                topCategories.map((category, index) => (
                  <div key={category.category} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium capitalize">{category.category}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(category.total)}
                        </p>
                      </div>
                    </div>
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width: `${(category.total / topCategories[0].total) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Détails des revenus quotidiens */}
      <Card>
        <CardHeader>
          <CardTitle>Détail des revenus quotidiens</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyRevenues.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Aucune donnée pour la période sélectionnée
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {dailyRevenues.slice(0, 10).map((revenue) => (
                <div 
                  key={revenue.id} 
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-medium">{formatDate(revenue.date)}</p>
                      <p className="text-sm text-muted-foreground">
                        {revenue.totalTransactions} transactions
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {formatCurrency(revenue.dailyTotal)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ticket moyen: {formatCurrency(revenue.averageTicket)}
                    </p>
                  </div>
                </div>
              ))}
              
              {dailyRevenues.length > 10 && (
                <div className="text-center pt-4">
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Voir plus
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}