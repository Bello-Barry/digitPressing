# ROADMAP : SaaS PRESSING (phases 3 à 5)

Document destiné à Jules. À placer à la racine du dépôt. Contexte : Next.js 15, TypeScript strict, Supabase (Postgres + RLS + Auth), multi-tenant (`organization_id` partout), interface mobile-first en français, devise FCFA. LB Pressing est le premier client. La phase 2 (commande en ligne, validation, ticket, cycle de statuts, paiements, clients, services, paramètres) est considérée comme terminée.

## RÈGLES POUR TOUTES LES TÂCHES

1. **Une tâche = une branche = une Pull Request courte.** Ne traite que la tâche demandée (ex. « 3.2 »), jamais une phase entière d'un coup.
2. **Ne prouve rien par supposition** : cite fichiers et lignes. Sépare dans la PR ce que tu as vérifié (lint, typecheck, build, tests) de ce que je dois tester moi-même sur l'application déployée. Tu n'as pas accès à la production : ne déclare jamais un test réussi si tu ne l'as pas exécuté.
3. **Multi-tenant et RLS** : toute table métier porte `organization_id` et a des politiques RLS. Toute vue doit utiliser `security_invoker = true` (ou filtrer par organisation). Jamais de `service_role` côté client. Chaque nouvelle table ou vue doit être couverte par un test d'isolation entre deux organisations.
4. **Actions sensibles** (annulation, remise, changement de prix, dérogation, clôture de caisse, correction de paiement) : uniquement via RPC ou Server Action qui vérifie le rôle, exige un motif, et écrit dans `audit_logs`. Aucun `UPDATE` direct depuis le client.
5. **Migrations** : fichiers SQL versionnés, additifs, sans suppression de données. Montre le SQL dans la description de la PR. N'applique rien en production toi-même.
6. **Pas d'API WhatsApp payante.** Messages = liens `wa.me` préremplis (numéros congolais : le `0` initial est conservé, voir `whatsapp.ts`).
7. **Pas d'erreur masquée** : jamais de `[]` ou de redirection silencieuse pour cacher un échec ; message clair à l'utilisateur et `console.error` côté serveur.
8. **Après chaque mutation**, l'interface doit se rafraîchir (`revalidatePath` ou `router.refresh()`).
9. **Mobile-first** (360, 390, 430 px), aucun défilement horizontal de page, boutons faciles au doigt. Pas de dépendance lourde sans justification.
10. **Pas de données mockées**, pas de commande de test dans l'organisation réelle LB Pressing.
11. Une tâche n'est terminée que si elle inclut son interface utilisateur et son entrée dans le menu (selon le rôle).
---

## PHASE 3 : CONTRÔLE (anti-détournement) : PRIORITÉ

Objectif : le propriétaire peut savoir ce qui s'est passé dans son pressing sans y être.

| # | Tâche | Critères d'acceptation |
|---|---|---|
| 3.1 | **Journal d'audit** : table `audit_logs` (organisation, utilisateur, action, objet, avant/après en JSON, date), alimentée par triggers. Lecture seule pour OWNER/MANAGER, aucun UPDATE/DELETE possible. | Toute modification d'une commande, d'un paiement ou d'un prix crée une ligne. Un employé ne peut ni lire ni modifier le journal. |
| 3.2 | **Annulation avec motif** : action réservée MANAGER/OWNER, motif obligatoire, aucune suppression physique de commande. | Impossible d'annuler sans motif ; la commande reste visible avec le statut `CANCELLED` et le motif. |
| 3.3 | **Paiements immuables** : pas de modification ; une erreur se corrige par une écriture inverse avec motif. `paid_amount` et `balance_due` restent calculés depuis `payments`. | Aucun champ de montant payé modifiable à la main ; l'historique des écritures est visible. |
| 3.4 | **Remises** : réservées MANAGER/OWNER, motif obligatoire, visibles dans les rapports. Prix figé dans la ligne de commande ; modification ultérieure = MANAGER/OWNER + motif + audit. | Un CASHIER ne peut ni appliquer une remise ni modifier un prix. |
| 3.5 | **Livraison impayée** : passer en `DELIVERED` une commande non soldée exige une dérogation MANAGER/OWNER avec motif ; la créance est enregistrée. | Sans dérogation, le passage est refusé ; avec dérogation, une créance client apparaît. |
| 3.6 | **Comptage des articles** : nombre à la réception (déjà prévu) et vérification à la remise (case « articles vérifiés »). Un écart est consigné. | La remise exige la vérification ; un écart crée une alerte. |
| 3.7 | **Clôture de caisse journalière** : espèces attendues (calculées) vs comptées (saisies), écart enregistré, journée verrouillée après clôture. | Une journée clôturée ne peut plus recevoir de paiement ni de modification. |
| 3.8 | **Alertes OWNER** : page `/admin/alertes` (annulations, remises, modifications après validation, livrées non payées, écarts de caisse, écarts de comptage, activité hors horaires). | Chaque type d'alerte apparaît avec utilisateur, date et motif. |
| 3.9 | **Droits par rôle** : CASHIER ne voit ni statistiques globales ni marges ni export clients ; DELIVERY ne voit que ses livraisons du jour. | Test automatisé des permissions par rôle (lecture et écriture). |
| 3.10 | **Résumé quotidien enrichi** (déjà un bouton WhatsApp) : CA, encaissements par mode, annulations, remises, écart de caisse. | Message prérempli correct avec les vraies données du jour. |

