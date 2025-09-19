// =============================================================================
// API ROUTE POUR LES ARTICLES - Digit PRESSING
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Schémas de validation
const createArticleSchema = z.object({
  name: z.string().min(1, 'Le nom de l\'article est requis').max(255),
  category: z.enum([
    'vetement', 'accessoire', 'special', 'cuir', 'retouche',
    'chaussure', 'maison', 'traditionnel', 'delicat', 'ceremonie',
    'enfant', 'uniforme'
  ]),
  defaultPrice: z.number().min(0, 'Le prix doit être positif'),
  description: z.string().optional(),
  estimatedDays: z.number().min(1, 'La durée doit être d\'au moins 1 jour').default(3),
  isActive: z.boolean().default(true),
});

const updateArticleSchema = createArticleSchema.partial();

const filtersSchema = z.object({
  category: z.enum([
    'vetement', 'accessoire', 'special', 'cuir', 'retouche',
    'chaussure', 'maison', 'traditionnel', 'delicat', 'ceremonie',
    'enfant', 'uniforme'
  ]).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
  sortBy: z.enum(['name', 'category', 'defaultPrice', 'createdAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  includeInactive: z.coerce.boolean().default(false),
});

const bulkActionSchema = z.object({
  action: z.enum(['activate', 'deactivate', 'delete', 'update_price']),
  articleIds: z.array(z.string().uuid()).min(1, 'Au moins un article requis'),
  data: z.record(z.any()).optional(),
});

// Helper pour vérifier l'authentification
async function verifyAuth(request: NextRequest): Promise<NextResponse | { user: any }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return NextResponse.json({ error: 'Utilisateur inactif' }, { status: 403 });
  }

  // Vérification que l'utilisateur a un pressing_id
  if (!profile.pressing_id) {
    return NextResponse.json({ error: 'Pressing non configuré' }, { status: 400 });
  }

  return { user: profile };
}

// Helper pour vérifier les permissions
function hasPermission(user: any, action: string): boolean {
  if (user?.role === 'owner') return true;

  const permission = user?.permissions?.find((p: any) => p.action === action);
  return permission?.granted || false;
}

