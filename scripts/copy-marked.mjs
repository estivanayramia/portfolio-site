// Copy marked.min.js from node_modules to assets/vendor for first-party loading
import { copyFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = __dirname + '/../node_modules/marked/lib/marked.umd.js';
const dest = __dirname + '/../assets/vendor/marked.min.js';

copyFileSync(src, dest);
console.log('Copied marked.min.js to assets/vendor/marked.min.js');
