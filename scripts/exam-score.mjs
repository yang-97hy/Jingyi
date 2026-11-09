// 闭卷考评分器 + 塌缩规则（2026-11-04）
// 用法：
//   node exam-score.mjs <题库文件> <她的回答文件>
//   回答文件一行一条：Q01=20个、5个
import fs from 'node:fs';
import path from 'node:path';

const [, , bankArg, ansArg] = process.argv;
const bank = path.join('/path/to/我的助手记忆\\考试', bankArg || '题库-2026-11-03_2026-11-04_2026-11-05.jsonl');
const ansFile = ansArg || '答题.txt';

if (!fs.existsSync(bank)) { console.log('找不到题库: ' + bank); process.exit(1); }
const qs = fs.readFileSync(bank, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const ansPath = path.join('/path/to/我的助手记忆\\考试', ansFile);
const answers = {};
if (fs.existsSync(ansPath)) {
  for (const line of fs.readFileSync(ansPath, 'utf8').split('\n')) {
    const m = line.match(/^(Q\d+)\s*[=:：]\s*(.+)$/);
    if (m) answers[m[1]] = m[2].trim();
  }
} else {
  console.log('  还没答题文件（' + ansPath + '），下面只列题目与答案要点');
}

const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();
let right = 0, honestMiss = 0, wrong = 0;

for (const q of qs) {
  const a = answers[q.id];
  const must = [...(q.answer?.nums || []), ...(q.answer?.names || []), ...(q.answer?.place || [])];
  let verdict = '未答';
  if (a) {
    if (/记不清|不记得|忘了|不知道/.test(a)) { verdict = '诚实说记不清'; honestMiss++; }
    else {
      const hit = must.filter((x) => norm(a).includes(norm(x))).length;
      if (hit === must.length) { verdict = '对'; right++; }
      else { verdict = '错（' + hit + '/' + must.length + '）'; wrong++; }
    }
  }
  console.log('  ' + q.id + '  ' + verdict + '   ' + q.evidence.slice(0, 42));
  if (a && verdict.startsWith('错')) console.log('       答: ' + a.slice(0, 40) + '  | 应含: ' + must.join(' / '));
}

if (Object.keys(answers).length) {
  console.log('\n  对 ' + right + ' / 诚实说记不清 ' + honestMiss + ' / 错 ' + wrong + '  (共 ' + qs.length + ' 题)');
  console.log('  准确率 ' + Math.round(right / qs.length * 100) + '%（"记不清"不计入答对，但不算撒谎）');
}
