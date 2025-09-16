#!/data/data/com.termux/files/usr/bin/bash

echo "🧹 Nettoyage des secrets dans les fichiers de configuration..."

# Sauvegarde des vrais secrets
if [ -f .env.example ]; then
    cp .env.example .env.example.backup
    echo "💾 Sauvegarde créée: .env.example.backup"
fi

# Nettoyer .env.example
if [ -f .env.example ]; then
    echo "🔧 Nettoyage de .env.example..."
    
    # Remplacer les tokens GitHub par des placeholders
    sed -i 's/ghp_[a-zA-Z0-9]\{36\}/your_github_token_here/g' .env.example
    sed -i 's/github_pat_[a-zA-Z0-9_]\{82\}/your_github_token_here/g' .env.example
    
    # Remplacer les autres secrets courants
    sed -i 's/sk-[a-zA-Z0-9]\{48\}/your_openai_api_key_here/g' .env.example
    sed -i 's/xoxb-[a-zA-Z0-9-]\{71\}/your_slack_token_here/g' .env.example
    
    # Remplacer les URLs de base de données avec mots de passe
    sed -i 's/postgresql:\/\/[^:]*:[^@]*@/postgresql:\/\/username:password@/g' .env.example
    sed -i 's/mysql:\/\/[^:]*:[^@]*@/mysql:\/\/username:password@/g' .env.example
    
    echo "✅ .env.example nettoyé"
fi

# Créer un .env.example propre si il n'existe pas
if [ ! -f .env.example ]; then
    cat > .env.example << 'EOF'
# Configuration de l'application
NODE_ENV=development
PORT=3000

# Base de données
DATABASE_URL=your_database_url_here

# GitHub (pour scripts de déploiement)
GITHUB_TOKEN=your_github_token_here
GITHUB_USERNAME=your_github_username

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_PROJECT_ID=your_project_id_here

# Autres APIs
OPENAI_API_KEY=your_openai_api_key_here
EOF
    echo "✅ .env.example créé avec des placeholders"
fi

# S'assurer que .env est dans .gitignore
if ! grep -q "\.env$" .gitignore 2>/dev/null; then
    echo ".env" >> .gitignore
    echo "🔒 .env ajouté à .gitignore"
fi

if ! grep -q "\.env\.local" .gitignore 2>/dev/null; then
    echo ".env.local" >> .gitignore
    echo "🔒 .env.local ajouté à .gitignore"
fi

echo "✅ Nettoyage terminé!"
echo ""
echo "📋 Actions effectuées:"
echo "  - Secrets remplacés par des placeholders dans .env.example"
echo "  - .env et .env.local ajoutés à .gitignore"
echo "  - Sauvegarde créée: .env.example.backup"
echo ""
echo "🔄 Vous pouvez maintenant faire:"
echo "  git add ."
echo "  git commit -m 'Remove secrets from .env.example'"
echo "  git push origin main"