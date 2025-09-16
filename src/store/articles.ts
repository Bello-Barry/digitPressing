// =============================================================================
// STORE ARTICLES - Digit PRESSING
// =============================================================================

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type {
  Article,
  ArticleFilters,
  ArticleSort,
  PaginatedResponse,
  LoadingState
} from '@/types';
import { useAuthStore } from './auth';

interface ArticlesState extends LoadingState {
  // État des articles
  articles: Article[];
  currentArticle: Article | null;
  filters: ArticleFilters;
  sort: ArticleSort;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Articles groupés par catégorie
  articlesByCategory: Record<string, Article[]>;
  
  // Actions CRUD
  fetchArticles: (options?: { reset?: boolean }) => Promise<void>;
  searchArticles: (searchTerm: string) => Promise<void>;
  createArticle: (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Article>;
  updateArticle: (id: string, updates: Partial<Article>) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>; // Soft delete
  restoreArticle: (id: string) => Promise<void>;
  duplicateArticle: (id: string, newName: string) => Promise<Article>;
  
  // Actions de masse
  bulkUpdatePrices: (articleIds: string[], priceUpdate: { amount: number; type: 'amount' | 'percentage' }) => Promise<void>;
  bulkToggleStatus: (articleIds: string[], isActive: boolean) => Promise<void>;
  
  // Gestion des filtres et tri
  setFilters: (filters: Partial<ArticleFilters>) => void;
  setSort: (sort: ArticleSort) => void;
  setPagination: (page: number, limit?: number) => void;
  resetFilters: () => void;
  
  // Utilitaires
  getArticlesByCategory: (category: string) => Article[];
  getActiveArticles: () => Article[];
  getArticleById: (id: string) => Article | undefined;
  setCurrentArticle: (article: Article | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialFilters: ArticleFilters = {
  category: undefined,
  isActive: undefined,
  minPrice: undefined,
  maxPrice: undefined,
  searchTerm: undefined,
};

const initialSort: ArticleSort = {
  field: 'name',
  direction: 'asc',
};

const initialPagination = {
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 0,
};

export const useArticlesStore = create<ArticlesState>()(
  subscribeWithSelector((set, get) => ({
    // État initial
    articles: [],
    currentArticle: null,
    filters: initialFilters,
    sort: initialSort,
    pagination: initialPagination,
    articlesByCategory: {},
    isLoading: false,
    error: null,
    lastUpdated: undefined,

    // Actions
    fetchArticles: async (options = {}) => {
      try {
        const { reset = false } = options;
        const { filters, sort, pagination } = get();
        const user = useAuthStore.getState().user;

        if (!user) {
          throw new Error('Utilisateur non connecté');
        }

        if (reset || get().articles.length === 0) {
          set({ isLoading: true, error: null });
        }

        // Construction de la requête de base
        let query = supabase
          .from('articles')
          .select('*', { count: 'exact' })
          .eq('pressing_id', user.pressingId)
          .eq('is_deleted', false); // Filtrer les articles supprimés

        // Application des filtres
        if (filters.category) {
          query = query.eq('category', filters.category);
        }

        if (filters.isActive !== undefined) {
          query = query.eq('is_active', filters.isActive);
        }

        if (filters.minPrice !== undefined) {
          query = query.gte('default_price', filters.minPrice);
        }

        if (filters.maxPrice !== undefined) {
          query = query.lte('default_price', filters.maxPrice);
        }

        if (filters.searchTerm) {
          query = query.ilike('name', `%${filters.searchTerm}%`);
        }

        // Application du tri
        query = query.order(sort.field, { ascending: sort.direction === 'asc' });

        // Application de la pagination
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) {
          throw error;
        }

        const articles: Article[] = data?.map(row => ({
          id: row.id,
          pressingId: row.pressing_id,
          name: row.name,
          category: row.category,
          defaultPrice: row.default_price,
          isActive: row.is_active,
          description: row.description || undefined,
          estimatedDays: row.estimated_days,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })) || [];

        const totalPages = Math.ceil((count || 0) / pagination.limit);

        // Grouper par catégorie
        const articlesByCategory = articles.reduce((acc, article) => {
          const category = article.category;
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(article);
          return acc;
        }, {} as Record<string, Article[]>);

        set({
          articles,
          articlesByCategory,
          pagination: {
            ...pagination,
            total: count || 0,
            totalPages,
          },
          isLoading: false,
          lastUpdated: new Date().toISOString(),
        });

      } catch (error: any) {
        console.error('Erreur lors du chargement des articles:', error);
        set({
          error: error.message || 'Erreur lors du chargement des articles',
          isLoading: false,
        });
      }
    },

    searchArticles: async (searchTerm: string) => {
      set(state => ({
        filters: { ...state.filters, searchTerm },
        pagination: { ...state.pagination, page: 1 },
      }));
      
      await get().fetchArticles({ reset: true });
    },

    createArticle: async (articleData) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        const { data, error } = await supabase
          .from('articles')
          .insert({
            pressing_id: user.pressingId,
            name: articleData.name.trim(),
            category: articleData.category,
            default_price: articleData.defaultPrice,
            is_active: articleData.isActive,
            description: articleData.description?.trim() || null,
            estimated_days: articleData.estimatedDays,
          })
          .select()
          .single();

        if (error) {
          throw error;
        }

        const newArticle: Article = {
          id: data.id,
          pressingId: data.pressing_id,
          name: data.name,
          category: data.category,
          defaultPrice: data.default_price,
          isActive: data.is_active,
          description: data.description || undefined,
          estimatedDays: data.estimated_days,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };

        // Mettre à jour la liste des articles
        set(state => ({
          articles: [newArticle, ...state.articles],
          articlesByCategory: {
            ...state.articlesByCategory,
            [newArticle.category]: [
              newArticle,
              ...(state.articlesByCategory[newArticle.category] || [])
            ]
          },
          pagination: {
            ...state.pagination,
            total: state.pagination.total + 1,
          },
          isLoading: false,
        }));

        return newArticle;

      } catch (error: any) {
        console.error('Erreur lors de la création d\'article:', error);
        set({
          error: error.message || 'Erreur lors de la création d\'article',
          isLoading: false,
        });
        throw error;
      }
    },

    updateArticle: async (id: string, updates: Partial<Article>) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        // Préparer les données pour Supabase
        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        if (updates.name) updateData.name = updates.name.trim();
        if (updates.category) updateData.category = updates.category;
        if (updates.defaultPrice !== undefined) updateData.default_price = updates.defaultPrice;
        if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
        if (updates.description !== undefined) updateData.description = updates.description?.trim() || null;
        if (updates.estimatedDays) updateData.estimated_days = updates.estimatedDays;

        const { error } = await supabase
          .from('articles')
          .update(updateData)
          .eq('id', id)
          .eq('pressing_id', user.pressingId);

        if (error) {
          throw error;
        }

        // Mettre à jour la liste des articles
        set(state => {
          const updatedArticles = state.articles.map(article =>
            article.id === id
              ? { ...article, ...updates, updatedAt: new Date().toISOString() }
              : article
          );

          // Recalculer les articles par catégorie
          const articlesByCategory = updatedArticles.reduce((acc, article) => {
            const category = article.category;
            if (!acc[category]) {
              acc[category] = [];
            }
            acc[category].push(article);
            return acc;
          }, {} as Record<string, Article[]>);

          return {
            articles: updatedArticles,
            articlesByCategory,
            currentArticle: state.currentArticle?.id === id
              ? { ...state.currentArticle, ...updates }
              : state.currentArticle,
            isLoading: false,
          };
        });

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour d\'article:', error);
        set({
          error: error.message || 'Erreur lors de la mise à jour d\'article',
          isLoading: false,
        });
        throw error;
      }
    },

