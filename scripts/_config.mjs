// 统一配置读取（2026-11-09）
// 优先级：环境变量 > config.local.json > 默认（脚本同级 记忆库/）
// 别人只需要改 config.local.json 一个文件。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

export function loadConfig() {
  const defaults = {
    memoryRoot: path.join(ROOT, '记忆库'),
    stateDir: path.join(ROOT, 'state'),
    logDir: path.join(ROOT, 'logs'),
    gateway: { startCmd: '', workdir: '', healthPorts: [] },
    sessionStore: '',
    rotation: { thresholdTokens: 0.85, enabled: true },
    archive: { beforeRotate: true },
  };
  let file = {};
  for (const cand of [path.join(ROOT, 'config.local.json'), path.join(process.cwd(), 'config.local.json')]) {
    try { if (fs.existsSync(cand)) { file = JSON.parse(fs.readFileSync(cand, 'utf8')); break; } } catch {}
  }
  const cfg = { ...defaults, ...file, gateway: { ...defaults.gateway, ...(file.gateway || {}) }, rotation: { ...defaults.rotation, ...(file.rotation || {}) }, archive: { ...defaults.archive, ...(file.archive || {}) } };

  // 环境变量覆盖
  if (process.env.JY_MEMORY) cfg.memoryRoot = process.env.JY_MEMORY;
  if (process.env.JY_STATE) cfg.stateDir = process.env.JY_STATE;
  if (process.env.JY_SESSIONS) cfg.sessionStore = process.env.JY_SESSIONS;
  if (process.env.JY_LOGS) cfg.logDir = process.env.JY_LOGS;

  // 会话存储自动发现
  if (!cfg.sessionStore) cfg.sessionStore = findSessionStore();
  // 情绪文件
  cfg.chemFile = cfg.chemFile || path.join(cfg.stateDir, 'chem.json');

  const M = cfg.memoryRoot;
  cfg.paths = {
    memory: M,
    l0: path.join(M, 'L0'),
    l1: path.join(M, 'L1'),
    daily: path.join(M, '每日'),
    exam: path.join(M, '考试'),
    pitfall: path.join(M, '坑'),
    voice: path.join(M, '语域'),
    archive: path.join(M, '归档'),
  };
  return cfg;
}

export function findSessionStore() {
  const roots = [process.env.APPDATA, process.env.LOCALAPPDATA, os.homedir()].filter(Boolean);
  for (const r of roots) {
    let apps = [];
    try { apps = fs.readdirSync(r); } catch { continue; }
    for (const app of apps) {
      const p = path.join(r, app, 'harness', 'sessions');
      try {
        if (!fs.existsSync(p)) continue;
        if (fs.readdirSync(p).some((n) => n.startsWith('session-'))) return p;
      } catch {}
    }
    // 另外常见布局：~/.claude/projects
    const cc = path.join(r, '.claude', 'projects');
    if (fs.existsSync(cc)) return cc;
  }
  return '';
}

export const P = loadConfig().paths;
export const CFG = loadConfig();
