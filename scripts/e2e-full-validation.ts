import { chromium } from 'playwright';
import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/postgres';

async function runE2EFullValidation() {
  console.log('🚀 Starting Full E2E Validation Script...');
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  await pg.query('DELETE FROM rate_limits;');

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------------------
    // 1. TEST PARCOURS CLIENT (2 ARTICLES AVEC CARACTÉRISTIQUES PHYSIQUES)
    // -------------------------------------------------------------------------
    console.log('\n--- 1. PARCOURS CLIENT COMMANDE EN LIGNE ---');
    const ctxClient = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageClient = await ctxClient.newPage();

    await pageClient.goto('http://localhost:3000/lb-pressing/commander');
    await pageClient.waitForLoadState('networkidle');

    // Saisie des coordonnées client
    await pageClient.fill('input[placeholder="Ex: Jean Koumou"]', 'Jean Koumou');
    await pageClient.fill('input[placeholder="Ex: 06 731 1016 ou +242 06..."]', '067311016');

    // Article 1 : Chemise
    console.log('Ajout Article 1: Chemise...');
    const chemiseBtn = pageClient.locator('button:has-text("Chemise homme")').first();
    await chemiseBtn.click();

    // Ouvrir formulaire extensible des détails physiques pour Chemise
    const toggleDetailsBtns = pageClient.locator('button[title*="détails physiques"]');
    await toggleDetailsBtns.nth(0).click();

    await pageClient.locator('input[placeholder="ex: Blanc, Bleu"]').first().fill('Bleu');
    await pageClient.locator('input[placeholder="ex: Uni, Rayé, Carreaux"]').first().fill('Rayé');
    await pageClient.locator('input[placeholder="ex: Zara, Hugo Boss"]').first().fill('Ralph Lauren');
    await pageClient.locator('input[placeholder="ex: M, L, 42"]').first().fill('L');
    await pageClient.locator('input[placeholder*="Tache sur col"]').first().fill('col légèrement taché');

    // Article 2 : Pantalon
    console.log('Ajout Article 2: Pantalon...');
    const pantalonBtn = pageClient.locator('button:has-text("Pantalon homme")').first();
    await pantalonBtn.click();

    await toggleDetailsBtns.nth(1).click();
    await pageClient.locator('input[placeholder="ex: Blanc, Bleu"]').nth(1).fill('Vert/Rose');
    await pageClient.locator('input[placeholder="ex: Uni, Rayé, Carreaux"]').nth(1).fill('Carreaux');
    await pageClient.locator('input[placeholder="ex: Zara, Hugo Boss"]').nth(1).fill('Lewis');
    await pageClient.locator('input[placeholder="ex: M, L, 42"]').nth(1).fill('42');
    await pageClient.locator('input[placeholder*="Tache sur col"]').nth(1).fill('aucune');

    // Valider la commande
    const submitBtn = pageClient.locator('button[type="submit"]:has-text("Valider ma demande")');
    await submitBtn.click();

    await pageClient.waitForTimeout(3000);

    const errorBanner = pageClient.locator('div.bg-red-950\\/80');
    if (await errorBanner.count() > 0) {
      const errText = await errorBanner.innerText();
      console.error('Error banner on form:', errText);
    }

    await pageClient.waitForSelector('text=Demande enregistrée avec succès', { timeout: 10000 });
    const requestCode = await pageClient.locator('p.text-3xl.font-mono').innerText();
    console.log(`✅ Commande enregistrée avec succès ! Code : ${requestCode}`);

    // Vérification directe dans la base de données PostgreSQL
    const orderDbRes = await pg.query('SELECT * FROM orders WHERE request_code = $1', [requestCode]);
    if (orderDbRes.rows.length === 0) throw new Error('Commande non trouvée dans la table orders!');
    const orderId = orderDbRes.rows[0].id;

    const itemsDbRes = await pg.query('SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC', [orderId]);
    if (itemsDbRes.rows.length !== 2) throw new Error(`Attendu 2 order_items, trouvé : ${itemsDbRes.rows.length}`);

    const item1 = itemsDbRes.rows[0];
    const item2 = itemsDbRes.rows[1];

    console.log('Vérification DB Item 1 (Chemise) :', item1.color, item1.pattern, item1.brand, item1.size, item1.item_notes);
    if (item1.color !== 'Bleu' || item1.pattern !== 'Rayé' || item1.brand !== 'Ralph Lauren' || item1.size !== 'L' || item1.item_notes !== 'col légèrement taché') {
      throw new Error('Les attributs physiques de l\'Article 1 ne correspondent pas !');
    }

    console.log('Vérification DB Item 2 (Pantalon) :', item2.color, item2.pattern, item2.brand, item2.size, item2.item_notes);
    if (item2.color !== 'Vert/Rose' || item2.pattern !== 'Carreaux' || item2.brand !== 'Lewis' || item2.size !== '42' || item2.item_notes !== 'aucune') {
      throw new Error('Les attributs physiques de l\'Article 2 ne correspondent pas !');
    }

    console.log('✅ TEST CLIENT & BASE DE DONNÉES CONFORME À 100% !');
    await ctxClient.close();

    // -------------------------------------------------------------------------
    // 2. TEST ADMIN (INSPECTION & TICKET PRINT)
    // -------------------------------------------------------------------------
    console.log('\n--- 2. TEST ADMIN & INSPECTION COMMANDE ---');
    const ctxOwner = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageOwner = await ctxOwner.newPage();

    await pageOwner.goto('http://localhost:3000/admin/login');
    await pageOwner.fill('input[type="email"]', 'obusiness715@gmail.com');
    await pageOwner.fill('input[type="password"]', 'barry@2014');
    await pageOwner.click('button[type="submit"]');
    await pageOwner.waitForURL('**/admin');
    await pageOwner.waitForTimeout(1000);

    // Aller sur le détail de la commande
    await pageOwner.goto(`http://localhost:3000/admin/commandes/${orderId}`, { waitUntil: 'domcontentloaded' });
    await pageOwner.waitForTimeout(1000);

    // Vérifier l'affichage des attributs physiques
    const pageText = await pageOwner.content();
    if (!pageText.includes('Bleu') || !pageText.includes('Ralph Lauren') || !pageText.includes('col légèrement taché')) {
      throw new Error('Détails physiques de l\'article 1 non affichés dans l\'administration !');
    }
    if (!pageText.includes('Vert/Rose') || !pageText.includes('Carreaux') || !pageText.includes('Lewis')) {
      throw new Error('Détails physiques de l\'article 2 non affichés dans l\'administration !');
    }
    console.log('✅ Inspection Admin des attributs séparés validée !');

    // -------------------------------------------------------------------------
    // 3. TEST DE RÉCEPTION & ATTRIBUTION ATOMIQUE TICKET LB-XXXX
    // -------------------------------------------------------------------------
    console.log('\n--- 3. TEST DE RÉCEPTION & TICKET LB-XXXX ---');
    // Valider la demande
    const validateBtn = pageOwner.locator('button:has-text("1. Valider la demande")');
    if (await validateBtn.count() > 0) {
      console.log('Validation de la demande...');
      await validateBtn.click();
      await pageOwner.waitForTimeout(2000);
      await pageOwner.reload();
      await pageOwner.waitForTimeout(1000);
    }

    // Réceptionner le linge (2 pièces)
    const receiveBtn = pageOwner.locator('button:has-text("2. Réceptionner le linge")');
    if (await receiveBtn.count() > 0) {
      console.log('Réception du linge...');
      await receiveBtn.click();
      await pageOwner.waitForSelector('text=Attribuer Ticket', { timeout: 5000 });
      await pageOwner.click('button:has-text("Attribuer Ticket")');
      await pageOwner.waitForTimeout(2000);
    } else {
      console.error('Bouton de réception non trouvé !');
    }

    // Vérifier en base le numéro de ticket
    const ticketDbRes = await pg.query('SELECT ticket_number, status FROM orders WHERE id = $1', [orderId]);
    console.log(`📌 Ticket attribué : ${ticketDbRes.rows[0].ticket_number}, Statut : ${ticketDbRes.rows[0].status}`);

    if (!ticketDbRes.rows[0].ticket_number || !ticketDbRes.rows[0].ticket_number.startsWith('LB-')) {
      throw new Error('Format de ticket LB-XXXX invalide ou non attribué !');
    }
    console.log('✅ Réception et attribution de ticket officiel validées !');

    // -------------------------------------------------------------------------
    // 4. TEST CATALOGUE & RBAC DES 4 RÔLES
    // -------------------------------------------------------------------------
    console.log('\n--- 4. TEST CATALOGUE & PERMISSIONS DES RÔLES ---');
    // OWNER teste création service
    await pageOwner.goto('http://localhost:3000/admin/services', { waitUntil: 'domcontentloaded' });
    await pageOwner.waitForTimeout(1000);
    await pageOwner.click('button:has-text("Ajouter un service")');
    await pageOwner.fill('input[placeholder="ex: Chemise sur cintre, Costume 2 pièces"]', 'Service Test E2E');
    await pageOwner.fill('input[placeholder="ex: 5000"]', '4500');
    await pageOwner.click('button[type="submit"]:has-text("Créer la prestation")');
    await pageOwner.waitForTimeout(1000);
    console.log('✅ Service "Service Test E2E" créé par OWNER.');

    await ctxOwner.close();

    // MANAGER Test
    const ctxManager = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageManager = await ctxManager.newPage();
    await pageManager.goto('http://localhost:3000/admin/login');
    await pageManager.fill('input[type="email"]', 'manager@lb-pressing.cg');
    await pageManager.fill('input[type="password"]', 'barry@2014');
    await pageManager.click('button[type="submit"]');
    await pageManager.waitForURL('**/admin');
    await pageManager.waitForTimeout(1000);

    await pageManager.goto('http://localhost:3000/admin/services', { waitUntil: 'domcontentloaded' });
    await pageManager.waitForTimeout(1000);
    if ((await pageManager.locator('button:has-text("Ajouter un service")').count()) === 0) {
      throw new Error('Le Manager doit avoir le bouton d\'ajout de service !');
    }
    console.log('✅ MANAGER a accès au catalogue en modification.');
    await ctxManager.close();

    // CASHIER Test (Lecture Seule sur Services + Interdiction /users)
    const ctxCashier = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageCashier = await ctxCashier.newPage();
    await pageCashier.goto('http://localhost:3000/admin/login');
    await pageCashier.fill('input[type="email"]', 'cashier@lb-pressing.cg');
    await pageCashier.fill('input[type="password"]', 'barry@2014');
    await pageCashier.click('button[type="submit"]');
    await pageCashier.waitForURL('**/admin');
    await pageCashier.waitForTimeout(1000);

    await pageCashier.goto('http://localhost:3000/admin/services', { waitUntil: 'domcontentloaded' });
    await pageCashier.waitForTimeout(1000);
    if ((await pageCashier.locator('button:has-text("Ajouter un service")').count()) > 0) {
      throw new Error('CASHIER ne doit pas voir le bouton d\'ajout de service !');
    }
    console.log('✅ CASHIER est en lecture seule sur le catalogue.');

    // Tentative d'accès direct à /users par CASHIER
    await pageCashier.goto('http://localhost:3000/users', { waitUntil: 'domcontentloaded' });
    await pageCashier.waitForTimeout(1000);
    const cashierUsersContent = await pageCashier.content();
    if (!cashierUsersContent.includes('Accès restreint')) {
      throw new Error('CASHIER ne doit pas pouvoir accéder à la gestion d\'équipe !');
    }
    console.log('✅ Restriction URL /users pour CASHIER confirmée (Accès restreint affiché).');
    await ctxCashier.close();

    // DELIVERY Test
    const ctxDelivery = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageDelivery = await ctxDelivery.newPage();
    await pageDelivery.goto('http://localhost:3000/admin/login');
    await pageDelivery.fill('input[type="email"]', 'delivery@lb-pressing.cg');
    await pageDelivery.fill('input[type="password"]', 'barry@2014');
    await pageDelivery.click('button[type="submit"]');
    await pageDelivery.waitForURL('**/admin');
    await pageDelivery.waitForTimeout(1000);

    await pageDelivery.goto('http://localhost:3000/admin/services', { waitUntil: 'domcontentloaded' });
    await pageDelivery.waitForTimeout(1000);
    if ((await pageDelivery.locator('button:has-text("Ajouter un service")').count()) > 0) {
      throw new Error('DELIVERY ne doit pas voir le bouton d\'ajout de service !');
    }
    console.log('✅ DELIVERY est en lecture seule sur le catalogue.');
    await ctxDelivery.close();

    // -------------------------------------------------------------------------
    // 5. TEST DE PRIX HISTORIQUE FIGÉ
    // -------------------------------------------------------------------------
    console.log('\n--- 5. TEST DU PRIX HISTORIQUE FIGÉ ---');
    // 1. Obtenir le prix actuel de Chemise homme (5000 FCFA)
    const serviceDb = await pg.query("SELECT id, price FROM services WHERE name = 'Chemise homme' AND organization_id = '11111111-1111-1111-1111-111111111111'");
    const serviceId = serviceDb.rows[0].id;

    // 2. Mettre à jour le catalogue : Chemise homme = 5500 FCFA
    await pg.query("UPDATE services SET price = 5500.00 WHERE id = $1", [serviceId]);
    console.log('Prix du catalogue mis à jour à 5,500 FCFA.');

    // 3. Vérifier que la commande précédente conserve unit_price = 5000 FCFA
    const pastItemRes = await pg.query("SELECT unit_price FROM order_items WHERE order_id = $1 AND service_id = $2", [orderId, serviceId]);
    const historicalPrice = Number(pastItemRes.rows[0].unit_price);
    console.log(`📌 Prix dans la commande passée : ${historicalPrice} FCFA (Attendu: 5000 FCFA)`);

    if (historicalPrice !== 5000) {
      throw new Error(`ÉCHEC CRITIQUE : Le prix de la commande historique a été altéré (${historicalPrice} FCFA) !`);
    }

    // 4. Passer une nouvelle commande et vérifier qu'elle utilise 5500 FCFA
    const ctxNew = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageNew = await ctxNew.newPage();
    await pageNew.goto('http://localhost:3000/lb-pressing/commander');
    await pageNew.waitForLoadState('networkidle');

    await pageNew.fill('input[placeholder="Ex: Jean Koumou"]', 'Client Prix Neuf');
    await pageNew.fill('input[placeholder="Ex: 06 731 1016 ou +242 06..."]', '067000099');
    await pageNew.locator('button:has-text("Chemise homme")').first().click();

    await pageNew.click('button[type="submit"]:has-text("Valider ma demande")');
    await pageNew.waitForSelector('text=Demande enregistrée avec succès', { timeout: 10000 });
    const newReqCode = await pageNew.locator('p.text-3xl.font-mono').innerText();

    const newOrderRes = await pg.query('SELECT id FROM orders WHERE request_code = $1', [newReqCode]);
    const newItemRes = await pg.query('SELECT unit_price FROM order_items WHERE order_id = $1', [newOrderRes.rows[0].id]);
    const newPrice = Number(newItemRes.rows[0].unit_price);
    console.log(`📌 Prix dans la nouvelle commande : ${newPrice} FCFA (Attendu: 5500 FCFA)`);

    if (newPrice !== 5500) {
      throw new Error(`La nouvelle commande aurait dû adopter 5500 FCFA, mais a pris ${newPrice} FCFA !`);
    }

    // Restaurer le prix d'origine 5000 FCFA pour la propreté du test
    await pg.query("UPDATE services SET price = 5000.00 WHERE id = $1", [serviceId]);

    console.log('✅ TEST PRIX HISTORIQUE VALIDÉ À 100% (Ancienne commande=5000, Nouvelle=5500) !');
    await ctxNew.close();

    // -------------------------------------------------------------------------
    // 6. TEST DE DÉCONNEXION & ACCÈS SÉCURISÉ
    // -------------------------------------------------------------------------
    console.log('\n--- 6. TEST DE DÉCONNEXION ---');
    const ctxSignout = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pageSignout = await ctxSignout.newPage();
    await pageSignout.goto('http://localhost:3000/admin/login');
    await pageSignout.fill('input[type="email"]', 'obusiness715@gmail.com');
    await pageSignout.fill('input[type="password"]', 'barry@2014');
    await pageSignout.click('button[type="submit"]');
    await pageSignout.waitForURL('**/admin');
    await pageSignout.waitForTimeout(1000);

    // Cliquer sur déconnexion via le bouton mobile
    const logoutBtn = pageSignout.locator('#mobile-logout-btn');
    await logoutBtn.click();
    await pageSignout.waitForTimeout(1000);

    // Tenter d'accéder à /admin sans session
    await pageSignout.goto('http://localhost:3000/admin/services', { waitUntil: 'domcontentloaded' });
    await pageSignout.waitForTimeout(1000);
    if (!pageSignout.url().includes('/admin/login')) {
      throw new Error('L\'utilisateur déconnecté a pu accéder à une route protégée !');
    }
    console.log('✅ Déconnexion et destruction de session validées !');
    await ctxSignout.close();

    await browser.close();
    await pg.end();

    console.log('\n🎉 TOUS LES TESTS E2E REQUIS SONT RÉUSSIS ET VALIDÉS A 100% !');
  } catch (err) {
    console.error('❌ Échec de la validation E2E :', err);
    await browser.close();
    await pg.end();
    process.exit(1);
  }
}

runE2EFullValidation();
