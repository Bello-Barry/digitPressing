// =============================================================================
// REPOSITORIES ABSTRACTION LAYER - SAAS PRESSING
// Clean interface contract isolating UI from Supabase / Temporary Fixtures
// =============================================================================

import type { Invoice, Client, Article, PaymentMethod, User } from '@/types';

export interface OrderRequestInput {
  clientName: string;
  whatsappPhone: string;
  services: Array<{ articleId: string; quantity: number }>;
  serviceType: 'deposit' | 'withdrawal' | 'both';
  homeDelivery: boolean;
  deliveryAddress?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  notes?: string | null;
  honeypot?: string; // Anti-spam
}

export interface OrderRequestResponse {
  requestCode: string; // e.g. "D-0042"
  clientPhoneNormalized: string;
  createdOrder: Invoice;
}

export interface PaymentInput {
  organizationId: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'CASH' | 'MTN_MOMO' | 'AIRTEL_MONEY' | 'OTHER';
  notes?: string;
  createdBy: string;
}

export interface ReversalPaymentInput {
  organizationId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  reversalReason: string;
  createdBy: string;
}

export interface ShiftClosingInput {
  cashRegisterId: string;
  closedBy: string;
  countedAmount: number;
  expectedAmount: number;
  notes?: string;
}

export interface OrderRepository {
  createPublicRequest(input: OrderRequestInput): Promise<OrderRequestResponse>;
  getOrderByCodeOrPhone(codeOrPhone: string): Promise<Invoice | null>;
  getOrderByToken(token: string): Promise<Invoice | null>;
  listOrders(organizationId: string, filters?: any): Promise<Invoice[]>;
  updateOrderStatus(orderId: string, status: string, updatedBy: string): Promise<Invoice>;
}

export interface ClientRepository {
  findByNormalizedPhone(organizationId: string, phone: string): Promise<Client | null>;
  listClients(organizationId: string): Promise<Client[]>;
  saveClient(organizationId: string, clientData: Partial<Client>): Promise<Client>;
}

export interface ServiceRepository {
  listActiveServices(organizationId: string): Promise<Article[]>;
  saveService(organizationId: string, serviceData: Partial<Article>): Promise<Article>;
  toggleServiceStatus(serviceId: string, isActive: boolean): Promise<Article>;
}

export interface PaymentRepository {
  recordPayment(input: PaymentInput): Promise<any>;
  reversePayment(input: ReversalPaymentInput): Promise<any>;
  listPaymentsForInvoice(invoiceId: string): Promise<any[]>;
}

export interface CashRegisterRepository {
  getCurrentOpenRegister(organizationId: string): Promise<any | null>;
  openRegister(organizationId: string, userId: string, openingBalance: number): Promise<any>;
  closeShift(input: ShiftClosingInput): Promise<any>;
  getRegisterHistory(organizationId: string): Promise<any[]>;
}

export interface TeamRepository {
  listMembers(organizationId: string): Promise<User[]>;
  updateRole(memberId: string, role: 'owner' | 'manager' | 'cashier' | 'delivery'): Promise<User>;
  toggleActive(memberId: string, isActive: boolean): Promise<User>;
}
