# =============================================================================
# DOCKERFILE OPTIMISÉ - ZUA PRESSING PWA
# =============================================================================

# Utiliser Node.js 18 Alpine pour un build léger
FROM node:18-alpine AS base

# Installation des dépendances système nécessaires
RUN apk add --no-cache libc6-compat

# Définir le répertoire de travail
WORKDIR /app

# =============================================================================
# ÉTAPE 1: INSTALLATION DES DÉPENDANCES
# =============================================================================
FROM base AS deps

# Copier les fichiers de dépendances
COPY package.json package-lock.json* ./

# Installer les dépendances
RUN npm ci --only=production --ignore-scripts

# =============================================================================
# ÉTAPE 2: BUILD DE L'APPLICATION
# =============================================================================
FROM base AS builder

# Copier les dépendances installées
COPY --from=deps /app/node_modules ./node_modules

# Copier tous les fichiers source
COPY . .

# Variables d'environnement pour le build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Arguments de build pour les variables d'environnement
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXTAUTH_SECRET

# Définir les variables d'environnement pour le build
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Vérification des variables d'environnement critiques
RUN if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then echo "ERREUR: NEXT_PUBLIC_SUPABASE_URL est requis" && exit 1; fi
RUN if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then echo "ERREUR: NEXT_PUBLIC_SUPABASE_ANON_KEY est requis" && exit 1; fi

# Build de l'application
RUN npm run build

# =============================================================================
# ÉTAPE 3: IMAGE DE PRODUCTION
# =============================================================================
FROM base AS runner

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier les fichiers publics
COPY --from=builder /app/public ./public

# Définir les permissions pour les fichiers statiques
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copier les fichiers de build avec les bonnes permissions
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Variables d'environnement de production
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Exposer le port
EXPOSE 3000

# Passer à l'utilisateur non-root
USER nextjs

# Health check pour Docker
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Commande de démarrage
CMD ["node", "server.js"]

# =============================================================================
# MÉTADONNÉES
# =============================================================================

# Labels pour la documentation
LABEL maintainer="Digit Pressing Team <support@zua-pressing.com>"
LABEL description="Digit Pressing - Application PWA de gestion digitale pour pressings"
LABEL version="1.0.0"
LABEL vendor="Digit Pressing"

# Variables d'environnement par défaut
ENV NODE_OPTIONS="--max-old-space-size=1024"
ENV TZ="Europe/Paris"

# Optimisations pour la production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true