    deleteArticle: async (id: string) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        // Soft delete - marquer comme supprimé
        const { error } = await supabase
          .from('articles')
          .update({
            is_deleted: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('pressing_id', user.pressingId);

        if (error) {
          throw error;
        }

        // Retirer de la liste des articles
        set(state => {
          const filteredArticles = state.articles.filter(article => article.id !== id);
          
          // Recalculer les articles par catégorie
          const articlesByCategory = filteredArticles.reduce((acc, article) => {
            const category = article.category;
            if (!acc[category]) {
              acc[category] = [];
            }
            acc[category].push(article);
            return acc;
          }, {} as Record<string, Article[]>);

          return {
            articles: filteredArticles,
            articlesByCategory,
            pagination: {
              ...state.pagination,
              total: Math.max(0, state.pagination.total - 1),
            },
            currentArticle: state.currentArticle?.id === id
              ? null
              : state.currentArticle,
            isLoading: false,
          };
        });

      } catch (error: any) {
        console.error('Erreur lors de la suppression d\'article:', error);
        set({
          error: error.message || 'Erreur lors de la suppression d\'article',
          isLoading: false,
        });
        throw error;
      }
    },

    restoreArticle: async (id: string) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        const { error } = await supabase
          .from('articles')
          .update({
            is_deleted: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .eq('pressing_id', user.pressingId);

        if (error) {
          throw error;
        }

        // Recharger les articles
        await get().fetchArticles({ reset: true });

      } catch (error: any) {
        console.error('Erreur lors de la restauration d\'article:', error);
        throw error;
      }
    },

