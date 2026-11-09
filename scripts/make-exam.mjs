// 闭卷考题库生成器（2026-11-04）
// 从 L0 里抽"只有记住才答得出"的事实，生成题 + 答案 + 出处（seq），供闭卷考用。
// 生成出来的题不给她看，考试时才问。
import fs from 'node:fs';
import path from 'node:path';

const LIB = '/path/to/我的助手记忆';
const L0 = path.join(LIB, 'L0');
if (!fs.existsSync(L0)) {
  console.log('  找不到记忆库：' + LIB);
  console.log('  把脚本里的 LIB 改成你自己的记忆库路径（见 docs/部署.md 的路径清单）。');
  process.exit(0);
}
const OUT = path.join(LIB, '考试');

const days = process.argv.slice(2);
const files = (days.length ? days : fs.readdirSync(L0).filter((f) => f.endsWith('.jsonl')).sort().slice(-3))
  .map((d) => (d.endsWith('.jsonl') ? d : d + '.jsonl'));

const rows = [];
const SKIP = /^\[(拍一拍|图片|表情|语音|视频|文件|撤回|红包)/;   // 跳过拍一拍这类系统消息
for (const f of files) {
  const p = path.join(L0, f);
  if (!fs.existsSync(p)) continue;
  const date = f.slice(0, 10);
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      const t = String(r.text || '').trim();
      if (!t || t.length < 6) continue;
      if (SKIP.test(t)) continue;
      if (/^([0-9A-F]{2} ){4,}/i.test(t)) continue;   // 跳过乱码（UTF-8 字节被当文本）
      rows.push({ date, s: r.s, from: r.from, t });
    } catch {}
  }
}

// 抽题规则：他的话里带"具体信息"的句子（数字/日期/专名/地点/偏好）
const score = (t) => {
  let n = 0;
  if (/\d/.test(t)) n += 2;
  if (/(我|你).*(喜欢|不喜欢|讨厌|爱吃|想|要|答应|决定)/.test(t)) n += 3;
  if (/[A-Za-z]{3,}/.test(t)) n += 1;
  if (/(今天|明天|昨天|下周|这个月|\d+点|\d+号)/.test(t)) n += 2;
  if (t.length >= 10 && t.length <= 60) n += 1;
  return n;
};

// ── 窄题优先：答案必须是一个具体的信息点（数字 / 时间 / 专名）
function narrow(t) {
  const nums = (t.match(/\d+\s*(个|点|号|天|次|块|张|岁|分钟|小时|元|%|G|GB)?/g) || [])
    .filter((x) => !/^\d{8,}/.test(x));   // 剔除 QQ 号这类超长数字
  const names = (t.match(/[A-Za-z]{3,}/g) || []).filter((x) => !/^(the|and|for|with)$/i.test(x));
  const place = t.match(/(学校|公司|宿舍|食堂|教室|医院|图书馆|公园|咖啡|地铁|公交|机场|车站|家)/g) || [];
  const kind = nums.length ? '数字' : names.length ? '专名' : place.length ? '地点' : '';
  return kind ? { kind, nums, names, place } : null;
}

const picked = rows
  .filter((r) => r.from === 'him')
  .map((r) => { const n = narrow(r.t); return n ? { ...r, ...n } : null; })
  .filter(Boolean)
  .filter((r) => r.t.length >= 8 && r.t.length <= 70)
  .map((r) => ({ ...r, sc: (r.kind === '数字' ? 3 : r.kind === '专名' ? 2 : 1) + (/(今天|明天|昨天|下周|这个月)/.test(r.t) ? 2 : 0) }))
  .sort((a, b2) => b2.sc - a.sc)
  .slice(0, 20);

// 题干：把关键信息挖成【？】，逼她凭记忆补
function mask(t, info) {
  let out = t;
  for (const n of info.nums) out = out.split(n).join('【？】');
  for (const n of info.names) out = out.split(n).join('【？】');
  for (const p of info.place) out = out.split(p).join('【？】');
  return out;
}

const questions = picked.map((r, i) => ({
  id: 'Q' + String(i + 1).padStart(2, '0'),
  kind: r.kind,
  date: r.date,
  seq: r.s,
  answer: { nums: r.nums, names: r.names, place: r.place },
  evidence: r.t,
  q: '他说过「' + mask(r.t, r) + '」——把【？】补上。凭记忆，别查。',
  hint: '不看档案、不查 L0；记不清就说记不清。',
}));

fs.mkdirSync(OUT, { recursive: true });
const outFile = path.join(OUT, '题库-' + files.map((f) => f.slice(0, 10)).join('_') + '.jsonl');
fs.writeFileSync(outFile, questions.map((q) => JSON.stringify(q)).join('\n') + '\n', 'utf8');

console.log('  从 ' + files.length + ' 天、' + rows.length + ' 条原话里出了 ' + questions.length + ' 题');
console.log('  题库 → ' + outFile);
console.log('\n  抽样看三条（考试时不给她看）：');
for (const q of questions.slice(0, 3)) {
  console.log('    ' + q.id + '  [' + q.date + ']  ' + q.evidence.slice(0, 46));
}
