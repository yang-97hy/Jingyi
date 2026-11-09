// 环境自检（读取 JY_* 环境变量 / config.local.json）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { CFG } from './_config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const ok = (s) => '  [OK]   ' + s;
const no = (s) => '  [FAIL] ' + s;
const wa = (s) => '  [WARN] ' + s;

const out = [];
out.push('【鲸忆 环境自检】' + new Date().toLocaleString('zh-CN'));
out.push('  node ' + process.version + ' / ' + os.platform() + ' ' + os.arch());
out.push('  记忆库: ' + CFG.memoryRoot);
out.push('');

const major = Number(process.version.replace('v', '').split('.')[0]);
out.push(major >= 20 ? ok('node 版本够用（>=20）') : no('node 版本过低，需要 20+'));

if (R(CFG.memoryRoot)) {
  out.push(ok('记忆库存在'));
  for (const [name, p] of Object.entries(CFG.paths)) {
    if (name === 'memory') continue;
    out.push(R(p) ? ok('  ' + name + '/') : no('  ' + name + '/ 缺失（跑 init.mjs 会建）'));
  }
  const l0 = CFG.paths.l0;
  if (R(l0)) {
    const n = fs.readdirSync(l0).filter((f) => f.endsWith('.jsonl')).length;
    out.push(n ? ok('  L0 有 ' + n + ' 天数据') : wa('  L0 是空的（还没接消息）'));
  }
} else {
  out.push(no('记忆库不存在: ' + CFG.memoryRoot + '（跑 node scripts/init.mjs）'));
}

if (R(CFG.chemFile)) {
  try {
    const c = JSON.parse(fs.readFileSync(CFG.chemFile, 'utf8'));
    out.push(ok('情绪文件可用（' + (c.chemicals || []).map((x) => x.id).join(',') + '）'));
  } catch { out.push(no('情绪文件解析失败: ' + CFG.chemFile)); }
} else {
  out.push(wa('没有情绪文件（跑 init.mjs 会生成）'));
}

out.push(CFG.sessionStore ? ok('会话存储: ' + CFG.sessionStore) : wa('没找到会话存储（归档功能会跳过）'));

for (const s of ['hormones.mjs', 'mem-health.mjs', 'make-exam.mjs', 'pre-rotate.mjs', 'supervisor.mjs']) {
  out.push(R(path.join(HERE, s)) ? ok('脚本存在: ' + s) : no('脚本缺失: ' + s));
}

out.push('');
out.push('  把这段整段贴给管理员，别截断。');
console.log(out.join('\n'));
