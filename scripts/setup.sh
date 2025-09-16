#!/bin/bash

# =============================================================================
# SCRIPT DE CONFIGURATION INITIALE - Digit PRESSING
# =============================================================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Vérification des prérequis
check_prerequisites() {
    print_step "Vérification des prérequis"
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js n'est pas installé. Veuillez installer Node.js 18.17.0 ou supérieur."
        exit 1
    fi
    
    NODE_VERSION=$(node -v | sed 's/v//')
    REQUIRED_VERSION="18.17.0"
    if ! dpkg --compare-versions "$NODE_VERSION" "ge" "$REQUIRED_VERSION"; then
        print_error "Node.js version $NODE_VERSION détectée. Version $REQUIRED_VERSION ou supérieure requise."
        exit 1
    fi
    print_message "Node.js version $NODE_VERSION ✓"
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        print_error "npm n'est pas installé."
        exit 1
    fi
    NPM_VERSION=$(npm -v)
    print_message "npm version $NPM_VERSION ✓"
    
    # Vérifier Git
    if ! command -v git &> /dev/null; then
        print_warning "Git n'est pas installé. Recommandé pour le versioning."
    else
        GIT_VERSION=$(git --version | cut -d' ' -f3)
        print_message "Git version $GIT_VERSION ✓"
    fi
}

# Installation des dépendances
install_dependencies() {
    print_step "Installation des dépendances"
    
    if [ ! -f "package.json" ]; then
        print_error "Fichier package.json non trouvé. Êtes-vous dans le bon répertoire ?"
        exit 1
    fi
    
    print_message "Installation des dépendances npm..."
    npm install
    
    print_message "Dépendances installées avec succès ✓"
}

# Configuration des variables d'environnement
setup_environment() {
    print_step "Configuration des variables d'environnement"
    
    if [ ! -f ".env.example" ]; then
        print_error "Fichier .env.example non trouvé."
        exit 1
    fi
    
    if [ ! -f ".env.local" ]; then
        print_message "Création du fichier .env.local..."
        cp .env.example .env.local
        print_warning "Fichier .env.local créé. Veuillez configurer vos variables d'environnement :"
        echo "  - NEXT_PUBLIC_SUPABASE_URL"
        echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY" 
        echo "  - SUPABASE_SERVICE_ROLE_KEY"
        echo "  - NEXTAUTH_SECRET"
    else
        print_message "Fichier .env.local déjà existant ✓"
    fi
}

# Configuration de Supabase
setup_supabase() {
    print_step "Configuration Supabase (optionnel)"
    
    read -p "Voulez-vous configurer Supabase maintenant ? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if command -v supabase &> /dev/null; then
            print_message "CLI Supabase détectée ✓"
            
            if [ ! -f "supabase/config.toml" ]; then
                print_message "Initialisation du projet Supabase..."
                supabase init
            fi
            
            print_message "Pour configurer votre base de données :"
            echo "  1. Créez un nouveau projet sur https://supabase.com"
            echo "  2. Copiez l'URL et les clés dans .env.local"
            echo "  3. Exécutez : supabase db reset"
            echo "  4. Exécutez : npm run db:generate"
        else
            print_warning "CLI Supabase non installée."
            print_message "Pour installer : npm install -g supabase"
        fi
    fi
}

# Configuration des hooks Git
setup_git_hooks() {
    print_step "Configuration des hooks Git"
    
    if [ -d ".git" ]; then
        print_message "Configuration de Husky..."
        npx husky install
        npx husky add .husky/pre-commit "npx lint-staged"
        npx husky add .husky/commit-msg "npx commitlint --edit"
        print_message "Hooks Git configurés ✓"
    else
        print_warning "Pas de dépôt Git détecté. Hooks ignorés."
    fi
}

# Vérification de la configuration
verify_setup() {
    print_step "Vérification de la configuration"
    
    # Vérifier les variables d'environnement critiques
    if [ -f ".env.local" ]; then
        if grep -q "your-supabase-url" .env.local || grep -q "your-supabase-anon-key" .env.local; then
            print_warning "Variables d'environnement Supabase non configurées dans .env.local"
        else
            print_message "Variables d'environnement configurées ✓"
        fi
    fi
    
    # Test de build
    print_message "Test de compilation TypeScript..."
    npm run type-check
    
    print_message "Test de linting..."
    npm run lint
    
    print_message "Configuration vérifiée ✓"
}

# Génération des icônes PWA
generate_pwa_icons() {
    print_step "Génération des icônes PWA (optionnel)"
    
    read -p "Voulez-vous générer les icônes PWA maintenant ? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "public/logo.png" ]; then
            print_message "Génération des icônes PWA..."
            # Ici vous pourriez ajouter un script pour générer automatiquement
            # toutes les tailles d'icônes à partir d'un logo source
            print_message "Placez votre logo dans public/logo.png et utilisez un générateur d'icônes PWA"
            print_message "Recommandé : https://www.pwabuilder.com/imageGenerator"
        else
            print_warning "Fichier public/logo.png non trouvé. Créez d'abord votre logo."
        fi
    fi
}

# Fonction principale
main() {
    print_message "Bienvenue dans le script de configuration ZUA Pressing !"
    echo
    
    check_prerequisites
    install_dependencies
    setup_environment
    setup_supabase
    setup_git_hooks
    generate_pwa_icons
    verify_setup
    
    print_step "Configuration terminée !"
    print_message "Prochaines étapes :"
    echo "  1. Configurez vos variables d'environnement dans .env.local"
    echo "  2. Configurez votre base de données Supabase"
    echo "  3. Lancez le serveur de développement : npm run dev"
    echo "  4. Ouvrez http://localhost:3000"
    echo
    print_message "Documentation : README.md"
    print_message "Support : https://github.com/votre-repo/issues"
}

# Gestion des erreurs
trap 'print_error "Script interrompu. Configuration incomplète."' INT

# Exécution
main "$@"