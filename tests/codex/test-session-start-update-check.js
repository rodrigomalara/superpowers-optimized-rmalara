#!/usr/bin/env node
/**
 * Unit tests — hooks/session-start Path B (marketplace install) update check.
 *
 * Runs the real hook from a non-git copy of the plugin, with a fake `curl` on PATH
 * that only answers for the fork's plugin.json URL.
 * Run: node tests/codex/test-session-start-update-check.js
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');
const FORK_URL_PART = 'rodrigomalara/superpowers-optimized-rmalara';

let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${label}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

function runHook({ localVersion, remoteVersion, staleUpstreamCache }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-update-check-'));
  try {
    const pluginRoot = path.join(tmp, 'plugin');
    const home = path.join(tmp, 'home');
    const bin = path.join(tmp, 'bin');
    const cwd = path.join(tmp, 'cwd');
    fs.cpSync(path.join(REPO_ROOT, 'hooks'), path.join(pluginRoot, 'hooks'), { recursive: true });
    fs.mkdirSync(path.join(pluginRoot, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(pluginRoot, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'superpowers-optimized', version: '0.0.1' }, null, 2));
    fs.mkdirSync(path.join(home, '.claude', 'plugins'), { recursive: true });
    fs.mkdirSync(path.join(home, '.claude', 'hooks-logs'), { recursive: true });
    fs.writeFileSync(path.join(home, '.claude', 'plugins', 'installed_plugins.json'), JSON.stringify({
      version: 2,
      plugins: {
        'superpowers-optimized@superpowers-optimized-rmalara': [
          { scope: 'user', installPath: pluginRoot, version: localVersion },
        ],
      },
    }, null, 2));
    if (staleUpstreamCache) {
      fs.writeFileSync(path.join(home, '.claude', 'hooks-logs', 'update-check.cache'), staleUpstreamCache);
    }
    fs.mkdirSync(bin);
    fs.mkdirSync(cwd);
    fs.writeFileSync(path.join(bin, 'curl'),
      `#!/usr/bin/env bash\ncase "$*" in *${FORK_URL_PART}*) printf '{\\n  "version": "${remoteVersion}"\\n}\\n' ;; *) exit 22 ;; esac\n`,
      { mode: 0o755 });

    const env = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` };
    delete env.SUPERPOWERS_AUTO_UPDATE;
    delete env.CLAUDE_PLUGIN_ROOT;
    const r = spawnSync('bash', [path.join(pluginRoot, 'hooks', 'session-start')], {
      cwd, env, encoding: 'utf8', timeout: 20000,
      input: JSON.stringify({ cwd, session_id: 'update-check-' + Date.now() + Math.random(), source: 'startup' }),
    });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\nsession-start update check (marketplace install, fork)');

test('newer -scope.N on the fork produces a notice naming the fork marketplace', () => {
  const out = runHook({ localVersion: '6.8.1-scope.3', remoteVersion: '6.8.1-scope.4' });
  assert.ok(out.includes('v6.8.1-scope.4 is available'), out);
  assert.ok(out.includes('you have v6.8.1-scope.3'), out);
  assert.ok(out.includes('superpowers-optimized-rmalara'), out);
  assert.ok(!out.includes('REPOZY'), out);
});

test('same version produces no notice', () => {
  const out = runHook({ localVersion: '6.8.1-scope.4', remoteVersion: '6.8.1-scope.4' });
  assert.ok(!out.includes('is available'), out);
});

test('older remote produces no notice', () => {
  const out = runHook({ localVersion: '6.8.1-scope.4', remoteVersion: '6.8.1-scope.3' });
  assert.ok(!out.includes('is available'), out);
});

test('newer base version beats any scope suffix', () => {
  const out = runHook({ localVersion: '6.8.1-scope.9', remoteVersion: '6.9.0-scope.1' });
  assert.ok(out.includes('v6.9.0-scope.1 is available'), out);
});

test('stale upstream cache from the old check is ignored', () => {
  const out = runHook({ localVersion: '6.8.1-scope.4', remoteVersion: '6.8.1-scope.4', staleUpstreamCache: '6.10.0' });
  assert.ok(!out.includes('6.10.0'), out);
});

console.log(`\nsession-start-update-check: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
