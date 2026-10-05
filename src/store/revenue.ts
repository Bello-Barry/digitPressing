// =============================================================================
// STORE REVENUE - Digit PRESSING / SAAS PRESSING
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type {
  DailyRevenue,
  RevenueFilters,
  RevenueStats,
  RevenueChartData,
  LoadingState
} from '@/types';
import { useAuthStore } from './auth';
import { formatDate } from '@/lib/utils';

interface RevenueState extends LoadingState {
  dailyRevenues: DailyRevenue[];
  currentDateRevenue: DailyRevenue | null;
  dateRange: {
    startDate: string;
    endDate: string;
  };

  stats: RevenueStats | null;
  todayStats: RevenueStats | null;
  monthStats: RevenueStats | null;
  yearStats: RevenueStats | null;

  chartData: {
    daily: RevenueChartData[];
    weekly: RevenueChartData[];
    monthly: RevenueChartData[];
    categories: { name: string; value: number; color: string }[];
    paymentMethods: { name: string; value: number; color: string }[];
  };

  filters: RevenueFilters;
  error: string | null;
  lastUpdated?: string | null;

  fetchDailyRevenues: (startDate?: string, endDate?: string) => Promise<void>;
  fetchRevenueStats: (period: 'today' | 'month' | 'year' | 'custom', startDate?: string, endDate?: string) => Promise<void>;
  fetchChartData: (type: 'daily' | 'weekly' | 'monthly' | 'categories' | 'payment_methods', period?: string) => Promise<void>;
  calculateDailyRevenue: (date: string) => Promise<void>;
  
  updateTodayRevenue: () => Promise<void>;
  syncRevenueData: () => Promise<void>;

  setFilters: (filters: Partial<RevenueFilters>) => void;
  setDateRange: (startDate: string, endDate: string) => void;
  resetFilters: () => void;

  getRevenueByDate: (date: string) => DailyRevenue | undefined;
  getRevenueByPeriod: (startDate: string, endDate: string) => DailyRevenue[];
  calculatePeriodTotal: (startDate: string, endDate: string) => number;
  calculateGrowthRate: (current: number, previous: number) => number;
  getTopCategories: (limit?: number) => { category: string; total: number }[];
  getTopPaymentMethods: (limit?: number) => { method: string; total: number }[];

