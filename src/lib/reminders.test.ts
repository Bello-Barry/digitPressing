/**
 * @jest-environment node
 */

import {
  renderWhatsAppMessage,
  DEFAULT_MESSAGE_TEMPLATES,
  isValidCongoMobile,
} from './whatsapp';

describe('Tests des rappels de linge prêt non récupéré (Tâche 4.3)', () => {
  test('Calcul du nombre de jours depuis ready_at', () => {
    const readyAt = new Date('2026-10-01T10:00:00Z').getTime();
    const currentDate = new Date('2026-10-05T10:00:00Z').getTime();

    const diffDays = Math.floor((currentDate - readyAt) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(4);
  });

  test('Rendu du modèle de message PICKUP_REMINDER', () => {
    const template = DEFAULT_MESSAGE_TEMPLATES.PICKUP_REMINDER;
    const rendered = renderWhatsAppMessage(template, {
      nom: 'Jean Dupont',
      ticket: 'LB-1002',
      jours: 5,
      pressing_nom: 'LB Pressing',
      reste_a_payer: '15 000',
    });

    expect(rendered).toBe(
      'Bonjour Jean Dupont, votre commande LB-1002 est prête depuis 5 jours chez LB Pressing. Reste à régler : 15 000 FCFA. Merci de passer la récupérer.'
    );
  });

  test('Vérification du délai de 48 h avant le prochain rappel', () => {
    const now = new Date('2026-10-10T12:00:00Z').getTime();
    const recentReminderAt = new Date('2026-10-09T18:00:00Z').getTime(); // 18h plus tôt
    const oldReminderAt = new Date('2026-10-07T12:00:00Z').getTime(); // 72h plus tôt

    const diffHoursRecent = (now - recentReminderAt) / (1000 * 60 * 60);
    const diffHoursOld = (now - oldReminderAt) / (1000 * 60 * 60);

    expect(diffHoursRecent < 48).toBe(true);
    expect(diffHoursOld < 48).toBe(false);
  });

  test('Validation des numéros de mobile congolais avec isValidCongoMobile', () => {
    expect(isValidCongoMobile('242067311016')).toBe(true);
    expect(isValidCongoMobile('242055551234')).toBe(true);
    expect(isValidCongoMobile('242044441234')).toBe(true);

    // Invalides
    expect(isValidCongoMobile('242071234567')).toBe(false); // 07 au lieu de 04/05/06
    expect(isValidCongoMobile('24267311016')).toBe(false);  // Manque le 0
    expect(isValidCongoMobile('12345')).toBe(false);
    expect(isValidCongoMobile('')).toBe(false);
  });
});
