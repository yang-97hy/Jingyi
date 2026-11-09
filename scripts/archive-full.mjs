// 重建归档：全文 + 思考 + 按人分开（2026-11-04）
// 他的要求：所有会话的全文、她的思考过程都写进去；他和示例对象B的分开存。
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
const ROOT = '/path/to/我的助手记忆\\归档';
const OLD = path.join(ROOT, '_旧版_扁平');

// 1) 把旧的扁平文件挪到子目录，别删
fs.mkdirSync(OLD, { recursive: true });
for (const f of fs.readdirSync(ROOT)) {
  const p = path.join(ROOT, f);
  if (fs.statSync(p).isFile() && f.endsWith('.md')) fs.renameSync(p, path.join(OLD, f));
}

const WHO = { '100000001': 'TKS（主人）', '100000002': '示例对象B', '100000003': '示例对象C' };

// 取文本：兼容字符串 / 分段数组（他发消息时是分段结构，之前被取成 [object Object]）
function partsText(o) {
  const c = o?.data?.message?.content ?? o?.data?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : (p?.text ?? ""))).filter(Boolean).join("\n");
  if (c && typeof c === "object") return String(c.text ?? "");
  return "";
}
const textParts = (o) => {
  const c = o?.data?.message?.content;
  if (typeof c === 'string') return { text: c, think: '' };
  if (!Array.isArray(c)) return { text: '', think: '' };
  const text = c.filter((p) => p?.type === 'text').map((p) => p.text || '').join('\n');
  const think = c.filter((p) => p?.type === 'reasoning').map((p) => p.text || '').join('\n');
  return { text, think };
};

const sessions = fs.readdirSync(WS).filter((n) => n.startsWith('session-')).map((n) => {
  const f = path.join(WS, n, 'session.v4.jsonl.zstd');
  return fs.existsSync(f) ? { id: n.replace('session-', ''), f, mtime: fs.statSync(f).mtimeMs } : null;
}).filter(Boolean).sort((a, b) => a.mtime - b.mtime);

const index = {};
let done = 0;

for (const s of sessions) {
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

  const qq = (all.match(/private:(\d{5,})/) || [])[1] || 'unknown';
  const lines = [];
  let nHe = 0, nShe = 0, nThink = 0, nInject = 0, t0 = 0;

  for (const r of recs) {
    const t = Number(r.time || 0);
    if (!t) continue;
    if (!t0 && r.type === 'user/message') t0 = t;
    const d = new Date(t);
    const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

    if (r.type === 'user/message') {
      const raw = partsText(r);
      if (!raw.trim()) continue;
      const isInject = /^【(当前时间|衔接上一段对话|最近|还没做完|第一优先级|你俩的惯用|引导唤醒|本次消息快照)/.test(raw) || raw.startsWith('Current runtime context');
      if (isInject) {
        // 从快照里抽他的话：唤醒提示里带着【本次消息快照】，他的原话在那个 JSON 里
        let got = false;
        const m = raw.match(/【本次消息快照】\s*(\{[\s\S]*\})/);
        if (m) {
          try {
            const snap = JSON.parse(m[1]);
            const arr = snap.messages ?? snap.news ?? [];
            for (const it of (Array.isArray(arr) ? arr : [])) {
              const tx = String(it.text ?? it.content ?? "").trim();
              if (tx) { lines.push(`- ${hm} 【他】${tx}`); nHe++; got = true; }
            }
          } catch {}
        }
        lines.push(`- ${hm} 【注入】${raw}`); nInject++;
        void got;
      }
      else { lines.push(`- ${hm} 【他】${raw}`); nHe++; }
      continue;
    }
    if (r.type === 'assistant/message') {
      const { text, think } = textParts(r);
      if (text.trim()) { lines.push(`- ${hm} 【她】${text}`); nShe++; }
      if (think.trim()) { lines.push(`- ${hm} 【她·思考】${think}`); nThink++; }
      continue;
    }
    if (r.type === 'tool/call') {
      const name = String(r?.data?.name || '');
      if (/qq_send_message|qq_reply|qq_send_group_message|qq_send_private_message|qq_send_burst/.test(name)) {
        let a = r?.data?.arguments ?? r?.data?.input;
        if (typeof a === 'string') { try { a = JSON.parse(a); } catch {} }
        const b = a?.messages ?? a?.message;
        for (const m of (Array.isArray(b) ? b : (b ? [b] : []))) {
          const tx = typeof m === 'string' ? m : (m?.text ?? '');
          if (tx && String(tx).trim()) { lines.push(`- ${hm} 【她·说】${String(tx).trim()}`); nShe++; }
        }
      }
    }
  }

  if (!nHe && !nShe && !nThink) continue;

  const d0 = t0 ? new Date(t0) : new Date(s.mtime);
  const date = d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0');
  const hm0 = String(d0.getHours()).padStart(2, '0') + ':' + String(d0.getMinutes()).padStart(2, '0');
  const short8 = s.id.slice(0, 8);

  const dir = path.join(ROOT, qq);
  fs.mkdirSync(dir, { recursive: true });
  const list = (index[qq] ||= []);
  const n = String(list.length + 1).padStart(2, '0');
  const fname = `${n}_${date}_${short8}.md`;
  const head = [
    `# 会话 ${short8}（${WHO[qq] || qq}）`,
    '',
    `- 开始：${date} ${hm0}`,
    `- 他的消息 ${nHe} 条 / 她的话 ${nShe} 条 / 她的思考 ${nThink} 段 / 注入块 ${nInject} 条`,
    `- 说明：全文，不截断；注入块保留原文并标【注入】`,
    '',
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, fname), head + lines.join('\n') + '\n', 'utf8');
  list.push({ n, fname, date, hm0, nHe, nShe, nThink, nInject });
  done++;
  console.log(`  ${WHO[qq] || qq} ${fname}  他${nHe} 她${nShe} 思考${nThink} 注入${nInject}`);
}

// 每人一份索引
for (const [qq, list] of Object.entries(index)) {
  const dir = path.join(ROOT, qq);
  const md = [
    `# 归档索引 · ${WHO[qq] || qq}`,
    '',
    `共 ${list.length} 场会话。全文归档，含她的思考过程。`,
    '',
    '| # | 日期 | 开始 | 他的消息 | 她的话 | 思考段 | 注入块 | 文件 |',
    '|---|---|---|---|---|---|---|---|',
    ...list.map((x) => `| ${x.n} | ${x.date} | ${x.hm0} | ${x.nHe} | ${x.nShe} | ${x.nThink} | ${x.nInject} | [${x.fname}](${encodeURI(x.fname)}) |`),
  ].join('\n');
  fs.writeFileSync(path.join(dir, '索引.md'), md + '\n', 'utf8');
}
console.log('\n  完成：' + done + ' 个会话；分目录：' + Object.keys(index).join(' / '));
