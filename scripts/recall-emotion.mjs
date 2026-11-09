// 情绪显著度 + 带情绪的检索（2026-11-04）
// ① 给每条 L1 记忆算"情绪显著度"：偏离基线越多越高（皮质醇高、多巴胺高都算）
// ② 检索时按权重排序：关键词 0.46 + 重要度 + 新鲜度 + 情绪 0.15
// 只用现成文件，不改桥接。
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
const L1 = path.join(LIB, 'L1');
const CHEM = findChemFile();

// 基线（跟 chem.json 对齐，读不到就用默认）
let base = { dopamine: 50, cortisol: 20, serotonin: 55 };
try {
  const c = JSON.parse(fs.readFileSync(CHEM, 'utf8'));
  for (const x of c.chemicals || []) base[x.id] = x.baseline;
  if (c.temperament?.enthusiasm) base.dopamine = Number(c.temperament.enthusiasm);
} catch {}

const files = fs.readdirSync(L1).filter((f) => f.endsWith('.index.jsonl')).sort();
const entries = [];
for (const f of files) {
  const day = f.slice(0, 10);
  for (const line of fs.readFileSync(path.join(L1, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      r._day = day;
      entries.push(r);
    } catch {}
  }
}

// ① 情绪显著度：各值偏离基线的绝对值 / 50，取最大两路的平均，封顶 1
function salience(e) {
  const c = e.chem;
  if (!c) return 0.3;                    // 老条目给中性值
  const d = Math.abs((c.dopamine ?? base.dopamine) - base.dopamine) / 50;
  const k = Math.abs((c.cortisol ?? base.cortisol) - base.cortisol) / 50;
  const s = Math.abs((c.serotonin ?? base.serotonin) - base.serotonin) / 50;
  const top2 = [d, k, s].sort((a, b) => b - a).slice(0, 2);
  return Math.min(1, (top2[0] + top2[1]) / 2);
}

// ② 检索
const now = Date.now();
function score(e, kw) {
  const t = String(e.quote || '') + ' ' + String(e.why || '');
  const kwHit = kw ? (t.includes(kw) ? 1 : 0) : 0.5;
  const imp = (Number(e.imp) || 0) / 3;
  const days = Math.max(0, (now - Number(e.markedAt || now)) / 86400000);
  const fresh = Math.exp(-days / 7);                        // 一周半衰
  const sal = salience(e);
  return {
    total: 0.46 * kwHit + 0.18 * imp + 0.21 * fresh + 0.15 * sal,
    kwHit, imp, fresh: +fresh.toFixed(2), sal: +sal.toFixed(2),
  };
}

const kw = process.argv[2] || '';
const top = entries
  .map((e) => ({ e, s: score(e, kw) }))
  .sort((a, b) => b.s.total - a.s.total)
  .slice(0, 10);

console.log('  共 ' + entries.length + ' 条记忆' + (kw ? '，关键词「' + kw + '」' : '（无关键词，按综合分）'));
console.log('  权重：关键词 0.46 / 重要 0.18 / 新鲜 0.21 / 情绪 0.15\n');
for (const { e, s } of top) {
  console.log('  ' + s.total.toFixed(3) + '  [kw' + s.kwHit + ' imp' + Math.round(s.imp * 3) + ' 新' + s.fresh + ' 情' + s.sal + ']  ' + e._day + '  ' + String(e.quote || '').slice(0, 34));
}
const salAll = entries.map((e) => salience(e));
const avg = (salAll.reduce((a, b) => a + b, 0) / (salAll.length || 1)).toFixed(2);
console.log('\n  情绪显著度：平均 ' + avg + '，最高 ' + Math.max(...salAll).toFixed(2) + '，带快照 ' + entries.filter((e) => e.chem).length + '/' + entries.length);
