import fs from 'node:fs';

const CHAT_SERVICE_FILE = 'worker/chat-service.mjs';
const FACTS_GENERATOR_FILE = 'scripts/generate-site-facts.js';

function assertOk(name, condition, details = '') {
  if (condition) {
    process.stdout.write(`PASS: ${name}\n`);
    return;
  }

  process.stderr.write(`FAIL: ${name}${details ? ` (${details})` : ''}\n`);
  process.exitCode = 1;
}

function main() {
  for (const file of [CHAT_SERVICE_FILE, FACTS_GENERATOR_FILE]) {
    if (!fs.existsSync(file)) {
      process.stderr.write(`FAIL: Missing ${file}\n`);
      process.exit(1);
    }
  }

  const chatService = fs.readFileSync(CHAT_SERVICE_FILE, 'utf8');
  const factsGenerator = fs.readFileSync(FACTS_GENERATOR_FILE, 'utf8');

  assertOk('classifyQuestion function exists', /function\s+classifyQuestion\s*\(/.test(chatService));
  assertOk('projects intent keyword mapping exists', /projects\|work samples\|what have you done\|what projects/.test(chatService));
  assertOk('hobbies intent keyword mapping exists', /hobbies\|whispers/.test(chatService));
  assertOk('contact intent keyword mapping exists', /contact\|email\|reach out\|reach him\|reach you\|linkedin/.test(chatService));
  assertOk('getWispers guard exists', /getwispers/i.test(factsGenerator));
  assertOk('whispers is handled as hobby context', /pageType\s*===\s*["']hobby_detail["']/.test(chatService) && /whispers/.test(chatService));

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }

  process.stdout.write('Intent checks passed.\n');
  process.exit(0);
}

main();