  setCurrentDateRevenue: (revenue: DailyRevenue | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialFilters: RevenueFilters = {
  dateFrom: undefined,
  dateTo: undefined,
  paymentMethod: undefined,
};

const initialDateRange = {
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0],
};

export const useRevenueStore = create<RevenueState>()(
  subscribeWithSelector((set, get) => ({
    dailyRevenues: [],
    currentDateRevenue: null,
    dateRange: initialDateRange,
    stats: null,
    todayStats: null,
    monthStats: null,
    yearStats: null,
    chartData: {
      daily: [],
      weekly: [],
      monthly: [],
      categories: [],
      paymentMethods: [],
    },
    filters: initialFilters,
    isLoading: false,
    error: null,
    lastUpdated: null,

    fetchDailyRevenues: async (startDate, endDate) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        if (user.role !== 'owner' && !user.permissions?.find(p => p.action === 'view_revenue')?.granted) {
          throw new Error('Accès refusé - Permission view_revenue requise');
        }

        set({ isLoading: true, error: null });

        const { dateRange, filters } = get();
        const start = startDate || filters.dateFrom || dateRange.startDate;
        const end = endDate || filters.dateTo || dateRange.endDate;

        let query: any = (supabase as any)
          .from('revenue_daily')
          .select('*')
          .eq('pressing_id', user.pressingId)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        const dailyRevenues: DailyRevenue[] = data?.map((row: any) => ({
          pressingId: row.pressing_id,
          date: row.date,
          depositTotal: row.deposit_total,
          withdrawalTotal: row.withdrawal_total,
          dailyTotal: row.daily_total,
          totalTransactions: row.total_transactions,
          averageTicket: row.average_ticket,
          paymentMethods: row.payment_methods as Record<string, number>,
          categories: row.categories as Record<string, number>,
        })) || [];

        set({
          dailyRevenues,
          dateRange: { startDate: start, endDate: end },
          isLoading: false,
          lastUpdated: new Date().toISOString(),
        });

      } catch (error: any) {
        console.error('Erreur lors du chargement des revenus:', error);
        set({
          error: error.message || 'Erreur lors du chargement des revenus',
          isLoading: false,
        });
      }
    },

    fetchRevenueStats: async (period, startDate, endDate) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        if (user.role !== 'owner' && !user.permissions?.find(p => p.action === 'view_revenue')?.granted) {
          throw new Error('Accès refusé');
        }

        let start: string;
        let end: string;

        const now = new Date();
        
        switch (period) {
          case 'today':
            start = end = now.toISOString().split('T')[0];
            break;
          case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            end = now.toISOString().split('T')[0];
            break;
          case 'year':
            start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
            end = now.toISOString().split('T')[0];
            break;
          case 'custom':
            start = startDate!;
            end = endDate!;
            break;
        }

        const { data, error } = await (supabase as any)
          .from('revenue_daily')
          .select('*')
          .eq('pressing_id', user.pressingId)
          .gte('date', start)
          .lte('date', end);

        if (error) throw error;

        const revenues: any[] = data || [];
        
        const stats: RevenueStats = {
          totalRevenue: revenues.reduce((sum: number, r: any) => sum + Number(r.daily_total || 0), 0),
          depositTotal: revenues.reduce((sum: number, r: any) => sum + Number(r.deposit_total || 0), 0),
          withdrawalTotal: revenues.reduce((sum: number, r: any) => sum + Number(r.withdrawal_total || 0), 0),
          totalTransactions: revenues.reduce((sum: number, r: any) => sum + Number(r.total_transactions || 0), 0),
          averageTicket: revenues.length > 0 
            ? revenues.reduce((sum: number, r: any) => sum + Number(r.average_ticket || 0), 0) / revenues.length
            : 0,
          growthRate: 0,
        };

        const updateKey = `${period}Stats` as 'todayStats' | 'monthStats' | 'yearStats' | 'stats';
        set({ [updateKey]: stats });

      } catch (error: any) {
        console.error('Erreur lors du calcul des stats:', error);
        set({ error: error.message || 'Erreur lors du calcul des stats' });
      }
    },

    fetchChartData: async (type, period) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        const { dateRange } = get();
        const start = period || dateRange.startDate;
        const end = dateRange.endDate;

