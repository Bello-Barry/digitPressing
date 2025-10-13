'use client';

// =============================================================================
// PAGE RECHERCHE AVANCÉE CORRIGÉE - app/invoices/search/page.tsx
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search,
  Filter,
  Calendar,
  User,
  CreditCard,
  Package,
  ArrowLeft,
  RefreshCw,
  Download,
  Eye,
  Edit,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  X
} from 'lucide-react';
import {
  useInvoicesStore,
  type Invoice,
  type InvoiceFilters
} from '@/store/invoices';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, formatRelativeDate } from '@/lib/utils';

// FIX: Correction des noms de constantes (suppression du underscore)
const URGENCY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'express', label: 'Express' },
  { value: 'urgent', label: 'Urgent' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'cancelled', label: 'Annulée' },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: 'paid', label: 'Payées' },
  { value: 'unpaid', label: 'Non payées' },
];

const WITHDRAWAL_STATUS_OPTIONS = [
  { value: 'withdrawn', label: 'Retirées' },
  { value: 'pending', label: 'En attente' },
];

const URGENCY_CONFIG = {
  normal: { label: 'Normal', color: 'bg-gray-100 text-gray-800' },
  express: { label: 'Express', color: 'bg-yellow-100 text-yellow-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
};

const STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle, color: 'text-green-600' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-red-600' },
};

// FIX: Interface améliorée avec des types plus stricts
interface SearchFormData {
  searchTerm: string;
  clientName: string;
  clientPhone: string;
  invoiceNumber: string;
  status: string[];
  paid: string;
  withdrawn: string;
  urgency: string[];
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
  createdBy: string;
  tags: string;
}

