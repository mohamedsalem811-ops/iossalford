#!/usr/bin/env node
/**
 * Prints the Maestro flows of one part of the simulator run, so each device's run is split over
 * machines working side by side (the full check before 10.0: 40 flows took 242 of the iPad's 275
 * minutes, too close to the limit).
 *
 *   node scripts/flow-parts.mjs <part> <parts>     e.g. 1 2 → the first half
 *
 * Every flow at the top of e2e/ (not subflows/, not config.yaml) goes to exactly one part. The
 * longest flows are placed first, each in the part with the fewest lines so far, so the parts take
 * about the same time. Same flows, same split. Prints e2e/<name>.yaml separated by spaces.
 */
import { readdirSync, readFileSync } from 'node:fs';

const [part, parts] = process.argv.slice(2).map(Number);
if (!Number.isInteger(part) || !Number.isInteger(parts) || part < 1 || part > parts) {
  console.error('usage: flow-parts.mjs <part> <parts>, with 1 <= part <= parts');
  process.exit(2);
}

const flows = readdirSync('e2e')
  .filter((f) => f.endsWith('.yaml') && f !== 'config.yaml')
  .sort()
  .map((f) => ({ file: `e2e/${f}`, lines: readFileSync(`e2e/${f}`, 'utf8').split('\n').length }))
  .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file));

const buckets = Array.from({ length: parts }, () => ({ lines: 0, files: [] }));
for (const flow of flows) {
  const lightest = buckets.reduce((min, b) => (b.lines < min.lines ? b : min));
  lightest.lines += flow.lines;
  lightest.files.push(flow.file);
}
console.log(buckets[part - 1].files.sort().join(' '));