    duplicateArticle: async (id: string, newName: string) => {
      try {
        const { articles } = get();
        const originalArticle = articles.find(article => article.id === id);
        
        if (!originalArticle) {
          throw new Error('Article non trouvé');
        }

        // Créer un nouvel article basé sur l'original
        const duplicatedArticleData = {
          ...originalArticle,
          name: newName,
        };

        return await get().createArticle(duplicatedArticleData);

      } catch (error: any) {
        console.error('Erreur lors de la duplication d\'article:', error);
        throw error;
      }
    },

    bulkUpdatePrices: async (articleIds: string[], priceUpdate: { amount: number; type: 'amount' | 'percentage' }) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        // Récupérer les articles concernés
        const { data: articles, error: fetchError } = await supabase
          .from('articles')
          .select('id, default_price')
          .in('id', articleIds)
          .eq('pressing_id', user.pressingId);

        if (fetchError) throw fetchError;

        // Calculer les nouveaux prix
        const updates = articles?.map(article => {
          let newPrice: number;
          
          if (priceUpdate.type === 'percentage') {
            newPrice = article.default_price * (1 + priceUpdate.amount / 100);
          } else {
            newPrice = article.default_price + priceUpdate.amount;
          }

          // S'assurer que le prix reste positif
          newPrice = Math.max(0, Math.round(newPrice * 100) / 100);

          return {
            id: article.id,
            default_price: newPrice,
            updated_at: new Date().toISOString(),
          };
        }) || [];

        // Effectuer les mises à jour en lot
        const { error: updateError } = await supabase
          .from('articles')
          .upsert(updates);

        if (updateError) throw updateError;

        // Recharger les articles
        await get().fetchArticles({ reset: true });

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour en lot des prix:', error);
        set({
          error: error.message || 'Erreur lors de la mise à jour en lot des prix',
          isLoading: false,
        });
        throw error;
      }
    },

    bulkToggleStatus: async (articleIds: string[], isActive: boolean) => {
      try {
        const user = useAuthStore.getState().user;
        if (!user) throw new Error('Utilisateur non connecté');

        set({ isLoading: true, error: null });

        const { error } = await supabase
          .from('articles')
          .update({
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .in('id', articleIds)
          .eq('pressing_id', user.pressingId);

        if (error) throw error;

        // Mettre à jour localement
        set(state => ({
          articles: state.articles.map(article =>
            articleIds.includes(article.id)
              ? { ...article, isActive }
              : article
          ),
          isLoading: false,
        }));

      } catch (error: any) {
        console.error('Erreur lors de la mise à jour en lot du statut:', error);
        set({
          error: error.message || 'Erreur lors de la mise à jour en lot du statut',
          isLoading: false,
        });
        throw error;
      }
    },

    setFilters: (newFilters: Partial<ArticleFilters>) => {
      set(state => ({
        filters: { ...state.filters, ...newFilters },
        pagination: { ...state.pagination, page: 1 },
      }));
      
      get().fetchArticles({ reset: true });
    },

    setSort: (newSort: ArticleSort) => {
      set({
        sort: newSort,
        pagination: { ...get().pagination, page: 1 }
      });
      
      get().fetchArticles({ reset: true });
    },

    setPagination: (page: number, limit?: number) => {
      set(state => ({
        pagination: {
          ...state.pagination,
          page,
          limit: limit || state.pagination.limit,
        }
      }));
      
      get().fetchArticles();
    },

    resetFilters: () => {
      set({
        filters: initialFilters,
        sort: initialSort,
        pagination: initialPagination,
      });
      
      get().fetchArticles({ reset: true });
    },

    getArticlesByCategory: (category: string) => {
      const { articlesByCategory } = get();
      return articlesByCategory[category] || [];
    },

    getActiveArticles: () => {
      const { articles } = get();
      return articles.filter(article => article.isActive);
    },

    getArticleById: (id: string) => {
      const { articles } = get();
      return articles.find(article => article.id === id);
    },

    setCurrentArticle: (article: Article | null) => {
      set({ currentArticle: article });
    },

    clearError: () => {
      set({ error: null });
    },

    reset: () => {
      set({
        articles: [],
        currentArticle: null,
        filters: initialFilters,
        sort: initialSort,
        pagination: initialPagination,
        articlesByCategory: {},
        isLoading: false,
        error: null,
        lastUpdated: undefined,
      });
    },
  }))
);

