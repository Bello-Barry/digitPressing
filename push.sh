#!/data/data/com.termux/files/usr/bin/bash

# Activer l'export automatique des variables
set -o allexport

# Charger les variables depuis plusieurs sources possibles
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
    echo "⚠️  Aucun fichier de configuration trouvé."
fi

# Désactiver l'export automatique
set +o allexport

# 🔒 Demander le token interactivement s'il n'est pas défini
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ GITHUB_TOKEN non trouvé dans les fichiers de configuration."
    echo "🔑 Veuillez saisir votre token GitHub :"
    read -s GITHUB_TOKEN
    
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "❌ Token vide. Abandon."
        exit 1
    fi
    
    # Optionnel: sauvegarder dans .env pour les prochaines fois
    read -p "💾 Voulez-vous sauvegarder ce token dans .env ? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "GITHUB_TOKEN=$GITHUB_TOKEN" > .env
        echo "✅ Token sauvegardé dans .env"
    fi
fi

# Vérifier que le token a le bon format
if [[ ! "$GITHUB_TOKEN" =~ ^(ghp_|github_pat_) ]]; then
    echo "⚠️  Le token ne semble pas avoir le bon format (devrait commencer par ghp_ ou github_pat_)"
    read -p "Continuer quand même ? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# ✅ Variables du projet
GITHUB_USERNAME="Bello-Barry"
REPO_NAME="digitPressing"
PROJECT_DIR="/data/data/com.termux/files/home/digit-pressing"

# Aller dans le projet
cd "$PROJECT_DIR" || { echo "❌ Erreur : dossier $PROJECT_DIR introuvable"; exit 1; }

# Initialiser Git si nécessaire
[ -d .git ] || git init

# Créer un README si absent
[ -f README.md ] || echo "# $REPO_NAME" > README.md

# Ajouter tous les fichiers
git add .

# Faire un commit (même s'il n'y a rien à committer, ignorer l'erreur)
git commit -m "Ajout de tous les fichiers du projet" || echo "ℹ️  Rien à committer"

# Créer ou forcer la branche main
git branch -M main

# Ajouter le remote origin si absent
git remote get-url origin >/dev/null 2>&1 || \
  git remote add origin https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git

# Définir l'URL avec token pour push
git remote set-url origin https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${REPO_NAME}.git

# Fonction pour tenter le push
attempt_push() {
    echo "🚀 Tentative de push..."
    if git push -u origin main 2>/dev/null; then
        echo "✅ Push réussi!"
        return 0
    else
        return 1
    fi
}

# Fonction pour synchroniser avec le distant
sync_with_remote() {
    echo "🔄 Synchronisation avec le repository distant..."
    git fetch origin 2>/dev/null || {
        echo "⚠️ Impossible de fetch. Repository peut-être vide."
        return 1
    }
    
    if git pull origin main --allow-unrelated-histories --no-edit 2>/dev/null; then
        echo "✅ Synchronisation réussie"
        return 0
    else
        echo "⚠️ Conflits détectés ou synchronisation impossible"
        return 1
    fi
}

# Test de connexion GitHub
echo "🔍 Test de connexion GitHub..."
if curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user >/dev/null; then
    echo "✅ Token valide"
else
    echo "❌ Token invalide ou connexion impossible"
    echo "🔧 Vérifiez votre token sur: https://github.com/settings/tokens"
    exit 1
fi

# Stratégie de push intelligente
echo "📤 Début du processus de push..."

# Tentative 1: Push direct
if attempt_push; then
    echo "🎉 Push direct réussi!"
elif sync_with_remote && attempt_push; then
    echo "🎉 Push réussi après synchronisation!"
else
    # Demander confirmation pour push forcé
    echo "⚠️ Push normal impossible. Options disponibles:"
    echo "1. Push forcé (écrase l'historique distant)"
    echo "2. Annuler et résoudre manuellement"
    
    read -p "Choisissez (1/2): " -n 1 -r choice
    echo
    
    case $choice in
        1)
            echo "🔥 Push forcé en cours..."
            if git push -f origin main; then
                echo "✅ Push forcé réussi!"
            else
                echo "❌ Échec du push forcé. Erreur d'authentification."
                exit 1
            fi
            ;;
        2)
            echo "❌ Push annulé. Résolvez les conflits manuellement avec:"
            echo "   git pull origin main --allow-unrelated-histories"
            echo "   # Résoudre les conflits"
            echo "   git push origin main"
            exit 1
            ;;
        *)
            echo "❌ Choix invalide. Abandon."
            exit 1
            ;;
    esac
fi

# Nettoyage : remettre l'URL sans token
git remote set-url origin https://github.com/${GITHUB_USERNAME}/${REPO_NAME}.git

echo "✅ Processus terminé avec succès!"
echo "🌐 Repository: https://github.com/${GITHUB_USERNAME}/${REPO_NAME}"