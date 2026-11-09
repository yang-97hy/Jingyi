// 一键初始化：建记忆库、生成配置、检查环境（2026-11-09）
// 用法：node scripts/init.mjs [目标目录]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const target = process.argv[2] || path.join(ROOT, '记忆库');

const ok = (s) => '  [OK]   ' + s;
const mk = (s) => '  [新建] ' + s;
const wa = (s) => '  [跳过] ' + s;

const DIRS = ['L0', 'L1', '每日', '考试', '坑', '语域', '归档'];
const stateDir = path.join(ROOT, 'state');
const logDir = path.join(ROOT, 'logs');

console.log('【鲸忆 初始化】' + new Date().toLocaleString('zh-CN'));
console.log('  目标目录: ' + target);
console.log('');

// 1) 建目录
for (const d of DIRS) {
  const p = path.join(target, d);
  if (fs.existsSync(p)) console.log(wa(d + '/ 已存在'));
  else { fs.mkdirSync(p, { recursive: true }); console.log(mk(d + '/')); }
}
for (const d of [stateDir, logDir]) {
  if (fs.existsSync(d)) console.log(wa(path.basename(d) + '/ 已存在'));
  else { fs.mkdirSync(d, { recursive: true }); console.log(mk(path.basename(d) + '/')); }
}

// 2) 模板文件
const writeIfAbsent = (rel, body) => {
  const p = path.join(target, rel);
  if (fs.existsSync(p)) return;
  fs.writeFileSync(p, body, 'utf8');
  console.log(mk(rel));
};
writeIfAbsent(path.join('坑', '坑.jsonl'), '');
writeIfAbsent(path.join('L0', 'README.md'), '# L0 原话层\n\n每天一个 YYYY-MM-DD.jsonl，一条消息一行。只追加，不改字。\n');
writeIfAbsent(path.join('L1', 'README.md'), '# L1 记忆层\n\n每天一个 YYYY-MM-DD.index.jsonl。模型自己标，带 seq + quote 校验。\n');
writeIfAbsent(path.join('每日', 'README.md'), '# 每日记忆\n\n轮换前写：[事实] / [承诺] / [情绪]，一条一件事，超 80 字拆开。\n');
writeIfAbsent(path.join('归档', 'README.md'), '# 归档\n\n按对象分目录：NN_日期_会话.md + 索引.md。全文 + 思考过程，不截断。\n');

// 3) 情绪状态
const chem = path.join(stateDir, 'chem.json');
if (fs.existsSync(chem)) console.log(wa('state/chem.json 已存在'));
else {
  fs.writeFileSync(chem, JSON.stringify({
    version: 1,
    temperament: { sensitivity: 1.0, resilience: 1.0, enthusiasm: 50, metabolism: 1.0 },
    chemicals: [
      { id: 'dopamine', baseline: 50, halfLifeMinutes: 30, min: 0, max: 100 },
      { id: 'cortisol', baseline: 20, halfLifeMinutes: 90, min: 0, max: 100 },
      { id: 'serotonin', baseline: 55, halfLifeMinutes: 240, min: 0, max: 100 },
    ],
    events: [],
  }, null, 2), 'utf8');
  console.log(mk('state/chem.json（含三条激素默认值）'));
}

// 4) 配置文件
const cfgPath = path.join(ROOT, 'config.local.json');
if (fs.existsSync(cfgPath)) console.log(wa('config.local.json 已存在（不覆盖）'));
else {
  const cfg = {
    _comment: '改这里就行；不填的项会用默认值',
    memoryRoot: target,
    stateDir,
    logDir,
    sessionStore: '',
    rotation: { enabled: true, thresholdTokens: 0.85, checkEveryMinutes: 10 },
    archive: { beforeRotate: true },
    gateway: { startCmd: '', workdir: '', healthPorts: [] },
  };
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
  console.log(mk('config.local.json（已按本机路径填好）'));
}

// 5) 环境检查
console.log('');
console.log('【检查】');
console.log('  node ' + process.version);
const dr = spawnSync(process.execPath, [path.join(HERE, 'doctor.mjs')], {
  encoding: 'utf8',
  env: { ...process.env, JY_MEMORY: target, JY_STATE: stateDir, JY_LOGS: logDir },
});
if (dr.stdout) {
  const lines = dr.stdout.split('\n').filter((l) => /OK|FAIL|WARN/.test(l)).slice(0, 8);
  console.log(lines.join('\n') || '  （没有可看的结果）');
} else console.log('  doctor 没输出，先跳过');

// 6) 下一步
console.log('');
console.log('【下一步】');
console.log('  1. 把你的框架挂上三个钩子（见 docs/接入钩子.md）：收消息→L0、取候选、写标注');
console.log('  2. 轮换前调用：node scripts/pre-rotate.mjs <会话id>');
console.log('  3. 常驻守护：node scripts/supervisor.mjs（归档 + 每日维护 + 网关看门狗）');
console.log('  4. 体检：node scripts/mem-health.mjs / node scripts/hormones.mjs');
