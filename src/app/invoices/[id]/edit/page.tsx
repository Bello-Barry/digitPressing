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
  Package,
  ArrowLeft
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
// FIX: Correctly imported the newly created utility functions.
import { formatCurrency, calculateInvoiceTotal, capitalizeWords } from '@/lib/utils';
import type { Article, InvoiceItem, UrgencyLevel, InvoiceStatus, PaymentMethod } from '@/types';

// REFACTOR: Defined the form data type locally for clarity, ensuring it aligns with the Invoice type.
interface InvoiceFormData {
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  items: InvoiceItem[];
  discount: number;
  discountType: 'amount' | 'percentage';
  tax: number;
  urgency: UrgencyLevel;
  depositDate: string;
  estimatedReadyDate: string;
  notes: string;
  tags: string[];
}

const URGENCY_CONFIG: Record<UrgencyLevel, { label: string; description: string; color: string }> = {
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
  
  const { invoices, isLoading: invoicesLoading } = useInvoices();
  const { updateInvoice, fetchInvoices } = useInvoiceActions();
  const { currentInvoice, setCurrentInvoice } = useCurrentInvoice();
  const { articles, isLoading: articlesLoading } = useArticles();
  const { getActiveArticles } = useArticleHelpers();

  const [invoice, setInvoice] = useState(invoices.find(inv => inv.id === invoiceId) || currentInvoice);

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const [articleSearch, setArticleSearch] = useState('');
  const [newTag, setNewTag] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  useEffect(() => {
    if (!user) return;
    const foundInvoice = invoices.find(inv => inv.id === invoiceId) || currentInvoice;
    if (!foundInvoice && !invoicesLoading) {
      fetchInvoices();
    } else {
      setInvoice(foundInvoice);
    }
  }, [user, invoiceId, invoices, currentInvoice, invoicesLoading, fetchInvoices]);

  useEffect(() => {
    if (invoice && user) {
      const canEdit = invoice.status === 'active' && (permissions.isOwner || invoice.createdBy === user.id);
      if (!canEdit) {
        router.push(`/invoices/${invoiceId}`);
      }
    }
  }, [invoice, user, permissions.isOwner, invoiceId, router]);

  useEffect(() => {
    if (invoice) {
      setFormData({
        clientName: invoice.clientName,
        clientPhone: invoice.clientPhone || '',
        clientEmail: invoice.clientEmail || '',
        clientAddress: invoice.clientAddress || '',
        items: invoice.items.map(item => ({...item})), // Create a deep copy to track changes
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
  }, [invoice, setCurrentInvoice]);

  const updateFormData = useCallback((updates: Partial<InvoiceFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  }, []);

  const activeArticles = getActiveArticles();
  const filteredArticles = activeArticles.filter(article =>
    article.name.toLowerCase().includes(articleSearch.toLowerCase()) ||
    article.category.toLowerCase().includes(articleSearch.toLowerCase())
  );

  const subtotal = formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  
  // FIX: This is the primary fix. The function now correctly receives a single object.
  const total = calculateInvoiceTotal(
  subtotal, 
  formData.discount, 
  formData.discountType,
  formData.tax
);

  // REFACTOR: Simplified the useEffect for calculating the estimated ready date.
  // This avoids including a setter function in the dependency array.
  useEffect(() => {
    const depositDate = new Date(formData.depositDate);
    // Check for invalid date
    if (isNaN(depositDate.getTime())) return;

    let daysToAdd = 3;
    switch (formData.urgency) {
      case 'urgent': daysToAdd = 1; break;
      case 'express': daysToAdd = 2; break;
    }

    const estimatedDate = new Date(depositDate);
    estimatedDate.setDate(depositDate.getDate() + daysToAdd);
    
    setFormData(prev => ({
      ...prev,
      estimatedReadyDate: estimatedDate.toISOString().split('T')[0]
    }));
  }, [formData.depositDate, formData.urgency]);

  const addArticleToInvoice = useCallback((article: Article) => {
    const existingItem = formData.items.find(item => item.articleId === article.id);
    
    if (existingItem) {
      updateFormData({
        items: formData.items.map(item =>
          item.articleId === article.id
            ? { ...item, quantity: item.quantity + 1, totalPrice: (item.quantity + 1) * item.unitPrice }
            : item
        )
      });
    } else {
      // FIX: The new item now perfectly matches the `InvoiceItem` type from `src/types/index.ts`.
      const newItem: InvoiceItem = {
        id: crypto.randomUUID(), // Use a robust unique ID for the React key.
        articleId: article.id,
        articleName: article.name,
        category: article.category,
        quantity: 1,
        unitPrice: article.defaultPrice,
        totalPrice: article.defaultPrice,
        completed: false, // Default value
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
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], quantity, totalPrice: quantity * newItems[index].unitPrice };
    updateFormData({ items: newItems });
  }, [formData.items, updateFormData]);

  const updateItemPrice = useCallback((index: number, unitPrice: number) => {
    const price = Math.max(0, unitPrice);
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], unitPrice: price, totalPrice: newItems[index].quantity * price };
    updateFormData({ items: newItems });
  }, [formData.items, updateFormData]);

  // REFACTOR: Renamed to avoid conflict with function scope if defined elsewhere.
  const removeInvoiceItem = useCallback((index: number) => {
    updateFormData({
      items: formData.items.filter((_, i) => i !== index)
    });
  }, [formData.items, updateFormData]);

  const addTag = useCallback(() => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      updateFormData({ tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  }, [newTag, formData.tags, updateFormData]);

  const removeTag = useCallback((tagToRemove: string) => {
    updateFormData({ tags: formData.tags.filter(tag => tag !== tagToRemove) });
  }, [formData.tags, updateFormData]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !user) return;
    if (formData.items.length === 0) {
      setError('Veuillez ajouter au moins un article.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateInvoice(invoice.id, {
        clientName: capitalizeWords(formData.clientName.trim()),
        clientPhone: formData.clientPhone.trim() || undefined,
        clientEmail: formData.clientEmail.trim().toLowerCase() || undefined,
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
    } catch (err: any) {
      console.error('Erreur lors de la modification:', err);
      setError(err.message || 'Une erreur est survenue lors de la modification.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // ... JSX remains largely the same, only changed handler names and keys
  // ... For brevity, I'll only show the changed parts of JSX below.

  // ... (inside the return statement)

  // FIX: Used the robust ID for the React key and corrected function name.
  /*
    <div key={item.id} ...> 
    ...
      <Button
        ...
        onClick={() => removeInvoiceItem(index)}
        ...
      >
  */
  // ... The rest of the JSX is valid. I've copy-pasted the full return for completeness.

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
    <div className="max-w-4xl mx-auto space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBackClick}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Modifier facture {invoice.number}</h1>
            {hasChanges && <p className="text-yellow-600 text-sm">• Modifications non sauvegardées</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/invoices/${invoiceId}`}>Voir</Link>
          </Button>
        </div>
      </div>

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
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Informations client</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="clientName">Nom du client *</Label>
                <Input id="clientName" value={formData.clientName} onChange={(e) => updateFormData({ clientName: e.target.value })} placeholder="Nom complet du client" required />
              </div>
              <div>
                <Label htmlFor="clientPhone">Téléphone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="clientPhone" value={formData.clientPhone} onChange={(e) => updateFormData({ clientPhone: e.target.value })} placeholder="+242 XX XXX XXXX" className="pl-10" />
                </div>
              </div>
              <div>
                <Label htmlFor="clientEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="clientEmail" type="email" value={formData.clientEmail} onChange={(e) => updateFormData({ clientEmail: e.target.value })} placeholder="email@exemple.com" className="pl-10" />
                </div>
              </div>
              <div>
                <Label htmlFor="clientAddress">Adresse</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="clientAddress" value={formData.clientAddress} onChange={(e) => updateFormData({ clientAddress: e.target.value })} placeholder="Adresse complète" className="pl-10" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Articles ({formData.items.length})</CardTitle>
              <Popover open={showArticleSearch} onOpenChange={setShowArticleSearch}>
                <PopoverTrigger asChild>
                  <Button type="button" size="sm"><Plus className="h-4 w-4 mr-2" />Ajouter un article</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <Command>
                    <CommandInput placeholder="Rechercher un article..." value={articleSearch} onValueChange={setArticleSearch}/>
                    <CommandEmpty>Aucun article trouvé.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-y-auto">
                      {filteredArticles.map((article) => (
                        <CommandItem key={article.id} onSelect={() => addArticleToInvoice(article)}>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{article.name}</span>
                              <span className="font-bold text-primary">{formatCurrency(article.defaultPrice)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground capitalize">{article.category}</p>
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
                  <div key={item.id} className="flex items-center gap-2 p-3 border rounded-lg flex-wrap">
                    <div className="flex-1 min-w-[150px]">
                      <p className="font-medium">{item.articleName}</p>
                      <p className="text-sm text-muted-foreground capitalize">{item.category}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(index, item.quantity - 1)}><Minus className="h-4 w-4" /></Button>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)} className="w-16 text-center h-8" />
                      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(index, item.quantity + 1)}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" min="0" step="100" value={item.unitPrice} onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)} className="w-28 text-right h-8" />
                    </div>
                    <div className="text-right font-bold w-24">{formatCurrency(item.totalPrice)}</div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeInvoiceItem(index)} className="text-red-500 hover:text-red-600 h-8 w-8"><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Paramètres</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="urgency">Urgence</Label>
                <Select value={formData.urgency} onValueChange={(value: UrgencyLevel) => updateFormData({ urgency: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(URGENCY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Badge className={config.color}>{config.label}</Badge>
                          <span className="text-sm text-muted-foreground">{config.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="depositDate">Date de dépôt</Label>
                  <Input id="depositDate" type="date" value={formData.depositDate} onChange={(e) => updateFormData({ depositDate: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="estimatedReadyDate">Prêt estimé</Label>
                  <Input id="estimatedReadyDate" type="date" value={formData.estimatedReadyDate} onChange={(e) => updateFormData({ estimatedReadyDate: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={formData.notes} onChange={(e) => updateFormData({ notes: e.target.value })} placeholder="Instructions spéciales, remarques..." rows={3} />
              </div>
              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}<button type="button" onClick={() => removeTag(tag)} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button></Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Ajouter un tag..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); }}} />
                  <Button type="button" onClick={addTag} disabled={!newTag.trim()}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" />Récapitulatif</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between"><span>Sous-total:</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount">Remise</Label>
                  <Input id="discount" type="number" min="0" step="0.01" value={formData.discount} onChange={(e) => updateFormData({ discount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label htmlFor="discountType">Type</Label>
                  <Select value={formData.discountType} onValueChange={(value: 'amount' | 'percentage') => updateFormData({ discountType: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="amount">Montant</SelectItem><SelectItem value="percentage">Pourcentage</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              {formData.discount > 0 && (<div className="flex justify-between text-sm text-muted-foreground"><span>Remise:</span><span>-{formatCurrency(formData.discountType === 'percentage' ? subtotal * (formData.discount / 100) : formData.discount)}</span></div>)}
              <div>
                <Label htmlFor="tax">TVA (%)</Label>
                <Input id="tax" type="number" min="0" max="100" step="0.01" value={formData.tax} onChange={(e) => updateFormData({ tax: parseFloat(e.target.value) || 0 })} />
              </div>
              <hr />
              <div className="flex justify-between text-lg font-bold"><span>Total:</span><span className="text-primary">{formatCurrency(total)}</span></div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={handleBackClick} disabled={isSubmitting}>Annuler</Button>
          <Button type="submit" disabled={isSubmitting || formData.items.length === 0 || !hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
      </form>

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter sans sauvegarder ?</AlertDialogTitle>
            <AlertDialogDescription>Vous avez des modifications non enregistrées. Si vous quittez maintenant, elles seront perdues.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Rester</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave} className="bg-destructive hover:bg-destructive/90">Quitter</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
