'use client';

// =============================================================================
// PAGE DÉTAIL DE FACTURE - Digit PRESSING
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Edit, 
  Printer, 
  Download,
  Share2,
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Phone,
  Mail,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
  MoreHorizontal,
  ArrowLeft,
  Copy,
  Trash2
} from 'lucide-react';
import { 
  useInvoices,
  useInvoiceActions,
  useCurrentInvoice
} from '@/store/invoices';
import { useAuth, useUserPermissions } from '@/store/auth';
import { usePressing } from '@/store/settings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  formatCurrency, 
  formatDate, 
  formatDateTime, 
  formatRelativeDate, 
  capitalizeWords 
} from '@/lib/utils';
import type { Invoice } from '@/types';

const _URGENCY_CONFIG = {
  normal: { label: 'Normal', color: 'bg-gray-100 text-gray-800' },
  express: { label: 'Express', color: 'bg-yellow-100 text-yellow-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
};

const _STATUS_CONFIG = {
  active: { label: 'Active', icon: CheckCircle, color: 'text-green-600' },
  cancelled: { label: 'Annulée', icon: XCircle, color: 'text-red-600' },
};

const _PAYMENT_METHODS = {
  cash: 'Espèces',
  card: 'Carte bancaire',
  check: 'Chèque',
  transfer: 'Virement',
  mobile_money: 'Mobile Money',
};

export default function InvoiceDetailPage() {
  const _params = useParams();
  const _router = useRouter();
  const _invoiceId = params?.id as string;
  
  const { user } = useAuth();
  const _permissions = useUserPermissions();
  const { pressing } = usePressing();
  
  // États des stores
  const { invoices, isLoading } = useInvoices();
  const { currentInvoice, setCurrentInvoice } = useCurrentInvoice();
  const { 
    cancelInvoice, 
    markAsPaid, 
    markAsWithdrawn, 
    duplicateInvoice,
    fetchInvoices 
  } = useInvoiceActions();

  // États locaux
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const _printRef = useRef<HTMLDivElement>(null);

  // Récupérer la facture
  const _invoice = invoices.find(inv => inv.id === invoiceId) || currentInvoice;

  // Charger la facture si pas trouvée
  useEffect(() => {
    if (!invoice && !isLoading && user) {
      fetchInvoices();
    }
  }, [invoice, isLoading, user, fetchInvoices]);

  // Mettre à jour la facture courante
  useEffect(() => {
    if (invoice && (!currentInvoice || currentInvoice.id !== invoiceId)) {
      setCurrentInvoice(invoice);
    }
  }, [invoice, currentInvoice, invoiceId, setCurrentInvoice]);

  // Vérifications
  const _canEdit = invoice?.status === 'active' && (
    permissions.isOwner || 
    invoice.createdBy === user?.id
  );

  const _canCancel = invoice?.status === 'active' && (
    permissions.isOwner || 
    permissions.canCancelInvoice
  );

  // Actions
  const _handleCancelInvoice = async () => {
    if (!invoice || !cancelReason.trim()) return;

    setIsProcessing(true);
    try {
      await cancelInvoice(invoice.id, cancelReason);
      setShowCancelDialog(false);
      setCancelReason('');
    } catch (error) {
      console.error('Erreur lors de l\'annulation:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const _handleMarkAsPaid = async () => {
    if (!invoice) return;

    setIsProcessing(true);
    try {
      await markAsPaid(invoice.id, paymentMethod, paymentDate);
      setShowPaymentDialog(false);
    } catch (error) {
      console.error('Erreur lors du marquage payé:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const _handleMarkAsWithdrawn = async () => {
    if (!invoice) return;

    setIsProcessing(true);
    try {
      await markAsWithdrawn(invoice.id);
    } catch (error) {
      console.error('Erreur lors du marquage retiré:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const _handleDuplicate = async () => {
    if (!invoice) return;

    try {
      const _duplicated = await duplicateInvoice(invoice.id);
      router.push(`/invoices/${duplicated.id}/edit`);
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
    }
  };

  const _handlePrint = () => {
    if (printRef.current) {
      const printContent = printRef.current.innerHTML;
      const _originalContent = document.body.innerHTML;
      
      document.body.innerHTML = printContent;
      window.print();
      document.body.innerHTML = originalContent;
      window.location.reload();
    }
  };

  const _handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Facture ${invoice?.number}`,
          text: `Facture ${invoice?.number} - ${formatCurrency(invoice?.total || 0)}`,
          url: window.location.href,
        });
      } catch (error) {
        console.log('Partage annulé');
      }
    } else {
      // Fallback: copier l'URL
      navigator.clipboard.writeText(window.location.href);
    }
  };

  // États de chargement
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement de la facture...</p>
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
          La facture demandée n'existe pas ou vous n'avez pas l'autorisation de la voir.
        </p>
        <Button onClick={() => router.push('/invoices')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux factures
        </Button>
      </div>
    );
  }

  const _StatusIcon = STATUS_CONFIG[invoice.status].icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/invoices')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">Facture {invoice.number}</h1>
              <StatusIcon className={`h-6 w-6 ${STATUS_CONFIG[invoice.status].color}`} />
            </div>
            <p className="text-muted-foreground">
              Créée {formatRelativeDate(invoice.createdAt)} par {invoice.createdByName}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer
          </Button>

          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-2" />
            Partager
          </Button>

          {canEdit && (
            <Button asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Link>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => {}}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {invoice.status === 'active' && !invoice.paid && (
                <DropdownMenuItem onClick={() => setShowPaymentDialog(true)}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marquer payée
                </DropdownMenuItem>
              )}

              {invoice.status === 'active' && invoice.paid && !invoice.withdrawn && (
                <DropdownMenuItem onClick={handleMarkAsWithdrawn}>
                  <Package className="h-4 w-4 mr-2" />
                  Marquer retirée
                </DropdownMenuItem>
              )}

              {canCancel && (
                <DropdownMenuItem
                  onClick={() => setShowCancelDialog(true)}
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

      {/* Contenu imprimable */}
      <div ref={printRef} className="print:shadow-none">
        {/* Informations générales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Informations pressing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pressing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pressing?.logo && (
                <img 
                  src={pressing.logo} 
                  alt={pressing.name}
                  className="h-16 w-auto mb-4"
                />
              )}
              <p className="font-semibold">{pressing?.name}</p>
              {pressing?.address && (
                <p className="text-sm text-muted-foreground">{pressing.address}</p>
              )}
              {pressing?.phone && (
                <p className="text-sm">{pressing.phone}</p>
              )}
              {pressing?.email && (
                <p className="text-sm">{pressing.email}</p>
              )}
            </CardContent>
          </Card>

          {/* Informations client */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-semibold text-lg">{invoice.clientName}</p>
              </div>
              
              {invoice.clientPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{invoice.clientPhone}</span>
                </div>
              )}
              
              {invoice.clientEmail && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{invoice.clientEmail}</span>
                </div>
              )}
              
              {invoice.clientAddress && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{invoice.clientAddress}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Informations facture */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Détails de la commande</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium">Date de dépôt</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(invoice.depositDate)}</span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Prêt estimé</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {invoice.estimatedReadyDate 
                      ? formatDate(invoice.estimatedReadyDate)
                      : 'Non défini'
                    }
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Urgence</Label>
                <div className="mt-1">
                  <Badge className={URGENCY_CONFIG[invoice.urgency].color}>
                    {URGENCY_CONFIG[invoice.urgency].label}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">État</Label>
                <div className="space-y-1 mt-1">
                  <div className="flex gap-2">
                    {invoice.paid ? (
                      <Badge variant="outline" className="text-green-600">
                        Payée
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600">
                        Non payée
                      </Badge>
                    )}
                  </div>
                  {invoice.withdrawn && (
                    <Badge variant="outline" className="text-blue-600">
                      Retirée le {formatDate(invoice.withdrawalDate!)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {invoice.tags && invoice.tags.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {invoice.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {invoice.notes && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Notes</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {invoice.notes}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Articles */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Articles ({invoice.items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoice.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {item.category}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-medium">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Totaux */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Sous-total:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {invoice.discount && invoice.discount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>
                    Remise ({invoice.discountType === 'percentage' ? `${invoice.discount}%` : formatCurrency(invoice.discount)}):
                  </span>
                  <span>
                    -{formatCurrency(
                      invoice.discountType === 'percentage'
                        ? invoice.subtotal * (invoice.discount / 100)
                        : invoice.discount
                    )}
                  </span>
                </div>
              )}

              {invoice.tax && invoice.tax > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TVA ({invoice.tax}%):</span>
                  <span>
                    +{formatCurrency(
                      (invoice.subtotal - (invoice.discount || 0)) * (invoice.tax / 100)
                    )}
                  </span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between text-xl font-bold">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informations de paiement */}
        {invoice.paid && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg text-green-600">Paiement effectué</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Méthode de paiement</Label>
                  <p className="mt-1">
                    {invoice.paymentMethod ? PAYMENT_METHODS[invoice.paymentMethod] : 'Non spécifié'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date de paiement</Label>
                  <p className="mt-1">
                    {invoice.paymentDate ? formatDate(invoice.paymentDate) : 'Non spécifié'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Informations d'annulation */}
        {invoice.status === 'cancelled' && (
          <Card className="mb-6 border-red-200">
            <CardHeader>
              <CardTitle className="text-lg text-red-600">Facture annulée</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {invoice.cancelledAt && (
                  <p className="text-sm">
                    <span className="font-medium">Date d'annulation:</span> {formatDateTime(invoice.cancelledAt)}
                  </p>
                )}
                {invoice.cancelledBy && (
                  <p className="text-sm">
                    <span className="font-medium">Annulée par:</span> {invoice.cancelledBy}
                  </p>
                )}
                {invoice.cancellationReason && (
                  <div>
                    <Label className="text-sm font-medium">Raison:</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {invoice.cancellationReason}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog d'annulation */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la facture</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler cette facture ? Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="cancelReason">Raison de l'annulation</Label>
            <Input
              id="cancelReason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Expliquez pourquoi cette facture est annulée..."
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelInvoice}
              disabled={!cancelReason.trim() || isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Annulation...' : 'Annuler la facture'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de paiement */}
      <AlertDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marquer comme payée</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmez le paiement de cette facture de {formatCurrency(invoice.total)}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="paymentMethod">Méthode de paiement</Label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full mt-2 p-2 border rounded-md"
              >
                {Object.entries(PAYMENT_METHODS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="paymentDate">Date de paiement</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMarkAsPaid}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? 'Traitement...' : 'Confirmer le paiement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}