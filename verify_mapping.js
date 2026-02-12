
import { buildAchievementIndex, ACHIEVEMENTS } from './assets/js/arcade/achievements-defs.js';

console.log("Building index...");
const index = buildAchievementIndex();

const TEST_IDS = [
    "snake:first_food",
    "snake:combo_5",
    "snake:score_100",
    "snake:length_20",
    "snake:score_250",
    "snake:length_35",
    "snake:level_5",
    "snake:level_10",
    "snake:powerup_collector",
    "snake:invincible_master",
    "snake:obstacle_dodger"
];

let failed = false;

console.log("\nTesting ID Lookup:");
TEST_IDS.forEach(id => {
    const def = index[id];
    if (def) {
        console.log(`✅ ${id} -> ${def.title} (${def.id})`);
    } else {
        console.log(`❌ ${id} -> NOT FOUND`);
        failed = true;
    }
});

if (failed) {
    console.error("\nSome IDs failed lookup!");
    process.exit(1);
} else {
    console.log("\nAll IDs mapped successfully.");
}
