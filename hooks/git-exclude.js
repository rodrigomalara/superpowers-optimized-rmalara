/**
 * Local-exclude check shared by the hooks that auto-append to .gitignore.
 *
 * A file the user already ignores in .git/info/exclude must not be added to
 * the tracked .gitignore — that turns a local preference into a committed change.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * True when `basename` is listed in the repository's info/exclude file.
 * Matches the bare name or its root-anchored form (`/name`). Resolves the file
 * through `git rev-parse --git-path`, so worktrees and custom GIT_DIRs work.
 * Returns false outside a git repository or on any error.
 */
function isInGitExclude(dir, basename) {
  try {
    const rel = execSync('git rev-parse --git-path info/exclude', {
      encoding: 'utf8',
      timeout: 5000,
      cwd: dir,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!rel) return false;

    const excludePath = path.resolve(dir, rel);
    if (!fs.existsSync(excludePath)) return false;

    const lines = fs.readFileSync(excludePath, 'utf8').split('\n').map(l => l.trim());
    return lines.includes(basename) || lines.includes(`/${basename}`);
  } catch {
    return false;
  }
}

module.exports = { isInGitExclude };
