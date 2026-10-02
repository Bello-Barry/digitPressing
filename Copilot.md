SaaS PRESSING (LB Pressing = premier client)

Tu es un ingénieur logiciel senior (Next.js, TypeScript, Supabase, PostgreSQL, UX mobile-first, applications métier multi-tenant).

## 1. OBJECTIF

Construire un SaaS de gestion et de commande en ligne pour pressings, au Congo-Brazzaville.

- **Premier client : LB Pressing** (le pressing du fondateur).
- Le même code devra servir **plusieurs pressings** (les siens, puis des concurrents qui s'abonnent).
- Trois buts : (1) gagner des clients en ligne, (2) gérer les clients/commandes/paiements, (3) **empêcher les détournements** par le personnel.

Contexte : smartphones Android, WhatsApp omniprésent, espèces + MTN MoMo/Airtel Money, personnel peu technique, connexion parfois faible. Interface en **français**, devise **FCFA (XAF)**.

## 2. DÉCISIONS DÉJÀ PRISES (ne pas remettre en cause)

- **Pas d'API WhatsApp.** On utilise des liens `https://wa.me/<numéro>?text=<message encodé>`. Le personnel appuie sur « Envoyer » dans WhatsApp après validation.
- **Pas de compte client.** Le client commande sans inscription ; son numéro de téléphone normalisé sert d'identifiant métier pour retrouver le client ; il ne constitue **ni une preuve d'identité ni une authentification** (le suivi exige le code de la demande et ne révèle que le strict nécessaire).
- **Multi-tenant dès le premier jour** (voir §4), mais on livre d'abord LB Pressing. Pas d'écran d'inscription de nouveaux pressings ni de facturation d'abonnement dans la phase 1 (un super-admin crée les organisations à la main).
- Pas de paiement Mobile Money réel, pas d'IA, pas d'application native.

## 3. STACK

Next.js 15+ (App Router, Server Components par défaut), TypeScript strict, Tailwind, shadcn/ui, lucide-react, Supabase (Auth, Postgres, RLS), Zod, React Hook Form. Aucune dépendance supplémentaire sans justification (un petit paquet `qrcode` est accepté pour les QR). Pas de Framer Motion, pas de grosse librairie de graphiques. Léger et rapide, même sur un petit PC et un téléphone modeste.

## 4. MULTI-TENANT

- Table `organizations` (id, slug unique, nom, slogan, logo_url, couleur principale, téléphones WhatsApp, adresse, indicatif pays par défaut `242`, devise, pied de facture, statut, plan, essai_jusqu_au).
- **Chaque table métier porte `organization_id`** et est protégée par RLS : un utilisateur ne voit que les données de ses organisations.
- Table `memberships` (user_id, organization_id, rôle).
- Rôles : `OWNER`, `MANAGER`, `CASHIER`, `DELIVERY` (livreur : voit uniquement ses livraisons du jour).
- Table `platform_admins` pour le super-admin (le fondateur) : crée/suspend les organisations.
- URL publique par pressing : `/{slug}` (ex. `/lb-pressing`). Thème (couleurs, nom, logo) chargé depuis l'organisation, rien de codé en dur.
- **Test obligatoire** : un utilisateur de l'organisation A ne peut lire/écrire aucune donnée de l'organisation B (tests SQL/RLS écrits et exécutés).

## 5. PARCOURS CLIENT (public, sans inscription)

Routes : `/{slug}`, `/{slug}/services`, `/{slug}/commander`, `/{slug}/suivi`, `/f/{token}` (facture).

1. Le client découvre le pressing via les réseaux sociaux / QR / lien, arrive sur la page publique : services, **prix**, horaires, bouton « Commander », bouton WhatsApp.
2. Formulaire de commande : nom, **numéro WhatsApp**, services + quantités, mode (dépôt au pressing / ramassage à domicile / livraison à domicile), adresse (si domicile), date et heure souhaitées, commentaire.
3. La demande est enregistrée avec le statut `REQUEST` (**ne compte pas dans le chiffre d'affaires**). Le client reçoit un **code de suivi de demande** (ex. `D-0042`, numérotation propre aux demandes, distincte des tickets officiels) et un bouton « Confirmer sur WhatsApp » (message prérempli avec le code).
4. Page de suivi : code + téléphone → statut de la commande (sans compte).
5. **Anti-spam** (obligatoire) : champ piège invisible (honeypot), limitation de débit **fondée d'abord sur le numéro de téléphone normalisé**, l'IP n'étant qu'un critère secondaire (réseaux mobiles et Wi-Fi partagés : plusieurs clients peuvent avoir la même IP), avec un **blocage doux** (message clair, réessai plus tard) plutôt qu'un blocage agressif ; l'IP est **hachée** et conservée très peu de temps ; le tout via table/fonction SQL, sans service externe ; validation Zod stricte, normalisation du numéro (indicatif pays). La validation admin est le filtre final.

Sécurité de la partie publique : lecture publique **uniquement** des services actifs et du profil public de l'organisation. La création de demande et le suivi passent par une Server Action ou une fonction RPC `SECURITY DEFINER` limitée et validée. **Aucune lecture publique** des tables commandes/clients. La clé `service_role` n'est jamais exposée côté client.

## 6. CYCLE D'UNE COMMANDE

Statuts : `REQUEST` → `VALIDATED` → `RECEIVED` (linge reçu et compté) → `PROCESSING` → `READY` → `DELIVERED` ; sorties : `REJECTED`, `CANCELLED`.

- Le **ticket officiel** (`LB-0001`, ...) n'est attribué qu'au passage à `RECEIVED`, c'est-à-dire quand le linge est **réellement réceptionné et compté**. Une demande en ligne (`D-0042`) refusée ou jamais honorée ne consomme donc aucun numéro de ticket.
- À la réception : comptage des articles et **étiquetage numéroté** du linge avec le numéro du ticket.
- Le suivi du linge reste volontairement simple (reçu et compté → en traitement → prêt → remis). Pas d'étapes détaillées de production en phase 1 : le personnel ne les saisirait pas.

- L'admin/caissier **valide** une demande en ligne (peut ajuster, ajouter un tarif de livraison). Après validation, bouton **« Envoyer la facture sur WhatsApp »** : ouvre `wa.me` avec le message préparé contenant le lien `/f/{token}`.
- Les commandes prises au comptoir sont **saisies dans le même système** (statut `RECEIVED` direct).
- Modèles de messages WhatsApp configurables par organisation, avec variables `{nom}`, `{code}`, `{montant}`, `{lien_facture}`, `{date}` : facture, commande prête, relance, ramassage prévu, livraison en cours.
- **Facture** (`/f/{token}`) : page imprimable (CSS print) avec logo, lignes, total, acompte/reste à payer, QR vers le suivi. Token aléatoire long (non devinable). Elle n'affiche que le strict nécessaire.

## 7. CONTRÔLES ANTI-DÉTOURNEMENT (priorité haute)

Le logiciel doit rendre la fraude **difficile et visible**. À implémenter :

1. **Ticket numéroté sans trous** par organisation (`LB-0001`, `LB-0002`, ...), séquence gérée en base, **attribué uniquement à la réception effective du linge** (statut `RECEIVED`). Règle métier : « pas de ticket, pas de linge ». L'attribution du ticket et le passage à `RECEIVED` se font dans **une seule transaction PostgreSQL atomique**, jamais générés côté frontend. Une opération échouée ne consomme aucun numéro. Attention : une `SEQUENCE` PostgreSQL native n'est **pas** sans trou (elle n'est pas annulée en cas de rollback) ; utiliser plutôt un compteur par organisation (ligne verrouillée, `UPDATE ... RETURNING`) dans la même transaction.
2. **Aucune suppression physique** de commandes ou de paiements. Seule l'**annulation avec motif obligatoire**, réservée à `MANAGER`/`OWNER`.
3. **Journal d'audit en lecture seule** (`audit_logs` : qui, quand, action, avant/après en JSON) alimenté par des triggers PostgreSQL (qui se déclenchent même sur un `UPDATE` direct) ; ni modification ni suppression possible pour les utilisateurs de l'organisation.
   **Principe d'architecture** : les politiques RLS autorisent le strict minimum en écriture directe. Les **actions sensibles** (annulation, remise, changement de prix, dérogation de livraison, clôture de caisse, correction de paiement) passent **uniquement** par une fonction RPC ou une Server Action qui vérifie le rôle, exige le motif et écrit dans l'audit. Aucun `UPDATE` direct de ces champs depuis le frontend (flux : utilisateur → RPC/Server Action autorisée → PostgreSQL → trigger → `audit_logs`).
4. **Prix figé** : le prix unitaire est copié dans la ligne de commande à la création. Toute modification ensuite = `MANAGER`/`OWNER` + motif + audit.
5. **Remises** : réservées à `MANAGER`/`OWNER`, motif obligatoire, visibles dans les rapports.
6. **Paiements en écritures** (`payments` : montant, mode CASH/MTN_MOMO/AIRTEL_MONEY/OTHER, référence, encaissé par, date). Pas de modification : une erreur se corrige par une écriture inverse avec motif.
7. **Pas de livraison sans paiement** : passer en `DELIVERED` une commande non soldée exige une dérogation `MANAGER`/`OWNER` avec motif (créance client enregistrée).
8. **Comptage des articles** : nombre d'articles à la réception, et revérification à la remise (case « articles vérifiés »). Un écart est consigné.
9. **Clôture de caisse journalière** : espèces attendues (calculées) vs espèces comptées (saisies) → écart enregistré ; une fois clôturée, la journée est verrouillée.
10. **Tableau d'alertes pour l'OWNER** : annulations, remises, modifications après validation, commandes livrées non payées, écarts de caisse, activité hors horaires, un même utilisateur cumulant beaucoup d'annulations.
11. **Droits limités** : un `CASHIER` ne voit pas les statistiques globales ni les marges, seulement les commandes qu'il traite ; il ne peut pas changer les prix ni exporter les données clients.
12. **Résumé quotidien** pour le propriétaire : bouton qui ouvre WhatsApp avec le résumé du jour (CA, encaissements par mode, nombre de commandes, annulations, écart de caisse).

## 8. ADMINISTRATION

Interface mobile-first : `/admin` (tableau de bord), `/admin/commandes`, `/admin/clients`, `/admin/services`, `/admin/paiements`, `/admin/caisse`, `/admin/alertes`, `/admin/equipe`, `/admin/parametres`.

- Tableau de bord : CA du jour/du mois, commandes à valider, à préparer, prêtes, livraisons du jour, impayés.
- Commandes : tableau sur desktop, **cartes sur mobile** ; filtres par statut ; actions rapides (Valider, Reçu, Prêt, Livré, Prévenir le client).
- Clients : nom, téléphone, nombre de commandes, total dépensé, dernière commande, historique.
- Services : créer/modifier/désactiver, prix et description configurables (jamais codés en dur). Champ **coût interne facultatif** (visible uniquement par `OWNER`/`MANAGER`, jamais par `CASHIER`) pour préparer une future analyse de marge ; **aucun écran d'analyse de marge en phase 1**.
- Équipe : inviter un employé (Supabase Auth), attribuer un rôle, désactiver un accès.
- Statistiques simples (jour/semaine/mois, services les plus demandés, clients récurrents) à partir des vraies données.

## 9. DESIGN ET UX

- Mobile-first : 360, 390, 430 px d'abord. Aucun défilement horizontal, boutons faciles au doigt, texte lisible.
- Thème par organisation. Pour LB Pressing : noir / blanc / or, sobre, propre, rassurant (couleurs modifiables dans les paramètres).
- États loading / vide / erreur / succès, toasts, confirmation avant les actions sensibles.
- PWA installable pour le dashboard (manifest + icônes), sans complexité inutile.
- SEO de la page publique de chaque pressing (title, description, Open Graph), `robots.txt`, `sitemap.xml`.

## 10. DONNÉES (indicatif, à affiner)

`organizations`, `memberships`, `platform_admins`, `customers` (unique par organisation + téléphone), `services` (avec `cost_price` facultatif), `orders` (`subtotal`, `delivery_fee`, `discount_amount`, `total_amount` ; **`paid_amount` et `balance_due` sont dérivés des écritures `payments`** par vue ou calcul en base, jamais saisis ni modifiables à la main), `order_items`, `payments`, `cash_closings`, `message_templates`, `audit_logs`, `rate_limits`. UUID partout, `created_at`/`updated_at`, index sur `organization_id` et les colonnes filtrées. Migrations SQL versionnées.

## 11. MÉTHODE

Avant de coder : inspecter le projet existant, `package.json`, version de Next.js, Tailwind, Supabase, variables d'environnement. Ne rien détruire sans raison ; si le projet est vide, initialiser proprement.

Travailler **par phases, en s'arrêtant à la fin de chacune pour validation** :

- **Phase 1 : socle** : schéma, migrations, RLS multi-tenant + tests d'isolation, authentification, rôles, configuration d'organisation, seed (organisation de démonstration clairement fictive). **Condition de passage : la Phase 2 ne démarre que si tous les tests d'isolation entre organisations réussissent, et après ma validation explicite.** Une isolation mal construite est un risque de sécurité majeur dès que plusieurs pressings seront dans le système.
- **Phase 2 : cœur LB Pressing** : services, page publique, commande sans compte, validation, cycle de commande, facture + bouton WhatsApp, clients, paiements.
- **Phase 3 : anti-détournement** : audit, annulations, dérogations, comptage, clôture de caisse, alertes, droits par rôle.
- **Phase 4 : finition** : statistiques, PWA, SEO, optimisation mobile, tests, déploiement Vercel.
- **Plus tard (hors périmètre actuel)** : inscription en libre-service d'autres pressings, abonnement payant, fidélité/coupons, suivi détaillé du linge étape par étape, analyse de marge, API WhatsApp, Mobile Money.

## 12. RÈGLES IMPORTANTES

- **Ne rien simuler.** Si une fonctionnalité n'est pas réellement reliée à Supabase, le dire. Les formulaires enregistrent vraiment, le dashboard lit de vraies données.
- Numéros de téléphone, nom, slogan, couleurs : **dans la configuration/base**, jamais dispersés dans les composants. Pour le seed LB Pressing : téléphones `06 731 1016` et `06 766 2712`, indicatif `242`.
- Variables `NEXT_PUBLIC_` uniquement pour le réellement public. Jamais de `service_role` côté client.
- Supprimer ou changer tout compte de test avant la mise en production.
- Composants courts et réutilisables ; architecture claire (`features/`, `lib/supabase`, `lib/whatsapp`, `lib/validations`, `config/`).

## 13. TESTS À EXÉCUTER

Isolation RLS entre organisations ; création demande publique + anti-spam (limitation par téléphone, blocage doux) ; ticket officiel attribué uniquement à la réception, sans trou ; impossibilité de modifier directement les champs sensibles (annulation, remise, prix) sans passer par la RPC/Server Action ; validation et changement de statut ; calcul des totaux ; blocage de la suppression ; audit des modifications ; livraison impayée refusée sans dérogation ; clôture de caisse ; génération des liens `wa.me` (indicatif, encodage) ; protection des routes admin par rôle ; responsive mobile/desktop ; `build` sans erreur TypeScript.

## 14. LIVRABLE (à la fin de chaque phase)

Architecture, fichiers créés/modifiés, schéma et migrations, variables d'environnement, commandes d'installation/migration/lancement/build, procédure Vercel, fonctionnalités terminées, restantes, et limites connues.

**CONSTRUIS réellement l'application dans le repository courant.** Commence par inspecter le projet existant, puis propose le plan de la Phase 1 avant de coder.
