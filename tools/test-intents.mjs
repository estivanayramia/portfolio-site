import fs from 'node:fs';

const WORKER_FILE = 'worker/worker.js';

function assertOk(name, condition, details = '') {
  if (condition) {
    process.stdout.write(`PASS: ${name}\n`);
    return;
  }

  process.stderr.write(`FAIL: ${name}${details ? ` (${details})` : ''}\n`);
  process.exitCode = 1;
}

function main() {
  if (!fs.existsSync(WORKER_FILE)) {
    process.stderr.write(`FAIL: Missing ${WORKER_FILE}\n`);
    process.exit(1);
  }

  const worker = fs.readFileSync(WORKER_FILE, 'utf8');

  assertOk('detectIntent function exists', /function\s+detectIntent\s*\(/.test(worker));
  assertOk('projects intent keyword mapping exists', /project\|projects\|case study\|portfolio\|work samples/.test(worker));
  assertOk('hobbies intent keyword mapping exists', /hobbies\|hobby\|gym\|workout\|fitness/.test(worker));
  assertOk('contact intent keyword mapping exists', /(email|contact|reach|message|connect)/.test(worker));
  assertOk('getWispers guard exists', /getwispers/i.test(worker));
  assertOk('whispers is handled as hobby context', /whispers.*hobby|hobby.*whispers/is.test(worker));

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  process.stdout.write('Intent checks passed.\n');
  process.exit(0);
}

main();
