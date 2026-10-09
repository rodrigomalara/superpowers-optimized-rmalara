'use strict';
let failures=0;
function test(name,fn) { try { fn(); console.log('PASS '+name); } catch(e) { failures++; console.error('FAIL '+name+': '+e.message); } }
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const { buildSessionContext } = require('../../hooks/codex/session-start-adapter');
const { evaluatePayload } = require('../../hooks/codex/user-prompt-submit-adapter');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-budget-'));
process.env.SUPERPOWERS_AUTO_UPDATE = '0';
process.env.HOME = temp;
delete process.env.USERPROFILE;
process.on('exit', () => fs.rmSync(temp, { recursive: true, force: true }));

test('empty startup uses a compact router', () => {
 const text = buildSessionContext(temp);
 assert.ok(Buffer.byteLength(text) < 3500, Buffer.byteLength(text));
 assert.ok(!text.includes('digraph'));
 assert.ok(text.includes('verification-before-completion'));
});

test('startup memory is bounded even with long Unicode lines', () => {
 for (const file of ['state.md', 'project-map.md', 'known-issues.md', 'session-log.md'])
  fs.writeFileSync(path.join(temp, file), '# Summary\n## Current [saved]\n'+ '界'.repeat(20000));
 const text = buildSessionContext(temp);
 for (const tag of ['state', 'project-map', 'known-issues', 'session-log']) {
  const body = text.match(new RegExp('<'+tag+'>\\n([\\s\\S]*?)\\n</'+tag+'>'))?.[1];
  assert.ok(body, tag);
  assert.ok(Buffer.byteLength(body) <= 4096, tag+': '+Buffer.byteLength(body));
  assert.ok(body.includes('omitted'), tag);
  assert.ok(!body.includes('\ufffd'));
 }
 for (const file of ['state.md', 'project-map.md', 'known-issues.md', 'session-log.md']) fs.unlinkSync(path.join(temp, file));
});

test('identical hints suppressed; explicit requests and phase changes survive', () => {
 const data = {cwd:temp, session_id:'hint-budget', prompt:'there is a bug in my code, it crashes when I call the function'};
 assert.ok(evaluatePayload(data).hookSpecificOutput?.additionalContext);
 assert.deepEqual(evaluatePayload(data), {});
 assert.ok(evaluatePayload({...data,prompt:'use systematic-debugging to debug this bug and crash'}).hookSpecificOutput?.additionalContext);
 evaluatePayload({...data,prompt:'hello'});
 assert.ok(evaluatePayload(data).hookSpecificOutput?.additionalContext);
 assert.ok(evaluatePayload({...data,session_id:'other-session'}).hookSpecificOutput?.additionalContext);
 assert.ok(evaluatePayload({...data,cwd:path.join(temp,'other-project')}).hookSpecificOutput?.additionalContext);
});

test('both startup entry points suppress duplicate lifecycle events and restore hints after compact', () => {
 const cwd = fs.mkdtempSync(path.join(temp, 'lifecycle-'));
 const env = {...process.env, SUPERPOWERS_AUTO_UPDATE:'0'};
 const payload = {cwd,session_id:'lifecycle-budget',source:'startup'};
 const run = (script,payload) => {
  const inputFile=path.join(cwd,'payload.json'); fs.writeFileSync(inputFile,JSON.stringify(payload));
  const fd=fs.openSync(inputFile,'r');
  const r=spawnSync(script.endsWith('.js')?'node':'bash',[path.join(root,script)],{cwd,env,stdio:[fd,'pipe','pipe'],encoding:'utf8',timeout:10000}); fs.closeSync(fd);
  assert.equal(r.status,0,r.stderr); return r.stdout.trim();
 };
 assert.ok(run('hooks/codex/session-start-adapter.js',payload).includes('superpowers-optimized'));
 assert.equal(run('hooks/codex/session-start-adapter.js',payload),'');
 assert.deepEqual(JSON.parse(run('hooks/session-start',payload)),{});
 const prompt={cwd,session_id:payload.session_id,prompt:'there is a bug in my code, it crashes when I call the function'};
 assert.ok(evaluatePayload(prompt).hookSpecificOutput);
 assert.deepEqual(evaluatePayload(prompt),{});
 assert.ok(run('hooks/session-start',{...payload,source:'compact'}).includes('superpowers-optimized'));
 assert.ok(evaluatePayload(prompt).hookSpecificOutput);
 assert.ok(run('hooks/codex/session-start-adapter.js',{...payload,source:'resume'}));
 fs.writeFileSync(path.join(cwd,'state.md'),'Current Goal: test\n'+'界'.repeat(20000));
 const shell=JSON.parse(run('hooks/session-start',{...payload,session_id:'shell-memory'}));
 const body=shell.additional_context.match(/<state>\n([\s\S]*?)\n<\/state>/)[1];
 assert.ok(Buffer.byteLength(body)<=4096);
 assert.ok(body.includes('omitted'));
 for (const [platform,key] of [['CLAUDE_PLUGIN_ROOT','hookSpecificOutput'],['CURSOR_PLUGIN_ROOT','additional_context']]) {
  env[platform]=root;
  const out=JSON.parse(run('hooks/session-start',{...payload,session_id:platform}));
  assert.ok(out[key]); delete env[platform];
 }

});

const {claimStartup, ledgerPath, MEMORY_BYTES} = require('../../hooks/session-context');
const {dedupeRecall} = require('../../hooks/skill-activator');
test('guard fails open without identity or writable storage and allows later resumes', () => {
 const cwd=path.join(temp,'guard-project');
 assert.equal(claimStartup({},cwd),true);
 const transcript=path.join(temp,'transcript.jsonl'); fs.writeFileSync(transcript,'a');
 const positioned={session_id:'positioned',source:'resume',transcript_path:transcript};
 assert.equal(claimStartup(positioned,cwd),true);
 assert.equal(claimStartup(positioned,cwd),false);
 fs.appendFileSync(transcript,'new turn');
 assert.equal(claimStartup(positioned,cwd),true);

 const data={session_id:'later-resume',source:'resume'};
 assert.equal(claimStartup(data,cwd),true);
 assert.equal(claimStartup(data,cwd),false);
 const file=ledgerPath(cwd,data.session_id,'startup');
 const old=JSON.parse(fs.readFileSync(file,'utf8')); old.time-=11000; fs.writeFileSync(file,JSON.stringify(old));
 assert.equal(claimStartup(data,cwd),true);
 const previous=process.env.HOME; const blocked=path.join(temp,'not-a-directory'); fs.writeFileSync(blocked,'x');
 process.env.HOME=blocked;
 try { assert.equal(claimStartup({session_id:'unwritable'},cwd),true); } finally {process.env.HOME=previous;}
});
test('omitted memory remains available to recall; reset after compact', () => {
 const cwd=fs.mkdtempSync(path.join(temp,'recall-'));
 const entry='## 2026-10-09 [saved]\nGoal: later decision';
 fs.writeFileSync(path.join(cwd,'session-log.md'),'## 2026-10-08 [saved]\n'+ 'x'.repeat(MEMORY_BYTES)+'\n'+entry);
 const sid='omitted-recall';
 assert.deepEqual(dedupeRecall(cwd,sid,[entry],[]).sessionLog,[entry]);
 assert.deepEqual(dedupeRecall(cwd,sid,[entry],[]).sessionLog,[]);
 claimStartup({session_id:sid,source:'compact'},cwd);
 assert.deepEqual(dedupeRecall(cwd,sid,[entry],[]).sessionLog,[entry]);
});

process.exitCode = failures ? 1 : 0;
