// =============================================================================
// LIB WHATSAPP - DIGIT PRESSING (CONGO-BRAZZAVILLE)
// Aucun appel d'API externe payant : génération de liens directs wa.me
// =============================================================================

export interface WhatsAppTemplateVars {
  nom?: string;
  code?: string;
  ticket?: string;
  montant?: string | number;
  reste_a_payer?: string | number;
  lien_facture?: string;
  lien_suivi?: string;
  date?: string;
  pressing_nom?: string;
  pressing_tel?: string;
  [key: string]: string | number | undefined;
}

/**
 * Normalise un numéro de téléphone pour le Congo (ou autre pays)
 * Exemple : '06 731 1016' -> '242067311016'
 * Exemple : '+242 06 766 2712' -> '242067662712'
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode = '242'): string {
  if (!phone) return '';

  // Supprime tous les caractères non numériques
  let cleaned = phone.replace(/[^0-9]/g, '');

  // Si commence par l'indicatif pays sans le + (ex: 24206...)
  if (cleaned.startsWith(defaultCountryCode)) {
    return cleaned;
  }

  // Si commence par un zéro local (ex: 067311016)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
    return `${defaultCountryCode}${cleaned}`;
  }

  // Si déjà au format local à 9 chiffres sans le 0 (ex: 67311016)
  if (cleaned.length === 8 || cleaned.length === 9) {
    return `${defaultCountryCode}${cleaned}`;
  }

  return cleaned;
}

/**
 * Formate un numéro pour un affichage lisible
 * Exemple : '242067311016' -> '+242 06 731 1016'
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('242') && cleaned.length >= 11) {
    const num = cleaned.substring(3);
    return `+242 0${num.slice(0, 1)} ${num.slice(1, 4)} ${num.slice(4)}`;
  }
  return phone;
}

/**
 * Génère le lien direct WhatsApp wa.me
 */
export function generateWhatsAppLink(
  phone: string,
  message: string,
  countryCode = '242'
): string {
  const normalized = normalizePhoneNumber(phone, countryCode);
  const encodedText = encodeURIComponent(message.trim());
  return `https://wa.me/${normalized}?text=${encodedText}`;
}

/**
 * Remplace les variables {nom}, {code}, etc. dans un modèle de message
 */
export function renderWhatsAppMessage(
  template: string,
  vars: WhatsAppTemplateVars
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined && value !== null) {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regex, String(value));
    }
  }
  return result;
}

/**
 * Modèles de messages prédéfinis conformes à copilote.md
 */
export const DEFAULT_MESSAGE_TEMPLATES = {
  // Confirmation de demande en ligne par le client
  CLIENT_ORDER_CONFIRMATION:
`Bonjour {pressing_nom} 👋
Je confirme ma demande de pressing *{code}* pour *{nom}*.
Montant estimé : {montant} FCFA.
Merci de me contacter dès réception de mes articles !`,

  // Envoi de la facture / ticket au client après validation
  INVOICE_SENT:
`Bonjour {nom} 👋
Votre commande de pressing a été validée avec succès chez *{pressing_nom}* !
🎫 Ticket officiel : *{ticket}*
💰 Montant total : *{montant} FCFA*
💳 Reste à payer : *{reste_a_payer} FCFA*
📄 Consultez et imprimez votre facture ici :
{lien_facture}

Merci de votre fidélité !`,

  // Commande prête
  ORDER_READY:
`Bonjour {nom} 👋
Bonne nouvelle ! Vos articles pour le ticket *{ticket}* sont lavés, repassés et prêts à être récupérés chez *{pressing_nom}*.
💳 Reste à régler : *{reste_a_payer} FCFA*.
À très bientôt !`,

  // Ramassage prévu à domicile
  PICKUP_SCHEDULED:
`Bonjour {nom} 👋
Notre coursier de *{pressing_nom}* passera récupérer vos articles le *{date}*.
Demande : *{code}*.
Merci de préparer vos vêtements. À tout de suite !`,

  // Livraison en cours
  DELIVERY_IN_PROGRESS:
`Bonjour {nom} 👋
Vos articles (Ticket *{ticket}*) sont en cours de livraison chez vous !
Notre livreur vous contactera très rapidement.
Montant à régler à la livraison : *{reste_a_payer} FCFA*.`,

  // Résumé journalier pour le propriétaire (anti-détournement)
  DAILY_SUMMARY_OWNER:
`📊 *RAPPORT JOURNALIER DU {date} — {pressing_nom}*
---------------------------------------
💰 Chiffre d'Affaires du jour : *{ca_jour} FCFA*
💵 Espèces encaissées : *{especes} FCFA*
📱 Mobile Money encaissé : *{momo} FCFA*
📦 Commandes créées : *{nb_commandes}*
👕 Articles traités : *{nb_articles}*
🚫 Annulations : *{nb_annulations}*
⚠️ Écart de caisse : *{ecart_caisse} FCFA*
---------------------------------------
Vérification effectuée via Digit Pressing.`
};
