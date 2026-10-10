// Collects my public repositories tagged with the `portfolio` topic and saves them to
// src/generated/projects.json, which the build turns into the "More projects" list.
//
// It runs before every build on GitHub Actions (on push, every day, and on demand), so tagging a
// repository on GitHub is all it takes to show it on the site. It never breaks the build: if GitHub
// can't be reached, the last saved list is kept.
//
//   npm run projects                          # needs network; uses GITHUB_TOKEN if set
//   PORTFOLIO_TOPIC=xyz npm run projects      # try it with another topic

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const USER = 'andrea-sofia-dev';
const TOPIC = process.env.PORTFOLIO_TOPIC || 'portfolio';
const API = process.env.GITHUB_API || 'https://api.github.com';
const MAX = 12;
// Shown as hand-written cards already, or not projects at all.
const SKIP = new Set([USER, `${USER}.github.io`, 'wp-doctor', 'wordpress-performance-case-study', 'roma-night-gp']);
const OUT = new URL('../src/generated/projects.json', import.meta.url);

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': `${USER}-portfolio-build`,
};
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

function previous() {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    return [];
  }
}

function save(projects) {
  mkdirSync(new URL('.', OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(projects, null, 2)}\n`);
}

// A demo link is worth showing only if it leads somewhere other than GitHub itself.
function demo(homepage) {
  try {
    const url = new URL(homepage);
    if (url.protocol !== 'https:' || url.hostname === 'github.com' || url.hostname.endsWith('.github.com')) return null;
    return url.href;
  } catch {
    return null;
  }
}

async function main() {
  const response = await fetch(`${API}/users/${USER}/repos?type=owner&sort=pushed&per_page=100`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status} ${response.statusText}`);
  const repos = await response.json();
  if (!Array.isArray(repos)) throw new Error('unexpected answer from GitHub');

  const tagged = repos.filter(
    (r) => r.topics?.includes(TOPIC) && !r.fork && !r.archived && !r.private && !SKIP.has(r.name),
  );
  const projects = tagged.slice(0, MAX).map((r) => ({
    name: r.name,
    description: (r.description || '').trim(),
    url: r.html_url,
    demo: demo(r.homepage),
    language: r.language || null,
    stars: r.stargazers_count || 0,
    topics: (r.topics || []).filter((t) => t !== TOPIC).slice(0, 4),
    pushedAt: r.pushed_at,
  }));
  if (tagged.length > MAX) console.warn(`fetch-projects: ${tagged.length} tagged, showing the ${MAX} updated most recently`);

  save(projects);
  console.log(`fetch-projects: ${projects.length} project(s) with the "${TOPIC}" topic${projects.length ? ': ' + projects.map((p) => p.name).join(', ') : ''}`);
}

main().catch((error) => {
  // Never fail the build because of GitHub: keep (or create) the last saved list.
  const kept = previous();
  save(kept);
  console.warn(`fetch-projects: could not reach GitHub (${error.message}); keeping the last list (${kept.length} project(s))`);
});
