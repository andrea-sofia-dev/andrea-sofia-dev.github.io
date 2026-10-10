// Fails when a data-i18n key in index.html has no Italian translation, or a translation is unused.
import { readFileSync } from 'node:fs';
import { it } from '../src/content.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const used = new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]));
const defined = new Set(Object.keys(it));
const runtimeOnly = new Set(['meta.title', 'copied']); // used from main.js

const missing = [...used].filter((k) => !defined.has(k));
const unused = [...defined].filter((k) => !used.has(k) && !runtimeOnly.has(k));

if (missing.length) console.error('Missing Italian text for:', missing.join(', '));
if (unused.length) console.error('Unused Italian keys:', unused.join(', '));
if (missing.length || unused.length) process.exit(1);
console.log(`i18n ok: ${used.size} keys`);
