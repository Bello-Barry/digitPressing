// =============================================================================
// TYPES PRINCIPAUX - Digit PRESSING
// =============================================================================

// Types utilisateur et authentification
export type UserRole = 'owner' | 'employee';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  pressingId: string;
  fullName: string;
  permissions: Permission[];
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
}

export interface Permission {
  action: 'create_invoice' | 'cancel_invoice' | 'view_revenue' | 'manage_users' | 'modify_prices' | 'export_data';
  granted: boolean;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// Types pressing
export interface Pressing {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  settings: PressingSettings;
  createdAt: string;
  updatedAt: string;
}

export interface PressingSettings {
  currency: string;
  timezone: string;
  taxRate?: number;
  defaultDiscount?: number;
  businessHours: BusinessHours;
  notifications: NotificationSettings;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface DayHours {
  open: string; // HH:mm format
  close: string; // HH:mm format
  closed: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
}

// Types articles
// Types articles - MISE À JOUR DU TYPE ArticleCategory
export type ArticleCategory = 
  | 'vetement' 
  | 'chaussure' 
  | 'accessoire' 
  | 'maison' 
  | 'traditionnel' 
  | 'delicat' 
  | 'ceremonie' 
  | 'enfant' 
  | 'uniforme' 
  | 'cuir' 
  | 'retouche' 
  | 'special';

export interface Article {
  id: string;
  name: string;
  defaultPrice: number;
  category: ArticleCategory;
  customizable: boolean;
  isActive: boolean;
  pressingId: string;
  description?: string;
  estimatedDays?: number;
  createdAt: string;
  updatedAt: string;
}

// Types factures
export type InvoiceStatus = 'active' | 'cancelled';
export type UrgencyLevel = 'normal' | 'express' | 'urgent';
export type PaymentMethod = 'cash' | 'card' | 'check' | 'transfer';

export interface Invoice {
  // Identifiants
  id: string;
  number: string;
  pressingId: string;
  
  // Informations client
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  
  // Articles et calculs
  items: InvoiceItem[];
  subtotal: number;
  discount?: number;
  discountType?: 'amount' | 'percentage';
  tax?: number;
  total: number;
  
  // États et dates
  status: InvoiceStatus;
  paid: boolean;
  withdrawn: boolean;
  paymentMethod?: PaymentMethod;
  depositDate: string;
  paymentDate?: string;
  withdrawalDate?: string;
  estimatedReadyDate?: string;
  
  // Traçabilité
  createdBy: string;
  createdByName: string;
  modifiedBy?: string;
  modifiedByName?: string;
  modifiedAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  
  // Métadonnées
  notes?: string;
  urgency: UrgencyLevel;
  tags?: string[];
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// CORRECTION PRINCIPALE: InvoiceItem avec les bonnes propriétés
export interface InvoiceItem {
  // Propriétés de base (obligatoires)
  articleId: string;
  name: string;  // Ajouté pour correspondre à votre code
  category: string;  // Ajouté pour correspondre à votre code
  quantity: number;
  unitPrice: number;
  
  // Propriétés optionnelles (pour compatibilité avec l'ancien système)
  id?: string;
  articleName?: string;  // Alias de 'name' pour compatibilité
  totalPrice?: number;
  specialInstructions?: string;
  completed?: boolean;
  completedAt?: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus[];
  paid?: boolean;
  withdrawn?: boolean;
  urgency?: UrgencyLevel[];
  dateFrom?: string;
  dateTo?: string;
  clientName?: string;
  createdBy?: string[];
  minAmount?: number;
  maxAmount?: number;
  tags?: string[];
}

export interface InvoiceSort {
  field: 'number' | 'clientName' | 'total' | 'depositDate' | 'createdAt' | 'estimatedReadyDate';
  direction: 'asc' | 'desc';
}

// Types revenus et statistiques
export interface DailyRevenue {
  date: string; // YYYY-MM-DD
  pressingId: string;
  
  // Factures du jour
  depositInvoices: Invoice[];
  withdrawalInvoices: Invoice[];
  
  // Calculs
  depositTotal: number;
  withdrawalTotal: number;
  dailyTotal: number;
  
  // Statistiques
  totalTransactions: number;
  averageTicket: number;
  employeeBreakdown: EmployeeRevenue[];
  
