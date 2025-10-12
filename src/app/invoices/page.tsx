'use client';

// =============================================================================
// PAGE LISTE DES FACTURES - Digit PRESSING
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, 
  Plus, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  MoreHorizontal,
  RefreshCw,
  Calendar,
  User,
  CreditCard,
  Package,
} from 'lucide-react';
import {
  useInvoices,
  useInvoiceActions,
  useInvoiceFilters,
  useTodayStats
} from '@/store/invoices';
import { useAuth, useUserPermissions } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils';
import type { Invoice } from '@/types';

const URGENCY_CONFIG = {
  normal: { label: 'Normal', color: 'bg-gray-100 text-gray-800' },
  express: { label: 'Express', color: 'bg-yellow-100 text-yellow-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
};

const STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle, color: 'text-green-600' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-red-600' },
};

export default function InvoicesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const permissions = useUserPermissions();
  
  // États des stores
  const { invoices, isLoading, error, pagination } = useInvoices();
  const { todayStats, fetchTodayStats } = useTodayStats();
  const { filters, sort, setFilters, setSort, resetFilters } = useInvoiceFilters();
  const { 
    fetchInvoices, 
    searchInvoices, 
    cancelInvoice, 
    markAsPaid, 
    markAsWithdrawn,
    duplicateInvoice,
    clearError 
  } = useInvoiceActions();

  // États locaux
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [actionType, setActionType] = useState<'cancel' | 'delete' | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Charger les données au montage
  useEffect(() => {
    if (user) {
      fetchInvoices({ reset: true });
      fetchTodayStats();
    }
  }, [user, fetchInvoices, fetchTodayStats]);

  // Gestion de la recherche avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchInvoices(searchTerm);
      } else {
        fetchInvoices({ reset: true });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, searchInvoices, fetchInvoices]);

  // Gérer les erreurs
  useEffect(() => {
    if (error) {
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  // Actions sur les factures
  const handleCancelInvoice = async () => {
    if (!selectedInvoice || !cancelReason.trim()) return;

    try {
      await cancelInvoice(selectedInvoice.id, cancelReason);
      setSelectedInvoice(null);
      setActionType(null);
      setCancelReason('');
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    try {
      await markAsPaid(invoice.id, 'cash'); // Par défaut espèces
    } catch (error) {
      console.error('Erreur lors du marquage payé:', error);
    }
  };

  const handleMarkAsWithdrawn = async (invoice: Invoice) => {
    try {
      await markAsWithdrawn(invoice.id);
    } catch (error) {
      console.error('Erreur lors du marquage retiré:', error);
    }
  };

  const handleDuplicateInvoice = async (invoice: Invoice) => {
    try {
      const duplicated = await duplicateInvoice(invoice.id);
      router.push(`/invoices/${duplicated.id}/edit`);
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
    }
  };

  // Rendu des statistiques rapides
  const renderQuickStats = () => {
    if (!todayStats) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Factures du jour</p>
              <p className="text-2xl font-bold">{todayStats.totalInvoices}</p>
            </div>
            <Package className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Payées</p>
              <p className="text-2xl font-bold text-green-600">{todayStats.paidInvoices}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{todayStats.pendingInvoices}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">CA du jour</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(todayStats.totalRevenue)}
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>
    );
  };

  // Rendu des filtres
  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            value={filters.status?.[0] || 'all'}
            onValueChange={(value) => 
              setFilters({ status: value === 'all' ? undefined : [value as 'active' | 'cancelled'] })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Actives</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.paid === undefined ? 'all' : filters.paid ? 'paid' : 'unpaid'}
            onValueChange={(value) => 
              setFilters({ 
                paid: value === 'all' ? undefined : value === 'paid' 
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Paiement" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="paid">Payées</SelectItem>
              <SelectItem value="unpaid">Non payées</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.urgency?.[0] || 'all'}
            onValueChange={(value) => 
              setFilters({ 
                urgency: value === 'all' ? undefined : [value as 'normal' | 'express' | 'urgent'] 
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Urgence" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="express">Express</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            onClick={resetFilters}
            className="w-full"
          >
            Réinitialiser
          </Button>
        </div>
      </Card>
    );
  };

  // Rendu d'une ligne de facture
  const renderInvoiceRow = (invoice: Invoice) => {
    const StatusIcon = STATUS_CONFIG[invoice.status].icon;
    const canEdit = invoice.status === 'active' && (
      permissions.isOwner || 
      invoice.createdBy === user?.id
    );

    return (
      <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
            {/* Numéro et statut */}
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-5 w-5 ${STATUS_CONFIG[invoice.status].color}`} />
              <div>
                <p className="font-medium">{invoice.number}</p>
                <p className="text-sm text-muted-foreground">
                  {formatRelativeDate(invoice.createdAt)}
                </p>
              </div>
            </div>

            {/* Client */}
            <div>
              <p className="font-medium">{invoice.clientName}</p>
              {invoice.clientPhone && (
                <p className="text-sm text-muted-foreground">{invoice.clientPhone}</p>
              )}
            </div>

            {/* Montant */}
            <div className="text-right">
              <p className="font-bold text-lg">{formatCurrency(invoice.total)}</p>
              <p className="text-sm text-muted-foreground">
                {invoice.items.length} article{invoice.items.length > 1 ? 's' : ''}
              </p>
            </div>

            {/* Urgence */}
            <div>
              <Badge className={URGENCY_CONFIG[invoice.urgency].color}>
                {URGENCY_CONFIG[invoice.urgency].label}
              </Badge>
            </div>

            {/* État */}
            <div className="flex flex-col gap-1">
              {invoice.paid ? (
                <Badge variant="outline" className="text-green-600">
                  Payée
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-600">
                  Non payée
                </Badge>
              )}
              {invoice.withdrawn && (
                <Badge variant="outline" className="text-blue-600">
                  Retirée
                </Badge>
              )}
            </div>

            {/* Dates */}
            <div className="text-sm">
              <p>Dépôt: {formatDate(invoice.depositDate)}</p>
              {invoice.estimatedReadyDate && (
                <p className="text-muted-foreground">
                  Prêt: {formatDate(invoice.estimatedReadyDate)}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/invoices/${invoice.id}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Voir
                </Link>
              </DropdownMenuItem>
              
              {canEdit && (
                <DropdownMenuItem asChild>
                  <Link href={`/invoices/${invoice.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Modifier
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={() => handleDuplicateInvoice(invoice)}>
                <Package className="h-4 w-4 mr-2" />
                Dupliquer
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {invoice.status === 'active' && !invoice.paid && (
                <DropdownMenuItem onClick={() => handleMarkAsPaid(invoice)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marquer payée
                </DropdownMenuItem>
              )}

              {invoice.status === 'active' && invoice.paid && !invoice.withdrawn && (
                <DropdownMenuItem onClick={() => handleMarkAsWithdrawn(invoice)}>
                  <Package className="h-4 w-4 mr-2" />
                  Marquer retirée
                </DropdownMenuItem>
              )}

              {invoice.status === 'active' && (permissions.isOwner || permissions.canCancelInvoice) && (
                <DropdownMenuItem 
                  onClick={() => {
                    setSelectedInvoice(invoice);
                    setActionType('cancel');
                  }}
                  className="text-red-600"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Annuler
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Factures</h1>
          <p className="text-muted-foreground">
            Gestion des factures de pressing
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => fetchInvoices({ reset: true })}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>

          {permissions.canCreateInvoice && (
            <Button asChild>
              <Link href="/invoices/new">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle facture
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Statistiques rapides */}
      {renderQuickStats()}

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par numéro, client, téléphone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtres
        </Button>

        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Filtres */}
      {renderFilters()}

      {/* Liste des factures */}
      <div className="space-y-2">
        {isLoading && invoices.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Chargement des factures...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Aucune facture trouvée</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Aucune facture ne correspond à votre recherche."
                : "Commencez par créer votre première facture."
              }
            </p>
            {permissions.canCreateInvoice && !searchTerm && (
              <Button asChild>
                <Link href="/invoices/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer une facture
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            {invoices.map(renderInvoiceRow)}
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  disabled={pagination.page === 1}
                  onClick={() => {
                    // TODO: Implémenter pagination
                  }}
                >
                  Précédent
                </Button>
                
                <span className="flex items-center px-4">
                  Page {pagination.page} sur {pagination.totalPages}
                </span>
                
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => {
                    // TODO: Implémenter pagination
                  }}
                >
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Dialog d'annulation */}
      <AlertDialog 
        open={actionType === 'cancel'} 
        onOpenChange={(open) => {
          if (!open) {
            setActionType(null);
            setSelectedInvoice(null);
            setCancelReason('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la facture</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler la facture {selectedInvoice?.number} ?
              Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <label className="text-sm font-medium">Raison de l'annulation</label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Expliquez pourquoi cette facture est annulée..."
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvoice}
              disabled={!cancelReason.trim()}
              className="bg-red-600 hover:bg-red-700"
            >
              Annuler la facture
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}