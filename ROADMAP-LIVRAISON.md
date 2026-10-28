# ROADMAP LIVRAISON : collecte, livraison et livreurs (inspiré d'Uber, adapté à LB Pressing)

Document destiné à Jules. À placer à la racine du dépôt, à lire avec ROADMAP-JULES.md : TOUTES les règles de ROADMAP-JULES.md s'appliquent aux tâches D1 à D5 (une tâche = une branche = une PR courte ; interface et menu inclus ; règles SQL ; règle de preuve).

## OBJECTIF
Éviter les litiges : quantités de vêtements contestées, factures modifiées, paiement des livreurs. Chaque étape doit être vérifiable : qui a pris quoi, quand, avec l'accord de qui, et ce que chaque livreur a gagné.
Ce que nous reprenons d'Uber : missions proposées ou attribuées, acceptation par un livreur, étapes de progression, historique des gains. Ce que nous ne faisons PAS : GPS permanent, tarification dynamique, notation publique, pourboires, paiement automatique, services payants, mode hors ligne.

## RÈGLES SPÉCIFIQUES À CE CHANTIER
1. **Une tâche D à la fois, dans l'ordre D1 → D5.** Ne commence jamais une tâche D tant que la précédente n'est pas fusionnée et testée. N'implémente pas d'avance les tâches suivantes.
2. **Audit court puis implémentation, dans la même tâche** : 10 lignes maximum de diagnostic (ce qui existe, ce qui manque, risques), puis code. Ne t'arrête pas à une proposition d'architecture.
3. **Réutiliser, ne pas dupliquer.** Observé dans le journal et le code, à VÉRIFIER avant usage : colonnes de orders (mode avec les valeurs DROP_OFF et DELIVERY, delivery_fee, delivered_by, pickup_address, delivery_address, items_count_in, items_count_out, items_verified, items_discrepancy, delivery_override_at / by / note, ticket_number attribué à la réception, request_code D-xxxx, invoice_token secret), rôle DELIVERY existant, table order_items (instantané du nom et du prix), fonctions public.catalog_has_role, public.catalog_is_member, public.trigger_generic_audit_log (ne pas la modifier), public.local_today(), mécanisme d'annulation avec motif, contrôle de comptage de la tâche 3.6, clôture de caisse. Ne crée ni deuxième système de commandes, ni de factures, ni d'authentification, ni de permissions.
4. **Séparation des états, sans multiplier les machines à états** : (a) le statut de la commande existant ne change pas de sens ; (b) UNE seule machine à états nouvelle : la mission ; (c) les contrôles (chez le client, au pressing) sont des ENREGISTREMENTS de données, pas des statuts supplémentaires ; (d) les gains sont un registre.
5. **Toute transition sensible passe par une fonction SQL (RPC)** qui vérifie l'identité, le rôle, l'organisation, l'état courant et l'idempotence, puis écrit l'historique. Aucun UPDATE direct de statut, de montant ou de gain depuis le navigateur. Un double clic ou une requête répétée ne crée ni double attribution ni double gain.
6. **Confidentialité du client** : un livreur ne voit l'adresse et le téléphone d'un client qu'après avoir accepté la mission, et seulement pour ses propres missions (consultables 7 jours après leur clôture). Avant l'acceptation, il voit uniquement le type de mission, le quartier ou la zone, la rémunération et l'heure. Il n'a jamais accès aux autres commandes, aux autres livreurs, aux marges ni aux dépenses.
7. **Argent** : aucun virement automatique. Les gains s'accumulent ; un responsable autorisé enregistre un règlement groupé fait manuellement (espèces, MTN MoMo, Airtel Money).
8. **SQL** (suite à des erreurs précédentes) : liste d'abord ce qui existe réellement dans supabase/migrations et vérifie les TYPES des colonnes ; n'invente aucune fonction ; memberships.role est l'enum member_role (compare avec role::text) ; fonctions SECURITY DEFINER avec search_path fixé, rôle vérifié en premier, REVOKE ALL FROM PUBLIC, anon puis GRANT explicite ; vues en security_invoker = true ; migration additive, idempotente, ordonnée ; je l'applique moi-même dans Supabase AVANT de fusionner : le fichier du dépôt doit être identique à ce qui est exécuté. Toutes les dates dans le fuseau Africa/Brazzaville (public.local_today()), jamais en UTC côté application.
9. **Journal d'audit** : les tables nouvelles utilisent le déclencheur d'audit générique existant, avec libellés français ajoutés au fichier de correspondance du journal. Les lignes sensibles (gains, paiements) ne sont lisibles dans le journal que par l'OWNER.
10. **Honnêteté** : ne dis jamais "vérifié" sans la sortie de npm run type-check et npm run build collée telle quelle ; liste ce que tu n'as pas pu exécuter ; sépare "terminé", "partiel", "non fait".

