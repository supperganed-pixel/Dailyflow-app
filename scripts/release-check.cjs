const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'artifacts/dailyflow');
const config = fs.readFileSync(path.join(app, 'app.config.ts'), 'utf8');
const eas = JSON.parse(fs.readFileSync(path.join(app, 'eas.json')));
const problems = [];
if (/com\.example\./.test(config)) problems.push('Replace the example Android package identifier.');
if (!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(config)) problems.push('Link a real EAS project ID.');
if (eas.build.preview.android.buildType !== 'apk') problems.push('Preview must produce a directly installable APK.');
if (!config.includes('allowBackup: false')) problems.push('Disable automatic Android backup for private task data.');
if (!fs.existsSync(path.join(app, 'assets/images/icon.png'))) problems.push('App icon is missing.');
if (process.env.EXPO_PUBLIC_SUPABASE_URL && !process.env.EXPO_PUBLIC_SUPABASE_URL.startsWith('https://')) problems.push('Supabase requires an HTTPS project URL.');
if (eas.build.preview.environment !== 'preview') problems.push('Preview must use the configured EAS preview environment.');
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Release configuration checks passed. A signed native build and on-device checks are still required.');
