#!/usr/bin/env node
/**
 * Reads one Maestro run folder (maestro-output/<device>/<time>) after a failed simulator run.
 *
 *   node scripts/driver-killed-flows.mjs killed <run folder>   flows the driver's crash cut off
 *   node scripts/driver-killed-flows.mjs failed <run folder>   flows that failed on their own
 *
 * Maestro drives the app through one XCTest case on the simulator. If that case stops (run 65 on
 * iPad: XCTest could not read the system keyboard's window after 30 minutes), XCTest relaunches the
 * runner with no test to run, nothing answers Maestro any more, and every flow after it "fails" in
 * seconds with a command left running and no failed command. Those flows were never tested, so the
 * workflow runs them again once. A flow with a failed command failed by itself and still fails the
 * job. Without XCTest's restart message in the runner log, nothing is listed as cut off.
 *
 * Prints the flows as e2e/<name>.yaml, separated by spaces (nothing when there are none).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [mode, runDir] = process.argv.slice(2);
if (!['killed', 'failed'].includes(mode) || !runDir) {
  console.error('usage: driver-killed-flows.mjs killed|failed <maestro run folder>');
  process.exit(2);
}

const entries = readdirSync(runDir, { withFileTypes: true });
const driverStopped = entries.some(
  (e) =>
    e.isFile() &&
    e.name.startsWith('xctest_runner') &&
    readFileSync(join(runDir, e.name), 'utf8').includes('Restarting after unexpected exit'),
);

const statuses = (flow) => {
  const file = join(runDir, flow, 'commands.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')).map((c) => c?.metadata?.status);
  } catch {
    return null;
  }
};

const flows = [];
for (const e of entries) {
  // Only top-level flows of e2e/ have a folder of their own here.
  if (!e.isDirectory() || !existsSync(join('e2e', `${e.name}.yaml`))) continue;
  const s = statuses(e.name);
  const failed = !!s?.includes('FAILED');
  const cutOff = driverStopped && !failed && (s === null || s.includes('RUNNING'));
  if (mode === 'failed' ? failed : cutOff) flows.push(`e2e/${e.name}.yaml`);
}
process.stdout.write(flows.sort().join(' '));
