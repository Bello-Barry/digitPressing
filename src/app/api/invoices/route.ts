import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Schéma de validation pour création de facture
const createInvoiceSchema = z.object({
  clientName: z.string().min(1, 'Le nom du client est requis'),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientAddress: z.string().optional(),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    total: z.number().min(0),
    category: z.string().optional(),
    notes: z.string().optional(),
  })).min(1, 'Au moins un article est requis'),
  subtotal: z.number().min(0),
  discount: z.number().min(0).optional(),
  discountType: z.enum(['amount', 'percentage']).optional(),
  tax: z.number().min(0).optional(),
  total: z.number().min(0),
  depositDate: z.string(),
  estimatedReadyDate: z.string().optional(),
  urgency: z.enum(['normal', 'express', 'urgent']).default('normal'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

// Schéma pour les filtres de recherche
const searchFiltersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['active', 'cancelled']).optional(),
  paid: z.coerce.boolean().optional(),
  withdrawn: z.coerce.boolean().optional(),
  urgency: z.enum(['normal', 'express', 'urgent']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  clientName: z.string().optional(),
  createdBy: z.string().optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  sortBy: z.enum(['createdAt', 'total', 'clientName', 'depositDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
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

  // Récupérer les informations utilisateur complètes
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

// Helper pour vérifier les permissions
function hasPermission(user: any, action: string): boolean {
  if (user.role === 'owner') return true;
  
  const permission = user.permissions?.find((p: any) => p.action === action);
  return permission?.granted || false;
}

// GET - Récupérer les factures avec filtres
export async function GET(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const { searchParams } = new URL(request.url);
    const filters = searchFiltersSchema.parse(Object.fromEntries(searchParams));

    // Construction de la requête de base
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('pressing_id', user.pressing_id);

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

    if (filters.clientName) {
      query = query.ilike('client_name', `%${filters.clientName}%`);
    }

    if (filters.createdBy) {
      query = query.eq('created_by', filters.createdBy);
    }

    if (filters.minAmount) {
      query = query.gte('total', filters.minAmount);
    }

    if (filters.maxAmount) {
      query = query.lte('total', filters.maxAmount);
    }

    if (filters.search) {
      query = query.or(`number.ilike.%${filters.search}%,client_name.ilike.%${filters.search}%,client_phone.ilike.%${filters.search}%`);
    }

    // Tri
    const sortField = filters.sortBy === 'createdAt' ? 'created_at' : 
                     filters.sortBy === 'clientName' ? 'client_name' :
                     filters.sortBy === 'depositDate' ? 'deposit_date' : 
                     filters.sortBy;

    query = query.order(sortField, { ascending: filters.sortOrder === 'asc' });

    // Pagination
    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;
    query = query.range(from, to);

    const { data: invoices, error: queryError, count } = await query;

    if (queryError) {
      throw queryError;
    }

    const totalPages = Math.ceil((count || 0) / filters.limit);

    return NextResponse.json({
      success: true,
      data: {
        invoices: invoices || [],
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: count || 0,
          totalPages,
          hasNext: filters.page < totalPages,
          hasPrev: filters.page > 1,
        },
      },
    });

  } catch (error: any) {
    console.error('Erreur GET /api/invoices:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// POST - Créer une nouvelle facture
export async function POST(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Vérifier les permissions
    if (!hasPermission(user, 'create_invoice')) {
      return NextResponse.json(
        { error: 'Permission refusée' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const invoiceData = createInvoiceSchema.parse(body);

    // Générer le numéro de facture
    const { data: invoiceNumber, error: numberError } = await supabase
      .rpc('generate_invoice_number', {
        pressing_id: user.pressing_id
      });

    if (numberError) {
      throw new Error('Erreur lors de la génération du numéro de facture');
    }

    // Créer la facture
    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        pressing_id: user.pressing_id,
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
        status: 'active',
        paid: false,
        withdrawn: false,
        deposit_date: invoiceData.depositDate,
        estimated_ready_date: invoiceData.estimatedReadyDate,
        created_by: user.id,
        created_by_name: user.full_name,
        notes: invoiceData.notes,
        urgency: invoiceData.urgency,
        tags: invoiceData.tags,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Mettre à jour les statistiques client si nécessaire
    if (invoiceData.clientPhone) {
      await supabase.rpc('update_client_stats', {
        p_pressing_id: user.pressing_id,
        p_client_name: invoiceData.clientName,
        p_client_phone: invoiceData.clientPhone,
        p_invoice_total: invoiceData.total,
      });
    }

    return NextResponse.json({
      success: true,
      data: invoice,
      message: 'Facture créée avec succès',
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erreur POST /api/invoices:', error);
    
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

// PUT - Mettre à jour une facture (body doit contenir l'ID)
export async function PUT(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de facture requis' },
        { status: 400 }
      );
    }

    const updateData = updateInvoiceSchema.parse(updates);

    // Vérifier que la facture existe et appartient au pressing
    const { data: existingInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, created_by, status')
      .eq('id', id)
      .eq('pressing_id', user.pressing_id)
      .single();

    if (fetchError || !existingInvoice) {
      return NextResponse.json(
        { success: false, error: 'Facture non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier les permissions de modification
    const canModify = user.role === 'owner' || 
                     existingInvoice.created_by === user.id ||
                     hasPermission(user, 'cancel_invoice');

    if (!canModify) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée' },
        { status: 403 }
      );
    }

    // Empêcher la modification des factures annulées
    if (existingInvoice.status === 'cancelled' && user.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Impossible de modifier une facture annulée' },
        { status: 400 }
      );
    }

    // Mettre à jour la facture
    const { data: updatedInvoice, error: updateError } = await supabase
      .from('invoices')
      .update({
        ...updateData,
        modified_by: user.id,
        modified_by_name: user.full_name,
        modified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('pressing_id', user.pressing_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message: 'Facture mise à jour avec succès',
    });

  } catch (error: any) {
    console.error('Erreur PUT /api/invoices:', error);
    
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

// DELETE - Supprimer une facture (soft delete en réalité)
export async function DELETE(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Seuls les owners peuvent supprimer
    if (user.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Seuls les propriétaires peuvent supprimer des factures' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de facture requis' },
        { status: 400 }
      );
    }

    // Soft delete (marquer comme annulée)
    const { data: deletedInvoice, error: deleteError } = await supabase
      .from('invoices')
      .update({
        status: 'cancelled',
        cancellation_reason: 'Suppression par le propriétaire',
        cancelled_by: user.id,
        cancelled_at: new Date().toISOString(),
        modified_by: user.id,
        modified_by_name: user.full_name,
        modified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('pressing_id', user.pressing_id)
      .select()
      .single();

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: 'Facture non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: deletedInvoice,
      message: 'Facture supprimée avec succès',
    });

  } catch (error: any) {
    console.error('Erreur DELETE /api/invoices:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}