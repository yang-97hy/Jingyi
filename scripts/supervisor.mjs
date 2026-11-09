// 常驻守护：网关看门狗 + 每日维护 + 归档（2026-11-09）
// 用法：node scripts/supervisor.mjs
// 它做四件事：
//   ① 每 30 秒检查网关端口（配置了才查），掉了就按 startCmd 拉起
//   ② 每天 23:00 跑一次日常维护（健康报告 + 待标清单）
//   ③ 每 15 分钟跑一次增量归档（把新会话存进归档目录）
//   ④ 所有动作写 logs/supervisor.log
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { CFG } from './_config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LOG = path.join(CFG.logDir, 'supervisor.log');
const STATE = path.join(CFG.stateDir, 'supervisor.json');
const PORTS = CFG.gateway?.healthPorts || [];
const START = CFG.gateway?.startCmd || '';
const WORKDIR = CFG.gateway?.workdir || process.cwd();

fs.mkdirSync(CFG.logDir, { recursive: true });
const log = (m) => { const l = new Date().toISOString() + '  ' + m + '\n'; try { fs.appendFileSync(LOG, l, 'utf8'); } catch {} };

const portOpen = (p) => new Promise((res) => {
  const s = net.connect({ host: '127.0.0.1', port: p });
  const done = (v) => { try { s.destroy(); } catch {} res(v); };
  s.setTimeout(1500); s.once('connect', () => done(true)); s.once('timeout', () => done(false)); s.once('error', () => done(false));
});

const run = (file, args = []) => {
  try {
    const out = execFileSync(process.execPath, [file, ...args], { encoding: 'utf8', timeout: 120000 });
    return out.trim();
  } catch (e) { return '失败: ' + (e.message || '').slice(0, 120); }
};

let lastDaily = '';
let lastArchive = 0;
let savedGatewayPid = 0;

async function tick() {
  const now = Date.now();
  const d = new Date();
  const day = d.toISOString().slice(0, 10);

  // ① 网关
  if (PORTS.length && START) {
    const ups = await Promise.all(PORTS.map(portOpen));
    if (!ups.every(Boolean)) {
      if (!savedGatewayPid || !alive(savedGatewayPid)) {
        log('网关端口不在听 → 拉起: ' + START);
        const child = spawn(START, { cwd: WORKDIR, shell: true, detached: true, stdio: 'ignore', windowsHide: true });
        child.unref();
        savedGatewayPid = child.pid;
      }
    } else if (savedGatewayPid && !alive(savedGatewayPid)) {
      savedGatewayPid = 0;
    }
  }

  // ② 每日维护（23 点后跑一次）
  if (d.getHours() >= 23 && lastDaily !== day) {
    log('每日维护开始');
    const out = run(path.join(ROOT, 'scripts', 'daily-maint.mjs'));
    log('每日维护结束: ' + out.split('\n')[0]);
    lastDaily = day;
  }

  // ③ 增量归档（每 15 分钟）
  if (now - lastArchive > 15 * 60 * 1000) {
    const out = run(path.join(ROOT, 'scripts', 'archive-incremental.mjs'));
    if (!/没有需要补的会话/.test(out)) log('增量归档: ' + out.split('\n').filter(Boolean).slice(-2).join(' | '));
    lastArchive = now;
  }

  fs.writeFileSync(STATE, JSON.stringify({ at: now, lastDaily, lastArchive, gatewayPid: savedGatewayPid }, null, 2), 'utf8');
}

function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

log('守护进程启动 pid=' + process.pid + ' 端口=' + (PORTS.join(',') || '（未配置，跳过）'));
await tick();
setInterval(() => { tick().catch((e) => log('异常: ' + e.message)); }, 30_000);
