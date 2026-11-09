// 一键安装：建库 → 配置 → 注册开机自启 → 起守护 → 自检（2026-11-09）
// 用法：node scripts/install.mjs
// 目标：别人把仓库丢进自己的 DSH，跑这一条，剩下的不用管。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './_config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const say = (s) => console.log(s);
const ok = (s) => console.log('  [OK]   ' + s);
const mk = (s) => console.log('  [做]   ' + s);
const wa = (s) => console.log('  [跳过] ' + s);
const no = (s) => console.log('  [注意] ' + s);

say('【鲸忆 一键安装】' + new Date().toLocaleString('zh-CN'));
say('  目录: ' + ROOT);
say('');

// ① 初始化记忆库（可重复执行）
say('① 初始化');
const init = spawnSync(process.execPath, [path.join(HERE, 'init.mjs')], { encoding: 'utf8' });
say((init.stdout || '').split('\n').filter((l) => /新建|跳过|OK|FAIL|WARN/.test(l)).slice(0, 14).join('\n') || '  （init 无输出）');
if (init.status !== 0 && init.status !== null) no('init 退出码 ' + init.status + '（可继续）');

// ② 配置
say('');
say('② 配置');
const cfgPath = path.join(ROOT, 'config.local.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
cfg.supervisor = cfg.supervisor || {};
cfg.rotation = cfg.rotation || { enabled: true, thresholdTokens: 0.85 };
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf8');
ok('config.local.json 就绪（要接自己的网关，改里面的 gateway）');

// ③ 开机自启（Windows）
say('');
say('③ 开机自启');
if (process.platform === 'win32') {
  const tr = `"${process.execPath}" "${path.join(HERE, 'supervisor.mjs')}"`;
  const r = spawnSync('schtasks', ['/Create', '/TN', 'JingYi-Supervisor', '/TR', tr, '/SC', 'ONLOGON', '/F'], { encoding: 'utf8' });
  if (r.status === 0) ok('已注册计划任务 JingYi-Supervisor（登录时自动起守护）');
  else no('注册计划任务失败（可手动运行 supervisor.mjs）：' + (r.stdout || r.stderr || '').slice(0, 80));
} else {
  wa('非 Windows：请自行把 supervisor.mjs 加入 systemd/cron');
}

// ④ 起守护（如果没在跑）
say('');
say('④ 守护进程');
const already = spawnSync('powershell', ['-NoProfile', '-Command',
  "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine -match 'supervisor.mjs' } | Measure-Object | Select-Object -ExpandProperty Count"],
  { encoding: 'utf8' });
const running = Number((already.stdout || '0').trim()) > 0;
if (running) wa('守护已在运行');
else {
  const child = spawn(process.execPath, [path.join(HERE, 'supervisor.mjs')], { cwd: ROOT, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  mk('守护已启动（pid ' + child.pid + '），日志在 logs/supervisor.log');
}

// ⑤ 自检
say('');
say('⑤ 自检');
const doc = spawnSync(process.execPath, [path.join(HERE, 'doctor.mjs')], { encoding: 'utf8' });
say((doc.stdout || '').split('\n').filter((l) => /OK|FAIL|WARN/.test(l)).join('\n') || '  （doctor 无输出）');

// ⑥ 收尾
say('');
say('【装好了。接下来只有一件事】');
say('  照 docs/接入钩子.md 把你的框架挂上三个钩子：');
say('    · 收到消息 → 写 L0');
say('    · 取候选 → 给模型看');
say('    · 写标注 → 带三条校验');
say('  换会话前调一次：node scripts/pre-rotate.mjs <会话id>');
say('');
say('  其它都会自己跑：归档（每15分钟）、日常维护（每天23点）、网关掉线自动拉起。');
