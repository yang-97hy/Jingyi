// 挑"笨笨的东西"（2026-11-02）：她写进记忆的条目，逐条回查 L0
// 判据：① 标了"他说的"但 L0 里找不到这句话 ② 同一件事重复写
//      ③ 把猜测写成事实（含"应该/可能/大概"却标成[事实]） ④ 长度离谱
import fs from 'node:fs';
import path from 'node:path';

const LIB = '/path/to/我的助手记忆';
const d = new Date();
const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const mdPath = path.join(LIB, '每日', ds + '.md');

if (!fs.existsSync(mdPath)) { console.log('  今天没有每日记忆文件'); process.exit(0); }

// 当天 + 前一天的 L0 文本，用来回查
const l0text = [];
for (const off of [0, 1]) {
  const dd = new Date(Date.now() - off * 86400000);
  const f = path.join(LIB, 'L0', dd.getFullYear() + '-' + String(dd.getMonth() + 1).padStart(2, '0') + '-' + String(dd.getDate()).padStart(2, '0') + '.jsonl');
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { l0text.push(String(JSON.parse(line).text || '')); } catch {}
  }
}
const allL0 = l0text.join('\n');

const lines = fs.readFileSync(mdPath, 'utf8').split('\n');
const items = [];
for (const raw of lines) {
  const t = raw.trim();
  if (!t || t.startsWith('#')) continue;
  if (!/^[-*·]/.test(t)) continue;
  items.push(t.replace(/^[-*·]\s*/, ''));
}

const KEY3 = (s) => {
  // 取 8 个字以上的片段，去标点，用来在 L0 里找
  const clean = s.replace(/[\s，。！？、；：「」“”"'（）()·—…]/g, '');
  return clean.slice(0, 14);
};

const flags = [];
for (const it of items) {
  const says = /他说的[:：]/.test(it);
  const guess = /(应该|可能|大概|估计|好像是)/.test(it);
  const isFact = /\[事实\]/.test(it);
  if (says) {
    const k = KEY3(it.split('他说的')[1] || '');
    if (k.length >= 6 && !allL0.includes(k.slice(0, 8))) {
      flags.push({ kind: '标了他说的但 L0 查不到', text: it });
    }
  }
  if (isFact && guess) flags.push({ kind: '事实里带"应该/可能"', text: it });
  if (it.length > 160) flags.push({ kind: '太长（>160 字）', text: it });
}

// 重复：去掉时间后比较
const seen = new Map();
for (const it of items) {
  const k = it.replace(/（事发[^）]*）/g, '').replace(/\d{2}-\d{2}\s*\d{2}:\d{2}/g, '').slice(0, 24);
  if (k.length < 8) continue;
  seen.set(k, (seen.get(k) || 0) + 1);
}
for (const [k, c] of seen) if (c >= 2) flags.push({ kind: '同一件事写了 ' + c + ' 遍', text: k });

console.log('  今天记忆条目 ' + items.length + ' 条，挑出可疑 ' + flags.length + ' 条');
for (const f of flags.slice(0, 12)) {
  console.log('\n  [' + f.kind + ']');
  console.log('    ' + f.text.slice(0, 140));
}
