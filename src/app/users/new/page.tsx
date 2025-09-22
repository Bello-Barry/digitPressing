'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, User, Mail, Phone, Shield, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useUserActions } from '@/store/users';
import { useAuth, useUserPermissions } from '@/store/auth';
import { toast } from 'sonner';
import { isValidEmail, isValidPhone, capitalizeWords } from '@/lib/utils';
import type { UserPermission } from '@/types';

// Schéma de validation
const _createUserSchema = z.object({
  fullName: z.string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(255, 'Le nom ne peut pas dépasser 255 caractères')
    .refine(name => name.trim().length >= 2, 'Le nom ne peut pas être vide'),
  email: z.string()
    .min(1, 'L\'email est requis')
    .refine(isValidEmail, 'Format d\'email invalide'),
  phone: z.string()
    .optional()
    .refine(phone => !phone || isValidPhone(phone), 'Format de téléphone invalide'),
  role: z.enum(['owner', 'employee'], {
    required_error: 'Le rôle est requis',
  }),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

// Permissions disponibles avec descriptions
const _AVAILABLE_PERMISSIONS = [
  {
    action: 'create_invoice',
    label: 'Créer des factures',
    description: 'Permet de créer de nouvelles factures',
    category: 'Factures',
  },
  {
    action: 'cancel_invoice', 
    label: 'Annuler des factures',
    description: 'Permet d\'annuler des factures existantes',
    category: 'Factures',
  },
  {
    action: 'view_revenue',
    label: 'Voir les revenus',
    description: 'Accès aux rapports et statistiques de revenus',
    category: 'Finances',
  },
  {
    action: 'manage_users',
    label: 'Gérer les utilisateurs',
    description: 'Créer, modifier et gérer les comptes utilisateurs',
    category: 'Administration',
  },
  {
    action: 'modify_prices',
    label: 'Modifier les prix',
    description: 'Gérer les articles et leurs tarifs',
    category: 'Catalogue',
  },
  {
    action: 'export_data',
    label: 'Exporter les données',
    description: 'Exporter les données vers Excel, PDF, etc.',
    category: 'Données',
  },
];

// Permissions par défaut selon le rôle
const _getDefaultPermissions = (role: 'owner' | 'employee'): UserPermission[] => {
  if (role === 'owner') {
    return AVAILABLE_PERMISSIONS.map(perm => ({
      action: perm.action,
      granted: true,
    }));
  }
  
  return AVAILABLE_PERMISSIONS.map(perm => ({
    action: perm.action,
    granted: perm.action === 'create_invoice', // Seule permission par défaut pour employés
  }));
};

export default function NewUserPage() {
  const _router = useRouter();
  const { createUser } = useUserActions();
  const { user } = useAuth();
  const { canManageUsers, isOwner } = useUserPermissions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<UserPermission[]>(
    getDefaultPermissions('employee')
  );

  const _form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      role: 'employee',
      isActive: true,
      notes: '',
    },
  });

  // Vérifier les autorisations
  if (!user || !canManageUsers || !isOwner) {
    router.push('/dashboard');
    return null;
  }

  const _handleRoleChange = (role: 'owner' | 'employee') => {
    form.setValue('role', role);
    setSelectedPermissions(getDefaultPermissions(role));
  };

  const _handlePermissionChange = (action: string, granted: boolean) => {
    setSelectedPermissions(prev =>
      prev.map(perm =>
        perm.action === action ? { ...perm, granted } : perm
      )
    );
  };

  const _onSubmit = async (data: CreateUserForm) => {
    try {
      setIsSubmitting(true);

      const _userData = {
        ...data,
        fullName: capitalizeWords(data.fullName.trim()),
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim()  || null,
        permissions: selectedPermissions,
      };

      await createUser(userData);

      toast.success('Utilisateur créé avec succès', {
        description: `${userData.fullName} a été ajouté à votre équipe.`,
      });

      router.push('/users');

    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      toast.error('Erreur lors de la création', {
        description: error.message || 'Une erreur est survenue lors de la création de l\'utilisateur.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const _groupedPermissions = AVAILABLE_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_PERMISSIONS>);

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/users')}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux utilisateurs
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Nouvel utilisateur</h1>
        <p className="text-muted-foreground">
          Ajoutez un nouveau membre à votre équipe et définissez ses permissions.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Informations personnelles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations personnelles
            </CardTitle>
            <CardDescription>
              Renseignez les informations de base du nouvel utilisateur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet *</Label>
                <Input
                  id="fullName"
                  placeholder="Ex: Jean Dupont"
                  {...form.register('fullName')}
                  error={form.formState.errors.fullName?.message}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-9"
                    placeholder="jean.dupont@exemple.com"
                    {...form.register('email')}
                    error={form.formState.errors.email?.message}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    className="pl-9"
                    placeholder="+242 06 XXX XXXX"
                    {...form.register('phone')}
                    error={form.formState.errors.phone?.message}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Rôle *</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(value: 'owner' | 'employee') => handleRoleChange(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un rôle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employé</SelectItem>
                    <SelectItem value="owner">Propriétaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Informations complémentaires..."
                {...form.register('notes')}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isActive"
                checked={form.watch('isActive')}
                onCheckedChange={(checked) => form.setValue('isActive', !!checked)}
              />
              <Label htmlFor="isActive">Compte actif</Label>
            </div>
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissions
            </CardTitle>
            <CardDescription>
              Définissez les actions autorisées pour cet utilisateur.
              {form.watch('role') === 'owner' && (
                <span className="text-amber-600 font-medium">
                  {' '}Les propriétaires ont automatiquement toutes les permissions.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(groupedPermissions).map(([category, permissions]) => (
              <div key={category}>
                <h4 className="font-medium text-sm text-muted-foreground mb-3">
                  {category}
                </h4>
                <div className="space-y-3">
                  {permissions.map((perm) => {
                    const _permission = selectedPermissions.find(p => p.action === perm.action);
                    const _isChecked = permission?.granted || false;
                    const _isDisabled = form.watch('role') === 'owner';

                    return (
                      <div
                        key={perm.action}
                        className="flex items-start space-x-3 p-3 rounded-lg border bg-card"
                      >
                        <Checkbox
                          id={perm.action}
                          checked={isChecked}
                          disabled={isDisabled}
                          onCheckedChange={(checked) => 
                            handlePermissionChange(perm.action, !!checked)
                          }
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <Label 
                            htmlFor={perm.action}
                            className={`font-medium ${isDisabled ? 'text-muted-foreground' : 'cursor-pointer'}`}
                          >
                            {perm.label}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {perm.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-4 pt-6">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Création...
              </div>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Créer l'utilisateur
              </>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/users')}
            disabled={isSubmitting}
          >
            <X className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        </div>
      </form>
    </div>
  );
}