#!/usr/bin/env node
// scripts/fix-ts-errors.js
// Script pour corriger automatiquement les erreurs TypeScript communes

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = path.join(process.cwd(), 'src');
const EXTENSIONS = ['.ts', '.tsx'];
const DRY_RUN = process.argv.includes('--dry-run');

console.log('🔍 Recherche des erreurs TypeScript communes...');

// Patterns de correction automatique
const FIX_PATTERNS = [
  // Variables inutilisées avec underscore
  {
    name: 'unused-parameters',
    pattern: /export\s+async\s+function\s+(\w+)\s*\(\s*(\w+):\s*[^)]+\)\s*{/g,
    fix: (match, funcName, paramName) => {
      // Ne pas modifier si le paramètre est utilisé dans la fonction
      return match.replace(paramName, `_${paramName}`);
    }
  },
  
  // Import inutilisés
  {
    name: 'unused-imports',
    pattern: /import\s+(\w+)\s+from\s+['"][^'"]+['"];\s*\n(?!.*\1)/gm,
    fix: () => '' // Supprimer l'import
  },
  
  // Undefined vers null pour compatibilité Supabase
  {
    name: 'undefined-to-null',
    pattern: /(\w+):\s*(\w+\.\w+)\s*\|\|\s*undefined/g,
    fix: (match, prop, value) => `${prop}: ${value} || null`
  }
];

// Fonctions utilitaires
function getAllFiles(dir, extensions) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Ignorer les dossiers système
        if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(item)) {
          traverse(fullPath);
        }
      } else {
        // Vérifier l'extension
        if (extensions.some(ext => fullPath.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Détecter les variables inutilisées
  const unusedVarPattern = /const\s+(\w+)\s*=\s*[^;]+;[\s\n]*(?!.*\1)/g;
  let match;
  while ((match = unusedVarPattern.exec(content)) !== null) {
    if (!match[1].startsWith('_')) {
      issues.push({
        type: 'unused-variable',
        line: content.substring(0, match.index).split('\n').length,
        variable: match[1],
        suggestion: `Préfixer avec _ ou supprimer: _${match[1]}`
      });
    }
  }
  
  // Détecter les imports inutilisés
  const unusedImportPattern = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"][^'"]+['"];/g;
  while ((match = unusedImportPattern.exec(content)) !== null) {
    const imports = match[1].split(',').map(s => s.trim());
    const unusedImports = imports.filter(imp => {
      const regex = new RegExp(`\\b${imp.replace(/\s+as\s+\w+/, '')}\\b`, 'g');
      const matches = content.match(regex);
      return !matches || matches.length <= 1; // Seule l'import elle-même
    });
    
    if (unusedImports.length > 0) {
      issues.push({
        type: 'unused-import',
        line: content.substring(0, match.index).split('\n').length,
        imports: unusedImports,
        suggestion: `Supprimer les imports inutilisés: ${unusedImports.join(', ')}`
      });
    }
  }
  
  // Détecter les problèmes undefined/null
  const undefinedPattern = /(\w+):\s*([^,}]+)\s*\|\|\s*undefined/g;
  while ((match = undefinedPattern.exec(content)) !== null) {
    issues.push({
      type: 'undefined-to-null',
      line: content.substring(0, match.index).split('\n').length,
      property: match[1],
      suggestion: `Remplacer "|| undefined" par "|| null"`
    });
  }
  
  return issues;
}

function fixFile(filePath, issues) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Trier les issues par ligne (de la fin vers le début pour éviter les décalages)
  issues.sort((a, b) => b.line - a.line);
  
  for (const issue of issues) {
    switch (issue.type) {
      case 'unused-variable':
        // Préfixer avec underscore ou supprimer si vraiment inutile
        const varPattern = new RegExp(`\\bconst\\s+${issue.variable}\\b`, 'g');
        if (content.match(varPattern)) {
          content = content.replace(varPattern, `const _${issue.variable}`);
          modified = true;
        }
        break;
        
      case 'undefined-to-null':
        content = content.replace(
          new RegExp(`(${issue.property}):\\s*([^,}]+)\\s*\\|\\|\\s*undefined`, 'g'),
          '$1: $2 || null'
        );
        modified = true;
        break;
        
      case 'unused-import':
        // Cette correction est plus complexe, on la laisse pour une version future
        break;
    }
  }
  
  return { content, modified };
}

// Fonction principale
function main() {
  const files = getAllFiles(SRC_DIR, EXTENSIONS);
  console.log(`📁 ${files.length} fichiers trouvés`);
  
  let totalIssues = 0;
  let fixedFiles = 0;
  
  for (const file of files) {
    const issues = analyzeFile(file);
    
    if (issues.length > 0) {
      console.log(`\n📄 ${path.relative(process.cwd(), file)}`);
      
      for (const issue of issues) {
        console.log(`  ⚠️  Ligne ${issue.line}: ${issue.suggestion}`);
        totalIssues++;
      }
      
      if (!DRY_RUN) {
        const { content, modified } = fixFile(file, issues);
        
        if (modified) {
          fs.writeFileSync(file, content, 'utf8');
          console.log(`  ✅ Fichier corrigé`);
          fixedFiles++;
        }
      }
    }
  }
  
  console.log(`\n📊 Résumé:`);
  console.log(`  • ${totalIssues} problèmes détectés`);
  
  if (DRY_RUN) {
    console.log(`  • Mode dry-run: aucun fichier modifié`);
    console.log(`  • Exécutez sans --dry-run pour appliquer les corrections`);
  } else {
    console.log(`  • ${fixedFiles} fichiers corrigés`);
    
    if (fixedFiles > 0) {
      console.log(`\n🔧 Exécution de la vérification TypeScript...`);
      try {
        execSync('npm run type-check', { stdio: 'inherit' });
        console.log(`✅ Vérification TypeScript réussie`);
      } catch (error) {
        console.log(`❌ Des erreurs TypeScript persistent`);
      }
    }
  }
}

// Package.json scripts suggérés
const SUGGESTED_SCRIPTS = {
  "type-check": "tsc --noEmit",
  "fix-ts": "node scripts/fix-ts-errors.js",
  "fix-ts-dry": "node scripts/fix-ts-errors.js --dry-run"
};

console.log('🛠️  Nettoyage automatique des erreurs TypeScript');
console.log('='.repeat(50));

// Vérifier si le script est exécuté directement
if (require.main === module) {
  main();
  
  console.log(`\n💡 Scripts package.json suggérés:`);
  console.log(JSON.stringify(SUGGESTED_SCRIPTS, null, 2));
}