  // Détail par méthode de paiement
  paymentMethodBreakdown: PaymentMethodBreakdown[];
  
  // Détail par catégorie d'articles
  categoryBreakdown: CategoryBreakdown[];
}

export interface EmployeeRevenue {
  employeeId: string;
  employeeName: string;
  invoiceCount: number;
  revenue: number;
  averageTicket: number;
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  amount: number;
  count: number;
}

export interface CategoryBreakdown {
  category: ArticleCategory;
  amount: number;
  count: number;
  averagePrice: number;
}

export interface MonthlyRevenue {
  month: string; // YYYY-MM
  pressingId: string;
  totalRevenue: number;
  totalTransactions: number;
  averageTicket: number;
  dailyBreakdown: DailyRevenue[];
  topArticles: TopArticle[];
  growthRate?: number; // Comparé au mois précédent
}

export interface TopArticle {
  articleId: string;
  articleName: string;
  category: ArticleCategory;
  totalSold: number;
  totalRevenue: number;
  averagePrice: number;
}

// Types rapports
export interface ReportPeriod {
  startDate: string;
  endDate: string;
  label: string;
}

export interface RevenueReport {
  period: ReportPeriod;
  pressingId: string;
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    averageTicket: number;
    totalCustomers: number;
    returningCustomers: number;
  };
  dailyData: DailyRevenue[];
  employeePerformance: EmployeeRevenue[];
  topArticles: TopArticle[];
  paymentMethods: PaymentMethodBreakdown[];
  categories: CategoryBreakdown[];
}

// Types clients
export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  pressingId: string;
  totalInvoices: number;
  totalSpent: number;
  lastVisit?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientStats {
  totalClients: number;
  newClientsThisMonth: number;
  returningClientsThisMonth: number;
  averageSpentPerClient: number;
  topClients: TopClient[];
}

export interface TopClient {
  clientId: string;
  clientName: string;
  totalSpent: number;
  invoiceCount: number;
  lastVisit: string;
}

// Types audit et logs
export interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'create' | 'update' | 'delete' | 'cancel';
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  userId: string;
  userName: string;
  userRole: UserRole;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Types API et réponses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SearchResponse<T> extends PaginatedResponse<T> {
  query: string;
  filters?: Record<string, unknown>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  };
}

// Types d'erreurs
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ValidationError extends AppError {
  field: string;
  value: unknown;
}

// Types configuration et préférences
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'fr' | 'en';
  currency: string;
  timezone: string;
  notifications: {
    email: boolean;
    push: boolean;
    sound: boolean;
  };
  dashboard: {
    defaultView: 'today' | 'week' | 'month';
    showQuickStats: boolean;
    showRecentInvoices: boolean;
  };
}

// Types pour les hooks et state management
export interface LoadingState {
  isLoading: boolean;
  error?: string;
  lastUpdated?: string;
}

export interface FormState<T> extends LoadingState {
  data: T;
  isDirty: boolean;
  isValid: boolean;
  errors: Record<string, string>;
}

// Types PWA
export interface PWAInstallPrompt {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface OfflineQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: unknown;
  timestamp: string;
  retryCount: number;
}

// Types exports
export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
export type ExportType = 'invoices' | 'revenue' | 'clients' | 'articles';

export interface ExportOptions {
  format: ExportFormat;
  type: ExportType;
  period?: ReportPeriod;
  filters?: Record<string, unknown>;
  includeDetails: boolean;
}

// Types pour les inputs de création/modification
export interface CreateInvoiceInput {
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  items: InvoiceItem[];
  discount?: number;
  discountType?: 'amount' | 'percentage';
  tax?: number;
  urgency: UrgencyLevel;
  depositDate: string;
  estimatedReadyDate?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface UpdateInvoiceInput {
  clientName?: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  items?: InvoiceItem[];
  discount?: number;
  discountType?: 'amount' | 'percentage';
  tax?: number;
  subtotal?: number;
  total?: number;
  urgency?: UrgencyLevel;
  depositDate?: string;
  estimatedReadyDate?: string | null;
  notes?: string | null;
  tags?: string[];
}

// Types utilitaires
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Types pour les composants UI
export interface TableColumn<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: unknown, record: T) => React.ReactNode;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  preventCloseOnOutsideClick?: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}