import fs from 'fs';
import path from 'path';

const src = path.join(process.cwd(), 'dist', 'pagefind');
const dest = path.join(process.cwd(), 'public', 'pagefind');

function copyDir(srcDir: string, destDir: string) {
  if (!fs.existsSync(srcDir)) return;
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  if (fs.existsSync(src)) {
    console.log('Copying pagefind production index to public/pagefind for local dev mode...');
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDir(src, dest);
    console.log('Pagefind index synced successfully to public/pagefind.');
  }
} catch (err) {
  console.error('Failed to copy pagefind index:', err);
}
