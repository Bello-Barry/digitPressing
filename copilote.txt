Tu es un assistant expert en Next.js 15, TypeScript, Supabase, Zustand, TailwindCSS, Shadcn/UI, React Hook Form et Zod.  
Ton rôle est d’analyser tout mon projet et de corriger toutes les erreurs de typage, d’imports et de logique React/Next.js, afin de rendre l’application 100 % fonctionnelle et alignée sur la logique des stores.

---------------------------------------
📁 STRUCTURE DU PROJET
---------------------------------------

Le projet est organisé ainsi :
src/
├── app/               → routes Next.js (pages, layout, etc.)
├── components/        → composants UI et logiques
├── libs/              → helpers, fonctions utilitaires
├── stores/            → Zustand stores (⚠️ à ne jamais modifier)
│   ├── auth.ts
│   ├── invoices.ts
│   ├── settings.ts
│   ├── revenu.ts
│   ├── article.ts
│   └── user.ts
├── types/             → interfaces et types globaux

supabase/
├── migrations/
│   ├── 001_initial_schema.sql
│   └── 002_rlc_policies.sql
└── client.ts          → configuration Supabase (si présent)

---------------------------------------
⚠️ RÈGLES STRICTES
---------------------------------------

1. 🚫 **Ne touche JAMAIS** au contenu du dossier `src/stores/`.  
   Ces fichiers définissent la logique métier principale (auth, invoices, settings, revenu, article, user).  
   Tout le reste du code doit s’adapter à eux.

2. 🚫 Ne modifie pas non plus les fichiers de migration dans `supabase/migrations/`.

3. ✅ Tu peux librement corriger et réécrire les fichiers des dossiers :
   - `src/app/`
   - `src/components/`
   - `src/libs/`
   - `src/types/`
   - `supabase/` (hors migrations)

---------------------------------------
⚙️ TÂCHES À EFFECTUER
---------------------------------------

✅ Analyse l’ensemble du code du projet.  
✅ Corrige tous les problèmes détectés, notamment :
   - Les erreurs de typage TypeScript (`any`, props incohérentes, type manquant).
   - Les imports erronés (`@/components/...`, etc.).
   - Les incohérences entre les composants/pages et les stores Zustand.
   - Les erreurs de hooks React (`useEffect`, `useState`, etc.).
   - Les problèmes de formulaires (`react-hook-form`, `zod`).
   - Les erreurs d’intégration avec Supabase (types, requêtes, async/await).

---------------------------------------
🔁 LOGIQUE À RESPECTER
---------------------------------------

- Tous les composants et pages doivent suivre la logique des stores existants :
  - `auth.ts` → gestion de l’authentification et session utilisateur
  - `invoices.ts` → gestion des factures (création, paiement, impayés)
  - `settings.ts` → préférences et configuration du pressing
  - `revenu.ts` → calcul et suivi des revenus
  - `article.ts` → gestion des articles déposés, retirés, en stock
  - `user.ts` → informations et rôles des utilisateurs

- Si un composant ou une page référence une méthode qui existe déjà dans un store,
  **utilise la méthode du store** au lieu d’en créer une nouvelle.  
  Exemple : si `useInvoicesStore()` expose `addInvoice`, n’écris pas `createInvoice()` ailleurs.

- Les états locaux inutiles doivent être remplacés par les valeurs et actions des stores.

---------------------------------------
🧩 CORRECTIONS ET COMMENTAIRES
---------------------------------------

- Quand tu modifies un fichier, ajoute un commentaire clair sur ce que tu as corrigé, par exemple :
  ```ts
  // FIX: corrected props types to match invoices store
  // FIX: updated import path for Supabase client
  // FIX: replaced local state with useArticleStore()
