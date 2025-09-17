'use client';

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
// Import du store invoices - ajustez le chemin selon votre structure
// import { useInvoices, useInvoiceActions } from '@/store/invoices';

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  createdAt: string;
  dueDate?: string;
}

interface RecentInvoicesProps {
  className?: string;
}

// Données de démonstration
const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'FAC-2024-001',
    customerName: 'Marie Dubois',
    totalAmount: 4250,
    status: 'paid',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    invoiceNumber: 'FAC-2024-002',
    customerName: 'Jean Martin',
    totalAmount: 1875,
    status: 'pending',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    invoiceNumber: 'FAC-2024-003',
    customerName: 'Sophie Bernard',
    totalAmount: 3200,
    status: 'pending',
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    invoiceNumber: 'FAC-2024-004',
    customerName: 'Pierre Durand',
    totalAmount: 5600,
    status: 'overdue',
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    invoiceNumber: 'FAC-2024-005',
    customerName: 'Claire Moreau',
    totalAmount: 2100,
    status: 'paid',
    createdAt: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(),
  },
];

const statusConfig = {
  pending: {
    label: 'En attente',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
  },
  paid: {
    label: 'Payée',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  overdue: {
    label: 'En retard',
    color: 'bg-red-100 text-red-800',
    icon: AlertCircle,
  },
  cancelled: {
    label: 'Annulée',
    color: 'bg-gray-100 text-gray-800',
    icon: AlertCircle,
  },
};

export const RecentInvoices: React.FC<RecentInvoicesProps> = ({ 
  className 
}) => {
  // Décommentez et ajustez selon votre store invoices
  // const { invoices, isLoading } = useInvoices();
  // const { fetchInvoices } = useInvoiceActions();
  
  // useEffect(() => {
  //   fetchInvoices({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' });
  // }, [fetchInvoices]);

  // Pour l'instant, utilisez les données mock
  const invoices = mockInvoices;
  const isLoading = false;
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Factures récentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-32" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-24" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-20" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-16" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Factures récentes</CardTitle>
          <Button variant="outline" size="sm">
            Voir tout
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Eye className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-muted-foreground">Aucune facture récente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.slice(0, 5).map((invoice, index) => {
              const statusInfo = statusConfig[invoice.status];
              const StatusIcon = statusInfo.icon;
              
              return (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      statusInfo.color
                    )}>
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                        <Badge variant="outline" className={statusInfo.color}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invoice.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCurrency(invoice.totalAmount)}
                    </p>
                    <Button variant="ghost" size="sm" className="mt-1">
                      <Eye className="h-3 w-3 mr-1" />
                      Voir
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};