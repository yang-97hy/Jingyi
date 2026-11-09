// 探测这台机器上是什么框架（决定接哪条路）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const H = os.homedir();
const R = (p) => { try { return fs.existsSync(p); } catch { return false; } };
const hit = [];
const add = (name, note) => hit.push({ name, note });

if (R(path.join(H, 'AppData', 'Roaming', 'dsh-desktop'))) add('DSH Desktop', '会话目录在 AppData\\Roaming\\dsh-desktop');
if (R(path.join(H, '.claude')) || R(path.join(H, 'AppData', 'Roaming', 'Claude'))) add('Claude Code / Claude Desktop', '可能有 CLAUDE.md 与 project 记忆');
if (R(path.join(H, '.cursor'))) add('Cursor', '规则在 .cursorrules / .cursor/rules');
if (R(path.join(H, '.continue'))) add('Continue', '');
if (R(path.join(H, '.codeium'))) add('Codeium', '');

// 找项目里的框架痕迹
const marks = [
  ['package.json', /langchain|llamaindex|haystack|autogen|crewai/i, '自建 JS 编排框架'],
  ['requirements.txt', /langchain|llama-index|autogen|crewai|openai/i, '自建 Python 编排框架'],
  ['config.json', /socialV2|onebot|napcat|llonebot/i, '类似 QQ 桥接/OneBot 网关'],
];
const roots = [process.cwd(), path.join(H, 'Documents'), 'D:/', 'C:/Users/' + path.basename(H)];
for (const r of roots) {
  for (const [file, re, label] of marks) {
    const p = path.join(r, file);
    if (!R(p)) continue;
    try {
      const t = fs.readFileSync(p, 'utf8').slice(0, 20000);
      if (re.test(t)) add(label, p);
    } catch {}
  }
}

// 会话存储（能不能开新会话）
const sessDirs = [
  path.join(H, 'AppData', 'Roaming', 'dsh-desktop', 'harness', 'sessions'),
  path.join(H, '.claude', 'projects'),
  path.join(H, '.config'),
];
const hasSessions = sessDirs.some(R);

console.log('【框架探测】' + new Date().toLocaleString('zh-CN'));
console.log('  cwd: ' + process.cwd());
console.log('');
if (!hit.length) console.log('  没探到已知框架 —— 可能是：网页版聊天 / 自建脚本 / 别的');
else for (const h of hit) console.log('  · ' + h.name + (h.note ? '   （' + h.note + '）' : ''));
console.log('');
console.log('  能开新会话（有会话存储）: ' + (hasSessions ? '是 → 走完整版' : '查不到 → 走软轮换（见 docs/适配其他框架.md 第六节）'));
console.log('');
console.log('  下一步：');
if (hit.some((x) => x.name.startsWith('DSH'))) console.log('    你在 DSH 上 → 直接照 AGENTS.md 做');
else if (hasSessions) console.log('    有会话能力 → 先接三个最小接口，再接轮换');
else console.log('    没有会话能力 → 先做外部记忆（L0 + 每日 + 体检），别假装自动');