// GET - Récupérer les articles
export async function GET(request: NextRequest) {
  const authResult = await verifyAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult; // Retourne la réponse d'erreur de NextResponse
  }

  const user = authResult.user;

  try {
    const { searchParams } = new URL(request.url);
    const filters = filtersSchema.parse(Object.fromEntries(searchParams));

    // Construction de la requête de base
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('pressing_id', user.pressing_id);

    // Filtrer les articles supprimés (soft delete)
    query = query.eq('is_deleted', false);

    // Application des filtres
    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    } else if (!filters.includeInactive) {
      // Par défaut, ne montrer que les articles actifs
      query = query.eq('is_active', true);
    }

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.minPrice) {
      query = query.gte('default_price', filters.minPrice);
    }

    if (filters.maxPrice) {
      query = query.lte('default_price', filters.maxPrice);
    }

    // Tri
    const sortField = filters.sortBy === 'defaultPrice' ? 'default_price' :
                     filters.sortBy === 'createdAt' ? 'created_at' :
                     filters.sortBy;

    query = query.order(sortField, { ascending: filters.sortOrder === 'asc' });

    // Pagination
    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;
    query = query.range(from, to);

    const { data: articles, error: queryError, count } = await query;

    if (queryError) {
      throw queryError;
    }

    // Enrichir avec des métadonnées
    const enrichedArticles = (articles || []).map(article => ({
      ...article,
      _metadata: {
        daysSinceCreated: Math.floor(
          (new Date().getTime() - new Date(article.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        priceCategory: article.default_price < 2000 ? 'economique' :
                      article.default_price < 10000 ? 'standard' : 'premium',
      },
    }));

    const totalPages = Math.ceil((count || 0) / filters.limit);

    // Statistiques par catégorie
    const { data: categoryStats } = await supabase
      .from('articles')
      .select('category, is_active')
      .eq('pressing_id', user.pressing_id)
      .eq('is_deleted', false);

    const stats = categoryStats?.reduce((acc, article) => {
      if (!acc[article.category]) {
        acc[article.category] = { total: 0, active: 0, inactive: 0 };
      }
      acc[article.category].total++;
      if (article.is_active) {
        acc[article.category].active++;
      } else {
        acc[article.category].inactive++;
      }
      return acc;
    }, {} as Record<string, any>) || {};

    return NextResponse.json({
      success: true,
      data: {
        articles: enrichedArticles,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: count || 0,
          totalPages,
          hasNext: filters.page < totalPages,
          hasPrev: filters.page > 1,
        },
        stats: {
          total: count || 0,
          by_category: stats,
          active: categoryStats?.filter(a => a.is_active).length || 0,
          inactive: categoryStats?.filter(a => !a.is_active).length || 0,
        },
      },
    });

  } catch (error: any) {
    console.error('Erreur GET /api/articles:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Paramètres invalides',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// POST - Créer un nouvel article
export async function POST(request: NextRequest) {
  const authResult = await verifyAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const user = authResult.user;

  try {
    // Vérifier les permissions
    if (!hasPermission(user, 'modify_prices')) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée - Modification des prix requise' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const articleData = createArticleSchema.parse(body);

    // Vérifier l'unicité du nom dans le pressing
    const { data: existingArticle } = await supabase
      .from('articles')
      .select('name')
      .eq('pressing_id', user.pressing_id)
      .eq('name', articleData.name)
      .eq('is_deleted', false)
      .single();

    if (existingArticle) {
      return NextResponse.json(
        { success: false, error: 'Un article avec ce nom existe déjà' },
        { status: 409 }
      );
    }

    // Créer l'article
    const { data: newArticle, error: insertError } = await supabase
      .from('articles')
      .insert({
        pressing_id: user.pressing_id,
        name: articleData.name,
        category: articleData.category,
        default_price: articleData.defaultPrice,
        description: articleData.description || null,
        estimated_days: articleData.estimatedDays,
        is_active: articleData.isActive,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      data: newArticle,
      message: 'Article créé avec succès',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erreur POST /api/articles:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Données invalides',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un article
export async function PUT(request: NextRequest) {
  const authResult = await verifyAuth(request);
    
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const user = authResult.user;

  try {
    // Vérifier les permissions
    if (!hasPermission(user, 'modify_prices')) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée - Modification des prix requise' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de l\'article requis' },
        { status: 400 }
      );
    }

    const updateData = updateArticleSchema.parse(updates);

    // Vérifier que l'article existe et appartient au pressing
    const { data: existingArticle, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .eq('pressing_id', user.pressing_id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existingArticle) {
      return NextResponse.json(
        { success: false, error: 'Article non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier l'unicité du nom si modifié
    if (updateData.name && updateData.name !== existingArticle.name) {
      const { data: duplicateName } = await supabase
        .from('articles')
        .select('id')
        .eq('pressing_id', user.pressing_id)
        .eq('name', updateData.name)
        .eq('is_deleted', false)
        .neq('id', id)
        .single();

      if (duplicateName) {
        return NextResponse.json(
          { success: false, error: 'Un autre article avec ce nom existe déjà' },
          { status: 409 }
        );
      }
    }

    // Préparer les données pour la mise à jour
    const dbUpdateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updateData.name) dbUpdateData.name = updateData.name;
    if (updateData.category) dbUpdateData.category = updateData.category;
    if (updateData.defaultPrice !== undefined) dbUpdateData.default_price = updateData.defaultPrice;
    if (updateData.description !== undefined) dbUpdateData.description = updateData.description || null;
    if (updateData.estimatedDays) dbUpdateData.estimated_days = updateData.estimatedDays;
    if (updateData.isActive !== undefined) dbUpdateData.is_active = updateData.isActive;

    // Mettre à jour l'article
    const { data: updatedArticle, error: updateError } = await supabase
      .from('articles')
      .update(dbUpdateData)
      .eq('id', id)
      .eq('pressing_id', user.pressing_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: updatedArticle,
      message: 'Article mis à jour avec succès',
    });

  } catch (error: any) {
    console.error('Erreur PUT /api/articles:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Données invalides',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un article (soft delete)
export async function DELETE(request: NextRequest) {
  const authResult = await verifyAuth(request);
    
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const user = authResult.user;

  try {
    // Seuls les propriétaires peuvent supprimer
    if (user.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Seuls les propriétaires peuvent supprimer des articles' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('id');

    if (!articleId) {
      return NextResponse.json(
        { success: false, error: 'ID de l\'article requis' },
        { status: 400 }
      );
    }

    // Vérifier que l'article existe et appartient au pressing
    const { data: existingArticle, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .eq('pressing_id', user.pressing_id)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !existingArticle) {
      return NextResponse.json(
        { success: false, error: 'Article non trouvé' },
        { status: 404 }
      );
    }

    // Vérifier si l'article est utilisé dans des factures actives
    const { data: usageCheck, error: usageError } = await supabase
      .from('invoices')
      .select('id')
      .eq('pressing_id', user.pressing_id)
      .eq('status', 'active')
      .contains('items', [{ id: articleId }])
      .limit(1);

    if (usageError) {
      console.error('Erreur lors de la vérification d\'usage:', usageError);
    }

    if (usageCheck && usageCheck.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Impossible de supprimer un article utilisé dans des factures actives' },
        { status: 400 }
      );
    }

    // Soft delete
    const { data: deletedArticle, error: deleteError } = await supabase
      .from('articles')
      .update({
        is_deleted: true,
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', articleId)
      .eq('pressing_id', user.pressing_id)
      .select()
      .single();

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      data: deletedArticle,
      message: 'Article supprimé avec succès',
    });

  } catch (error: any) {
    console.error('Erreur DELETE /api/articles:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// PATCH - Actions en lot sur les articles
export async function PATCH(request: NextRequest) {
  const authResult = await verifyAuth(request);
    
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const user = authResult.user;

  try {
    // Vérifier les permissions
    if (!hasPermission(user, 'modify_prices')) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée - Modification des prix requise' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, articleIds, data } = bulkActionSchema.parse(body);

    // Vérifier que tous les articles appartiennent au pressing
    const { data: articles, error: fetchError } = await supabase
      .from('articles')
      .select('id, name, default_price, is_active')
      .eq('pressing_id', user.pressing_id)
      .eq('is_deleted', false)
      .in('id', articleIds);

    if (fetchError) {
      throw fetchError;
    }

    if (!articles || articles.length !== articleIds.length) {
      return NextResponse.json(
        { success: false, error: 'Certains articles n\'ont pas été trouvés' },
        { status: 404 }
      );
    }

    let updateData: any = { updated_at: new Date().toISOString() };
    let message = '';

    switch (action) {
      case 'activate':
        updateData.is_active = true;
        message = `${articleIds.length} article(s) activé(s)`;
        break;

      case 'deactivate':
        updateData.is_active = false;
        message = `${articleIds.length} article(s) désactivé(s)`;
        break;

      case 'delete':
        if (user.role !== 'owner') {
          return NextResponse.json(
            { success: false, error: 'Seuls les propriétaires peuvent supprimer des articles' },
            { status: 403 }
          );
        }
        updateData.is_deleted = true;
        updateData.is_active = false;
        message = `${articleIds.length} article(s) supprimé(s)`;
        break;

      case 'update_price':
        if (!data?.priceMultiplier && !data?.priceIncrease && !data?.newPrice) {
          return NextResponse.json(
            { success: false, error: 'Données de prix manquantes' },
            { status: 400 }
          );
        }

        // Mise à jour prix par prix nécessaire car formule différente par article
        const priceUpdates = [];
        for (const articleId of articleIds) {
          let newPrice;
          const article = articles.find(a => a.id === articleId);
          if (article) {
            const currentPrice = article.default_price;
            if (data.newPrice) {
                newPrice = data.newPrice;
            } else if (data.priceMultiplier) {
                newPrice = Math.round(currentPrice * data.priceMultiplier);
            } else if (data.priceIncrease) {
                newPrice = currentPrice + data.priceIncrease;
            }
          }

          if (newPrice && newPrice > 0) {
            priceUpdates.push(
              supabase
                .from('articles')
                .update({
                  default_price: newPrice,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', articleId)
                .eq('pressing_id', user.pressing_id)
            );
          }
        }

        await Promise.all(priceUpdates);
        message = `Prix de ${articleIds.length} article(s) mis à jour`;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Action non reconnue' },
          { status: 400 }
        );
    }

    // Exécuter la mise à jour en lot (sauf pour update_price déjà fait)
    if (action !== 'update_price') {
      const { error: bulkUpdateError } = await supabase
        .from('articles')
        .update(updateData)
        .eq('pressing_id', user.pressing_id)
        .in('id', articleIds);

      if (bulkUpdateError) {
        throw bulkUpdateError;
      }
    }

    return NextResponse.json({
      success: true,
      message,
      data: {
        affected_count: articleIds.length,
        article_ids: articleIds,
      },
    });

  } catch (error: any) {
    console.error('Erreur PATCH /api/articles:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Données invalides',
          details: error.errors 
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}