        const { data, error } = await (supabase as any)
          .from('revenue_daily')
          .select('*')
          .eq('pressing_id', user.pressingId)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true });

        if (error) throw error;

        const revenues: any[] = data || [];

        switch (type) {
          case 'daily':
            const dailyData: RevenueChartData[] = revenues.map((r: any) => ({
              date: r.date,
              amount: r.daily_total,
              deposits: r.deposit_total,
              withdrawals: r.withdrawal_total,
              value: r.daily_total,
              label: formatDate(r.date, 'dd/MM'),
            }));
            set(state => ({
              chartData: { ...state.chartData, daily: dailyData }
            }));
            break;

          case 'weekly':
            const weeklyData: Record<string, number> = {};
            revenues.forEach((r: any) => {
              const date = new Date(r.date);
              const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
              const weekKey = weekStart.toISOString().split('T')[0];
              weeklyData[weekKey] = (weeklyData[weekKey] || 0) + r.daily_total;
            });

            const weeklyChartData: RevenueChartData[] = Object.entries(weeklyData).map(([date, value]) => ({
              date,
              amount: value,
              deposits: value,
              withdrawals: 0,
              value,
              label: `Sem ${formatDate(date, 'dd/MM')}`,
            }));

            set(state => ({
              chartData: { ...state.chartData, weekly: weeklyChartData }
            }));
            break;

          case 'monthly':
            const monthlyData: Record<string, number> = {};
            revenues.forEach((r: any) => {
              const date = new Date(r.date);
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              monthlyData[monthKey] = (monthlyData[monthKey] || 0) + r.daily_total;
            });

            const monthlyChartData: RevenueChartData[] = Object.entries(monthlyData).map(([key, value]) => ({
              date: key,
              amount: value,
              deposits: value,
              withdrawals: 0,
              value,
              label: formatDate(`${key}-01`, 'MMM yyyy'),
            }));

            set(state => ({
              chartData: { ...state.chartData, monthly: monthlyChartData }
            }));
            break;

          case 'categories':
            const categoriesData: Record<string, number> = {};
            revenues.forEach((r: any) => {
              Object.entries(r.categories || {}).forEach(([cat, amount]) => {
                categoriesData[cat] = (categoriesData[cat] || 0) + (amount as number);
              });
            });

            const categoriesChartData = Object.entries(categoriesData)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 10)
              .map(([name, value], index) => ({
                name,
                value,
                color: `hsl(${index * 36}, 70%, 50%)`,
              }));

            set(state => ({
              chartData: { ...state.chartData, categories: categoriesChartData }
            }));
            break;

          case 'payment_methods':
            const paymentData: Record<string, number> = {};
            revenues.forEach((r: any) => {
              Object.entries(r.payment_methods || {}).forEach(([method, amount]) => {
                paymentData[method] = (paymentData[method] || 0) + (amount as number);
              });
            });

            const paymentMethodsChartData = Object.entries(paymentData)
              .sort(([,a], [,b]) => b - a)
              .map(([name, value], index) => ({
                name: name === 'cash' ? 'Espèces' : 
                     name === 'card' ? 'Carte' :
                     name === 'mobile_money' ? 'Mobile Money' :
                     name === 'transfer' ? 'Virement' : name,
                value,
                color: `hsl(${index * 72}, 60%, 50%)`,
              }));

            set(state => ({
              chartData: { ...state.chartData, paymentMethods: paymentMethodsChartData }
            }));
            break;
        }

      } catch (error: any) {
        console.error('Erreur lors du chargement des données graphiques:', error);
        set({ error: error.message || 'Erreur lors du chargement des données graphiques' });
      }
    },

    calculateDailyRevenue: async (date: string) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        const { data: invoices, error: invoicesError } = await (supabase as any)
          .from('invoices')
          .select('*')
          .eq('pressing_id', user.pressingId)
          .eq('deposit_date', date)
          .eq('status', 'active');

        if (invoicesError) throw invoicesError;

        const dailyInvoices: any[] = invoices || [];

        const depositTotal = dailyInvoices.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);
        const withdrawalTotal = dailyInvoices
          .filter((inv: any) => inv.withdrawn && inv.withdrawal_date === date)
          .reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);
        
        const totalTransactions = dailyInvoices.length;
        const averageTicket = totalTransactions > 0 ? depositTotal / totalTransactions : 0;

        const paymentMethods: Record<string, number> = {};
        dailyInvoices
          .filter((inv: any) => inv.paid)
          .forEach((inv: any) => {
            const method = inv.payment_method || 'cash';
            paymentMethods[method] = (paymentMethods[method] || 0) + Number(inv.total || 0);
          });

        const categories: Record<string, number> = {};
        dailyInvoices.forEach((inv: any) => {
          (inv.items as any[] || []).forEach((item: any) => {
            const category = item.category || 'autres';
            const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            categories[category] = (categories[category] || 0) + itemTotal;
          });
        });

        const employees: Record<string, number> = {};
        dailyInvoices.forEach((inv: any) => {
          const employeeName = inv.created_by_name || 'Inconnu';
          employees[employeeName] = (employees[employeeName] || 0) + Number(inv.total || 0);
        });

        const { error: upsertError } = await (supabase as any)
          .from('revenue_daily')
          .upsert({
            pressing_id: user.pressingId,
            date,
            deposit_total: depositTotal,
            withdrawal_total: withdrawalTotal,
            daily_total: withdrawalTotal,
            total_transactions: totalTransactions,
            average_ticket: averageTicket,
            payment_methods: paymentMethods,
            categories,
            employees,
            updated_at: new Date().toISOString(),
          } as any);

        if (upsertError) throw upsertError;

        const today = new Date().toISOString().split('T')[0];
        if (date === today) {
          await get().updateTodayRevenue();
        }

      } catch (error: any) {
        console.error('Erreur lors du calcul du CA journalier:', error);
        throw error;
      }
    },

    updateTodayRevenue: async () => {
      const today = new Date().toISOString().split('T')[0];
      await get().calculateDailyRevenue(today);
      await get().fetchRevenueStats('today');
    },

    syncRevenueData: async () => {
      try {
        const { dateRange } = get();
        await get().fetchDailyRevenues(dateRange.startDate, dateRange.endDate);
        await get().fetchRevenueStats('month');
        await get().fetchChartData('daily');
      } catch (error: any) {
        console.error('Erreur lors de la synchronisation:', error);
      }
    },

    setFilters: (newFilters: Partial<RevenueFilters>) => {
      set(state => ({
        filters: { ...state.filters, ...newFilters }
      }));
      get().fetchDailyRevenues();
    },

    setDateRange: (startDate: string, endDate: string) => {
      set({ dateRange: { startDate, endDate } });
      get().fetchDailyRevenues(startDate, endDate);
    },

    resetFilters: () => {
      set({ filters: initialFilters, dateRange: initialDateRange });
      get().fetchDailyRevenues();
    },

    getRevenueByDate: (date: string) => {
      const { dailyRevenues } = get();
      return dailyRevenues.find(r => r.date === date);
    },

    getRevenueByPeriod: (startDate: string, endDate: string) => {
      const { dailyRevenues } = get();
      return dailyRevenues.filter(r => r.date >= startDate && r.date <= endDate);
    },

    calculatePeriodTotal: (startDate: string, endDate: string) => {
      const revenues = get().getRevenueByPeriod(startDate, endDate);
      return revenues.reduce((sum, r) => sum + r.dailyTotal, 0);
    },

    calculateGrowthRate: (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 100) / 100;
    },

    getTopCategories: (limit = 5) => {
      const { dailyRevenues } = get();
      const categories: Record<string, number> = {};
      
      dailyRevenues.forEach(r => {
        Object.entries(r.categories || {}).forEach(([cat, amount]) => {
          categories[cat] = (categories[cat] || 0) + (amount as number);
        });
      });

      return Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([category, total]) => ({ category, total }));
    },

    getTopPaymentMethods: (limit = 5) => {
      const { dailyRevenues } = get();
      const methods: Record<string, number> = {};
      
      dailyRevenues.forEach(r => {
        Object.entries(r.paymentMethods || {}).forEach(([method, amount]) => {
          methods[method] = (methods[method] || 0) + (amount as number);
        });
      });

      return Object.entries(methods)
        .sort(([,a], [,b]) => b - a)
        .slice(0, limit)
        .map(([method, total]) => ({ method, total }));
    },

    setCurrentDateRevenue: (revenue: DailyRevenue | null) => {
      set({ currentDateRevenue: revenue });
    },

    clearError: () => {
      set({ error: null });
    },

    reset: () => {
      set({
        dailyRevenues: [],
        currentDateRevenue: null,
        dateRange: initialDateRange,
        stats: null,
        todayStats: null,
        monthStats: null,
        yearStats: null,
        chartData: {
          daily: [],
          weekly: [],
          monthly: [],
          categories: [],
          paymentMethods: [],
        },
        filters: initialFilters,
        isLoading: false,
        error: null,
        lastUpdated: null,
      });
    },
  }))
);

