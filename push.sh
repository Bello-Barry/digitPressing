#!/data/data/com.termux/files/usr/bin/bash

# =====================================
# 🚀 GESTION AUTOMATIQUE DE SYNC GITHUB
# Compatible Termux / Android
# =====================================

set -o allexport

# Charger les variables d'environnement
if [ -f .env ]; then
    echo "📄 Chargement depuis .env"
    source .env
elif [ -f .env.local ]; then
    echo "📄 Chargement depuis .env.local"
    source .env.local
elif [ -f .env.example.backup ]; then
    echo "📄 Chargement depuis .env.example.backup"
    source .env.example.backup
else
    echo "⚠️ Aucun fichier .env trouvé"
fi

set +o allexport

# 🔒 Demande interactive du token si absent
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN non trouvé."
    read -s -p "🔑 Saisis ton token GitHub : " GITHUB_TOKEN
    echo
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "❌ Token vide. Abandon."
        exit 1
    fi
    read -p "💾 Sauvegarder ce token dans .env ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "GITHUB_TOKEN=$GITHUB_TOKEN" > .env
        echo "✅ Token sauvegardé dans .env"
    fi
fi

# Vérification du format du token
if [[ ! "$GITHUB_TOKEN" =~ ^(ghp_|github_pat_) ]]; then
    echo "⚠️ Le token semble invalide."
    read -p "Continuer quand même ? (y/N): " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
fi

# =====================================
# 🧰 Variables de configuration
# =====================================
GITHUB_USERNAME="Bello-Barry"
REPO_NAME="digitPressing"
PROJECT_DIR="/data/data/com.termux/files/home/digit-pressing"

cd "$PROJECT_DIR" || { echo "❌ Dossier introuvable: $PROJECT_DIR"; exit 1; }

[ -d .git ] || git init
[ -f README.md ] || echo "# $REPO_NAME" > README.md

# =====================================
# 🔍 Test du token GitHub
# =====================================
echo "🔍 Vérification du token GitHub..."
if ! curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user >/dev/null; then
    echo "❌ Token invalide ou connexion impossible."
    echo "🔧 Vérifie ton token sur https://github.com/settings/tokens"
    exit 1
fi
echo "✅ Token valide."

# =====================================
# ⚙️ Config Git et remote
# =====================================
git branch -M main
git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git
git remote set-url origin https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git

# =====================================
# 🧠 Étape 1 — Sauvegarder les changements locaux
# =====================================
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "💾 Sauvegarde temporaire des changements locaux..."
    git add .
    git commit -m "Sauvegarde temporaire avant synchronisation"
else
    echo "✅ Aucun changement local à sauvegarder."
fi

# =====================================
# 🔄 Étape 2 — Synchronisation intelligente
# =====================================
echo "🔄 Synchronisation avec GitHub..."
if git fetch origin 2>/dev/null; then
    if git rebase origin/main 2>/dev/null; then
        echo "✅ Synchronisation réussie avec rebase."
    else
        echo "⚠️ Conflits détectés. Tentative de stash..."
        git stash push -m "stash_auto"
        git pull origin main --rebase --no-edit
        git stash pop || echo "⚠️ Conflits à résoudre manuellement."
    fi
else
    echo "⚠️ Impossible de fetch (peut-être dépôt vide ou inexistant)."
fi

# =====================================
# 🚀 Étape 3 — Push automatique
# =====================================
echo "📤 Tentative de push vers GitHub..."
if git push -u origin main; then
    echo "✅ Push réussi !"
else
    echo "⚠️ Échec du push normal, tentative de push forcé..."
    git push -f origin main && echo "🔥 Push forcé réussi !" || echo "❌ Push forcé échoué."
fi

# =====================================
# 🧹 Nettoyage final
# =====================================
git remote set-url origin https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git
echo "🌍 Synchronisation complète : https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"
echo "✅ Script terminé avec succès !"