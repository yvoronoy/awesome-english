#!/usr/bin/env node
// Rewrites external resource links in readme.md to route through a static
// redirect page (go/<slug>/index.html) so clicks made on github.com's README
// view can also be tracked in Umami — github.com strips JS, but GitHub Pages
// serves these redirect pages as plain HTML that tracks then forwards.
//
// Safe to re-run: already-tracked links and heading/badge links are left
// alone, and slugs are stable across runs via scripts/link-map.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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

function slugFor(url) {
  if (map[url]) return map[url];
  let slug = createHash('sha1').update(url).digest('hex').slice(0, 8);
  const used = new Set(Object.values(map));
  let len = 8;
  while (used.has(slug)) {
    len += 2;
    slug = createHash('sha1').update(url).digest('hex').slice(0, len);
  }
  map[url] = slug;
  return slug;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let readme = readFileSync(README_PATH, 'utf8');
const lines = readme.split('\n');

const inlineLinkRe = /\]\((https?:\/\/[^\s)]+)\)/g;
const refDefRe = /^(\[[a-z0-9-]+\]:\s*)(https?:\/\/\S+)(\s*)$/i;

let rewritten = 0;

const newLines = lines.map((line) => {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('#')) return line; // skip headings (e.g. the top badge line)

  const refMatch = line.match(refDefRe);
  if (refMatch) {
    const [, prefix, url, suffix] = refMatch;
    if (url.startsWith(TRACK_BASE)) return line;
    rewritten++;
    return `${prefix}${TRACK_BASE}${slugFor(url)}/${suffix}`;
  }

  return line.replace(inlineLinkRe, (full, url) => {
    if (url.startsWith(TRACK_BASE)) return full;
    rewritten++;
    return `](${TRACK_BASE}${slugFor(url)}/)`;
  });
});

readme = newLines.join('\n');
writeFileSync(README_PATH, readme);
writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n');

mkdirSync(GO_DIR, { recursive: true });

for (const [url, slug] of Object.entries(map)) {
  const dir = join(GO_DIR, slug);
  mkdirSync(dir, { recursive: true });
  const safeUrl = escapeHtml(url);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<meta name="robots" content="noindex,nofollow">
<meta http-equiv="refresh" content="1; url=${safeUrl}">
<script defer src="https://cloud.umami.is/script.js" data-website-id="${UMAMI_WEBSITE_ID}"></script>
<style>body{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#24292f}</style>
</head>
<body>
<p>Redirecting to <a id="target" href="${safeUrl}">${safeUrl}</a>&hellip;</p>
<script>
(function () {
  var target = ${JSON.stringify(url)};
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
      if (window.umami) window.umami.track('outbound', { url: target, source: source });
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
console.log(`Total tracked links: ${Object.keys(map).length}`);
console.log(`Generated ${Object.keys(map).length} redirect page(s) under go/`);
