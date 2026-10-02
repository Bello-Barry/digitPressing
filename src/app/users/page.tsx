// =============================================================================
// 1. GESTION UTILISATEURS - src/app/users/page.tsx
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Shield,
  Search,
  Settings,
  Eye,
  CheckCircle,
  XCircle,
  User as UserIcon
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { formatDate, cn } from '@/lib/utils';

interface PageUser {
  id: string;
  fullName: string;
  email: string;
  role: 'owner' | 'employee';
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  permissions: Array<{ action: string; granted: boolean }>;
}

interface CreateUserData {
  fullName: string;
  email: string;
  password: string;
  role: 'owner' | 'employee';
}

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['owner', 'employee']),
});

export default function UsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PageUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_editingUser, setEditingUser] = useState<PageUser | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Vérifier les permissions
  const canManageUsers = currentUser?.role === 'owner';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
  });

  const loadUsers = async () => {
    try {
      if (!currentUser?.pressingId) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('pressing_id', currentUser.pressingId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedUsers: PageUser[] = (data || []).map((u: any) => ({
        id: u.id,
        fullName: u.full_name || u.email,
        email: u.email,
        role: u.role,
        isActive: u.is_active,
        lastLogin: u.last_login,
        createdAt: u.created_at,
        permissions: (u.permissions as any) || [],
      }));

      setUsers(mappedUsers);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageUsers) {
      router.push('/dashboard');
      return;
    }
    loadUsers();
  }, [canManageUsers, router]);

  const handleCreateUser = async (data: CreateUserData) => {
    try {
      setIsCreating(true);

      // Créer l'utilisateur dans Supabase Auth
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            pressing_id: currentUser?.pressingId,
          },
        },
      });

      if (authError) throw authError;

      if (authUser.user) {
        // Créer le profil utilisateur
        const { error: profileError } = await supabase.from('users').insert({
          id: authUser.user.id,
          email: data.email,
          full_name: data.fullName,
          pressing_id: currentUser?.pressingId || '',
          role: data.role,
          permissions: [
            { action: 'create_invoice', granted: true },
            { action: 'cancel_invoice', granted: data.role === 'owner' },
            { action: 'view_revenue', granted: data.role === 'owner' },
            { action: 'manage_users', granted: data.role === 'owner' },
            { action: 'modify_prices', granted: data.role === 'owner' },
            { action: 'export_data', granted: data.role === 'owner' },
          ],
          is_active: true,
        });

        if (profileError) throw profileError;

        await loadUsers();
        setShowCreateModal(false);
        reset();
      }
    } catch (error: any) {
      console.error('Erreur création utilisateur:', error);
      alert('Erreur lors de la création: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleUserStatus = async (userId: string, newStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          is_active: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setUsers(
        users.map((u) => (u.id === userId ? { ...u, isActive: newStatus } : u))
      );
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const deleteUser = async (userId: string) => {
    if (
      !confirm(
        'Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.'
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);

      if (error) throw error;

      setUsers(users.filter((u) => u.id !== userId));
    } catch (error) {
      console.error('Erreur suppression utilisateur:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const updatePermissions = async (userId: string, permissions: any[]) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({
          permissions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      setUsers(
        users.map((u) =>
          u.id === userId ? { ...u, permissions } : u
        )
      );
    } catch (error) {
      console.error('Erreur mise à jour permissions:', error);
      alert('Erreur lors de la mise à jour des permissions');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' ? u.isActive : !u.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  if (!canManageUsers) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">Accès non autorisé</h2>
            <p className="text-muted-foreground">
              Seuls les propriétaires peuvent gérer les utilisateurs.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* En-tête */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Gestion de l'équipe</h1>
            <p className="text-muted-foreground">
              Gérez les utilisateurs et leurs permissions
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un utilisateur
          </Button>
        </div>

        {/* Recherche et filtres */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Rechercher un utilisateur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="rounded-md border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">Tous les rôles</option>
            <option value="owner">Propriétaires</option>
            <option value="employee">Employés</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
        </div>

        {/* Statistiques rapides */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-muted-foreground">Total</div>
                <div className="text-2xl font-bold">{users.length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                  <UserCheck className="h-4 w-4 text-success" />
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-muted-foreground">Actifs</div>
                <div className="text-2xl font-bold">{users.filter((u) => u.isActive).length}</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Settings className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-muted-foreground">Propriétaires</div>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.role === 'owner').length}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
                  <Mail className="h-4 w-4 text-orange-600" />
                </div>
              </div>
              <div className="ml-4">
                <div className="text-sm font-medium text-muted-foreground">Employés</div>
                <div className="text-2xl font-bold">
                  {users.filter((u) => u.role === 'employee').length}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des utilisateurs */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Chargement...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchTerm || filterRole !== 'all' || filterStatus !== 'all'
                  ? 'Aucun utilisateur trouvé avec ces critères'
                  : 'Aucun utilisateur trouvé'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Rôle
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Dernière connexion
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Permissions
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-border">
                  {filteredUsers.map((u, index) => (
                    <motion.tr
                      key={u.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                              <span className="text-sm font-medium text-white">
                                {u.fullName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-foreground">
                              {u.fullName}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            u.role === 'owner'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-secondary/50 text-secondary-foreground'
                          )}
                        >
                          {u.role === 'owner' ? (
                            <>
                              <Settings className="h-3 w-3 mr-1" />
                              Propriétaire
                            </>
                          ) : (
                            <>
                              <UserIcon className="h-3 w-3 mr-1" />
                              Employé
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            u.isActive
                              ? 'bg-success/10 text-success'
                              : 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {u.isActive ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Actif
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactif
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {u.lastLogin ? formatDate(u.lastLogin) : 'Jamais'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => 
                            setShowPermissions(showPermissions === u.id ? null : u.id)
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {u.permissions.filter((p: any) => p.granted).length}/{u.permissions.length}
                        </Button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingUser(u)}
                            className="text-primary hover:text-primary"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleUserStatus(u.id, !u.isActive)}
                            className={u.isActive ? 'text-orange-600' : 'text-green-600'}
                          >
                            {u.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                          {u.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteUser(u.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Panneau des permissions */}
        {showPermissions && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white rounded-lg border p-6"
          >
            {(() => {
              const targetUser = users.find(u => u.id === showPermissions);
              if (!targetUser) return null;
              
              return (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Permissions de {targetUser.fullName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {targetUser.permissions.map((perm, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm font-medium">
                          {perm.action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={perm.granted}
                            onChange={(e) => {
                              const newPermissions = [...targetUser.permissions];
                              newPermissions[index] = { ...perm, granted: e.target.checked };
                              updatePermissions(targetUser.id, newPermissions);
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </div>

      {/* Modal création utilisateur */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md"
          >
            <h3 className="text-lg font-semibold mb-4">Ajouter un utilisateur</h3>
            <form onSubmit={handleSubmit(handleCreateUser)} className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">Nom complet</label>
                <Input
                  {...register('fullName')}
                  placeholder="Jean Dupont"
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive mt-1">{errors.fullName.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Email</label>
                <Input
                  {...register('email')}
                  type="email"
                  placeholder="jean@exemple.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Mot de passe temporaire</label>
                <Input
                  {...register('password')}
                  type="password"
                />
                {errors.password && (
                  <p className="text-sm text-destructive mt-1">{errors.password.message}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Rôle</label>
                <select
                  {...register('role')}
                  className="w-full rounded-md border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="employee">Employé</option>
                  <option value="owner">Propriétaire</option>
                </select>
                {errors.role && (
                  <p className="text-sm text-destructive mt-1">{errors.role.message}</p>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    reset();
                  }}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? 'Création...' : 'Créer l\'utilisateur'}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}