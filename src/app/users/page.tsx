// =============================================================================
// GESTION EQUIPE - STAFF MEMBERS (OWNER ONLY)
// =============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  UserCheck,
  UserX,
  XCircle,
  CheckCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { getAdminMembershipAction } from '@/actions/auth';
import { createStaffMemberAction } from '@/actions/admin';
import { can } from '@/lib/permissions';
import { AccessDenied } from '@/components/admin/AccessDenied';

interface PageUser {
  id: string;
  fullName: string;
  email?: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'DELIVERY';
  isActive: boolean;
  createdAt: string;
}

interface CreateUserData {
  fullName: string;
  email: string;
  password: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'DELIVERY';
}

const createUserSchema = z.object({
  fullName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER', 'DELIVERY']),
});

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PageUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'CASHIER' },
  });

  const loadMembershipAndUsers = async () => {
    try {
      setIsLoading(true);
      const membershipData = await getAdminMembershipAction();
      if (!membershipData || !membershipData.membership) {
        router.push('/admin/login');
        return;
      }

      const role = membershipData.membership.role;
      const organizationId = membershipData.membership.organization_id;
      setCurrentRole(role);

      if (!can(role, 'manage_team_and_roles') && !membershipData.isPlatformAdmin) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('memberships')
        .select(`
          id,
          user_id,
          role,
          full_name,
          is_active,
          created_at
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mappedUsers: PageUser[] = (data || []).map((m: any) => ({
        id: m.id,
        fullName: m.full_name || 'Utilisateur',
        role: m.role,
        isActive: m.is_active,
        createdAt: m.created_at,
      }));

      setUsers(mappedUsers);
    } catch (error) {
      console.error('Erreur chargement équipe:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembershipAndUsers();
  }, []);

  const handleCreateUser = async (data: CreateUserData) => {
    try {
      setIsCreating(true);
      const res = await createStaffMemberAction({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        role: data.role,
      });

      if (!res.success) {
        throw new Error(res.error || 'Erreur lors de la création');
      }

      setShowCreateModal(false);
      reset();
      await loadMembershipAndUsers();
    } catch (error: any) {
      console.error('Erreur création utilisateur:', error);
      alert('Erreur lors de la création: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleUserStatus = async (membershipId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('memberships')
        .update({
          is_active: !currentActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', membershipId);

      if (error) throw error;

      setUsers(users.map((u) => (u.id === membershipId ? { ...u, isActive: !currentActive } : u)));
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      alert('Erreur lors de la modification du statut.');
    }
  };

  if (!isLoading && !can(currentRole, 'manage_team_and_roles')) {
    return (
      <AccessDenied
        title="Accès restreint"
        message="Seul le propriétaire (OWNER) est autorisé à gérer l'équipe et les rôles."
      />
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6 text-slate-100">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Gestion de l'équipe — LB Pressing</h1>
          <p className="text-slate-400 text-sm">
            Créez des membres Staff, attribuez leurs rôles et contrôlez leurs accès.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau membre
        </Button>
      </div>

      {/* Recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Rechercher un membre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-900 border-slate-800 text-white"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white"
        >
          <option value="all">Tous les rôles</option>
          <option value="OWNER">Propriétaire (OWNER)</option>
          <option value="MANAGER">Gestionnaire (MANAGER)</option>
          <option value="CASHIER">Caissier (CASHIER)</option>
          <option value="DELIVERY">Livreur (DELIVERY)</option>
        </select>
      </div>

      {/* Liste des membres */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto"></div>
            <p className="mt-2 text-sm">Chargement de l'équipe...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Aucun membre d'équipe trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-950/60">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Membre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Rôle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{u.fullName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        u.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {u.isActive ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                        {u.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleUserStatus(u.id, u.isActive)}
                        className={u.isActive ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'}
                      >
                        {u.isActive ? <UserX className="h-4 w-4 mr-1" /> : <UserCheck className="h-4 w-4 mr-1" />}
                        {u.isActive ? 'Désactiver' : 'Activer'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal création utilisateur */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">Ajouter un membre Staff</h3>
            <form onSubmit={handleSubmit(handleCreateUser)} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nom complet</label>
                <Input {...register('fullName')} placeholder="Ex: Jean Dupont" className="bg-slate-950 border-slate-800 text-white" />
                {errors.fullName && <p className="text-xs text-rose-400 mt-1">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Adresse Email</label>
                <Input {...register('email')} type="email" placeholder="jean@lb-pressing.cg" className="bg-slate-950 border-slate-800 text-white" />
                {errors.email && <p className="text-xs text-rose-400 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Mot de passe temporaire</label>
                <Input {...register('password')} type="password" className="bg-slate-950 border-slate-800 text-white" />
                {errors.password && <p className="text-xs text-rose-400 mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rôle</label>
                <select {...register('role')} className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
                  <option value="CASHIER">Caissier (CASHIER)</option>
                  <option value="MANAGER">Gestionnaire (MANAGER)</option>
                  <option value="DELIVERY">Livreur (DELIVERY)</option>
                  <option value="OWNER">Propriétaire (OWNER)</option>
                </select>
                {errors.role && <p className="text-xs text-rose-400 mt-1">{errors.role.message}</p>}
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <Button type="button" variant="outline" onClick={() => { setShowCreateModal(false); reset(); }}>
                  Annuler
                </Button>
                <Button type="submit" disabled={isCreating} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold">
                  {isCreating ? 'Création...' : 'Créer le membre'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