export default function InvoiceSearchPage() {
  const router = useRouter();
  
  // FIX: Utilisation correcte des stores Zustand
  const { user } = useAuthStore();
  const { 
    invoices, 
    loading: isLoading, 
    error, 
    searchInvoices, 
    fetchInvoices, 
    clearError 
  } = useInvoicesStore();

  // Formulaire de recherche
  const [searchForm, setSearchForm] = useState<SearchFormData>({
    searchTerm: '',
    clientName: '',
    clientPhone: '',
    invoiceNumber: '',
    status: [],
    paid: '',
    withdrawn: '',
    urgency: [],
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    createdBy: '',
    tags: '',
  });

  // États locaux
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // FIX: Correction de l'erreur 'today' - utilisation des variables locales correctement
  useEffect(() => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    setSearchForm(prev => ({
      ...prev,
      dateFrom: lastMonth.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0],
    }));
  }, []);

  // FIX: Fonction corrigée pour mettre à jour le formulaire
  const updateSearchForm = (updates: Partial<SearchFormData>) => {
    setSearchForm(prev => ({ ...prev, ...updates }));
  };

  // FIX: Fonction corrigée pour basculer les valeurs dans les tableaux
  const toggleArrayValue = (array: string[], value: string): string[] => {
    return array.includes(value) 
      ? array.filter(item => item !== value)
      : [...array, value];
  };

  // FIX: Fonction de recherche corrigée
  const handleSearch = async () => {
    if (!user) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      // Construire les filtres à partir du formulaire
      const searchFilters: Partial<InvoiceFilters> = {};

      if (searchForm.status.length > 0) {
        searchFilters.status = searchForm.status as ('active' | 'cancelled')[];
      }

      if (searchForm.paid) {
        searchFilters.paid = searchForm.paid === 'paid';
      }

      if (searchForm.withdrawn) {
        searchFilters.withdrawn = searchForm.withdrawn === 'withdrawn';
      }

      if (searchForm.urgency.length > 0) {
        searchFilters.urgency = searchForm.urgency as ('normal' | 'express' | 'urgent')[];
      }

      if (searchForm.dateFrom) {
        searchFilters.dateFrom = searchForm.dateFrom;
      }

      if (searchForm.dateTo) {
        searchFilters.dateTo = searchForm.dateTo;
      }

      if (searchForm.clientName.trim()) {
        searchFilters.clientName = searchForm.clientName.trim();
      }

      if (searchForm.minAmount) {
        searchFilters.minAmount = parseFloat(searchForm.minAmount);
      }

      if (searchForm.maxAmount) {
        searchFilters.maxAmount = parseFloat(searchForm.maxAmount);
      }

      if (searchForm.tags.trim()) {
        searchFilters.tags = searchForm.tags.trim().split(',').map(tag => tag.trim());
      }

      // Si recherche textuelle globale, utiliser searchInvoices
      if (searchForm.searchTerm.trim() || searchForm.invoiceNumber.trim() || searchForm.clientPhone.trim()) {
        const globalSearchTerm = [
          searchForm.searchTerm,
          searchForm.invoiceNumber,
          searchForm.clientPhone
        ].filter(Boolean).join(' ');
        
        await searchInvoices(globalSearchTerm, searchFilters);
      } else {
        // Sinon, utiliser fetchInvoices avec filtres
        await fetchInvoices({ filters: searchFilters, reset: true });
      }

    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // FIX: Fonction de réinitialisation corrigée
  const handleReset = () => {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    setSearchForm({
      searchTerm: '',
      clientName: '',
      clientPhone: '',
      invoiceNumber: '',
      status: [],
      paid: '',
      withdrawn: '',
      urgency: [],
      dateFrom: lastMonth.toISOString().split('T')[0],
      dateTo: today.toISOString().split('T')[0],
      minAmount: '',
      maxAmount: '',
      createdBy: '',
      tags: '',
    });
    
    // Réinitialiser les filtres du store
    fetchInvoices({ reset: true });
    setHasSearched(false);
  };

  // Gérer les erreurs
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // FIX: Vérification des permissions simplifiée
  const canEditInvoice = (invoice: Invoice) => {
    return invoice.status === 'active' && user && (user.role === 'owner' || invoice.createdBy === user.id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
        >
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold">Recherche avancée</h1>
          <p className="text-muted-foreground">
            Recherchez des factures avec des critères spécifiques
          </p>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulaire de recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Critères de recherche
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showAdvancedFilters ? 'Masquer' : 'Afficher'} filtres avancés
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Recherche générale */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="searchTerm">Recherche globale</Label>
              <Input
                id="searchTerm"
                value={searchForm.searchTerm}
                onChange={(e) => updateSearchForm({ searchTerm: e.target.value })}
                placeholder="Recherche dans tous les champs..."
              />
            </div>

            <div>
              <Label htmlFor="invoiceNumber">Numéro de facture</Label>
              <Input
                id="invoiceNumber"
                value={searchForm.invoiceNumber}
                onChange={(e) => updateSearchForm({ invoiceNumber: e.target.value })}
                placeholder="Ex: 2024-001"
              />
            </div>

            <div>
              <Label htmlFor="clientName">Nom du client</Label>
              <Input
                id="clientName"
                value={searchForm.clientName}
                onChange={(e) => updateSearchForm({ clientName: e.target.value })}
                placeholder="Nom du client"
              />
            </div>
          </div>

          {/* Statuts */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Statut de la facture</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {STATUS_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={searchForm.status.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSearchForm({
                      status: toggleArrayValue(searchForm.status, option.value)
                    })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="paid">Paiement</Label>
              <Select 
                value={searchForm.paid} 
                onValueChange={(value) => updateSearchForm({ paid: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {PAYMENT_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="withdrawn">Retrait</Label>
              <Select 
                value={searchForm.withdrawn} 
                onValueChange={(value) => updateSearchForm({ withdrawn: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous</SelectItem>
                  {WITHDRAWAL_STATUS_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Urgence</Label>
              <div className="flex flex-wrap gap-1 mt-2">
                {URGENCY_OPTIONS.map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={searchForm.urgency.includes(option.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateSearchForm({
                      urgency: toggleArrayValue(searchForm.urgency, option.value)
                    })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Filtres avancés */}
          {showAdvancedFilters && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium">Filtres avancés</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateFrom">Date de début</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dateFrom"
                      type="date"
                      value={searchForm.dateFrom}
                      onChange={(e) => updateSearchForm({ dateFrom: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="dateTo">Date de fin</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="dateTo"
                      type="date"
                      value={searchForm.dateTo}
                      onChange={(e) => updateSearchForm({ dateTo: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="minAmount">Montant minimum (FCFA)</Label>
                  <Input
                    id="minAmount"
                    type="number"
                    min="0"
                    step="100"
                    value={searchForm.minAmount}
                    onChange={(e) => updateSearchForm({ minAmount: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label htmlFor="maxAmount">Montant maximum (FCFA)</Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    min="0"
                    step="100"
                    value={searchForm.maxAmount}
                    onChange={(e) => updateSearchForm({ maxAmount: e.target.value })}
                    placeholder="999999"
                  />
                </div>

                <div>
                  <Label htmlFor="clientPhone">Téléphone client</Label>
                  <Input
                    id="clientPhone"
                    value={searchForm.clientPhone}
                    onChange={(e) => updateSearchForm({ clientPhone: e.target.value })}
                    placeholder="+242 XX XXX XXXX"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags (séparés par virgules)</Label>
                <Input
                  id="tags"
                  value={searchForm.tags}
                  onChange={(e) => updateSearchForm({ tags: e.target.value })}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button 
              variant="outline" 
              onClick={handleReset}
              type="button"
            >
              <X className="h-4 w-4 mr-2" />
              Réinitialiser
            </Button>
            <Button 
              onClick={handleSearch} 
              disabled={isSearching}
              type="button"
            >
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? 'Recherche...' : 'Rechercher'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Résultats de recherche */}
      {hasSearched && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Résultats de la recherche ({invoices.length} facture{invoices.length !== 1 ? 's' : ''})
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Recherche en cours...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Aucune facture trouvée</h3>
                <p className="text-muted-foreground">
                  Aucune facture ne correspond aux critères de recherche.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numéro</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Urgence</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const StatusIcon = STATUS_CONFIG[invoice.status].icon;
                      const canEdit = canEditInvoice(invoice);

                      return (
                        <TableRow key={invoice.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <StatusIcon className={`h-4 w-4 ${STATUS_CONFIG[invoice.status].color}`} />
                              {invoice.number}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div>
                              <div className="font-medium">{invoice.clientName}</div>
                              {invoice.clientPhone && (
                                <div className="text-sm text-muted-foreground">
                                  {invoice.clientPhone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="font-bold">{formatCurrency(invoice.total)}</div>
                            <div className="text-sm text-muted-foreground">
                              {invoice.items?.length || 0} article{invoice.items && invoice.items.length > 1 ? 's' : ''}
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <Badge className={URGENCY_CONFIG[invoice.urgency].color}>
                              {URGENCY_CONFIG[invoice.urgency].label}
                            </Badge>
                          </TableCell>
                          
                          <TableCell>
                            <div className="space-y-1">
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
                          </TableCell>
                          
                          <TableCell>
                            <div>
                              <div>{formatDate(invoice.depositDate)}</div>
                              <div className="text-sm text-muted-foreground">
                                {formatRelativeDate(invoice.createdAt)}
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right">
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
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}