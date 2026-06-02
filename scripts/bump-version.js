#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (e) {
    return null;
  }
}

function getVersion() {
  const hash = getGitHash();
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ts = `${y}${m}${d}${hh}${mm}${ss}`;
  return hash ? `${ts}-${hash}` : ts;
}

function bumpIndexHtml(indexPath) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const version = getVersion();

  // Patterns to replace: css/style.css?v=..., js/data.js?v=..., js/app.js?v=...
  const replacements = [
    /css\/style\.css(\?v=[0-9A-Za-z._\-]+)?/g,
    /js\/data\.js(\?v=[0-9A-Za-z._\-]+)?/g,
    /js\/app\.js(\?v=[0-9A-Za-z._\-]+)?/g,
    /js\/svg-icons\.js(\?v=[0-9A-Za-z._\-]+)?/g,
  ];

  let newHtml = html;
  replacements.forEach(re => {
    newHtml = newHtml.replace(re, (m, p1) => {
      const prefix = m.split('?')[0];
      return `${prefix}?v=${version}`;
    });
  });

  if (newHtml !== html) {
    fs.writeFileSync(indexPath, newHtml, 'utf8');
    return version;
  }
  return null;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const indexPath = path.join(repoRoot, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at', indexPath);
    process.exit(2);
  }

  const version = bumpIndexHtml(indexPath);
  if (!version) {
    console.log('no-change');
    return 0;
  }

  console.log(version);
  return 0;
}

const code = main();
process.exit(code);
