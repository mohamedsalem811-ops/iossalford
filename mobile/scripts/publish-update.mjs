#!/usr/bin/env node
/**
 * Publishes an instant update, with the safety checks of the plan (8.0a, 8.0i).
 *
 *   node scripts/publish-update.mjs preview "message"                 → Expo Go preview (branch preview)
 *   node scripts/publish-update.mjs production "message" --approved   → the installed app (branch production)
 *   node scripts/publish-update.mjs record                            → after the owner installs a new .ipa
 *
 * A production update is refused unless the owner approved it (--approved) and the update fits the
 * .ipa installed on the devices (updates/installed-build.json): the same native side (fingerprint)
 * and the same database version. A database upgrade always ships in a new .ipa, never as an update:
 * a rollback or the weekly re-sign could otherwise bring back code that can't open the database.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The EAS command-line version updates are published with; raise it on purpose, after a test. */
const EAS_CLI = '27.2.0';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const installedFile = join(root, 'updates', 'installed-build.json');

function fingerprint() {
  const out = execFileSync('npx', ['expo-updates', 'fingerprint:generate', '--platform', 'ios'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out).hash;
}

/** The newest migration number in src/db/schema.ts. */
function schemaVersion() {
  const src = readFileSync(join(root, 'src', 'db', 'schema.ts'), 'utf8');
  return Math.max(...[...src.matchAll(/^\s*version:\s*(\d+),/gm)].map((m) => Number(m[1])));
}

function eas(branch, message, env) {
  execFileSync(
    'npx',
    [
      '--yes',
      // A fixed, tested version (audit F-12): a new release can't change publishing unseen.
      `eas-cli@${EAS_CLI}`,
      'update',
      '--branch',
      branch,
      '--platform',
      'ios',
      '--environment',
      branch === 'production' ? 'production' : 'preview',
      '--message',
      message,
      '--non-interactive',
    ],
    { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } },
  );
}

const [what, message, flag] = process.argv.slice(2);

if (what === 'record') {
  const info = {
    fingerprint: fingerprint(),
    schemaVersion: schemaVersion(),
    commit: execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    recordedAt: new Date().toISOString().slice(0, 10),
  };
  mkdirSync(dirname(installedFile), { recursive: true });
  writeFileSync(installedFile, JSON.stringify(info, null, 2) + '\n');
  console.log('Recorded the installed .ipa:', info);
} else if (what === 'preview' && message) {
  eas('preview', message, { SALFORD_UPDATE_TARGET: 'expo-go' });
} else if (what === 'production' && message) {
  const problems = [];
  if (flag !== '--approved')
    problems.push('The owner has not approved this update (add --approved once they have).');
  let installed = { fingerprint: null, schemaVersion: null };
  try {
    installed = JSON.parse(readFileSync(installedFile, 'utf8'));
  } catch {
    problems.push(
      'No installed .ipa is recorded yet (run "record" once the owner has installed it).',
    );
  }
  const fp = fingerprint();
  const schema = schemaVersion();
  if (fp !== installed.fingerprint)
    problems.push(
      `The native side changed (fingerprint ${fp}, installed ${installed.fingerprint}): this needs a new .ipa.`,
    );
  if (schema !== installed.schemaVersion)
    problems.push(
      `The database version changed (${schema}, installed ${installed.schemaVersion}): database upgrades ship only in a new .ipa.`,
    );
  if (problems.length) {
    console.error('Not published:\n- ' + problems.join('\n- '));
    process.exit(1);
  }
  eas('production', message, {});
} else {
  console.error(
    'Usage: publish-update.mjs preview "message" | production "message" --approved | record',
  );
  process.exit(2);
}
