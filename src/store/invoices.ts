// =============================================================================
// STORE FACTURES - Digit PRESSING
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase, paginateQuery, buildSearchQuery } from '@/lib/supabase';
import type { 
  Invoice, 
  InvoiceItem, 
  InvoiceFilters, 
  InvoiceSort, 
  PaginatedResponse,
  LoadingState 
} from '@/types';
import { useAuthStore } from './auth';

interface InvoicesState extends LoadingState {
  // État des factures
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  filters: InvoiceFilters;
  sort: InvoiceSort;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // État des stats rapides
  todayStats: {
    totalInvoices: number;
    paidInvoices: number;
    pendingInvoices: number;
    totalRevenue: number;
    averageTicket: number;
  } | null;

  // Actions
  fetchInvoices: (options?: { reset?: boolean }) => Promise<void>;
  searchInvoices: (searchTerm: string) => Promise<void>;
  createInvoice: (invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  cancelInvoice: (id: string, reason: string) => Promise<void>;
  markAsPaid: (id: string, paymentMethod: string, paymentDate?: string) => Promise<void>;
  markAsWithdrawn: (id: string, withdrawalDate?: string) => Promise<void>;
  duplicateInvoice: (id: string) => Promise<Invoice>;
  generateInvoiceNumber: () => Promise<string>;
  
  // Gestion des filtres et tri
  setFilters: (filters: Partial<InvoiceFilters>) => void;
  setSort: (sort: InvoiceSort) => void;
  setPagination: (page: number, limit?: number) => void;
  resetFilters: () => void;
  
  // Stats et rapports
  fetchTodayStats: () => Promise<void>;
  getInvoicesByStatus: (status: string) => Invoice[];
  getInvoicesByDateRange: (startDate: string, endDate: string) => Invoice[];
  
  // Utilitaires
  setCurrentInvoice: (invoice: Invoice | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialFilters: InvoiceFilters = {
  status: undefined,
  paid: undefined,
  withdrawn: undefined,
  urgency: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  clientName: undefined,
  createdBy: undefined,
  minAmount: undefined,
  maxAmount: undefined,
  tags: undefined,
};

const initialSort: InvoiceSort = {
  field: 'createdAt',
  direction: 'desc',
};

const initialPagination = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
};

export const useInvoicesStore = create<InvoicesState>()(
  subscribeWithSelector((set, get) => ({
    // État initial
    invoices: [],
    currentInvoice: null,
    filters: initialFilters,
    sort: initialSort,
    pagination: initialPagination,
    todayStats: null,
    isLoading: false,
    error: null,
    lastUpdated: undefined,

    // Actions
    fetchInvoices: async (options = {}) => {
      try {
        const { reset = false } = options;
        const { filters, sort, pagination } = get();
        const user = useAuthStore.getState().user;

        if (!user) {
          throw new Error('Utilisateur non connecté');
        }

        if (reset || get().invoices.length === 0) {
          set({ isLoading: true, error: null });
        }

        // Construction de la requête de base
        let query = supabase
          .from('invoices')
          .select('*', { count: 'exact' })
          .eq('pressing_id', user.pressingId);

        // Application des filtres
        if (filters.status && filters.status.length > 0) {
          query = query.in('status', filters.status);
        }

        if (filters.paid !== undefined) {
          query = query.eq('paid', filters.paid);
        }

        if (filters.withdrawn !== undefined) {
          query = query.eq('withdrawn', filters.withdrawn);
        }

        if (filters.urgency && filters.urgency.length > 0) {
          query = query.in('urgency', filters.urgency);
        }

        if (filters.dateFrom) {
          query = query.gte('deposit_date', filters.dateFrom);
        }

        if (filters.dateTo) {
          query = query.lte('deposit_date', filters.dateTo);
        }

        if (filters.clientName) {
          query = query.ilike('client_name', `%${filters.clientName}%`);
        }

        if (filters.createdBy && filters.createdBy.length > 0) {
          query = query.in('created_by', filters.createdBy);
        }

        if (filters.minAmount) {
          query = query.gte('total', filters.minAmount);
        }

        if (filters.maxAmount) {
          query = query.lte('total', filters.maxAmount);
        }

        if (filters.tags && filters.tags.length > 0) {
          query = query.overlaps('tags', filters.tags);
        }

        // Application du tri
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });

        // Application de la pagination
        const paginatedQuery = paginateQuery(query, pagination.page, pagination.limit);

        const { data, error, count } = await paginatedQuery;

        if (error) {
          throw error;
        }

        const invoices: Invoice[] = data?.map(row => ({
          id: row.id,
          number: row.number,
          pressingId: row.pressing_id,
          clientName: row.client_name,
          clientPhone: row.client_phone || null,
          clientEmail: row.client_email || null,
          clientAddress: row.client_address || null,
          items: row.items as InvoiceItem[],
          subtotal: row.subtotal,
          discount: row.discount || null,
          discountType: row.discount_type as 'amount' | 'percentage' | undefined,
          tax: row.tax || null,
          total: row.total,
          status: row.status as 'active' | 'cancelled',
          paid: row.paid,
          withdrawn: row.withdrawn,
          paymentMethod: row.payment_method as any || null,
          depositDate: row.deposit_date,
          paymentDate: row.payment_date || null,
          withdrawalDate: row.withdrawal_date || null,
          estimatedReadyDate: row.estimated_ready_date || null,
          createdBy: row.created_by,
          createdByName: row.created_by_name,
          modifiedBy: row.modified_by || null,
          modifiedByName: row.modified_by_name || null,
          modifiedAt: row.modified_at || null,
          cancellationReason: row.cancellation_reason || null,
          cancelledBy: row.cancelled_by || null,
          cancelledAt: row.cancelled_at || null,
          notes: row.notes || null,
          urgency: row.urgency as 'normal' | 'express' | 'urgent',
          tags: row.tags || null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })) || [];

        const totalPages = Math.ceil((count || 0) / pagination.limit);

        set({
          invoices,
          pagination: {
            ...pagination,
            total: count || 0,
            totalPages,
          },
          isLoading: false,
          lastUpdated: new Date().toISOString(),
        });

      } catch (error: any) {
        console.error('Erreur lors du chargement des factures:', error);
        set({
          error: error.message || 'Erreur lors du chargement des factures',
          isLoading: false,
        });
      }
    },

    searchInvoices: async (searchTerm: string) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        const { data, error } = await supabase
          .rpc('search_invoices', {
            pressing_id: user.pressingId,
            search_term: searchTerm,
            limit_count: 100,
            offset_count: 0,
          });

        if (error) {
          throw error;
        }

        const invoices = data?.invoices || [];
        set({
          invoices,
          pagination: {
            ...get().pagination,
            total: data?.total_count || 0,
          },
          isLoading: false,
          lastUpdated: new Date().toISOString(),
        });

      } catch (error: any) {
        console.error('Erreur lors de la recherche:', error);
        set({
          error: error.message || 'Erreur lors de la recherche',
          isLoading: false,
        });
      }
    },

    createInvoice: async (invoiceData) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        // Générer le numéro de facture si non fourni
        const invoiceNumber = invoiceData.number || await get().generateInvoiceNumber();

        const { data, error } = await supabase
          .from('invoices')
          .insert({
            pressing_id: user.pressingId,
            number: invoiceNumber,
            client_name: invoiceData.clientName,
            client_phone: invoiceData.clientPhone,
            client_email: invoiceData.clientEmail,
            client_address: invoiceData.clientAddress,
            items: invoiceData.items,
            subtotal: invoiceData.subtotal,
            discount: invoiceData.discount,
            discount_type: invoiceData.discountType,
            tax: invoiceData.tax,
            total: invoiceData.total,
            status: invoiceData.status,
            paid: invoiceData.paid,
            payment_method: invoiceData.paymentMethod,
            deposit_date: invoiceData.depositDate,
            payment_date: invoiceData.paymentDate,
            estimated_ready_date: invoiceData.estimatedReadyDate,
            created_by: user.id,
            created_by_name: user.fullName,
            notes: invoiceData.notes,
            urgency: invoiceData.urgency,
            tags: invoiceData.tags,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        const newInvoice: Invoice = {
          id: data.id,
          number: data.number,
          pressingId: data.pressing_id,
          clientName: data.client_name,
          clientPhone: data.client_phone || null,
          clientEmail: data.client_email || null,
          clientAddress: data.client_address || null,
          items: data.items as InvoiceItem[],
          subtotal: data.subtotal,
          discount: data.discount || null,
          discountType: data.discount_type as any || null,
          tax: data.tax || null,
          total: data.total,
          status: data.status as 'active' | 'cancelled',
          paid: data.paid,
          withdrawn: data.withdrawn,
          paymentMethod: data.payment_method as any || null,
          depositDate: data.deposit_date,
          paymentDate: data.payment_date || null,
          withdrawalDate: data.withdrawal_date || null,
          estimatedReadyDate: data.estimated_ready_date || null,
          createdBy: data.created_by,
          createdByName: data.created_by_name,
          modifiedBy: data.modified_by || null,
          modifiedByName: data.modified_by_name || null,
          modifiedAt: data.modified_at || null,
          cancellationReason: data.cancellation_reason || null,
          cancelledBy: data.cancelled_by || null,
          cancelledAt: data.cancelled_at || null,
          notes: data.notes || null,
          urgency: data.urgency as any,
          tags: data.tags || null,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };

        // Mettre à jour la liste des factures
        set(state => ({
          invoices: [newInvoice, ...state.invoices],
          pagination: {
            ...state.pagination,
            total: state.pagination.total + 1,
          },
          isLoading: false,
        }));

        return newInvoice;

      } catch (error: any) {
        console.error('Erreur lors de la création de facture:', error);
        set({
          error: error.message || 'Erreur lors de la création de facture',
          isLoading: false,
        });
        throw error;
      }
    },

    updateInvoice: async (id: string, updates: Partial<Invoice>) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        const { data, error } = await supabase
          .from('invoices')
          .update({
            ...updates,
            modified_by: user.id,
            modified_by_name: user.fullName,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('pressing_id', user.pressingId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        // Mettre à jour la liste des factures
        set(state => ({
          invoices: state.invoices.map(invoice =>
            invoice.id === id
              ? {
                  ...invoice,
                  ...updates,
                  modifiedBy: user.id,
                  modifiedByName: user.fullName,
                  modifiedAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : invoice
          ),
          currentInvoice: state.currentInvoice?.id === id
            ? { ...state.currentInvoice, ...updates }
            : state.currentInvoice,
          isLoading: false,
        }));

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour de facture:', error);
        set({
          error: error.message || 'Erreur lors de la mise à jour de facture',
          isLoading: false,
        });
        throw error;
      }
    },

    cancelInvoice: async (id: string, reason: string) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        const { error } = await supabase
          .from('invoices')
          .update({
            status: 'cancelled',
            cancellation_reason: reason,
            cancelled_by: user.id,
            cancelled_at: new Date().toISOString(),
            modified_by: user.id,
            modified_by_name: user.fullName,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('pressing_id', user.pressingId);

        if (error) {
          throw error;
        }

        // Mettre à jour la liste des factures
        set(state => ({
          invoices: state.invoices.map(invoice =>
            invoice.id === id
              ? {
                  ...invoice,
                  status: 'cancelled',
                  cancellationReason: reason,
                  cancelledBy: user.id,
                  cancelledAt: new Date().toISOString(),
                }
              : invoice
          ),
          isLoading: false,
        }));

      } catch (error: any) {
        console.error('Erreur lors de l\'annulation de facture:', error);
        set({
          error: error.message || 'Erreur lors de l\'annulation de facture',
          isLoading: false,
        });
        throw error;
      }
    },

    markAsPaid: async (id: string, paymentMethod: string, paymentDate?: string) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        const { error } = await supabase
          .from('invoices')
          .update({
            paid: true,
            payment_method: paymentMethod,
            payment_date: paymentDate || new Date().toISOString().split('T')[0],
            modified_by: user.id,
            modified_by_name: user.fullName,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('pressing_id', user.pressingId);

        if (error) {
          throw error;
        }

        // Mettre à jour la liste des factures
        set(state => ({
          invoices: state.invoices.map(invoice =>
            invoice.id === id
              ? {
                  ...invoice,
                  paid: true,
                  paymentMethod: paymentMethod as any,
                  paymentDate: paymentDate || new Date().toISOString().split('T')[0],
                }
              : invoice
          ),
          isLoading: false,
        }));

      } catch (error: any) {
        console.error('Erreur lors du marquage comme payé:', error);
        set({
          error: error.message || 'Erreur lors du marquage comme payé',
          isLoading: false,
        });
        throw error;
      }
    },

    markAsWithdrawn: async (id: string, withdrawalDate?: string) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        const { error } = await supabase
          .from('invoices')
          .update({
            withdrawn: true,
            withdrawal_date: withdrawalDate || new Date().toISOString().split('T')[0],
            modified_by: user.id,
            modified_by_name: user.fullName,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('pressing_id', user.pressingId);

        if (error) {
          throw error;
        }

        // Mettre à jour la liste des factures
        set(state => ({
          invoices: state.invoices.map(invoice =>
            invoice.id === id
              ? {
                  ...invoice,
                  withdrawn: true,
                  withdrawalDate: withdrawalDate || new Date().toISOString().split('T')[0],
                }
              : invoice
          ),
          isLoading: false,
        }));

      } catch (error: any) {
        console.error('Erreur lors du marquage comme retiré:', error);
        set({
          error: error.message || 'Erreur lors du marquage comme retiré',
          isLoading: false,
        });
        throw error;
      }
    },

    duplicateInvoice: async (id: string) => {
      try {
        const { invoices } = get();
        const originalInvoice = invoices.find(inv => inv.id === id);
        
        if (!originalInvoice) {
          throw new Error('Facture non trouvée');
        }

        // Créer une nouvelle facture basée sur l'originale
        const duplicatedInvoiceData = {
          ...originalInvoice,
          number: '', // Sera généré automatiquement
          depositDate: new Date().toISOString().split('T')[0],
          paid: false,
          withdrawn: false,
          paymentDate: undefined,
          withdrawalDate: undefined,
          paymentMethod: undefined,
          notes: originalInvoice.notes ? `Copie de ${originalInvoice.number}: ${originalInvoice.notes}` : `Copie de ${originalInvoice.number}`,
        };

        return await get().createInvoice(duplicatedInvoiceData);

      } catch (error: any) {
        console.error('Erreur lors de la duplication de facture:', error);
        set({
          error: error.message || 'Erreur lors de la duplication de facture',
          isLoading: false,
        });
        throw error;
      }
    },

    generateInvoiceNumber: async () => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        const { data, error } = await supabase
          .rpc('generate_invoice_number', {
            pressing_id: user.pressingId
          });

        if (error) {
          throw error;
        }

        return data as string;

      } catch (error: any) {
        console.error('Erreur lors de la génération du numéro:', error);
        // Fallback: générer un numéro basé sur la date
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const time = String(Date.now()).slice(-4);
        return `${year}${month}${day}-${time}`;
      }
    },

    setFilters: (newFilters: Partial<InvoiceFilters>) => {
      set(state => ({
        filters: { ...state.filters, ...newFilters },
        pagination: { ...state.pagination, page: 1 }, // Reset to first page
      }));
      
      // Recharger les factures avec les nouveaux filtres
      get().fetchInvoices({ reset: true });
    },

    setSort: (newSort: InvoiceSort) => {
      set({ 
        sort: newSort,
        pagination: { ...get().pagination, page: 1 }
      });
      
      // Recharger les factures avec le nouveau tri
      get().fetchInvoices({ reset: true });
    },

    setPagination: (page: number, limit?: number) => {
      set(state => ({
        pagination: {
          ...state.pagination,
          page,
          limit: limit || state.pagination.limit,
        }
      }));
      
      // Recharger les factures pour la nouvelle page
      get().fetchInvoices();
    },

    resetFilters: () => {
      set({
        filters: initialFilters,
        sort: initialSort,
        pagination: initialPagination,
      });
      
      // Recharger les factures sans filtres
      get().fetchInvoices({ reset: true });
    },

    fetchTodayStats: async () => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('invoices')
          .select('*')
          .eq('pressing_id', user.pressingId)
          .eq('deposit_date', today)
          .eq('status', 'active');

        if (error) {
          throw error;
        }

        const invoices = data || [];
        const totalInvoices = invoices.length;
        const paidInvoices = invoices.filter(inv => inv.paid).length;
        const pendingInvoices = totalInvoices - paidInvoices;
        const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.paid ? inv.total : 0), 0);
        const averageTicket = totalInvoices > 0 ? totalRevenue / paidInvoices || 0 : 0;

        set({
          todayStats: {
            totalInvoices,
            paidInvoices,
            pendingInvoices,
            totalRevenue,
            averageTicket,
          }
        });

      } catch (error: any) {
        console.error('Erreur lors du chargement des stats du jour:', error);
      }
    },

    getInvoicesByStatus: (status: string) => {
      const { invoices } = get();
      return invoices.filter(invoice => invoice.status === status);
    },

    getInvoicesByDateRange: (startDate: string, endDate: string) => {
      const { invoices } = get();
      return invoices.filter(invoice => 
        invoice.depositDate >= startDate && invoice.depositDate <= endDate
      );
    },

    setCurrentInvoice: (invoice: Invoice | null) => {
      set({ currentInvoice: invoice });
    },

    clearError: () => {
      set({ error: null });
    },

    reset: () => {
      set({
        invoices: [],
        currentInvoice: null,
        filters: initialFilters,
        sort: initialSort,
        pagination: initialPagination,
        todayStats: null,
        isLoading: false,
        error: null,
        lastUpdated: undefined,
      });
    },
  }))
);

