// 记忆健康报告（2026-11-04）
// 一次看完：L0 量、L1 覆盖、情绪分布、超长条目、无出处嫌疑
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ── 路径发现（不写死本机目录名，别人也能用）──
function findSessionStore() {
  if (process.env.JY_SESSIONS && fs.existsSync(process.env.JY_SESSIONS)) return process.env.JY_SESSIONS;
  const roots = [process.env.APPDATA, process.env.LOCALAPPDATA, os.homedir()].filter(Boolean);
  for (const r of roots) {
    for (const app of (() => { try { return fs.readdirSync(r); } catch { return []; } })()) {
      const p = path.join(r, app, 'harness', 'sessions');
      try {
        if (!fs.existsSync(p)) continue;
        if (fs.readdirSync(p).some((n) => n.startsWith('session-'))) return p;
      } catch {}
    }
  }
  return '';
}
function findChemFile() {
  if (process.env.JY_CHEM && fs.existsSync(process.env.JY_CHEM)) return process.env.JY_CHEM;
  const cands = [path.join(process.cwd(), 'state', 'chem.json'), path.join(process.cwd(), 'chem.json')];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return cands[0];
}

const LIB = '/path/to/我的助手记忆';
const L0 = path.join(LIB, 'L0');
const L1 = path.join(LIB, 'L1');
const CHEM = findChemFile();

let base = { dopamine: 50, cortisol: 20, serotonin: 55 };
try {
  const c = JSON.parse(fs.readFileSync(CHEM, 'utf8'));
  for (const x of c.chemicals || []) base[x.id] = x.baseline;
  if (c.temperament?.enthusiasm) base.dopamine = Number(c.temperament.enthusiasm);
} catch {}

if (!fs.existsSync(L0)) {
  console.log('  找不到记忆库：' + LIB);
  console.log('  把脚本里的 LIB 改成你自己的记忆库路径（见 docs/部署.md 的路径清单）。');
  process.exit(0);
}
const days = fs.readdirSync(L0).filter((f) => f.endsWith('.jsonl')).sort();
console.log('  记忆健康报告  ' + new Date().toLocaleString('zh-CN'));
console.log('  ' + '─'.repeat(58));

let totalL0 = 0, totalL1 = 0;
const rows = [];
for (const f of days) {
  const day = f.slice(0, 10);
  const l0s = fs.readFileSync(path.join(L0, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const idx = path.join(L1, day + '.index.jsonl');
  const l1s = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  totalL0 += l0s.length; totalL1 += l1s.length;
  const cov = l0s.length ? (l1s.length / l0s.length * 100).toFixed(1) : '0.0';
  rows.push({ day, l0: l0s.length, l1: l1s.length, cov });
}

console.log('  日期         L0 条数   L1 标注   覆盖率');
for (const r of rows.slice(-7)) {
  console.log('  ' + r.day + '   ' + String(r.l0).padStart(6) + '   ' + String(r.l1).padStart(6) + '   ' + r.cov + '%');
}
console.log('  ' + '─'.repeat(58));
console.log('  合计 L0 ' + totalL0 + ' 条 / L1 ' + totalL1 + ' 条 → 总覆盖率 ' + (totalL0 ? (totalL1 / totalL0 * 100).toFixed(1) : '0') + '%');

// 情绪分布（按天，取当天 L1 条目的 chem 平均）
console.log('\n  情绪（按天平均，来自 L1 快照）');
for (const r of rows.slice(-5)) {
  const idx = path.join(L1, r.day + '.index.jsonl');
  if (!fs.existsSync(idx)) continue;
  const es = fs.readFileSync(idx, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((x) => x?.chem);
  if (!es.length) { console.log('  ' + r.day + '   没有快照'); continue; }
  const avg = (k) => Math.round(es.reduce((a, e) => a + Number(e.chem[k] ?? base[k]), 0) / es.length);
  const sal = es.map((e) => Math.max(...['dopamine', 'cortisol', 'serotonin'].map((k) => Math.abs(Number(e.chem[k]) - base[k]) / 50))).reduce((a, b) => a + b, 0) / es.length;
  console.log('  ' + r.day + '   多巴胺 ' + avg('dopamine') + '  皮质醇 ' + avg('cortisol') + '  血清素 ' + avg('serotonin') + '   显著度 ' + sal.toFixed(2));
}

// 超长条目（不自动改，只报，因为她的原话不许动）
const daily = path.join(LIB, '每日');
if (fs.existsSync(daily)) {
  const long = [];
  for (const f of fs.readdirSync(daily).filter((x) => x.endsWith('.md')).sort().slice(-3)) {
    for (const line of fs.readFileSync(path.join(daily, f), 'utf8').split('\n')) {
      const t = line.replace(/^[-*·]\s*/, '').trim();
      if (t.startsWith('#') || t.length < 80) continue;
      long.push({ f, t });
    }
  }
  console.log('\n  超长记忆条目（>80 字，' + long.length + ' 条）—— 不自动改，等她自己拆');
  for (const x of long.slice(0, 3)) console.log('    ' + x.t.slice(0, 56) + '…（' + x.t.length + ' 字）');
}
