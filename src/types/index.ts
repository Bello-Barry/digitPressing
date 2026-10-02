// =============================================================================
// TYPES PRINCIPAUX - Digit PRESSING / SAAS PRESSING
// =============================================================================

// Types utilisateur et authentification
export type UserRole = 'owner' | 'manager' | 'cashier' | 'delivery' | 'employee' | 'caissier';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  pressingId: string;
  organizationId?: string;
  fullName: string;
  phone?: string | null;
  permissions: Permission[];
  createdAt: string;
  lastLogin?: string | null;
  isActive: boolean;
}

export interface Permission {
  action: 'create_invoice' | 'cancel_invoice' | 'view_revenue' | 'manage_users' | 'modify_prices' | 'export_data' | 'create_order' | 'cancel_order' | 'manage_team';
  granted: boolean;
  [key: string]: unknown;
}

export type UserPermission = Permission;

export interface UserFilters {
  role?: UserRole[];
  isActive?: boolean;
  search?: string;
  searchTerm?: string;
}

export interface UserSort {
  field: 'fullName' | 'email' | 'role' | 'createdAt' | 'lastLogin';
  direction: 'asc' | 'desc';
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

// Types multi-tenant organisation
export interface Organization {
  id: string;
  name: string;
  slug: string;
  ticketPrefix: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  currency: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Types pressing
export interface Pressing {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
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
  [key: string]: unknown;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
  [key: string]: unknown;
}

export interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
}

// Types articles
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
  customizable?: boolean;
  isActive: boolean;
  pressingId: string;
  organizationId?: string;
  description?: string | null;
  estimatedDays?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleFilters {
  category?: ArticleCategory[];
  isActive?: boolean;
  search?: string;
  searchTerm?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface ArticleSort {
  field: 'name' | 'category' | 'defaultPrice' | 'createdAt';
  direction: 'asc' | 'desc';
}

// Types factures / commandes
export type InvoiceStatus = 'active' | 'cancelled';
export type UrgencyLevel = 'normal' | 'express' | 'urgent';
export type PaymentMethod = 'cash' | 'card' | 'check' | 'transfer' | 'mobile_money';

export interface Invoice {
  id: string;
  number: string;
  pressingId: string;
  organizationId?: string;
  
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  
  items: InvoiceItem[];
  subtotal: number;
  discount?: number | null;
  discountType?: 'amount' | 'percentage' | null;
  tax?: number | null;
  total: number;
  
  status: InvoiceStatus;
  paid: boolean;
  withdrawn: boolean;
  paymentMethod?: PaymentMethod | null;
  depositDate: string;
  paymentDate?: string | null;
  withdrawalDate?: string | null;
  estimatedReadyDate?: string | null;
  
  createdBy: string;
  createdByName: string;
  modifiedBy?: string | null;
  modifiedByName?: string | null;
  modifiedAt?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  
  notes?: string | null;
  urgency: UrgencyLevel;
  tags?: string[] | null;
  
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  articleId: string;
  name: string;
  category: string;
  quantity: number;
  unitPrice: number;
  id?: string;
  articleName?: string;
  totalPrice?: number;
  specialInstructions?: string | null;
  completed?: boolean;
  completedAt?: string | null;
  [key: string]: unknown;
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
  date: string;
  pressingId: string;
  organizationId?: string;
  
  depositInvoices?: Invoice[];
  withdrawalInvoices?: Invoice[];
  
  depositTotal: number;
  withdrawalTotal: number;
  dailyTotal: number;
  
  totalTransactions: number;
  averageTicket: number;
  employeeBreakdown?: EmployeeRevenue[];
  paymentMethodBreakdown?: PaymentMethodBreakdown[];
  categoryBreakdown?: CategoryBreakdown[];

  categories?: Record<string, number>;
  paymentMethods?: Record<string, number>;
}

export interface RevenueFilters {
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: PaymentMethod[];
  employeeId?: string;
}

export interface RevenueStats {
  totalRevenue: number;
  depositTotal: number;
  withdrawalTotal: number;
  totalTransactions: number;
  averageTicket: number;
  dailyAverage?: number;
  growthRate?: number;
}

export interface RevenueChartData {
  date: string;
  amount: number;
  deposits: number;
  withdrawals: number;
  value?: number;
  label?: string;
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
  month: string;
  pressingId: string;
  totalRevenue: number;
  totalTransactions: number;
  averageTicket: number;
  dailyBreakdown: DailyRevenue[];
  topArticles: TopArticle[];
  growthRate?: number;
}

export interface TopArticle {
  articleId: string;
  articleName: string;
  category: ArticleCategory;
  totalSold: number;
  totalRevenue: number;
  averagePrice: number;
}

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
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  pressingId: string;
  organizationId?: string;
  totalInvoices: number;
  totalSpent: number;
  lastVisit?: string | null;
  notes?: string | null;
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
  error?: string | null;
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

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
  lastUpdated?: string | null;
}

export interface FormState<T> extends LoadingState {
  data: T;
  isDirty: boolean;
  isValid: boolean;
  errors: Record<string, string>;
}

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

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
export type ExportType = 'invoices' | 'revenue' | 'clients' | 'articles';

export interface ExportOptions {
  format: ExportFormat;
  type: ExportType;
  period?: ReportPeriod;
  filters?: Record<string, unknown>;
  includeDetails: boolean;
}

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

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

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