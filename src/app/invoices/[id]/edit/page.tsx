'use client';

// =============================================================================
// PAGE MODIFICATION DE FACTURE - Digit PRESSING
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Save, 
  Plus, 
  Minus, 
  X, 
  Calculator,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  Search,
  Package,
  ArrowLeft,
  Trash2
} from 'lucide-react';
import { 
  useInvoices,
  useInvoiceActions,
  useCurrentInvoice 
} from '@/store/invoices';
import { useArticles, useArticleHelpers } from '@/store/articles';
import { useAuth, useUserPermissions } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { formatCurrency, calculateInvoiceTotal, capitalizeWords } from '@/lib/utils';
import type { Article, InvoiceItem, Invoice } from '@/types';

interface InvoiceFormData {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  items: InvoiceItem[];
  discount: number;
  discountType: 'amount' | 'percentage';
  tax: number;
  urgency: 'normal' | 'express' | 'urgent';
  depositDate: string;
  estimatedReadyDate: string;
  notes: string;
  tags: string[];
}

const URGENCY_CONFIG = {
  normal: { label: 'Normal', description: 'Délai standard', color: 'bg-gray-100 text-gray-800' },
  express: { label: 'Express', description: '24-48h', color: 'bg-yellow-100 text-yellow-800' },
  urgent: { label: 'Urgent', description: 'Même jour', color: 'bg-red-100 text-red-800' },
};

