/**
 * Sync flag-icons from node_modules into assets/ for static hosting (paths in CSS are relative to css/).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcRoot = path.join(root, 'node_modules', 'flag-icons');
const destRoot = path.join(root, 'assets', 'vendor', 'flag-icons');

const cssSrc = path.join(srcRoot, 'css', 'flag-icons.min.css');
if (!fs.existsSync(cssSrc)) {
  process.stderr.write('copy-flag-icons: skip (npm install flag-icons first)\n');
  process.exit(0);
}

fs.mkdirSync(path.join(destRoot, 'css'), { recursive: true });
fs.copyFileSync(cssSrc, path.join(destRoot, 'css', 'flag-icons.min.css'));

const flagsSrc = path.join(srcRoot, 'flags');
const flagsDest = path.join(destRoot, 'flags');
fs.rmSync(flagsDest, { recursive: true, force: true });
fs.cpSync(flagsSrc, flagsDest, { recursive: true });
process.stdout.write('copy-flag-icons: synced to assets/vendor/flag-icons\n');
