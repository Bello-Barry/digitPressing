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
  Phone,
  Shield,
  Search,
  Filter,
  Settings,
  Eye,
  MoreHorizontal,
  CheckCircle,
  XCircle
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { formatDate, cn } from '@/lib/utils';

interface User {
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

const _createUserSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['owner', 'employee']),
});

export default function UsersPage() {
  const _router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPermissions, setShowPermissions] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Vérifier les permissions
  const _canManageUsers = currentUser?.role === 'owner';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
  });

  useEffect(() => {
    if (!canManageUsers) {
      router.push('/dashboard');
      return;
    }
    loadUsers();
  }, [canManageUsers, router]);

  const _loadUsers = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('pressing_id', currentUser?.pressingId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const _createUser = async (data: CreateUserData) => {
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
          pressing_id: currentUser?.pressingId,
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

  const _toggleUserStatus = async (userId: string, newStatus: boolean) => {
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
        users.map((user) => (user.id === userId ? { ...user, isActive: newStatus } : user))
      );
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      alert('Erreur lors de la mise à jour du statut');
    }
  };

  const _deleteUser = async (userId: string) => {
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

      setUsers(users.filter((user) => user.id !== userId));
    } catch (error) {
      console.error('Erreur suppression utilisateur:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const _updatePermissions = async (userId: string, permissions: any[]) => {
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
        users.map((user) =>
          user.id === userId ? { ...user, permissions } : user
        )
      );
    } catch (error) {
      console.error('Erreur mise à jour permissions:', error);
      alert('Erreur lors de la mise à jour des permissions');
    }
  };

  const _filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const _matchesRole = filterRole === 'all' || user.role === filterRole;
    const _matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' ? user.isActive : !user.isActive);

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
              leftIcon={<Search className="h-4 w-4" />}
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
                  {filteredUsers.map((user, index) => (
                    <motion.tr
                      key={user.id}
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
                                {user.fullName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-foreground">
                              {user.fullName}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <Mail className="h-3 w-3 mr-1" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            user.role === 'owner'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-secondary/50 text-secondary-foreground'
                          )}
                        >
                          {user.role === 'owner' ? (
                            <>
                              <Settings className="h-3 w-3 mr-1" />
                              Propriétaire
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3 mr-1" />
                              Employé
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            user.isActive
                              ? 'bg-success/10 text-success'
                              : 'bg-destructive/10 text-destructive'
                          )}
                        >
                          {user.isActive ? (
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
                        {user.lastLogin ? formatDate(user.lastLogin) : 'Jamais'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => 
                            setShowPermissions(showPermissions === user.id ? null : user.id)
                          }
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          {user.permissions.filter(p => p.granted).length}/{user.permissions.length}
                        </Button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end items-center space-x-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingUser(user)}
                            className="text-primary hover:text-primary"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleUserStatus(user.id, !user.isActive)}
                            className={user.isActive ? 'text-orange-600' : 'text-green-600'}
                          >
                            {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                          {user.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteUser(user.id)}
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
              const _user = users.find(u => u.id === showPermissions);
              if (!user) return null;
              
              return (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    Permissions de {user.fullName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {user.permissions.map((perm, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <span className="text-sm font-medium">
                          {perm.action.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={perm.granted}
                            onChange={(e) => {
                              const _newPermissions = [...user.permissions];
                              newPermissions[index] = { ...perm, granted: e.target.checked };
                              updatePermissions(user.id, newPermissions);
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
            <form onSubmit={handleSubmit(createUser)} className="space-y-4">
              <Input
                {...register('fullName')}
                label="Nom complet"
                placeholder="Jean Dupont"
                error={errors.fullName?.message}
              />
              <Input
                {...register('email')}
                label="Email"
                type="email"
                placeholder="jean@exemple.com"
                error={errors.email?.message}
              />
              <Input
                {...register('password')}
                label="Mot de passe temporaire"
                type="password"
                error={errors.password?.message}
              />
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
                <Button type="submit" disabled={isCreating} loading={isCreating}>
                  Créer l'utilisateur
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </DashboardLayout>
  );
}