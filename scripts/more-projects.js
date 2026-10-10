// Vite plugin: fills the "More projects" list in index.html from src/generated/projects.json
// (written by scripts/fetch-projects.js). With no tagged projects, the whole block is removed.
// The list is baked into the HTML, so it reads without JavaScript and the page makes no requests to GitHub.

import { readFileSync } from 'node:fs';

const DATA = new URL('../src/generated/projects.json', import.meta.url);
const BLOCK = /<!-- more-projects -->[\s\S]*?<!-- \/more-projects -->\s*/;
const LIST = '<!-- more-projects:list -->';

const escape = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function load() {
  try {
    const projects = JSON.parse(readFileSync(DATA, 'utf8'));
    return Array.isArray(projects) ? projects.filter((p) => p?.name && /^https:\/\/github\.com\//.test(p.url)) : [];
  } catch {
    return [];
  }
}

function item(p) {
  const meta = [];
  if (p.language) meta.push(`<span>${escape(p.language)}</span>`);
  if (p.stars) meta.push(`<span>★ ${Number(p.stars)}</span>`);
  // Only https links: the JSON can be edited by hand too.
  if (/^https:\/\/[^\s"'<>]+$/.test(p.demo || '')) meta.push(`<a href="${escape(p.demo)}" data-i18n="more.demo">Live demo</a>`);
  return `
              <li class="more-item">
                <h4><a href="${escape(p.url)}">${escape(p.name)}</a></h4>
                ${p.description ? `<p lang="en">${escape(p.description)}</p>` : ''}
                ${meta.length ? `<p class="more-meta mono">${meta.join('')}</p>` : ''}
              </li>`;
}

export function moreProjects() {
  return {
    name: 'more-projects',
    transformIndexHtml(html) {
      const projects = load();
      if (!projects.length) return html.replace(BLOCK, '');
      return html.replace(LIST, projects.map(item).join('') + '\n            ');
    },
  };
}
