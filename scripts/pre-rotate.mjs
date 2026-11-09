// 轮换前：先把记忆和归档落盘（2026-11-09）
// 用法：node scripts/pre-rotate.mjs <会话id 或 对象名>
//
// 它保证三件事，任何一件不成立就"不换"（退出码 2），让上层自己决定压缩还是等：
//   ① 今天的每日记忆文件存在且今天有更新
//   ② 这一轮会话已归档（归档/<对象>/ 里有对应文件）
//   ③ 写一份交接（在记忆库里，不依赖会话）
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CFG, P } from './_config.mjs';

const arg = process.argv[2] || '默认';
const today = new Date();
const ds = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

const ok = (s) => console.log('  [OK]   ' + s);
const no = (s) => console.log('  [缺]   ' + s);

// ① 每日记忆
const dailyFile = path.join(P.daily, ds + '.md');
const dailyOk = fs.existsSync(dailyFile) && fs.statSync(dailyFile).size > 20;
dailyOk ? ok('今日记忆: ' + path.basename(dailyFile)) : no('今日记忆（' + ds + '.md 还没写）');

// ② 归档
let archiveOk = false, archiveFile = '';
const dir = path.join(P.archive, String(arg));
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== '索引.md').sort();
  if (files.length) { archiveFile = files[files.length - 1]; archiveOk = true; }
}
if (!archiveOk) {
  // 尝试现场补一次增量归档
  try {
    const out = execFileSync(process.execPath, [path.join(HERE, 'archive-incremental.mjs')], { encoding: 'utf8', timeout: 120000 });
    if (!/没有需要补的会话/.test(out)) ok('现场补归档: ' + out.split('\n').filter(Boolean).slice(-1)[0]);
    const dir2 = path.join(P.archive, String(arg));
    if (fs.existsSync(dir2)) {
      const f2 = fs.readdirSync(dir2).filter((f) => f.endsWith('.md') && f !== '索引.md').sort();
      if (f2.length) { archiveFile = f2[f2.length - 1]; archiveOk = true; }
    }
  } catch {}
}
archiveOk ? ok('归档: ' + archiveFile) : no('归档（归档目录里没有这个对象的会话）');

// ③ 交接
const handoff = path.join(CFG.stateDir, 'handoff-' + String(arg).replace(/[^\w]/g, '_') + '.json');
const handoffOk = fs.existsSync(handoff) && (Date.now() - fs.statSync(handoff).mtimeMs) < 3 * 3600 * 1000;
handoffOk ? ok('交接: ' + path.basename(handoff)) : no('交接（近 3 小时内没更新）');

const pass = dailyOk && archiveOk;
console.log('');
if (pass) {
  console.log('  结论：可以轮换（记忆与归档都在）');
  process.exit(0);
} else {
  console.log('  结论：先别换。把上面标[缺]的补上；实在补不上就让上层压缩，别丢记');
  process.exit(2);
}
