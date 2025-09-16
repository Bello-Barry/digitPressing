import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

// Schémas de validation
const createUserSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Format d\'email invalide'),
  phone: z.string().optional(),
  role: z.enum(['owner', 'employee']),
  permissions: z.array(z.object({
    action: z.string(),
    granted: z.boolean(),
  })),
  isActive: z.boolean().default(true),
  temporaryPassword: z.string().min(6, 'Mot de passe temporaire requis'),
});

const updateUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(['owner', 'employee']).optional(),
  permissions: z.array(z.object({
    action: z.string(),
    granted: z.boolean(),
  })).optional(),
  isActive: z.boolean().optional(),
});

const filtersSchema = z.object({
  role: z.enum(['owner', 'employee']).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['fullName', 'email', 'role', 'createdAt', 'lastLogin']).default('fullName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
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

// Helper pour vérifier les permissions
function hasPermission(user: any, action: string): boolean {
  if (user.role === 'owner') return true;
  
  const permission = user.permissions?.find((p: any) => p.action === action);
  return permission?.granted || false;
}

// GET - Récupérer les utilisateurs
export async function GET(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Vérifier les permissions
    if (!hasPermission(user, 'manage_users')) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée - Gestion des utilisateurs requise' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const filters = filtersSchema.parse(Object.fromEntries(searchParams));

    // Construction de la requête
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .eq('pressing_id', user.pressing_id);

    // Application des filtres
    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    if (filters.search) {
      query = query.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    // Tri
    const sortField = filters.sortBy === 'fullName' ? 'full_name' :
                     filters.sortBy === 'createdAt' ? 'created_at' :
                     filters.sortBy === 'lastLogin' ? 'last_login' :
                     filters.sortBy;

    query = query.order(sortField, { ascending: filters.sortOrder === 'asc' });

    // Pagination
    const from = (filters.page - 1) * filters.limit;
    const to = from + filters.limit - 1;
    query = query.range(from, to);

    const { data: users, error: queryError, count } = await query;

    if (queryError) {
      throw queryError;
    }

    // Enrichir avec des métadonnées
    const enrichedUsers = (users || []).map(u => ({
      ...u,
      _metadata: {
        daysSinceCreated: Math.floor(
          (new Date().getTime() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        daysSinceLastLogin: u.last_login ? Math.floor(
          (new Date().getTime() - new Date(u.last_login).getTime()) / (1000 * 60 * 60 * 24)
        ) : null,
        permissionCount: u.permissions ? u.permissions.filter((p: any) => p.granted).length : 0,
      },
    }));

    const totalPages = Math.ceil((count || 0) / filters.limit);

    // Statistiques utilisateurs
    const { data: statsData } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('pressing_id', user.pressing_id);

    const stats = {
      total: count || 0,
      active: statsData?.filter(u => u.is_active).length || 0,
      inactive: statsData?.filter(u => !u.is_active).length || 0,
      owners: statsData?.filter(u => u.role === 'owner').length || 0,
      employees: statsData?.filter(u => u.role === 'employee').length || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: count || 0,
          totalPages,
          hasNext: filters.page < totalPages,
          hasPrev: filters.page > 1,
        },
        stats,
      },
    });

  } catch (error: any) {
    console.error('Erreur GET /api/users:', error);
    
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

// POST - Créer un nouvel utilisateur
export async function POST(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Vérifier les permissions
    if (!hasPermission(user, 'manage_users')) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée - Gestion des utilisateurs requise' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const userData = createUserSchema.parse(body);

    // Vérifier que l'email n'existe pas déjà
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Un utilisateur avec cet email existe déjà' },
        { status: 409 }
      );
    }

    if (!supabaseAdmin) {
      throw new Error('Configuration admin Supabase manquante');
    }

    // Créer l'utilisateur dans auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userData.email,
      password: userData.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: userData.fullName,
        pressing_id: user.pressing_id,
      }
    });

    if (authError) {
      throw new Error(`Erreur auth: ${authError.message}`);
    }

    if (!authUser.user) {
      throw new Error('Utilisateur auth non créé');
    }

    try {
      // Créer le profil utilisateur
      const { data: newUser, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          pressing_id: user.pressing_id,
          email: userData.email,
          full_name: userData.fullName,
          phone: userData.phone,
          role: userData.role,
          permissions: userData.permissions,
          is_active: userData.isActive,
        })
        .select()
        .single();

      if (profileError) {
        // Si erreur, nettoyer l'utilisateur auth
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw profileError;
      }

      // Envoyer un email de réinitialisation du mot de passe
      await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: userData.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
        }
      });

      return NextResponse.json({
        success: true,
        data: newUser,
        message: 'Utilisateur créé avec succès. Un email de définition du mot de passe a été envoyé.',
      }, { status: 201 });

    } catch (profileError) {
      // Nettoyer l'utilisateur auth en cas d'erreur du profil
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

  } catch (error: any) {
    console.error('Erreur POST /api/users:', error);
    
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

// PUT - Mettre à jour un utilisateur
export async function PUT(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Vérifier les permissions
    if (!hasPermission(user, 'manage_users')) {
      return NextResponse.json(
        { success: false, error: 'Permission refusée - Gestion des utilisateurs requise' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = updateUserSchema.parse(body);

    // Vérifier que l'utilisateur à modifier appartient au pressing
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('pressing_id', user.pressing_id)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    // Empêcher un utilisateur de se désactiver lui-même
    if (id === user.id && updates.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas désactiver votre propre compte' },
        { status: 400 }
      );
    }

    // Mettre à jour les données de base
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.fullName) updateData.full_name = updates.fullName;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.role) updateData.role = updates.role;
    if (updates.permissions) updateData.permissions = updates.permissions;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .eq('pressing_id', user.pressing_id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Si l'utilisateur est désactivé, révoquer ses sessions
    if (updates.isActive === false && supabaseAdmin) {
      try {
        await supabaseAdmin.auth.admin.signOut(id, 'global');
      } catch (signOutError) {
        console.error('Erreur lors de la déconnexion forcée:', signOutError);
        // Ne pas faire échouer la requête pour cette erreur
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Utilisateur mis à jour avec succès',
    });

  } catch (error: any) {
    console.error('Erreur PUT /api/users:', error);
    
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

// DELETE - Supprimer un utilisateur
export async function DELETE(request: NextRequest) {
  try {
    const { user, error, status } = await verifyAuth(request);
    if (error) {
      return NextResponse.json({ error }, { status });
    }

    // Seuls les propriétaires peuvent supprimer
    if (user.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Seuls les propriétaires peuvent supprimer des utilisateurs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get('id');

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'ID utilisateur requis' },
        { status: 400 }
      );
    }

    // Empêcher un propriétaire de se supprimer lui-même
    if (targetId === user.id) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 400 }
      );
    }

    // Vérifier que l'utilisateur à supprimer appartient au pressing
    const { data: targetUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', targetId)
      .eq('pressing_id', user.pressing_id)
      .single();

    if (fetchError || !targetUser) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    if (!supabaseAdmin) {
      throw new Error('Configuration admin Supabase manquante');
    }

    // Supprimer l'utilisateur des deux tables (cascading delete)
    await supabaseAdmin.auth.admin.deleteUser(targetId);

    return NextResponse.json({
      success: true,
      message: 'Utilisateur supprimé avec succès',
      data: { id: targetId },
    });

  } catch (error: any) {
    console.error('Erreur DELETE /api/users:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Erreur interne du serveur' 
      },
      { status: 500 }
    );
  }
}