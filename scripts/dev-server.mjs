#!/usr/bin/env node
/**
 * Rosetta dev server for Phase 2 manual review.
 *
 * Replicates the dual-directory layout the Phase 6a Fastify backend will
 * serve: site/ at /, registry/ at /registry/. Same absolute-path conventions
 * the HTML uses. Zero dependencies; pure node:http + node:fs.
 *
 * Usage:
 *   node scripts/dev-server.mjs           # port 3000
 *   node scripts/dev-server.mjs 4000      # custom port
 *
 * Phase 6a will replace this with @fastify/static. Until then, this is the
 * way to spot-check the website without standing up the full backend.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolvePath(__dirname, '..');
const port = Number(process.argv[2] ?? 3000);

const mimes = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md':   'text/markdown; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function resolveFile(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';

  // /registry/* → projectRoot/registry/*
  // everything else → projectRoot/site/*
  const filePath = p.startsWith('/registry/')
    ? join(projectRoot, p)
    : join(projectRoot, 'site', p);

  // path-traversal guard
  return filePath.startsWith(projectRoot) ? filePath : null;
}

const server = createServer(async (req, res) => {
  const filePath = resolveFile(req.url);
  if (!filePath) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimes[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404); res.end(`not found: ${req.url}`);
    } else {
      res.writeHead(500); res.end(`error: ${err.message}`);
    }
  }
});

server.listen(port, () => {
  console.log(`\n  Rosetta dev server up at http://localhost:${port}\n`);
  console.log(`  Landing:    http://localhost:${port}/`);
  console.log(`  VS Code:    http://localhost:${port}/app.html?app=vscode`);
  console.log(`  Use seed:   http://localhost:${port}/seed-skills/use.md`);
  console.log(`  Registry:   http://localhost:${port}/registry/index.json`);
  console.log(`\n  Ctrl+C to stop.\n`);
});
