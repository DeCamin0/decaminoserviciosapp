const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../src/utils/routes.js');
let s = fs.readFileSync(filePath, 'utf8');

// 1) Replace full ternary so we always use BACKEND_BASE (path from second branch)
//    import.meta.env.DEV ? 'http://localhost:3000/api/XXX' : `${BACKEND_PROD_URL}/api/XXX`  ->  `${BACKEND_BASE}/api/XXX`
s = s.replace(
  /import\.meta\.env\.DEV\s*\?\s*'http:\/\/localhost:3000([^']*)'\s*:\s*`\$\{BACKEND_PROD_URL\}([^`]*)`/g,
  (_, p1, p2) => '`${BACKEND_BASE}' + (p2 || p1) + '`'
);
s = s.replace(
  /import\.meta\.env\.DEV\s*\?\s*`http:\/\/localhost:3000([^`]*)`\s*:\s*`\$\{BACKEND_PROD_URL\}([^`]*)`/g,
  (_, p1, p2) => '`${BACKEND_BASE}' + (p2 || p1) + '`'
);
// return import.meta.env.DEV ? ...
s = s.replace(
  /return import\.meta\.env\.DEV\s*\?\s*'http:\/\/localhost:3000([^']*)'\s*:\s*`\$\{BACKEND_PROD_URL\}([^`]*)`/g,
  (_, p1, p2) => 'return `${BACKEND_BASE}' + (p2 || p1) + '`'
);
s = s.replace(
  /return import\.meta\.env\.DEV\s*\?\s*`http:\/\/localhost:3000([^`]*)`\s*:\s*`\$\{BACKEND_PROD_URL\}([^`]*)`/g,
  (_, p1, p2) => 'return `${BACKEND_BASE}' + (p2 || p1) + '`'
);

// 2) Any remaining BACKEND_PROD_URL (e.g. in comments or edge cases)
s = s.replace(/BACKEND_PROD_URL/g, 'BACKEND_BASE');

fs.writeFileSync(filePath, s);
console.log('Fixed routes.js: BACKEND_BASE used everywhere');
