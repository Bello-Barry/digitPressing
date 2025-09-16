import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Schéma de validation pour la recherche
const searchSchema = z.object({
  q: z.string().min(1, 'Terme de recherche requis'),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  filters: z.object({
    status: z.enum(['active', 'cancelled']).optional(),
    paid: z.coerce.boolean().optional(),
    withdrawn: z.coerce.boolean().optional(),
    urgency: z.enum(['normal', 'express', 'urgent']).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    createdBy: z.string().optional(),
  }).optional().default({}),
  sortBy: z.enum(['relevance', 'date', 'amount', 'client']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Helper pour vérifier l'authentification
async function verifyAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Token manquant', status: 401 };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { error: 'Token invalide', status: 401 };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    return { error: 'Utilisateur inactif', status: 403 };
  }

  return { user: profile };
}

// Helper pour construire la requête de recherche
function buildSearchQuery(searchTerm: string, filters: any, pressingId: string) {
  let query = supabase
    .from('invoices')
    .select('*', { count: 'exact' })
    .eq('pressing_id', pressingId);

  // Recherche textuelle sur plusieurs champs
  const searchConditions = [
    `number.ilike.%${searchTerm}%`,
    `client_name.ilike.%${searchTerm}%`,
    `client_phone.ilike.%${searchTerm}%`,
    `client_email.ilike.%${searchTerm}%`,
    `notes.ilike.%${searchTerm}%`,
  ];

  // Recherche dans les tags si le terme contient #
  if (searchTerm.includes('#')) {
    const tag = searchTerm.replace('#', '').trim();
    searchConditions.push(`tags.cs.{${tag}}`);
  }

  // Recherche par montant exact si le terme est numérique
  const numericSearch = parseFloat(searchTerm);
  if (!isNaN(numericSearch)) {
    searchConditions.push(`total.eq.${numericSearch}`);
    searchConditions.push(`subtotal.eq.${numericSearch}`);
  }

  query = query.or(searchConditions.join(','));

  // Application des filtres
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.paid !== undefined) {
    query = query.eq('paid', filters.paid);
  }

  if (filters.withdrawn !== undefined) {
    query = query.eq('withdrawn', filters.withdrawn);
  }

  if (filters.urgency) {
    query = query.eq('urgency', filters.urgency);
  }

  if (filters.dateFrom) {
    query = query.gte('deposit_date', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('deposit_date', filters.dateTo);
  }

  if (filters.minAmount) {
    query = query.gte('total', filters.minAmount);
  }

  if (filters.maxAmount) {
    query = query.lte('total', filters.maxAmount);
  }

  if (filters.createdBy) {
    query = query.eq('created_by', filters.createdBy);
  }

  return query;
}

// Helper pour calculer le score de pertinence
function calculateRelevanceScore(invoice: any, searchTerm: string): number {
  const lowerSearchTerm = searchTerm.toLowerCase();
  let score = 0;

  // Score basé sur la correspondance exacte dans différents champs
  if (invoice.number.toLowerCase().includes(lowerSearchTerm)) {
    score += invoice.number.toLowerCase() === lowerSearchTerm ? 100 : 50;
  }

  if (invoice.client_name.toLowerCase().includes(lowerSearchTerm)) {
    score += invoice.client_name.toLowerCase() === lowerSearchTerm ? 80 : 30;
  }

  if (invoice.client_phone?.includes(lowerSearchTerm)) {
    score += invoice.client_phone === lowerSearchTerm ? 90 : 40;
  }

  if (invoice.client_email?.toLowerCase().includes(lowerSearchTerm)) {
    score += invoice.client_email.toLowerCase() === lowerSearchTerm ? 70 : 25;
  }

  if (invoice.notes?.toLowerCase().includes(lowerSearchTerm)) {
    score += 20;
  }

  if (invoice.tags?.some((tag: string) => tag.toLowerCase().includes(lowerSearchTerm))) {
    score += 35;
  }

  // Bonus pour les correspondances récentes
  const daysSinceCreated = Math.floor(
    (new Date().getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceCreated <= 7) score += 10;
  else if (daysSinceCreated <= 30) score += 5;

  // Bonus pour les factures actives
  if (invoice.status === 'active') score += 10;

  // Bonus pour les factures non payées ou non retirées (plus pertinentes)
  if (!invoice.paid) score += 15;
  if (invoice.paid && !invoice.withdrawn) score += 10;

  return score;
}

// POST - Recherche avancée de factures
export async function POST(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json();
    const searchParams = searchSchema.parse(body);

    const { q: searchTerm, limit, offset, filters, sortBy, sortOrder } = searchParams;

    // Construction de la requête
    let query = buildSearchQuery(searchTerm, filters, user.pressing_id);

    // Application du tri selon le critère choisi
    switch (sortBy) {
      case 'date':
        query = query.order('created_at', { ascending: sortOrder === 'asc' });
        break;
      case 'amount':
        query = query.order('total', { ascending: sortOrder === 'asc' });
        break;
      case 'client':
        query = query.order('client_name', { ascending: sortOrder === 'asc' });
        break;
      case 'relevance':
      default:
        // Pour la pertinence, on récupère tout et on trie en mémoire
        break;
    }

    // Application de la pagination (sauf pour la pertinence)
    if (sortBy !== 'relevance') {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: invoices, error: queryError, count } = await query;

    if (queryError) {
      throw queryError;
    }

    let results = invoices || [];

    // Tri par pertinence si demandé
    if (sortBy === 'relevance') {
      results = results
        .map(invoice => ({
          ...invoice,
          _relevanceScore: calculateRelevanceScore(invoice, searchTerm),
        }))
        .sort((a, b) => {
          if (sortOrder === 'asc') {
            return a._relevanceScore - b._relevanceScore;
          }
          return b._relevanceScore - a._relevanceScore;
        })
        .slice(offset, offset + limit)
        .map(({ _relevanceScore, ...invoice }) => invoice);
    }

    // Enrichissement des résultats avec des métadonnées
    const enrichedResults = results.map(invoice => ({
      ...invoice,
      _metadata: {
        daysSinceCreated: Math.floor(
          (new Date().getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        isOverdue: invoice.estimated_ready_date 
          ? new Date(invoice.estimated_ready_date) < new Date() && !invoice.withdrawn
          : false,
        status_display: invoice.status === 'active' ? 
          (invoice.withdrawn ? 'Retiré' : 
           invoice.paid ? 'Prêt' : 'En attente') : 'Annulé',
        search_highlights: getSearchHighlights(invoice, searchTerm),
      },
    }));

    // Statistiques de recherche
    const searchStats = {
      total_results: count || 0,
      showing: results.length,
      page: Math.floor(offset / limit) + 1,
      total_pages: Math.ceil((count || 0) / limit),
      search_term: searchTerm,
      filters_applied: Object.keys(filters).length,
    };

    return NextResponse.json({
      success: true,
      data: {
        results: enrichedResults,
        stats: searchStats,
      },
    });

  } catch (error: any) {
    console.error('Erreur POST /api/invoices/search:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Paramètres de recherche invalides',
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

// GET - Recherche simple (pour compatibilité)
export async function GET(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    
    if (!q) {
      return NextResponse.json(
        { success: false, error: 'Paramètre de recherche "q" requis' },
        { status: 400 }
      );
    }

    // Utiliser la recherche POST en interne
    const searchBody = {
      q,
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy: searchParams.get('sortBy') || 'relevance',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };

    const searchParams_validated = searchSchema.parse(searchBody);
    
    // Réutiliser la logique POST
    let query = buildSearchQuery(searchParams_validated.q, {}, user.pressing_id);

    if (searchParams_validated.sortBy !== 'relevance') {
      const sortField = searchParams_validated.sortBy === 'date' ? 'created_at' :
                       searchParams_validated.sortBy === 'amount' ? 'total' :
                       searchParams_validated.sortBy === 'client' ? 'client_name' : 'created_at';
      
      query = query.order(sortField, { ascending: searchParams_validated.sortOrder === 'asc' });
    }

    query = query.range(searchParams_validated.offset, searchParams_validated.offset + searchParams_validated.limit - 1);

    const { data: invoices, error: queryError, count } = await query;

    if (queryError) {
      throw queryError;
    }

    let results = invoices || [];

    // Tri par pertinence si demandé
    if (searchParams_validated.sortBy === 'relevance') {
      results = results
        .map(invoice => ({
          ...invoice,
          _relevanceScore: calculateRelevanceScore(invoice, searchParams_validated.q),
        }))
        .sort((a, b) => b._relevanceScore - a._relevanceScore)
        .map(({ _relevanceScore, ...invoice }) => invoice);
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        stats: {
          total_results: count || 0,
          showing: results.length,
          search_term: q,
        },
      },
    });

  } catch (error: any) {
    console.error('Erreur GET /api/invoices/search:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// Helper pour mettre en évidence les termes de recherche
function getSearchHighlights(invoice: any, searchTerm: string): any {
  const lowerSearchTerm = searchTerm.toLowerCase();
  const highlights: any = {};

  // Vérifier chaque champ pour les correspondances
  if (invoice.number.toLowerCase().includes(lowerSearchTerm)) {
    highlights.number = true;
  }

  if (invoice.client_name.toLowerCase().includes(lowerSearchTerm)) {
    highlights.client_name = true;
  }

  if (invoice.client_phone?.includes(lowerSearchTerm)) {
    highlights.client_phone = true;
  }

  if (invoice.client_email?.toLowerCase().includes(lowerSearchTerm)) {
    highlights.client_email = true;
  }

  if (invoice.notes?.toLowerCase().includes(lowerSearchTerm)) {
    highlights.notes = true;
  }

  const numericSearch = parseFloat(searchTerm);
  if (!isNaN(numericSearch) && (invoice.total === numericSearch || invoice.subtotal === numericSearch)) {
    highlights.amount = true;
  }

  return highlights;
}