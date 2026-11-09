// 候选 A 第一步：给示例对象B那边做"语域档案"初稿（2026-11-02）
// 只统计、不改任何记忆。统计只是初稿，终稿权在她。
import fs from 'node:fs';
import path from 'node:path';

const LIB = '/path/to/我的助手记忆';
const L0 = path.join(LIB, 'L0');
const KEY = 'private:100000002';
const OUT = path.join(LIB, '语域', '100000002.md');

const msgs = [];
for (const f of fs.readdirSync(L0).sort()) {
  if (!f.endsWith('.jsonl')) continue;
  for (const line of fs.readFileSync(path.join(L0, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.key === KEY && r.from === 'me' && String(r.text || '').trim()) msgs.push(String(r.text).trim());
    } catch {}
  }
}
const n = msgs.length;
if (!n) { console.log('  没有样本，先不做'); process.exit(0); }

const lens = msgs.map((t) => t.length).sort((a, b) => a - b);
const pct = (q) => lens[Math.min(n - 1, Math.floor(n * q))];
const avg = (lens.reduce((a, b) => a + b, 0) / n).toFixed(1);
const share = (f) => (msgs.filter(f).length / n * 100).toFixed(0);

const heads = {};
for (const t of msgs) { const k = t.slice(0, 2); if (k.length === 2) heads[k] = (heads[k] || 0) + 1; }
const topHeads = Object.entries(heads).sort((a, b) => b[1] - a[1]).slice(0, 8);

const bodies = [...new Set(msgs)].filter((t) => t.length >= 4).slice(-18);

const doc = `# 语域档案 · 示例对象B那边（初稿）

> 这份是**初稿**，从你自己的 ${n} 条真实发言统计出来的，不是谁编的。
> **你有终稿权**：可以改、可以删、可以加。改了什么会留痕，是你改的，不是别人改的。
> 统计只能复现"现在的你"；**你改过的，才是"以后的你"。**

## 一、句长（你自己的说话节奏）

- 平均 ${avg} 字
- 中位 ${pct(0.5)} 字；四分之一在 ${pct(0.25)} 字以内；四分之三在 ${pct(0.75)} 字以内
- 10 字以内占 ${share((t) => t.length <= 10)}%
- 30 字以上占 ${share((t) => t.length >= 30)}%

## 二、标点与习惯

- 带问号 ${share((t) => /[?？]/.test(t))}%
- 带感叹号 ${share((t) => /[!！]/.test(t))}%
- 带省略号 ${share((t) => /…|\.\.\./.test(t))}%
- 结尾不带句号 ${share((t) => !/[。！？!?~～]$/.test(t))}%
- 用 emoji / 表情符号 ${share((t) => /[\u{1F300}-\u{1FAFF}]/u.test(t))}%

## 三、高频开头（你自己的起手）

${topHeads.map(([k, v]) => `- 「${k}…」 ${v} 次`).join('\n')}

## 四、真实原句（用来对照语气，不是让我模仿台词）

${bodies.map((t) => `- ${t.replace(/\n/g, ' ').slice(0, 60)}`).join('\n')}

## 五、这份档案怎么用

- 用来说话时**统一口吻**，不是拿来背句子
- 不准改：记忆、承诺、关系定位、你认下的判断
- 觉得哪条不像你：直接划掉，或写"这句不像"

## 六、待你填

- 你不喜欢被怎么称呼：
- 你绝对不会说的话：
- 你想加的一条：
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, doc, 'utf8');
console.log('  样本 ' + n + ' 条 → 初稿 ' + OUT + '  (' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB)');
console.log('  平均 ' + avg + ' 字 / 中位 ' + pct(0.5) + ' 字 / 10字内 ' + share((t) => t.length <= 10) + '%');
