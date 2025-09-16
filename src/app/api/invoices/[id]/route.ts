import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// Schéma pour les actions spécifiques
const actionSchema = z.object({
  action: z.enum(['pay', 'withdraw', 'cancel', 'duplicate']),
  paymentMethod: z.enum(['cash', 'card', 'check', 'transfer', 'mobile_money']).optional(),
  paymentDate: z.string().optional(),
  withdrawalDate: z.string().optional(),
  cancellationReason: z.string().optional(),
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

// GET - Récupérer une facture spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const invoiceId = params.id;

    // Récupérer la facture avec toutes les informations
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select(`
        *,
        created_by_user:users!invoices_created_by_fkey(full_name, email),
        modified_by_user:users!invoices_modified_by_fkey(full_name, email),
        cancelled_by_user:users!invoices_cancelled_by_fkey(full_name, email)
      `)
      .eq('id', invoiceId)
      .eq('pressing_id', user.pressing_id)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json(
        { success: false, error: 'Facture non trouvée' },
        { status: 404 }
      );
    }

    // Calculer les statistiques associées
    const stats = {
      itemsCount: invoice.items?.length || 0,
      averageItemPrice: invoice.items?.length > 0 
        ? invoice.subtotal / invoice.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
        : 0,
      daysSinceCreated: Math.floor(
        (new Date().getTime() - new Date(invoice.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
      isOverdue: invoice.estimated_ready_date 
        ? new Date(invoice.estimated_ready_date) < new Date() && !invoice.withdrawn
        : false,
    };

    return NextResponse.json({
      success: true,
      data: {
        ...invoice,
        stats,
      },
    });

  } catch (error: any) {
    console.error(`Erreur GET /api/invoices/${params.id}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// POST - Actions spécifiques sur une facture
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const invoiceId = params.id;
    const body = await request.json();
    const { action, ...actionData } = actionSchema.parse(body);

    // Vérifier que la facture existe et appartient au pressing
    const { data: existingInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('pressing_id', user.pressing_id)
      .single();

    if (fetchError || !existingInvoice) {
      return NextResponse.json(
        { success: false, error: 'Facture non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier que la facture est active (sauf pour certaines actions)
    if (existingInvoice.status === 'cancelled' && action !== 'duplicate') {
      return NextResponse.json(
        { success: false, error: 'Action impossible sur une facture annulée' },
        { status: 400 }
      );
    }

    let updatedInvoice;
    let message = '';

    switch (action) {
      case 'pay':
        // Marquer comme payé
        if (existingInvoice.paid) {
          return NextResponse.json(
            { success: false, error: 'Facture déjà payée' },
            { status: 400 }
          );
        }

        if (!actionData.paymentMethod) {
          return NextResponse.json(
            { success: false, error: 'Méthode de paiement requise' },
            { status: 400 }
          );
        }

        const { data: paidInvoice, error: payError } = await supabase
          .from('invoices')
          .update({
            paid: true,
            payment_method: actionData.paymentMethod,
            payment_date: actionData.paymentDate || new Date().toISOString().split('T')[0],
            modified_by: user.id,
            modified_by_name: user.full_name,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('pressing_id', user.pressing_id)
          .select()
          .single();

        if (payError) throw payError;
        
        updatedInvoice = paidInvoice;
        message = 'Facture marquée comme payée';
        break;

      case 'withdraw':
        // Marquer comme retirée
        if (!existingInvoice.paid) {
          return NextResponse.json(
            { success: false, error: 'La facture doit être payée avant d\'être retirée' },
            { status: 400 }
          );
        }

        if (existingInvoice.withdrawn) {
          return NextResponse.json(
            { success: false, error: 'Commande déjà retirée' },
            { status: 400 }
          );
        }

        const { data: withdrawnInvoice, error: withdrawError } = await supabase
          .from('invoices')
          .update({
            withdrawn: true,
            withdrawal_date: actionData.withdrawalDate || new Date().toISOString().split('T')[0],
            modified_by: user.id,
            modified_by_name: user.full_name,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('pressing_id', user.pressing_id)
          .select()
          .single();

        if (withdrawError) throw withdrawError;
        
        updatedInvoice = withdrawnInvoice;
        message = 'Commande marquée comme retirée';
        break;

      case 'cancel':
        // Annuler la facture
        if (!hasPermission(user, 'cancel_invoice') && existingInvoice.created_by !== user.id) {
          return NextResponse.json(
            { success: false, error: 'Permission refusée' },
            { status: 403 }
          );
        }

        if (!actionData.cancellationReason) {
          return NextResponse.json(
            { success: false, error: 'Raison d\'annulation requise' },
            { status: 400 }
          );
        }

        const { data: cancelledInvoice, error: cancelError } = await supabase
          .from('invoices')
          .update({
            status: 'cancelled',
            cancellation_reason: actionData.cancellationReason,
            cancelled_by: user.id,
            cancelled_at: new Date().toISOString(),
            modified_by: user.id,
            modified_by_name: user.full_name,
            modified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', invoiceId)
          .eq('pressing_id', user.pressing_id)
          .select()
          .single();

        if (cancelError) throw cancelError;
        
        updatedInvoice = cancelledInvoice;
        message = 'Facture annulée avec succès';
        break;

      case 'duplicate':
        // Dupliquer la facture
        if (!hasPermission(user, 'create_invoice')) {
          return NextResponse.json(
            { success: false, error: 'Permission refusée' },
            { status: 403 }
          );
        }

        // Générer un nouveau numéro
        const { data: newNumber, error: numberError } = await supabase
          .rpc('generate_invoice_number', {
            pressing_id: user.pressing_id
          });

        if (numberError) throw new Error('Erreur lors de la génération du numéro');

        const { data: duplicatedInvoice, error: duplicateError } = await supabase
          .from('invoices')
          .insert({
            pressing_id: user.pressing_id,
            number: newNumber,
            client_name: existingInvoice.client_name,
            client_phone: existingInvoice.client_phone,
            client_email: existingInvoice.client_email,
            client_address: existingInvoice.client_address,
            items: existingInvoice.items,
            subtotal: existingInvoice.subtotal,
            discount: existingInvoice.discount,
            discount_type: existingInvoice.discount_type,
            tax: existingInvoice.tax,
            total: existingInvoice.total,
            status: 'active',
            paid: false,
            withdrawn: false,
            deposit_date: new Date().toISOString().split('T')[0],
            estimated_ready_date: existingInvoice.estimated_ready_date,
            created_by: user.id,
            created_by_name: user.full_name,
            notes: existingInvoice.notes 
              ? `Copie de ${existingInvoice.number}: ${existingInvoice.notes}`
              : `Copie de ${existingInvoice.number}`,
            urgency: existingInvoice.urgency,
            tags: existingInvoice.tags,
          })
          .select()
          .single();

        if (duplicateError) throw duplicateError;
        
        updatedInvoice = duplicatedInvoice;
        message = 'Facture dupliquée avec succès';
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Action non reconnue' },
          { status: 400 }
        );
    }

    // Mettre à jour les statistiques client si nécessaire
    if (action === 'pay' && existingInvoice.client_phone) {
      await supabase.rpc('update_client_stats', {
        p_pressing_id: user.pressing_id,
        p_client_name: existingInvoice.client_name,
        p_client_phone: existingInvoice.client_phone,
        p_invoice_total: existingInvoice.total,
      });
    }

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
      message,
    });

  } catch (error: any) {
    console.error(`Erreur POST /api/invoices/${params.id}:`, error);
    
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

// PUT - Mettre à jour une facture spécifique
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const invoiceId = params.id;
    const body = await request.json();

    // Vérifier que la facture existe et appartient au pressing
    const { data: existingInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, created_by, status')
      .eq('id', invoiceId)
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
        ...body,
        modified_by: user.id,
        modified_by_name: user.full_name,
        modified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
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
    console.error(`Erreur PUT /api/invoices/${params.id}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer une facture spécifique
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    const invoiceId = params.id;

    // Seuls les owners peuvent supprimer
    if (user.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Seuls les propriétaires peuvent supprimer des factures' },
        { status: 403 }
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
      .eq('id', invoiceId)
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
    console.error(`Erreur DELETE /api/invoices/${params.id}:`, error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}