// Sélecteurs optimisés
export const useArticles = () => {
  return useArticlesStore(state => ({
    articles: state.articles,
    articlesByCategory: state.articlesByCategory,
    isLoading: state.isLoading,
    error: state.error,
    pagination: state.pagination,
    lastUpdated: state.lastUpdated,
  }));
};

export const useArticleActions = () => {
  return useArticlesStore(state => ({
    fetchArticles: state.fetchArticles,
    searchArticles: state.searchArticles,
    createArticle: state.createArticle,
    updateArticle: state.updateArticle,
    deleteArticle: state.deleteArticle,
    restoreArticle: state.restoreArticle,
    duplicateArticle: state.duplicateArticle,
    bulkUpdatePrices: state.bulkUpdatePrices,
    bulkToggleStatus: state.bulkToggleStatus,
    clearError: state.clearError,
  }));
};

export const useArticleFilters = () => {
  return useArticlesStore(state => ({
    filters: state.filters,
    sort: state.sort,
    setFilters: state.setFilters,
    setSort: state.setSort,
    resetFilters: state.resetFilters,
  }));
};

export const useCurrentArticle = () => {
  return useArticlesStore(state => ({
    currentArticle: state.currentArticle,
    setCurrentArticle: state.setCurrentArticle,
  }));
};

export const useArticleHelpers = () => {
  return useArticlesStore(state => ({
    getArticlesByCategory: state.getArticlesByCategory,
    getActiveArticles: state.getActiveArticles,
    getArticleById: state.getArticleById,
  }));
};

// Écouter les changements en temps réel
if (typeof window !== 'undefined') {
  const user = useAuthStore.getState().user;

  if (user) {
    supabase
      .channel(`articles_${user.pressingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'articles',
          filter: `pressing_id=eq.${user.pressingId}`,
        },
        (payload) => {
          const store = useArticlesStore.getState();

          switch (payload.eventType) {
            case 'INSERT':
              const newArticle = payload.new as any;
              if (!newArticle.is_deleted && !store.articles.find(a => a.id === newArticle.id)) {
                useArticlesStore.setState(state => ({
                  articles: [newArticle, ...state.articles],
                  pagination: {
                    ...state.pagination,
                    total: state.pagination.total + 1,
                  }
                }));
              }
              break;

            case 'UPDATE':
              const updatedArticle = payload.new as any;
              useArticlesStore.setState(state => ({
                articles: state.articles.map(a =>
                  a.id === updatedArticle.id ? updatedArticle : a
                ),
                currentArticle: state.currentArticle?.id === updatedArticle.id
                  ? updatedArticle
                  : state.currentArticle,
              }));
              break;

            case 'DELETE':
              const deletedArticle = payload.old as any;
              useArticlesStore.setState(state => ({
                articles: state.articles.filter(a => a.id !== deletedArticle.id),
                pagination: {
                  ...state.pagination,
                  total: Math.max(0, state.pagination.total - 1),
                },
                currentArticle: state.currentArticle?.id === deletedArticle.id
                  ? null
                  : state.currentArticle,
              }));
              break;
          }
        }
      )
      .subscribe();
  }
}