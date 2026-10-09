'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMORY_BYTES = 4096;
const DUPLICATE_WINDOW_MS = 10000;

function ledgerPath(cwd, sessionId, kind) {
  const key = crypto.createHash('sha256')
    .update(path.resolve(cwd) + '\0' + sessionId).digest('hex');
  return path.join(process.env.HOME || process.env.USERPROFILE || '.',
    '.claude', 'hooks-logs', `${kind}-${key}.json`);
}

function cap(text, file) {
  if (Buffer.byteLength(text) <= MEMORY_BYTES) return text;
  const note = `\n\n[Content omitted from ${file}; read relevant sections only when needed.]`;
  const prefix = Buffer.from(text).subarray(0, MEMORY_BYTES - Buffer.byteLength(note))
    .toString('utf8').replace(/\ufffd$/, '');
  return prefix + note;
}

function boundMemoryContext(text) {
  const names = {
    state: 'state.md', 'project-map': 'project-map.md',
    'known-issues': 'known-issues.md', 'session-log': 'session-log.md',
  };
  for (const [tag, file] of Object.entries(names)) {
    text = text.replace(new RegExp(String.raw`(<${tag}>(?:\n|\\n))([\s\S]*?)((?:\n|\\n)</${tag}>)`, 'g'),
      (_, before, body, after) => `<${tag}>\n` + cap(body, file) + `\n</${tag}>`);
  }
  return text;
}

function readLedger(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

// Suppress near-simultaneous duplicate registrations, not a later resume.
function claimStartup(data, cwd) {
  if (!data?.session_id) return true;
  const file = ledgerPath(cwd, data.session_id, 'startup');
  let position = '';
  try {
    const stat = fs.statSync(data.transcript_path);
    position = `${stat.size}:${stat.mtimeMs}`;
  } catch {}
  const event = (data.source || 'startup') + '\0' + position;
  const isDuplicate = old => old?.event === event &&
    Date.now() - old.time < DUPLICATE_WINDOW_MS;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (isDuplicate(readLedger(file))) return false;
    // Exclusive claim avoids concurrent plugin copies both injecting.
    const lock = file + '.lock';
    let fd;
    try {
      fd = fs.openSync(lock, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - fs.statSync(lock).mtimeMs < DUPLICATE_WINDOW_MS) return false;
      fs.unlinkSync(lock);
      fd = fs.openSync(lock, 'wx');
    }
    try {
      if (isDuplicate(readLedger(file))) return false;
      fs.writeFileSync(file, JSON.stringify({ event, time: Date.now() }));
      // A new context may need hints and recall that were previously surfaced.
      for (const kind of ['hints', 'recall']) {
        try { fs.unlinkSync(ledgerPath(cwd, data.session_id, kind)); } catch {}
      }
      return true;
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    }
  } catch {
    // Missing identity or unwritable storage must not drop startup context.
    return true;
  }
}

function dedupeSkillContext(cwd, sessionId, prompt, matches, context) {
  if (!sessionId) return context;
  const explicit = matches.some(({ skill }) => {
    const name = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[-\\s]');
    return new RegExp(`(?:\\b(?:use|invoke|run)\\s+(?:the\\s+)?(?:superpowers-optimized:)?|\\$|/)${name}\\b`, 'i')
      .test(prompt);
  });
  const key = matches.map(match => match.skill + ':' + match.priority).join('|');
  const file = ledgerPath(cwd, sessionId, 'hints');
  try {
    const last = readLedger(file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ key }));
    if (!explicit && !/\b(?:new|next)\s+(?:task|feature|phase)\b/i.test(prompt) &&
        last?.key === key) return null;
  } catch {}
  return context;
}

module.exports = { MEMORY_BYTES, cap, boundMemoryContext, claimStartup, dedupeSkillContext, ledgerPath };

if (require.main === module) {
  const raw = fs.readFileSync(0, 'utf8');
  let data;
  try { data = JSON.parse(process.argv[2] || '{}'); } catch { data = {}; }
  const envelope = JSON.parse(raw);
  const cwd = data?.cwd || process.cwd();
  if (!claimStartup(data, cwd)) {
    process.stdout.write('{}');
  } else {
    const output = envelope.hookSpecificOutput || envelope;
    const key = Object.hasOwn(output, 'additionalContext') ? 'additionalContext' : 'additional_context';
    output[key] = boundMemoryContext(output[key] || '');
    process.stdout.write(JSON.stringify(envelope));
  }
}
