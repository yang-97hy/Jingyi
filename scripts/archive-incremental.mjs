// 增量补归档：只处理还没归档过的会话（2026-11-02）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

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

const WS = findSessionStore();
const DIR = '/path/to/我的助手记忆\\归档';

const existing = fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== '索引.md');
const done = new Set(existing.map((f) => (f.match(/_([0-9a-f]{8})_/) || [])[1]).filter(Boolean));
let next = Math.max(0, ...existing.map((f) => Number((f.match(/^(\d+)_/) || [])[1] || 0))) + 1;

const sess = fs.readdirSync(WS).filter((n) => n.startsWith('session-')).map((n) => {
  const f = path.join(WS, n, 'session.v4.jsonl.zstd');
  return fs.existsSync(f) ? { id: n.replace('session-', ''), f, mtime: fs.statSync(f).mtimeMs } : null;
}).filter(Boolean).sort((a, b) => a.mtime - b.mtime);

const textOf = (o) => {
  const c = o?.data?.message?.content ?? o?.data?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : (x?.text || ''))).join('\n');
  return '';
};

let added = 0;
for (const s of sess) {
  const short8 = s.id.slice(0, 8);
  if (done.has(short8)) continue;
  const buf = fs.readFileSync(s.f);
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
  const starts = []; let i = 0;
  while (true) { const k = buf.indexOf(MAGIC, i); if (k < 0) break; starts.push(k); i = k + 4; }
  let all = '';
  for (let k = 0; k < starts.length; k++) {
    const from = starts[k], to = k + 1 < starts.length ? starts[k + 1] : buf.length;
    try { all += zlib.zstdDecompressSync(buf.subarray(from, to)).toString('utf8'); } catch {}
  }
  const recs = all.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  let qq = (all.match(/private:(\d{5,})/) || [])[1] || 'unknown';
  const lines = [];
  let msgs = 0, t0 = 0;
  for (const r of recs) {
    const t = Number(r.time || 0);
    if (!t0 && r.type === 'user/message') t0 = t;
    const d = new Date(t);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (r.type === 'user/message') {
      const txt = String(textOf(r) || '').trim();
      if (!txt) continue;
      if (/^【(当前时间|衔接上一段对话|最近|还没做完|第一优先级|你俩的惯用|引导唤醒)/.test(txt) || txt.startsWith('Current runtime context')) continue;
      lines.push(`- ${hm} 【他】${txt.replace(/\n/g, ' ').slice(0, 400)}`);
      msgs++;
    } else if (r.type === 'tool/call') {
      const name = String(r?.data?.name || '');
      if (/qq_send_message|qq_reply|qq_send_group_message|qq_send_private_message/.test(name)) {
        let a = r?.data?.arguments ?? r?.data?.input;
        if (typeof a === 'string') { try { a = JSON.parse(a); } catch {} }
        const b = a?.messages ?? a?.message;
        for (const m of (Array.isArray(b) ? b : (b ? [b] : []))) {
          const t2 = typeof m === 'string' ? m : (m?.text ?? '');
          if (t2 && String(t2).trim()) { lines.push(`- ${hm} 【她·说】${String(t2).trim().replace(/\n/g, ' ')}`); msgs++; }
        }
      }
    }
  }
  if (!msgs) continue;
  const d0 = t0 ? new Date(t0) : new Date(s.mtime);
  const date = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
  const hm0 = String(d0.getHours()).padStart(2, '0') + ':' + String(d0.getMinutes()).padStart(2, '0');
  const n = String(next).padStart(2, '0');
  const name = `${n}_${date}_${short8}_${qq}.md`;
  const head = `# 归档会话 ${short8}\n\n- 日期：${date}\n- 对象：${qq}\n- 消息条数：${msgs}\n\n> 这是按时间排的第 ${n} 次会话（${date} ${hm0} 开始）。\n\n---\n`;
  fs.writeFileSync(path.join(DIR, name), head + lines.join('\n') + '\n', 'utf8');
  console.log('  新增 ' + name + '  ' + msgs + ' 条');
  next++; added++;
}
console.log(added ? '  合计新增 ' + added + ' 个会话' : '  没有需要补的会话');