// Sélecteurs optimisés
export const useInvoices = () => {
  return useInvoicesStore(state => ({
    invoices: state.invoices,
    isLoading: state.isLoading,
    error: state.error,
    pagination: state.pagination,
    lastUpdated: state.lastUpdated,
  }));
};

export const useInvoiceActions = () => {
  return useInvoicesStore(state => ({
    fetchInvoices: state.fetchInvoices,
    searchInvoices: state.searchInvoices,
    createInvoice: state.createInvoice,
    updateInvoice: state.updateInvoice,
    cancelInvoice: state.cancelInvoice,
    markAsPaid: state.markAsPaid,
    markAsWithdrawn: state.markAsWithdrawn,
    duplicateInvoice: state.duplicateInvoice,
    generateInvoiceNumber: state.generateInvoiceNumber,
    clearError: state.clearError,
  }));
};

export const useInvoiceFilters = () => {
  return useInvoicesStore(state => ({
    filters: state.filters,
    sort: state.sort,
    setFilters: state.setFilters,
    setSort: state.setSort,
    resetFilters: state.resetFilters,
  }));
};

export const useCurrentInvoice = () => {
  return useInvoicesStore(state => ({
    currentInvoice: state.currentInvoice,
    setCurrentInvoice: state.setCurrentInvoice,
  }));
};

