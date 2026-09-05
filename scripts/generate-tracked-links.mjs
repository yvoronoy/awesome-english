#!/usr/bin/env node
// Rewrites external resource links in readme.md to route through a static
// redirect page (go/<slug>/index.html) so clicks made on github.com's README
// view can also be tracked in Umami — github.com strips JS, but GitHub Pages
// serves these redirect pages as plain HTML that tracks then forwards.
//
// Slugs are readable (derived from the resource's title, e.g. "6-minute-english")
// so Umami's Pages/Events reports are identifiable at a glance, instead of an
// opaque hash.
//
// Safe to re-run: already-tracked links and heading/badge links are left
// alone, and slugs are stable across runs via scripts/link-map.json (keyed
// by the original URL, so a later title edit won't change the slug/URL).
// Map entries and go/ pages for URLs removed from readme.md are pruned
// automatically, so deleting a README line is enough to retire its link.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const README_PATH = join(ROOT, 'readme.md');
const MAP_PATH = join(ROOT, 'scripts', 'link-map.json');
const GO_DIR = join(ROOT, 'go');
const TRACK_BASE = 'https://yvoronoy.github.io/awesome-english/go/';
const UMAMI_WEBSITE_ID = '650f3ef1-f91e-4185-af3e-3f74823f6b76';

const map = existsSync(MAP_PATH) ? JSON.parse(readFileSync(MAP_PATH, 'utf8')) : {};
const usedSlugs = new Set(Object.values(map).map((e) => e.slug));

function slugify(text) {
  let s = text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > 60) {
    const cut = s.slice(0, 60);
    const lastDash = cut.lastIndexOf('-');
    s = (lastDash > 20 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '');
  }
  if (!s) s = createHash('sha1').update(text).digest('hex').slice(0, 8);
  return s;
}

function slugFor(url, title) {
  if (map[url]) return map[url].slug;
  let base = slugify(title);
  let slug = base;
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${base}-${n}`;
    n++;
  }
  usedSlugs.add(slug);
  map[url] = { slug, title };
  return slug;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let readme = readFileSync(README_PATH, 'utf8');
const lines = readme.split('\n');

const inlineLinkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const refDefRe = /^(\[([a-z0-9-]+)\]:\s*)(https?:\/\/\S+)(\s*)$/i;
const refUsageRe = (label) => new RegExp(`\\[([^\\]]+)\\]\\[${label}\\]`, 'i');

let rewritten = 0;

const newLines = lines.map((line) => {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('#')) return line; // skip headings (e.g. the top badge line)

  const refMatch = line.match(refDefRe);
  if (refMatch) {
    const [, prefix, label, url, suffix] = refMatch;
    if (url.startsWith(TRACK_BASE)) return line;
    rewritten++;
    // Prefer the actual display text used as [Text][label] in the body
    // (proper casing) over deriving a title from the label itself.
    const usageMatch = readme.match(refUsageRe(label));
    const title = usageMatch ? usageMatch[1] : label.replace(/-url$/i, '').replace(/-/g, ' ');
    return `${prefix}${TRACK_BASE}${slugFor(url, title)}/${suffix}`;
  }

  return line.replace(inlineLinkRe, (full, text, url) => {
    if (url.startsWith(TRACK_BASE)) return full;
    rewritten++;
    return `[${text}](${TRACK_BASE}${slugFor(url, text)}/)`;
  });
});

readme = newLines.join('\n');

// Prune map entries whose /go/<slug>/ is no longer referenced in the README
// (e.g. a resource was removed or repointed to a different URL), so removed
// links don't leave orphan redirect pages behind.
const referencedSlugs = new Set(
  [...readme.matchAll(new RegExp(`${TRACK_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([a-z0-9-]+)/`, 'g'))].map(
    (m) => m[1]
  )
);
let pruned = 0;
for (const [url, { slug }] of Object.entries(map)) {
  if (!referencedSlugs.has(slug)) {
    delete map[url];
    pruned++;
  }
}

writeFileSync(README_PATH, readme);
writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n');

rmSync(GO_DIR, { recursive: true, force: true });
mkdirSync(GO_DIR, { recursive: true });

for (const [url, { slug, title }] of Object.entries(map)) {
  const dir = join(GO_DIR, slug);
  mkdirSync(dir, { recursive: true });
  const safeUrl = escapeHtml(url);
  const safeTitle = escapeHtml(title);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="refresh" content="1; url=${safeUrl}">
<script defer src="https://cloud.umami.is/script.js" data-website-id="${UMAMI_WEBSITE_ID}"></script>
<style>body{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#24292f}</style>
</head>
<body>
<p>Redirecting to <a id="target" href="${safeUrl}">${safeTitle}</a>&hellip;</p>
<script>
(function () {
  var target = ${JSON.stringify(url)};
  var title = ${JSON.stringify(title)};
  var source = document.referrer.indexOf('github.com') !== -1
    ? 'readme-github'
    : (document.referrer.indexOf('yvoronoy.github.io') !== -1 ? 'readme-pages' : 'direct');
  var redirected = false;
  function go() {
    if (redirected) return;
    redirected = true;
    location.replace(target);
  }
  var fallbackTimer = setTimeout(go, 350);
  function track() {
    try {
      if (window.umami) window.umami.track('outbound', { url: target, title: title, source: source });
    } finally {
      clearTimeout(fallbackTimer);
      go();
    }
  }
  if (window.umami) {
    track();
  } else {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (window.umami || tries > 6) {
        clearInterval(iv);
        track();
      }
    }, 50);
  }
})();
</script>
</body>
</html>
`;
  writeFileSync(join(dir, 'index.html'), html);
}

console.log(`Rewrote ${rewritten} link(s) in readme.md`);
console.log(`Pruned ${pruned} orphaned link(s) from link-map.json`);
console.log(`Total tracked links: ${Object.keys(map).length}`);
console.log(`Generated ${Object.keys(map).length} redirect page(s) under go/`);
