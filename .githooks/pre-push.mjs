#!/usr/bin/env node

import { execSync } from 'child_process';

function run(label, command) {
  console.log(label);
  execSync(command, { stdio: 'inherit' });
}

run('🔎 Pre-push: verifying versioning...', 'npm run -s verify:versioning');
run('🧪 Pre-push: running audit gate...', 'npm run -s audit');
run('🎞️ Pre-push: running animation jank gate...', 'npm run -s anim:jank');
run('🧠 Pre-push: checking agent memory health...', 'npm run -s memory:health');
