'use client';

// =============================================================================
// PAGE CRÉATION DE FACTURE - Digit PRESSING
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  Package
} from 'lucide-react';
import { useInvoiceActions } from '@/store/invoices';
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
import { formatCurrency, calculateInvoiceTotal, capitalizeWords } from '@/lib/utils';
import type { Article, InvoiceItem } from '@/types';

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

export default function NewInvoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const permissions = useUserPermissions();
  
  // États des stores
  const { createInvoice, generateInvoiceNumber } = useInvoiceActions();
  const { articles, isLoading: articlesLoading } = useArticles();
  const { getActiveArticles } = useArticleHelpers();

  // Vérification des permissions
  useEffect(() => {
    if (user && !permissions.canCreateInvoice) {
      router.push('/dashboard');
    }
  }, [user, permissions.canCreateInvoice, router]);

  // État du formulaire
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
    const depositDate = new Date(formData.depositDate);
    let daysToAdd = 3; // Par défaut

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
    
    setFormData(prev => ({
      ...prev,
      estimatedReadyDate: estimatedDate.toISOString().split('T')[0]
    }));
  }, [formData.depositDate, formData.urgency]);

  // Déclarer removeItem en premier pour éviter les problèmes de référence
  const removeItem = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  }, []);

  // Gestion des articles
  const addArticleToInvoice = useCallback((article: Article) => {
    const existingItem = formData.items.find(item => item.articleId === article.id);
    
    if (existingItem) {
      // Incrémenter la quantité si l'article existe déjà
      setFormData(prev => ({
        ...prev,
        items: prev.items.map(item =>
          item.articleId === article.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }));
    } else {
      // Ajouter un nouvel article
      const newItem: InvoiceItem = {
        articleId: article.id,
        name: article.name,
        category: article.category,
        quantity: 1,
        unitPrice: article.defaultPrice,
      };

      setFormData(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
    }
    
    setShowArticleSearch(false);
    setArticleSearch('');
  }, [formData.items]);

  const updateItemQuantity = useCallback((index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, quantity } : item
      )
    }));
  }, [formData.items, removeItem]);

  const updateItemPrice = useCallback((index: number, unitPrice: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, unitPrice: Math.max(0, unitPrice) } : item
      )
    }));
  }, [formData.items]);

  // Gestion des tags
  const addTag = useCallback(() => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  }, [newTag, formData.tags]);

  const removeTag = useCallback((tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  }, [formData.tags]);

  // Fonction utilitaire pour convertir les valeurs vides en undefined
  const toOptionalString = (value: string): string | undefined => {
    return value.trim() || undefined;
  };

  // Fonction utilitaire pour les dates optionnelles
  const toOptionalDate = (value: string): string | undefined => {
    return value || undefined;
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Utilisateur non connecté');
      return;
    }

    if (formData.items.length === 0) {
      setError('Veuillez ajouter au moins un article');
      return;
    }

    // Validation du nom du client
    if (!formData.clientName.trim()) {
      setError('Le nom du client est obligatoire');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const invoiceNumber = await generateInvoiceNumber();
      
      // Préparer les données avec les types corrects
      const invoiceData = {
        number: invoiceNumber,
        pressingId: user.pressingId,
        clientName: capitalizeWords(formData.clientName.trim()),
        clientPhone: toOptionalString(formData.clientPhone),
        clientEmail: toOptionalString(formData.clientEmail),
        clientAddress: toOptionalString(formData.clientAddress),
        items: formData.items,
        subtotal,
        discount: formData.discount || undefined,
        discountType: formData.discountType,
        tax: formData.tax || undefined,
        total,
        status: 'active' as const,
        paid: false,
        withdrawn: false,
        urgency: formData.urgency,
        depositDate: formData.depositDate,
        estimatedReadyDate: toOptionalDate(formData.estimatedReadyDate),
        notes: toOptionalString(formData.notes),
        tags: formData.tags.length > 0 ? formData.tags : undefined,
        createdBy: user.id,
        createdByName: user.fullName,
      };

      const invoice = await createInvoice(invoiceData);

      // Redirection vers la page de détail de la facture créée
      router.push(`/invoices/${invoice.id}`);
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      setError(error.message || 'Erreur lors de la création de la facture');
    } finally {
      setIsSubmitting(false);
    }
  };

  // État de chargement
  if (articlesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des articles...</p>
        </div>
      </div>
    );
  }

  // Vérification des permissions
  if (user && !permissions.canCreateInvoice) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-600" />
        <h2 className="text-xl font-semibold mb-2">Accès non autorisé</h2>
        <p className="text-muted-foreground mb-4">
          Vous n'avez pas la permission de créer des factures.
        </p>
        <Button onClick={() => router.push('/dashboard')}>
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Nouvelle facture</h1>
          <p className="text-muted-foreground">
            Créer une nouvelle facture de pressing
          </p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Annuler
        </Button>
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
                  onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, clientAddress: e.target.value }))}
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
                  <Button type="button" disabled={isSubmitting}>
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
                          disabled={isSubmitting}
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
                        disabled={isSubmitting}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                        disabled={isSubmitting}
                      />
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateItemQuantity(index, item.quantity + 1)}
                        disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
                      disabled={isSubmitting}
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
                    setFormData(prev => ({ ...prev, urgency: value }))
                  }
                  disabled={isSubmitting}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, depositDate: e.target.value }))}
                      className="pl-10"
                      required
                      disabled={isSubmitting}
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
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedReadyDate: e.target.value }))}
                      className="pl-10"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Instructions spéciales, remarques..."
                  rows={3}
                  disabled={isSubmitting}
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
                        disabled={isSubmitting}
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
                    disabled={isSubmitting}
                  />
                  <Button 
                    type="button" 
                    onClick={addTag} 
                    disabled={!newTag.trim() || isSubmitting}
                  >
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
                    onChange={(e) => setFormData(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <Label htmlFor="discountType">Type</Label>
                  <Select
                    value={formData.discountType}
                    onValueChange={(value: 'amount' | 'percentage') =>
                      setFormData(prev => ({ ...prev, discountType: value }))
                    }
                    disabled={isSubmitting}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                  disabled={isSubmitting}
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
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Annuler
          </Button>
          
          <Button
            type="submit"
            disabled={isSubmitting || formData.items.length === 0 || !formData.clientName.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Création...' : 'Créer la facture'}
          </Button>
        </div>
      </form>
    </div>
  );
}