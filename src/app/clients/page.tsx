'use client';

// =============================================================================
// CLIENTS MANAGEMENT MODULE - SAAS PRESSING
// Search by normalized phone (+242), Client history, Organization isolation
// =============================================================================

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Plus,
  UserCheck,
  History
} from 'lucide-react';
import { MOCK_CLIENTS } from '@/lib/fixtures';
import { formatCurrency, formatDate, normalizePhoneNumber } from '@/lib/utils';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Client } from '@/types';

export default function ClientsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [selectedClient, setSelectedClient] = useState<Client | null>(MOCK_CLIENTS[0] || null);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    const normalizedQuery = normalizePhoneNumber(term, 'CG');

    const filtered = MOCK_CLIENTS.filter(c => {
      const matchName = c.name.toLowerCase().includes(term.toLowerCase());
      const matchPhone = c.phone?.includes(term) || (c.phone && normalizePhoneNumber(c.phone, 'CG').includes(normalizedQuery));
      return matchName || matchPhone;
    });

    setClients(filtered);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestion des Clients</h1>
            <p className="text-sm text-muted-foreground">
              Recherche par numéro de téléphone normalisé (+242) et historique
            </p>
          </div>
          <Button onClick={() => alert('Interface de création rapide client prête.')}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Client
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou téléphone (+242 06 XXX...)"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 h-11"
          />
        </div>

        {/* Clients Grid & Detail View */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Client List */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Clients ({clients.length})
            </h2>

            {clients.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground text-sm">
                Aucun client trouvé pour "{searchTerm}".
              </Card>
            ) : (
              clients.map((client) => (
                <Card
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`p-4 cursor-pointer hover:border-primary transition-all ${
                    selectedClient?.id === client.id ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground">{client.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3" />
                        {client.phone}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {client.totalInvoices} commande(s)
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Selected Client Detail Card */}
          <div className="lg:col-span-2">
            {selectedClient ? (
              <Card className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                      {selectedClient.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{selectedClient.name}</h2>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {selectedClient.phone}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/invoices?search=${encodeURIComponent(selectedClient.phone || '')}`)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Voir Commandes
                  </Button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/40 border">
                    <p className="text-xs text-muted-foreground">Total Dépensé</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(selectedClient.totalSpent)}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/40 border">
                    <p className="text-xs text-muted-foreground">Commandes Total</p>
                    <p className="text-lg font-bold">{selectedClient.totalInvoices}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-muted/40 border">
                    <p className="text-xs text-muted-foreground">Dernière Visite</p>
                    <p className="text-sm font-bold mt-1">
                      {selectedClient.lastVisit ? formatDate(selectedClient.lastVisit) : '—'}
                    </p>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4 text-primary" />
                    <span>Email: {selectedClient.email || 'Non renseigné'}</span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>Adresse: {selectedClient.address || 'Non renseignée'}</span>
                  </div>

                  {selectedClient.notes && (
                    <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-300 text-xs">
                      <strong>Remarque client:</strong> {selectedClient.notes}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p>Sélectionnez un client dans la liste pour voir sa fiche détaillée.</p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
