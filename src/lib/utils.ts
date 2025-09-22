import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// =============================================================================
// FONCTIONS DE FORMATAGE
// =============================================================================

/**
 * Formate un montant en devise (Euro)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Formate une date au format français
 */
export function formatDate(
  date: string | Date, 
  format: 'short' | 'long' | 'dd/MM' | 'dd/MM/yyyy' | 'MMM yyyy' = 'short'
): string {
  const _dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Date invalide';
  }

  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString('fr-FR');
    case 'long':
      return dateObj.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'dd/MM':
      return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
      });
    case 'dd/MM/yyyy':
      return dateObj.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    case 'MMM yyyy':
      return dateObj.toLocaleDateString('fr-FR', {
        month: 'short',
        year: 'numeric',
      });
    default:
      return dateObj.toLocaleDateString('fr-FR');
  }
}

/**
 * Formate une date et heure
 */
export function formatDateTime(date: string | Date): string {
  const _dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Date invalide';
  }

  return dateObj.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formate une date relative (il y a X jours)
 */
export function formatRelativeDate(date: string | Date): string {
  const _dateObj = typeof date === 'string' ? new Date(date) : date;
  const _now = new Date();
  const _diffInMs = now.getTime() - dateObj.getTime();
  const _diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return "Aujourd'hui";
  } else if (diffInDays === 1) {
    return 'Hier';
  } else if (diffInDays < 7) {
    return `Il y a ${diffInDays} jours`;
  } else if (diffInDays < 30) {
    const _weeks = Math.floor(diffInDays / 7);
    return weeks === 1 ? 'Il y a 1 semaine' : `Il y a ${weeks} semaines`;
  } else if (diffInDays < 365) {
    const _months = Math.floor(diffInDays / 30);
    return months === 1 ? 'Il y a 1 mois' : `Il y a ${months} mois`;
  } else {
    const _years = Math.floor(diffInDays / 365);
    return years === 1 ? 'Il y a 1 an' : `Il y a ${years} ans`;
  }
}

// =============================================================================
// FONCTIONS DE VALIDATION
// =============================================================================

/**
 * Valide une adresse email
 */
export function isValidEmail(email: string): boolean {
  const _emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valide un numéro de téléphone français
 */
export function isValidPhone(phone: string): boolean {
  // Accepte les formats: 06 12 34 56 78, 06.12.34.56.78, 0612345678, +33612345678
  const _phoneRegex = /^(?:\+33|0)[1-9](?:[0-9]{8})$/;
  const _cleanPhone = phone.replace(/[\s.-]/g, '');
  return phoneRegex.test(cleanPhone);
}

// =============================================================================
// FONCTIONS DE FORMATAGE DE TEXTE
// =============================================================================

/**
 * Met en forme un texte avec la première lettre de chaque mot en majuscule
 */
export function capitalizeWords(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Génère un slug à partir d'un texte
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâäãåą]/g, 'a')
    .replace(/[èéêëę]/g, 'e')
    .replace(/[ìíîïį]/g, 'i')
    .replace(/[òóôöõø]/g, 'o')
    .replace(/[ùúûüų]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[ñń]/g, 'n')
    .replace(/[çć]/g, 'c')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim('-');
}

// =============================================================================
// FONCTIONS DE CALCUL POUR LES FACTURES
// =============================================================================

export interface InvoiceItem {
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface Invoice {
  items: InvoiceItem[];
  discount?: number;
  tax?: number;
}

/**
 * Calcule le total d'une facture
 */
export function calculateInvoiceTotal(invoice: Invoice): number {
  const _subtotal = invoice.items.reduce((sum, item) => {
    const _itemTotal = item.quantity * item.unitPrice;
    const _itemDiscount = (item.discount || 0) / 100;
    return sum + (itemTotal * (1 - itemDiscount));
  }, 0);

  // Appliquer la remise globale
  const _globalDiscount = (invoice.discount || 0) / 100;
  const _afterDiscount = subtotal * (1 - globalDiscount);

  // Appliquer la taxe
  const _tax = (invoice.tax || 0) / 100;
  return afterDiscount * (1 + tax);
}

/**
 * Calcule le sous-total d'une facture (avant remises et taxes)
 */
export function calculateSubTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
}

/**
 * Calcule le total des remises sur les articles
 */
export function calculateItemsDiscount(items: InvoiceItem[]): number {
  return items.reduce((sum, item) => {
    const _itemTotal = item.quantity * item.unitPrice;
    const _discount = (item.discount || 0) / 100;
    return sum + (itemTotal * discount);
  }, 0);
}

// =============================================================================
// FONCTIONS UTILITAIRES
// =============================================================================

/**
 * Génère un numéro de facture unique
 */
export function generateInvoiceNumber(prefix = 'FAC', year = new Date().getFullYear()): string {
  const _timestamp = Date.now().toString().slice(-6);
  return `${prefix}-${year}-${timestamp}`;
}

/**
 * Génère un code de retrait aléatoire
 */
export function generateWithdrawalCode(): string {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

/**
 * Attend un délai spécifié
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Débounce une fonction
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return function executedFunction(...args: Parameters<T>) {
    const _later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Copie du texte dans le presse-papier
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback pour les navigateurs plus anciens
      const _textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const _result = document.execCommand('copy');
      textArea.remove();
      return result;
    }
  } catch (error) {
    console.error('Erreur lors de la copie:', error);
    return false;
  }
}

/**
 * Formate un numéro de téléphone français
 */
export function formatPhoneNumber(phone: string): string {
  const _cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('33')) {
    const _withoutPrefix = cleaned.slice(2);
    return `+33 ${withoutPrefix.replace(/(\d{1})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')}`;
  }
  
  return phone;
}

/**
 * Extrait les initiales d'un nom complet
 */
export function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Détermine si une couleur est claire ou sombre
 */
export function isLightColor(hex: string): boolean {
  const _rgb = parseInt(hex.slice(1), 16);
  const _r = (rgb >> 16) & 0xff;
  const _g = (rgb >>  8) & 0xff;
  const _b = (rgb >>  0) & 0xff;
  
  const _luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luma > 128;
}

/**
 * Génère une couleur aléatoire en hexadécimal
 */
export function generateRandomColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// =============================================================================
// FONCTIONS DE GESTION DES ERREURS
// =============================================================================

/**
 * Formate un message d'erreur pour l'affichage
 */
export function formatErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error_description) {
    return error.error_description;
  }
  
  return 'Une erreur inattendue est survenue';
}

/**
 * Vérifie si une erreur est une erreur réseau
 */
export function isNetworkError(error: any): boolean {
  return (
    error?.code === 'NETWORK_ERROR' ||
    error?.message?.includes('network') ||
    error?.message?.includes('offline') ||
    !navigator.onLine
  );
}