## MODÈLE DE DONNÉES (indicatif : adapte-le après l'audit)
- `delivery_missions` : organisation, commande, type (COLLECTION ou DELIVERY), statut, livreur attribué, rémunération (INSTANTANÉ copié à la création), zone ou quartier, consignes, horodatages de chaque étape, motifs d'échec ou d'annulation. Une seule mission active par (commande, type).
- `order_revisions` et `order_revision_lines` (D2) : versions de la facture avec lignes avant/après, accord du client, auteur.
- `mission_anomalies` (D3) : anomalies de réception, résolution, auteur.
- `cash_handovers` (D4) : espèces encaissées par un livreur et leur remise à la caisse.
- `courier_earnings` (D5), `courier_payouts`, `courier_payout_items` (D5) : registre des gains (écritures immuables), règlements groupés.
- Paramètres dans organizations : rémunération d'une collecte, rémunération d'une livraison, seuil de paiement (modifiables par l'OWNER seulement).

## D1. Missions et acceptation (socle)
Tables et fonctions des missions, acceptation atomique, écrans livreur et responsable.
- Création d'une mission depuis une commande de collecte ou de livraison (bouton explicite sur la commande, OWNER, MANAGER, CASHIER ; jamais automatique).
- Deux modes : attribution directe à un livreur, ou mission ouverte à tous les livreurs actifs ; acceptation atomique (un seul gagnant en cas d'acceptations simultanées) ; refus ou réattribution avec motif.
- Progression de la collecte : acceptée, en route, chez le client, collectée (avec le nombre de pièces reçues), en transport, arrivée au pressing. L'arrivée au pressing n'est PAS une réception.
- Échec ou annulation avec motif (client absent, adresse incorrecte, injoignable, refus, autre) sans jamais marquer la commande comme livrée ou reçue.
- Écrans mobiles : "Missions" (DELIVERY : disponibles et mes missions ; OWNER et MANAGER : tableau par statut, attribution, réattribution) ; carte "Missions en attente" au dashboard.
- Critères : deux livreurs ne peuvent pas obtenir la même mission ; un livreur d'une autre organisation ou un CASHIER ne peut pas accepter ; un livreur ne voit ni adresse ni téléphone avant d'accepter ; une requête répétée ne change rien ; chaque étape est dans le journal.

## D2. Contrôle chez le client et correction de facture
- Le livreur compare chaque ligne de la facture aux vêtements remis : quantité reçue, observation, état apparent.
- Correction sur place par versions : version initiale conservée, nouvelle version avec lignes avant/après, total avant/après recalculé côté serveur. Le livreur peut modifier des quantités et ajouter ou retirer des lignes du CATALOGUE au prix du catalogue ; il ne peut jamais modifier un prix, une remise ou les frais de livraison.
- **Accord du client par code** : un code à usage unique (4 à 6 chiffres, stocké haché, valable 30 minutes, 5 essais maximum) est affiché sur la page de suivi du client et envoyé par lien WhatsApp préparé ; le livreur le saisit pour confirmer l'accord. Si le client n'a pas de téléphone ou de connexion, le livreur peut déclarer un accord non vérifié : la correction est alors marquée "accord non vérifié" et apparaît dans les alertes du propriétaire. Une case cochée seule ne prouve pas l'identité : le type de preuve est toujours enregistré avec son horodatage.
- La version confirmée devient la référence du contrôle au pressing. Une version refusée ou non confirmée ne change aucun montant de la commande.
- Critères : impossible de finaliser sans accord ; l'historique des versions reste consultable ; un livreur ne peut pas toucher à une facture déjà acceptée par le pressing.

## D3. Réception au pressing (contrôle n° 2)
- Réutilise les mécanismes existants (RECEIVED, ticket officiel atomique, items_count_in, items_verified, items_discrepancy).
- Le personnel autorisé compare ce qu'il reçoit à la dernière version CONFIRMÉE de la facture, ligne par ligne. La personne qui valide la réception ne peut pas être le livreur de la mission.
- Conforme : réception validée, ticket attribué, mission COMPLETED, gain de collecte acquis (D5). Différence : anomalie obligatoire (lignes, quantités, état), blocage de la validation tant qu'un OWNER ou MANAGER ne l'a pas résolue ou traitée (nouvelle version de facture avec nouvel accord du client si le montant change).
- Critères : jamais de réception confirmée sans contrôle ; l'arrivée du livreur n'équivaut pas à une réception ; les commandes déposées directement au pressing gardent leur workflow actuel.

## D4. Livraison finale et espèces encaissées par le livreur
- Mission de livraison après "prête" : prise en charge, remise au client confirmée par un code à usage unique (même mécanisme que D2), échecs (client absent, adresse incorrecte, injoignable, refus, commande incomplète) avec nouvelle tentative ou réattribution autorisée.
- Si le livreur encaisse du client : enregistrement du paiement, puis "remise de caisse" : le livreur déclare le montant remis, un CASHIER ou responsable le valide ; l'écart éventuel crée une alerte. Un livreur ne peut pas clôturer sa journée avec des espèces non remises.
- Réutilise la dérogation "livraison impayée" existante.

## D5. Gains et paiements groupés manuels
- Registre de gains immuable (une écriture par prestation rémunérée, clé d'unicité par mission et type) : collecte payable après réception validée (D3), livraison payable après remise confirmée (D4). Mission échouée ou annulée : aucun gain, sauf décision de l'OWNER avec motif (écriture dédiée). Corrections par écritures inverses, jamais de modification ni de suppression.
- Écran livreur "Mes gains" : total acquis, déjà réglé, solde, seuil, historique, uniquement les siens.
- Écran OWNER : gains dus par livreur, seuil atteint, règlement groupé (montant ≤ solde payable, écritures les plus anciennes d'abord, mode de règlement, référence facultative, note), reçu imprimable, clé d'idempotence contre les doubles paiements. Le seuil indique l'éligibilité et ne déclenche aucun transfert.
- Seul l'OWNER enregistre les règlements dans cette version (le MANAGER seulement après une permission explicite ultérieure).
- Critères : jamais de double gain ni de double paiement ; solde recalculé depuis le registre ; isolation par organisation ; le livreur ne peut ni modifier ses gains, ni se payer, ni voir ceux des autres.

## HORS PÉRIMÈTRE
GPS et cartes, notation, pourboires, tarification dynamique, flotte avec partenaires et paiement par partenaire (chaque livreur est un compte), paiement automatique, SMS ou API WhatsApp payants, mode hors ligne.

## TESTS (chaque tâche)
- Tests unitaires TypeScript des règles pures (transitions, calculs, validations).
- Script SQL supabase/tests/…_dN_….sql dans le style existant : aucun DELETE, rollback final avec bilan, refus acceptés seulement pour SQLSTATE 42501, contrôles positifs (l'utilisateur voit bien ses données), isolation entre deux organisations, anon sans accès, tentatives d'écriture directe refusées pour tous les rôles.
- Régression : commandes déposées au pressing, caisse, dépenses, journal, rôles existants.