**Mesures à suivre avec LB Pressing** : nombre d'écarts de caisse détectés, annulations et remises par employé, pourcentage de commandes remises avec articles vérifiés, nombre d'impayés livrés.

**Condition de passage à la phase 4** : tests RLS et permissions réussis ; au moins 2 semaines d'usage réel par LB Pressing ; le propriétaire consulte le résumé quotidien.

---

## PHASE 4 : PILOTAGE ET CROISSANCE

Objectif : le logiciel fait gagner de l'argent, pas seulement en éviter la perte.

| # | Tâche | Critères d'acceptation |
|---|---|---|
| 4.1 | **Statistiques** : CA jour/semaine/mois, nombre de commandes, services les plus demandés, nouveaux clients et clients récurrents (requêtes SQL/vues avec `security_invoker`). Pas de grosse librairie de graphiques. | Chiffres cohérents avec les paiements réels ; visibles OWNER/MANAGER uniquement. |
| 4.2 | **Relance des clients inactifs** : liste des clients sans commande depuis N jours (paramétrable, 30 par défaut) avec bouton `wa.me` + message modèle configurable. Marque « relancé le … » pour éviter de relancer deux fois. | Aucun envoi automatique ; l'employé appuie sur Envoyer dans WhatsApp. |
| 4.3 | **Linge prêt non récupéré** : liste des commandes `READY` depuis plus de N jours avec bouton de rappel `wa.me`. | Tri par ancienneté ; nombre visible sur le dashboard. |
| 4.4 | **Coupons et parrainage simples** : code promo (montant ou %), validité, limite d'usage, application par MANAGER/OWNER avec audit ; parrainage = code lié à un client existant. | Un coupon ne peut pas être appliqué deux fois ; l'effet sur le CA est visible dans les rapports. |
| 4.5 | **Fidélité** : compteur de commandes et de montants par client ; palier configurable (ex. récompense après X commandes). | Récompense proposée à la caisse, appliquée via 4.4. |
| 4.6 | **Analyse de marge (simple)** : champ `cost_price` facultatif par service (déjà prévu), marge par service et par jour, visible OWNER uniquement. | Aucune donnée de marge accessible à CASHIER/DELIVERY (testé). |
| 4.7 | **Export** CSV (commandes, paiements, clients) pour OWNER, avec audit de chaque export. | Un export crée une ligne d'audit. |

**Mesures** : taux de retour des clients à 30/60 jours, nombre de clients revenus après relance, CA moyen par client, CA par jour avant/après la mise en place.

**Condition de passage à la phase 5** : LB Pressing a utilisé 4.2 et 4.3 pendant au moins 1 mois avec des résultats chiffrés ; le propriétaire est prêt à montrer le produit à un autre pressing.

---

## PHASE 5 : EXPLOITATION QUOTIDIENNE ET RÉSEAU

Objectif : passer d'un outil pour LB Pressing à un produit pour plusieurs pressings. **Ne commence cette phase qu'après la condition de la phase 4, et seulement tâche par tâche.**

| # | Tâche | Critères d'acceptation |
|---|---|---|
| 5.1 | **Étiquettes QR** imprimables par ticket (QR vers la fiche interne de la commande). | Scan depuis un téléphone → commande correcte ; accessible seulement au personnel connecté. |
| 5.2 | **Tournées de livraison** : liste du jour pour DELIVERY (adresse, téléphone `wa.me`, montant à encaisser), statut « en route / livré », encaissement enregistré en paiement. | Un livreur ne voit que ses propres livraisons. |
| 5.3 | **Rapprochement Mobile Money** : champ référence de transaction obligatoire pour MTN/Airtel, détection des doublons. Pas d'API réelle. | Une même référence ne peut pas être enregistrée deux fois dans l'organisation. |
| 5.4 | **Mode hors ligne fiable** (PWA) : lecture des commandes du jour et file d'attente pour saisies simples, avec resynchronisation et gestion explicite des conflits. | Aucune perte de saisie ; message clair quand la synchronisation est en attente. Commencer par un périmètre minimal. |
| 5.5 | **Gestion des organisations** : abonnement manuel (plan, statut, fin d'essai) géré par un super-admin ; suspension d'un pressing. | Un pressing suspendu perd l'accès écriture mais conserve ses données. |
| 5.6 | **Inscription d'un nouveau pressing** (assistant : nom, slug, téléphones, services, premier OWNER). | Un nouveau pressing démarre isolé des autres (test d'isolation). |
| 5.7 | **Annuaire public** `/pressings` (opt-in) : pressings qui acceptent d'être listés, par ville, avec bouton de commande. | Seuls les pressings opt-in apparaissent, sans aucune donnée privée. |

**Mesures** : nombre de pressings actifs, commandes par pressing et par mois, taux de rétention mensuel des pressings, nombre de clients venus via l'annuaire, temps de mise en route d'un nouveau pressing.

---

## MODÈLE DE PROMPT POUR CHAQUE TÂCHE

```
Lis ROADMAP-JULES.md à la racine du dépôt et respecte ses règles générales.

Implémente UNIQUEMENT la tâche [numéro, ex. 3.2 : titre] avec ses critères d'acceptation.
Branche : feat/[numéro]-[nom-court]. Ouvre une PR courte.

Avant de coder : indique les fichiers existants concernés (chemins) et ton plan en 5 lignes.
Dans la PR : migrations SQL (non appliquées), tests ajoutés (dont isolation entre organisations si nouvelle table/vue), résultats réels de lint/typecheck/build, et la liste des vérifications que je dois faire à la main.
Ne traite aucune autre tâche, ne modifie pas la logique métier hors périmètre.
```