export const useTodayStats = () => {
  return useInvoicesStore(state => ({
    todayStats: state.todayStats,
    fetchTodayStats: state.fetchTodayStats,
  }));
};

// Auto-refresh des stats toutes les 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    const store = useInvoicesStore.getState();
    const user = useAuthStore.getState().user;
    
    if (user && !store.isLoading) {
      store.fetchTodayStats();
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// Écouter les changements en temps réel
if (typeof window !== 'undefined') {
  const user = useAuthStore.getState().user;
  
  if (user) {
    supabase
      .channel(`invoices_${user.pressingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `pressing_id=eq.${user.pressingId}`,
        },
        (payload) => {
          const store = useInvoicesStore.getState();
          
          switch (payload.eventType) {
            case 'INSERT':
              // Ajouter la nouvelle facture si elle n'existe pas déjà
              const newInvoice = payload.new as any;
              if (!store.invoices.find(inv => inv.id === newInvoice.id)) {
                useInvoicesStore.setState(state => ({
                  invoices: [newInvoice, ...state.invoices],
                  pagination: {
                    ...state.pagination,
                    total: state.pagination.total + 1,
                  }
                }));
              }
              break;
              
            case 'UPDATE':
              // Mettre à jour la facture existante
              const updatedInvoice = payload.new as any;
              useInvoicesStore.setState(state => ({
                invoices: state.invoices.map(inv =>
                  inv.id === updatedInvoice.id ? updatedInvoice : inv
                ),
                currentInvoice: state.currentInvoice?.id === updatedInvoice.id 
                  ? updatedInvoice 
                  : state.currentInvoice,
              }));
              break;
              
            case 'DELETE':
              // Retirer la facture supprimée
              const deletedInvoice = payload.old as any;
              useInvoicesStore.setState(state => ({
                invoices: state.invoices.filter(inv => inv.id !== deletedInvoice.id),
                pagination: {
                  ...state.pagination,
                  total: Math.max(0, state.pagination.total - 1),
                },
                currentInvoice: state.currentInvoice?.id === deletedInvoice.id 
                  ? null 
                  : state.currentInvoice,
              }));
              break;
          }
          
          // Actualiser les stats après chaque changement
          store.fetchTodayStats();
        }
      )
      .subscribe();
  }
}