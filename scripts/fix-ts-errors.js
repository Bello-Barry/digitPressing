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

function getAllFiles(dir, extensions) {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(item)) {
          traverse(fullPath);
        }
      } else {
        if (extensions.some(ext => fullPath.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

function main() {
  const files = getAllFiles(SRC_DIR, EXTENSIONS);
  console.log(`📁 ${files.length} fichiers trouvés`);
}

if (require.main === module) {
  main();
}