export const useRevenue = () => {
  return useRevenueStore(state => ({
    dailyRevenues: state.dailyRevenues,
    stats: state.stats,
    todayStats: state.todayStats,
    monthStats: state.monthStats,
    yearStats: state.yearStats,
    chartData: state.chartData,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
  }));
};

export const useRevenueActions = () => {
  return useRevenueStore(state => ({
    fetchDailyRevenues: state.fetchDailyRevenues,
    fetchRevenueStats: state.fetchRevenueStats,
    fetchChartData: state.fetchChartData,
    calculateDailyRevenue: state.calculateDailyRevenue,
    updateTodayRevenue: state.updateTodayRevenue,
    syncRevenueData: state.syncRevenueData,
    clearError: state.clearError,
  }));
};

export const useRevenueFilters = () => {
  return useRevenueStore(state => ({
    filters: state.filters,
    dateRange: state.dateRange,
    setFilters: state.setFilters,
    setDateRange: state.setDateRange,
    resetFilters: state.resetFilters,
  }));
};

export const useRevenueHelpers = () => {
  return useRevenueStore(state => ({
    getRevenueByDate: state.getRevenueByDate,
    getRevenueByPeriod: state.getRevenueByPeriod,
    calculatePeriodTotal: state.calculatePeriodTotal,
    calculateGrowthRate: state.calculateGrowthRate,
    getTopCategories: state.getTopCategories,
    getTopPaymentMethods: state.getTopPaymentMethods,
  }));
};
