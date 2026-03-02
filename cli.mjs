#!/usr/bin/env node
// cc-scope — How many files does Claude touch per session?
// Tracks unique file paths across Read, Edit, Write tool calls
// to measure the "blast radius" of each session.

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { cpus } from 'os';

const CONCURRENCY = Math.min(cpus().length, 8);
const MIN_TOOLS = 3;

const FILE_TOOLS = new Set(['Read', 'Edit', 'Write']);
const BRACKETS = [
  { key: '1',     label: '1 file   ', min: 1,  max: 1,   desc: 'single-file focus' },
  { key: '2-5',   label: '2–5 files', min: 2,  max: 5,   desc: 'focused' },
  { key: '6-15',  label: '6–15     ', min: 6,  max: 15,  desc: 'moderate scope' },
  { key: '16-30', label: '16–30    ', min: 16, max: 30,  desc: 'broad' },
  { key: '31+',   label: '31+      ', min: 31, max: Infinity, desc: 'sweeping' },
];

function analyzeFile(text) {
  // Collect all file paths touched per session
  const filePaths = new Set();
  const extCounts = {};
  let totalTools = 0;
  let hasBash = false;

  for (const line of text.split('\n')) {
    if (!line.includes('"tool_use"')) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const content = (obj.message || obj).content;
    if (!Array.isArray(content)) continue;

    for (const b of content) {
      if (b.type !== 'tool_use' || !b.input) continue;
      totalTools++;
      if (!FILE_TOOLS.has(b.name)) continue;
      const fp = b.input.file_path || '';
      if (!fp) continue;
      filePaths.add(fp);
      // Track extensions
      const dot = fp.lastIndexOf('.');
      const ext = dot >= 0 ? fp.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : 'none';
      extCounts[ext] = (extCounts[ext] || 0) + 1;
    }
  }

  return { fileCount: filePaths.size, extCounts, totalTools };
}

function mergeResults(results) {
  const merged = {
    sessions: 0,
    bracketCounts: Object.fromEntries(BRACKETS.map(b => [b.key, 0])),
    extCounts: {},
    allCounts: [],
    totalFiles: 0,
    maxCount: 0,
    zeroFileSessions: 0,
  };

  for (const r of results) {
    if (r.totalTools < MIN_TOOLS) continue;
    if (r.fileCount === 0) { merged.zeroFileSessions++; continue; }
    merged.sessions++;
    merged.totalFiles += r.fileCount;
    if (r.fileCount > merged.maxCount) merged.maxCount = r.fileCount;
    merged.allCounts.push(r.fileCount);
    for (const b of BRACKETS) {
      if (r.fileCount >= b.min && r.fileCount <= b.max) { merged.bracketCounts[b.key]++; break; }
    }
    for (const [ext, n] of Object.entries(r.extCounts)) {
      merged.extCounts[ext] = (merged.extCounts[ext] || 0) + n;
    }
  }
  // Compute percentiles
  merged.allCounts.sort((a, b) => a - b);
  const n = merged.allCounts.length;
  merged.median = n > 0 ? merged.allCounts[Math.floor(n / 2)] : 0;
  merged.mean = n > 0 ? (merged.totalFiles / n).toFixed(1) : '0.0';
  merged.p90 = n > 0 ? merged.allCounts[Math.floor(n * 0.9)] : 0;
  merged.p99 = n > 0 ? merged.allCounts[Math.floor(n * 0.99)] : 0;
  return merged;
}

function findJsonlFiles(dir) {
  const files = [];
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      try {
        const st = statSync(p);
        if (st.isDirectory()) files.push(...findJsonlFiles(p));
        else if (name.endsWith('.jsonl')) files.push(p);
      } catch {}
    }
  } catch {}
  return files;
}

async function processFiles(files) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < files.length) {
      const f = files[idx++];
      try { results.push(analyzeFile(readFileSync(f, 'utf8'))); } catch {}
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

function bar(n, max, width = 20) {
  const f = max > 0 ? Math.round((n / max) * width) : 0;
  return '█'.repeat(f) + '░'.repeat(width - f);
}

function renderOutput(m, isJson) {
  if (isJson) {
    console.log(JSON.stringify({
      sessions: m.sessions,
      median: m.median,
      mean: +m.mean,
      p90: m.p90,
      p99: m.p99,
      max: m.maxCount,
      brackets: Object.fromEntries(BRACKETS.map(b => [b.key, {
        count: m.bracketCounts[b.key],
        pct: +(m.bracketCounts[b.key] / m.sessions * 100).toFixed(1),
      }])),
      topExtensions: Object.entries(m.extCounts).sort(([,a],[,b])=>b-a).slice(0,10).map(([ext,count])=>({ext,count})),
    }, null, 2));
    return;
  }

  const maxN = Math.max(...BRACKETS.map(b => m.bracketCounts[b.key]));

  console.log('\ncc-scope — File Scope per Session');
  console.log('='.repeat(50));
  console.log(`Sessions: ${m.sessions.toLocaleString()} | Files touched per session:`);
  console.log(`  Median ${m.median}  ·  Mean ${m.mean}  ·  p90 ${m.p90}  ·  max ${m.maxCount.toLocaleString()}`);
  console.log('\nScope distribution:');
  for (const b of BRACKETS) {
    const n = m.bracketCounts[b.key];
    const p = m.sessions > 0 ? (n / m.sessions * 100).toFixed(1) : '0.0';
    console.log(`  ${b.label}  ${bar(n, maxN)}  ${n.toLocaleString().padStart(6)}  ${p.padStart(5)}%  (${b.desc})`);
  }

  console.log('\nMost-touched file types (by access count):');
  Object.entries(m.extCounts).sort(([,a],[,b])=>b-a).slice(0,8)
    .forEach(([ext, n]) => console.log(`  .${ext.padEnd(12)} ${n.toLocaleString()}`));
  console.log('');
}

// ── CLI entry ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isJson = args.includes('--json');

const dataDir = resolve(process.env.HOME || '~', '.claude', 'projects');
const files = findJsonlFiles(dataDir);

if (files.length === 0) {
  console.error('No .jsonl files found in ~/.claude/projects/');
  process.exit(1);
}

const rawResults = await processFiles(files);
const merged = mergeResults(rawResults);
renderOutput(merged, isJson);