export default function EditInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.id as string;
  
  const { user } = useAuth();
  const permissions = useUserPermissions();
  
  // États des stores
  const { invoices, isLoading: invoicesLoading } = useInvoices();
  const { currentInvoice, setCurrentInvoice } = useCurrentInvoice();
  const { updateInvoice, fetchInvoices } = useInvoiceActions();
  const { articles, isLoading: articlesLoading } = useArticles();
  const { getActiveArticles } = useArticleHelpers();

  // Récupérer la facture
  const invoice = invoices.find(inv => inv.id === invoiceId) || currentInvoice;

  // États du formulaire
  const [formData, setFormData] = useState<InvoiceFormData>({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    clientAddress: '',
    items: [],
    discount: 0,
    discountType: 'amount',
    tax: 0,
    urgency: 'normal',
    depositDate: new Date().toISOString().split('T')[0],
    estimatedReadyDate: '',
    notes: '',
    tags: [],
  });

  // États pour l'interface
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [newTag, setNewTag] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Vérifications initiales
  useEffect(() => {
    if (!user) return;
    
    // Charger les factures si pas encore fait
    if (!invoice && !invoicesLoading) {
      fetchInvoices();
    }
  }, [user, invoice, invoicesLoading, fetchInvoices]);

  // Vérifier les permissions
  useEffect(() => {
    if (invoice && user) {
      const canEdit = invoice.status === 'active' && (
        permissions.isOwner || 
        invoice.createdBy === user.id
      );
      
      if (!canEdit) {
        router.push(`/invoices/${invoiceId}`);
      }
    }
  }, [invoice, user, permissions.isOwner, invoiceId, router]);

  // Initialiser le formulaire avec les données de la facture
  useEffect(() => {
    if (invoice && !hasChanges) {
      setFormData({
        clientName: invoice.clientName,
        clientPhone: invoice.clientPhone || '',
        clientEmail: invoice.clientEmail || '',
        clientAddress: invoice.clientAddress || '',
        items: invoice.items,
        discount: invoice.discount || 0,
        discountType: invoice.discountType || 'amount',
        tax: invoice.tax || 0,
        urgency: invoice.urgency,
        depositDate: invoice.depositDate,
        estimatedReadyDate: invoice.estimatedReadyDate || '',
        notes: invoice.notes || '',
        tags: invoice.tags || [],
      });
      setCurrentInvoice(invoice);
    }
  }, [invoice, hasChanges, setCurrentInvoice]);

  // Marquer comme modifié lors des changements
  const updateFormData = useCallback((updates: Partial<InvoiceFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  // Articles actifs pour la recherche
  const activeArticles = getActiveArticles();
  const filteredArticles = activeArticles.filter(article =>
    article.name.toLowerCase().includes(articleSearch.toLowerCase()) ||
    article.category.toLowerCase().includes(articleSearch.toLowerCase())
  );

  // Calculs automatiques
  const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const total = calculateInvoiceTotal(subtotal, formData.discount, formData.discountType, formData.tax);

  // Calculer la date prêt estimée selon l'urgence
  useEffect(() => {
    if (!hasChanges) return;
    
    const depositDate = new Date(formData.depositDate);
    let daysToAdd = 3;

    switch (formData.urgency) {
      case 'urgent':
        daysToAdd = 1;
        break;
      case 'express':
        daysToAdd = 2;
        break;
      case 'normal':
        daysToAdd = 3;
        break;
    }

    const estimatedDate = new Date(depositDate);
    estimatedDate.setDate(depositDate.getDate() + daysToAdd);
    
    updateFormData({
      estimatedReadyDate: estimatedDate.toISOString().split('T')[0]
    });
  }, [formData.depositDate, formData.urgency, hasChanges, updateFormData]);

  // Gestion des articles
  const addArticleToInvoice = useCallback((article: Article) => {
    const existingItem = formData.items.find(item => item.articleId === article.id);
    
    if (existingItem) {
      updateFormData({
        items: formData.items.map(item =>
          item.articleId === article.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      });
    } else {
      const newItem: InvoiceItem = {
        articleId: article.id,
        name: article.name,
        category: article.category,
        quantity: 1,
        unitPrice: article.defaultPrice,
      };

      updateFormData({
        items: [...formData.items, newItem]
      });
    }
    
    setShowArticleSearch(false);
    setArticleSearch('');
  }, [formData.items, updateFormData]);

  const updateItemQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }

    updateFormData({
      items: formData.items.map((item, i) =>
        i === index ? { ...item, quantity } : item
      )
    });
  }, [formData.items, updateFormData]);

  const updateItemPrice = useCallback((index: number, unitPrice: number) => {
    updateFormData({
      items: formData.items.map((item, i) =>
        i === index ? { ...item, unitPrice: Math.max(0, unitPrice) } : item
      )
    });
  }, [formData.items, updateFormData]);

  const removeItem = useCallback((index: number) => {
    updateFormData({
      items: formData.items.filter((_, i) => i !== index)
    });
  }, [formData.items, updateFormData]);

  // Gestion des tags
  const addTag = useCallback(() => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateFormData({
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  }, [newTag, formData.tags, updateFormData]);

  const removeTag = useCallback((tagToRemove: string) => {
    updateFormData({
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  }, [formData.tags, updateFormData]);

  // Gestion de la navigation
  const handleBackClick = () => {
    if (hasChanges) {
      setShowLeaveDialog(true);
    } else {
      router.push(`/invoices/${invoiceId}`);
    }
  };

  const handleLeave = () => {
    setShowLeaveDialog(false);
    router.push(`/invoices/${invoiceId}`);
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoice || !user) return;
    if (formData.items.length === 0) {
      setError('Veuillez ajouter au moins un article');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateInvoice(invoice.id, {
        clientName: capitalizeWords(formData.clientName.trim()),
        clientPhone: formData.clientPhone.trim() || undefined,
        clientEmail: formData.clientEmail.trim() || undefined,
        clientAddress: formData.clientAddress.trim() || undefined,
        items: formData.items,
        subtotal,
        discount: formData.discount,
        discountType: formData.discountType,
        tax: formData.tax,
        total,
        urgency: formData.urgency,
        depositDate: formData.depositDate,
        estimatedReadyDate: formData.estimatedReadyDate || undefined,
        notes: formData.notes.trim() || undefined,
        tags: formData.tags.length > 0 ? formData.tags : undefined,
      });

      setHasChanges(false);
      router.push(`/invoices/${invoice.id}`);
    } catch (error: any) {
      console.error('Erreur lors de la modification:', error);
      setError(error.message || 'Erreur lors de la modification de la facture');
    } finally {
      setIsSubmitting(false);
    }
  };

  // États de chargement
  if (invoicesLoading || articlesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Facture non trouvée</h2>
        <p className="text-muted-foreground mb-4">
          La facture demandée n'existe pas ou vous n'avez pas l'autorisation de la modifier.
        </p>
        <Button onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux factures
        </Button>
      </div>
    );
  }

  if (invoice.status !== 'active') {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
        <h2 className="text-xl font-semibold mb-2">Facture non modifiable</h2>
        <p className="text-muted-foreground mb-4">
          Seules les factures actives peuvent être modifiées.
        </p>
        <Button asChild>
          <Link href={`/invoices/${invoiceId}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voir la facture
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackClick}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold">Modifier facture {invoice.number}</h1>
            <p className="text-muted-foreground">
              {hasChanges && <span className="text-yellow-600">• Modifications non sauvegardées</span>}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleBackClick}
          >
            Annuler
          </Button>
          
          <Button asChild variant="outline">
            <Link href={`/invoices/${invoiceId}`}>
              Voir
            </Link>
          </Button>
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations client */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientName">Nom du client *</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => updateFormData({ clientName: e.target.value })}
                  placeholder="Nom complet du client"
                  required
                />
              </div>

              <div>
                <Label htmlFor="clientPhone">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="clientPhone"
                    value={formData.clientPhone}
                    onChange={(e) => updateFormData({ clientPhone: e.target.value })}
                    placeholder="+242 XX XXX XXXX"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="clientEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="clientEmail"
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => updateFormData({ clientEmail: e.target.value })}
                    placeholder="email@exemple.com"
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="clientAddress">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="clientAddress"
                    value={formData.clientAddress}
                    onChange={(e) => updateFormData({ clientAddress: e.target.value })}
                    placeholder="Adresse complète"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Articles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Articles ({formData.items.length})
              </CardTitle>
              
              <Popover open={showArticleSearch} onOpenChange={setShowArticleSearch}>
                <PopoverTrigger asChild>
                  <Button type="button">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un article
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <Command>
                    <CommandInput 
                      placeholder="Rechercher un article..." 
                      value={articleSearch}
                      onValueChange={setArticleSearch}
                    />
                    <CommandEmpty>Aucun article trouvé.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-y-auto">
                      {filteredArticles.map((article) => (
                        <CommandItem
                          key={article.id}
                          onSelect={() => addArticleToInvoice(article)}
                        >
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{article.name}</span>
                              <span className="font-bold text-primary">
                                {formatCurrency(article.defaultPrice)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground capitalize">
                              {article.category}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {formData.items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun article ajouté</p>
                <p className="text-sm">Cliquez sur "Ajouter un article" pour commencer</p>
              </div>
            ) : (
              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateItemQuantity(index, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                      />
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateItemQuantity(index, item.quantity + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                        className="w-32 text-right"
                      />
                      <span className="text-sm text-muted-foreground">FCFA</span>
                    </div>

                    <div className="text-right min-w-0">
                      <p className="font-bold">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Paramètres et calculs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Paramètres */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Paramètres
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="urgency">Urgence</Label>
                <Select
                  value={formData.urgency}
                  onValueChange={(value: 'normal' | 'express' | 'urgent') =>
                    updateFormData({ urgency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(URGENCY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>
                            {config.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {config.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="depositDate">Date de dépôt</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="depositDate"
                      type="date"
                      value={formData.depositDate}
                      onChange={(e) => updateFormData({ depositDate: e.target.value })}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="estimatedReadyDate">Prêt estimé</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="estimatedReadyDate"
                      type="date"
                      value={formData.estimatedReadyDate}
                      onChange={(e) => updateFormData({ estimatedReadyDate: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateFormData({ notes: e.target.value })}
                  placeholder="Instructions spéciales, remarques..."
                  rows={3}
                />
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Ajouter un tag..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                  />
                  <Button type="button" onClick={addTag} disabled={!newTag.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calculs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Récapitulatif
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span>Sous-total:</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount">Remise</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount}
                    onChange={(e) => updateFormData({ discount: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <Label htmlFor="discountType">Type</Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(value: 'amount' | 'percentage') =>
                      updateFormData({ discountType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Montant</SelectItem>
                      <SelectItem value="percentage">Pourcentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.discount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Remise ({formData.discountType === 'percentage' ? `${formData.discount}%` : formatCurrency(formData.discount)}):
                  </span>
                  <span>
                    -{formatCurrency(
                      formData.discountType === 'percentage'
                        ? subtotal * (formData.discount / 100)
                        : formData.discount
                    )}
                  </span>
                </div>
              )}

              <div>
                <Label htmlFor="tax">TVA (%)</Label>
                <Input
                  id="tax"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.tax}
                  onChange={(e) => updateFormData({ tax: parseFloat(e.target.value) || 0 })}
                />
              </div>

              {formData.tax > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TVA ({formData.tax}%):</span>
                  <span>+{formatCurrency((subtotal - (formData.discountType === 'percentage' ? subtotal * (formData.discount / 100) : formData.discount)) * (formData.tax / 100))}</span>
                </div>
              )}

              <hr />

              <div className="flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleBackClick}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          
          <Button
            type="submit"
            disabled={isSubmitting || formData.items.length === 0 || !hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
          </Button>
        </div>
      </form>

      {/* Dialog de confirmation de sortie */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Modifications non sauvegardées</AlertDialogTitle>
            <AlertDialogDescription>
              Vous avez des modifications non sauvegardées. Êtes-vous sûr de vouloir quitter sans sauvegarder ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Rester sur cette page</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} className="bg-red-600 hover:bg-red-700">
              Quitter sans sauvegarder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}