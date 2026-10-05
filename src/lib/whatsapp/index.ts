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
 * Règles par indicatif pays.
 * Congo-Brazzaville (242) : le 0 initial FAIT PARTIE du numéro
 * (ex. 06 731 1016 -> +242 06 731 1016). Il ne doit jamais être retiré.
 * Pour un autre pays où le 0 est un préfixe local à retirer, laisser false.
 */
const COUNTRY_RULES: Record<string, { keepLeadingZero: boolean }> = {
  '242': { keepLeadingZero: true },
};

/**
 * Corrige un numéro déjà international qui commence par l'indicatif du pays :
 * si le 0 manque (ancien format à 8 chiffres), on le rajoute pour le Congo.
 */
function fixCountryNumber(digits: string, countryCode: string): string {
  if (!digits.startsWith(countryCode)) return digits;
  const keepZero = COUNTRY_RULES[countryCode]?.keepLeadingZero ?? false;
  const national = digits.slice(countryCode.length);
  if (keepZero && national.length === 8) {
    return `${countryCode}0${national}`;
  }
  return digits;
}

/**
 * Normalise un numéro de téléphone au format international sans "+".
 *
 * Exemples (Congo) :
 *  '06 731 1016'        -> '242067311016'
 *  '067311016'          -> '242067311016'
 *  '+242 06 766 2712'   -> '242067662712'
 *  '00242067311016'     -> '242067311016'
 *  '67311016' (8 chiffres, ancien format) -> '242067311016'
 *  '+223 96 22 90 14'   -> '22396229014' (numéro étranger conservé tel quel)
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode = '242'): string {
  if (!phone) return '';

  const raw = phone.trim();
  let digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';

  // Préfixe international explicite : "+..." ou "00..."
  const isInternational = raw.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);

  if (isInternational) {
    return fixCountryNumber(digits, defaultCountryCode);
  }

  // Indicatif saisi sans "+" (ex. 242067311016)
  if (digits.startsWith(defaultCountryCode)) {
    return fixCountryNumber(digits, defaultCountryCode);
  }

  const keepZero = COUNTRY_RULES[defaultCountryCode]?.keepLeadingZero ?? false;

  // Format local commençant par 0 (ex. 067311016)
  if (digits.startsWith('0')) {
    return keepZero
      ? `${defaultCountryCode}${digits}` // Congo : on garde le 0
      : `${defaultCountryCode}${digits.slice(1)}`; // autres pays : on retire le 0
  }

  // Local sans le 0 (ex. 67311016, ancien format à 8 chiffres)
  return keepZero
    ? `${defaultCountryCode}0${digits}`
    : `${defaultCountryCode}${digits}`;
}

/**
 * Vérifie qu'un numéro normalisé est un mobile congolais valide.
 * Format attendu : 242 + 0 + [4-6] + 7 chiffres (12 chiffres au total).
 * Exemple valide : '242067311016'
 */
export function isValidCongoMobile(normalized: string): boolean {
  return /^2420[4-6]\d{7}$/.test(normalized);
}

/**
 * Formate un numéro pour un affichage lisible
 * Exemple : '242067311016' -> '+242 06 731 1016'
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('242') && cleaned.length === 12) {
    const local = cleaned.slice(3); // ex. 067311016
    return `+242 ${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5)}`;
  }
  return phone;
}

/**
 * Génère le lien direct WhatsApp wa.me
 * Exemple : https://wa.me/242067311016?text=Bonjour...
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
      const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\{${safeKey}\\}`, 'gi');
      // Fonction de remplacement : évite l'interprétation des "$&", "$1", etc.
      result = result.replace(regex, () => String(value));
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
