// 每日维护：健康报告 + 漏标提醒（2026-11-05）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

// ── 路径发现（不写死本机目录名，别人也能用）──
function findSessionStore() {
  if (process.env.JY_SESSIONS && fs.existsSync(process.env.JY_SESSIONS)) return process.env.JY_SESSIONS;
  const roots = [process.env.APPDATA, process.env.LOCALAPPDATA, os.homedir()].filter(Boolean);
  for (const r of roots) {
    for (const app of (() => { try { return fs.readdirSync(r); } catch { return []; } })()) {
      const p = path.join(r, app, 'harness', 'sessions');
      try {
        if (!fs.existsSync(p)) continue;
        if (fs.readdirSync(p).some((n) => n.startsWith('session-'))) return p;
      } catch {}
    }
  }
  return '';
}
function findChemFile() {
  if (process.env.JY_CHEM && fs.existsSync(process.env.JY_CHEM)) return process.env.JY_CHEM;
  const cands = [path.join(process.cwd(), 'state', 'chem.json'), path.join(process.cwd(), 'chem.json')];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return cands[0];
}

const LIB = '/path/to/我的助手记忆';
const LOGDIR = '/path/to/管理员\\日志';
const NODE = process.execPath;
const d = new Date();
const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// 1) 健康报告
let report = '';
try { report = execFileSync(NODE, ['D:\\AI\\tools\\mem-health.mjs'], { encoding: 'utf8' }); } catch (e) { report = '报告失败: ' + e.message; }

// 2) 今天漏标的候选（L0 里他的话，按信息量排序，取前 12 条）
const l0 = path.join(LIB, 'L0', ds + '.jsonl');
let todo = '';
if (fs.existsSync(l0)) {
  const rows = fs.readFileSync(l0, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const idx = path.join(LIB, 'L1', ds + '.index.jsonl');
  const marked = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).map((x) => Number(x.s)) : [];
  const cand = rows
    .filter((r) => r.from === 'him' && !marked.includes(Number(r.seq)))
    .filter((r) => !/^\[(拍一拍|图片|表情|语音|视频|文件|撤回|红包)/.test(String(r.text || '')))
    .map((r) => {
      const t = String(r.text || '');
      let sc = 0;
      if (/\d/.test(t)) sc += 2;
      if (/(我|你).*(喜欢|不喜欢|讨厌|想|要|答应|决定)/.test(t)) sc += 3;
      if (/(今天|明天|下周|这个月)/.test(t)) sc += 2;
      if (t.length >= 8 && t.length <= 70) sc += 1;
      return { s: r.seq, t, sc };
    })
    .filter((x) => x.sc >= 3)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 12);
  todo = cand.map((x) => '- seq ' + x.s + '（分 ' + x.sc + '）' + x.t.slice(0, 46)).join('\n');
  fs.writeFileSync(path.join(LIB, '考试', '待标-' + ds + '.md'),
    '# ' + ds + ' 还值得标的（今天 L1 已标 ' + marked.length + ' 条）\n\n' + (todo || '（今天都标过了）') + '\n', 'utf8');
}

// 3) 落到日志
fs.mkdirSync(LOGDIR, { recursive: true });
const out = [report, '', '## 今日漏标候选（' + ds + '）', '', todo || '（无）'].join('\n');
fs.appendFileSync(path.join(LOGDIR, ds + '.md'), '\n\n---\n\n## 记忆维护 · ' + d.toLocaleString('zh-CN') + '\n\n```\n' + out + '\n```\n', 'utf8');
console.log('  已写入日志: ' + ds + '.md');
console.log('  待标清单: ' + path.join(LIB, '考试', '待标-' + ds + '.md'));
console.log(report.split('\n').slice(0, 4).join('\n'));
