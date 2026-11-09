// 内稳态最小实现（2026-11-02）
// 只算数值：当前值 = 基线 + Σ 事件量 × 2^(-经过分钟 / (半衰期 × 恢复力))
// 用法：
//   node hormones.mjs                 看当前状态
//   node hormones.mjs --touch cortisol=+15   记一次事件
//   node hormones.mjs --line          输出一行给注入用的状态描述
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
const F = findChemFile();
const args = process.argv.slice(2);
if (!fs.existsSync(F)) {
  fs.mkdirSync(path.dirname(F), { recursive: true });
  fs.writeFileSync(F, "{\n  \"version\": 1,\n  \"temperament\": {\n    \"sensitivity\": 1,\n    \"resilience\": 1,\n    \"enthusiasm\": 50,\n    \"metabolism\": 1\n  },\n  \"chemicals\": [\n    {\n      \"id\": \"dopamine\",\n      \"baseline\": 50,\n      \"halfLifeMinutes\": 30,\n      \"min\": 0,\n      \"max\": 100\n    },\n    {\n      \"id\": \"cortisol\",\n      \"baseline\": 20,\n      \"halfLifeMinutes\": 90,\n      \"min\": 0,\n      \"max\": 100\n    },\n    {\n      \"id\": \"serotonin\",\n      \"baseline\": 55,\n      \"halfLifeMinutes\": 240,\n      \"min\": 0,\n      \"max\": 100\n    }\n  ],\n  \"events\": []\n}", 'utf8');
  console.log('  没有情绪状态文件，已生成默认的: ' + F);
}
const cfg = JSON.parse(fs.readFileSync(F, 'utf8'));
const t = cfg.temperament || {};
const resil = Number(t.resilience) || 1;
const sens = Number(t.sensitivity) || 1;
const now = Date.now();

// 记事件
const touchIdx = args.indexOf('--touch');
if (touchIdx >= 0) {
  const [id, deltaStr] = String(args[touchIdx + 1] || '').split('=');
  const delta = Number(deltaStr) || 0;
  if (!cfg.chemicals.some((c) => c.id === id)) { console.error('  没有这个激素: ' + id); process.exit(1); }
  cfg.events.push({ at: now, id, delta: Math.round(delta * sens) });
  if (cfg.events.length > 500) cfg.events = cfg.events.slice(-500);
  fs.writeFileSync(F, JSON.stringify(cfg, null, 2), 'utf8');
  console.log('  ' + id + ' ' + (delta >= 0 ? '+' : '') + delta + '（敏感度 ' + sens + ' 倍后 ' + Math.round(delta * sens) + '）');
}

// 算当前值
const cur = {};
for (const c of cfg.chemicals) {
  let v = c.baseline;
  if (c.id === 'dopamine') v = Number(t.enthusiasm) || c.baseline;
  for (const e of cfg.events) {
    if (e.id !== c.id) continue;
    const mins = (now - e.at) / 60000;
    v += e.delta * Math.pow(2, -mins / (c.halfLifeMinutes * resil));
  }
  cur[c.id] = Math.max(c.min, Math.min(c.max, v));
}

const label = (v) => v >= 75 ? '很高' : v >= 60 ? '偏高' : v >= 40 ? '正常' : v >= 25 ? '偏低' : '很低';
const line = cfg.chemicals.map((c) => c.id + ' ' + Math.round(cur[c.id]) + '（' + label(cur[c.id]) + '）').join('  ');

if (args.includes('--line')) {
  console.log('【现在的状态】' + line);
} else {
  console.log('  状态：' + line);
  console.log('  气质：敏感度 ' + sens + ' / 恢复力 ' + resil + ' / 积极性 ' + t.enthusiasm + ' / 能耗 ' + t.metabolism);
  console.log('  事件：' + cfg.events.length + ' 条');
}
