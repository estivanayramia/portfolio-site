const { test, expect } = require('@playwright/test');

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5500';

const viewports = [
  { name: 'Desktop 1920x1080', use: { viewport: { width: 1920, height: 1080 }, hasTouch: false, isMobile: false } },
  { name: 'Phone 375x812', use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
  { name: 'Tablet 768x1024', use: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true } }
];

const text = {
  backgroundFamily:
    'My parents had an arranged marriage; starting off strong trying to assimilate, right?. My dad was an electrical engineer. My mom, restarted her education from scratch in the USA, and came out the other side with a Bachelor of Science in Business Administration from SDSU after nearly a decade of classes. I am the youngest of four brothers: Alen, Andrew, Evan, and then me, which means I had front row seats to everything before I even got started. Now it is time to see what I can make of myself given that privilege.',
  backgroundSystems:
    'I like figuring out how things actually work and then making them work better. That usually means looking at where things are not as efficient as they could be, where things fall through the cracks, and working to fix all of that. Not because it sounds impressive, but because watching a messy process get clean is genuinely satisfying. Knowing I had a part in it? Even better.',
  photographyIntro:
    'I take pictures to save a quick memory. I snap the photo, and then I go back to enjoying the day. It just feels nice to freeze a moment in time.',
  photographyBody:
    'Photography is a casual hobby for me, and I try not to overthink it. I point my camera at things that look interesting. A cool shadow or a sharp angle works fine. I want a memory of a nice car or a street scene. I capture the shot, and then I focus on the real world again.',
  photographyGear:
    'I use a Canon EOS 70D for some shots, and other times I just use my iPhone. The exact gear does not matter much to me. I grab whatever device is closest. Apple is right about this. The best camera is the one in your pocket.',
  photographyGallery:
    'This gallery shows how I see things, and you get to look through my eyes for a few minutes. These photos highlight the everyday details that catch my attention. It is a fun way to introduce myself.',
  cookingIntro:
    'Cooking is just a fun activity for me, and I get a great reward out of the whole process. I treat the kitchen like a fun party rather than a science lab. I just go in, get busy, and feel highly productive. I force my brother to rate the final plate. I always know the food is delicious, but I expect him to give it a low score so I have a perfect excuse to cook for him again later.',
  cookingGoals:
    'My meal choices change completely based on my current gym goals. If I just want to enjoy life, I cook with heavy cream and endless carbs. But if I need to hit a strict fitness goal, I lock in and change my diet. I cut out snacks, alcohol, and fast food. Then I switch to clean home-cooked meals with plenty of rice, meat, and vegetables. I keep a loose eye on my macros to hit my protein targets. You cannot build muscle on a bad diet, so the gym is only half the battle.',
  cookingBreakfast:
    'I preach about fitness goals constantly, but I rarely eat a real breakfast. I never have a big appetite in the morning, so I usually just grab an Oikos yogurt and a protein bar.',
  cookingSystem:
    'I cook strictly for fun and my own taste buds. I refuse to treat my kitchen like a competition. If a meal turns out bad, I will still eat it so I do not waste the food or my effort. Luckily, my food rarely tastes bad. Chasing perfection turns a fun hobby into a stressful job, and I never want cooking to feel like a chore. The kitchen did teach me how to multitask, though. I prep my sides while the main dish cooks, and I wash the dishes as I go for peak efficiency. Getting everything organized first makes the entire process smooth.',
  whispersMission:
    'Every day, I write a handwritten note and hand it directly to a stranger on the SDSU campus. I never speak a single word. People try to talk to me, but I do not respond. I want the written message to hold all the importance. I hand a note to a different person every day. I have no idea if my notes change anything for anyone. That uncertainty is part of the fun. I just hope I make a positive difference in their life.',
  whispersWhy:
    'College is hard. Everyone is stressed, rushing somewhere, and thinking about exams or relationships. I wanted to create small moments of pause. It is a reminder that someone out there hopes they have a good day. The anonymity is the point. I do not sign the notes. I hand the paper directly to a student and walk away. It is not about getting credit. The note stands entirely on its own as a small gift.',
  whispersAudience:
    'I constantly wonder what the student is going through. A freshman might be having a rough week, or a senior might be stressed about the future. I hand them out hoping the person needs those exact words in that moment.',
  whispersWriting:
    'I write what comes to mind, something I truly resonate with. Every message comes naturally from my own thoughts or daily experiences. I never look anything up online. This keeps the project highly personal. It may be hard to read, I tried my best, but give it a look, maybe something will resonate with you!'
};

async function dismissDiagnosticsBanner(page) {
  await page.evaluate(() => {
    const banner = document.querySelector('[role="dialog"][aria-label="Diagnostics consent"]');
    if (banner) {
      banner.style.pointerEvents = 'none';
      banner.setAttribute('aria-hidden', 'true');
    }
  });
}

async function gotoPath(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
  await dismissDiagnosticsBanner(page);
}

async function tabToLocator(page, locator, maxTabs = 24) {
  await page.locator('body').click({ position: { x: 10, y: 10 } });
  for (let step = 0; step < maxTabs; step += 1) {
    await page.keyboard.press('Tab');
    const isActive = await locator.evaluate((node) => node === document.activeElement);
    if (isActive) return;
  }
  throw new Error('Failed to reach target via keyboard tabbing');
}

async function expectVisibleFocus(locator) {
  const styles = await locator.evaluate((node) => {
    const computed = window.getComputedStyle(node);
    return {
      outlineStyle: computed.outlineStyle,
      outlineWidth: computed.outlineWidth,
      boxShadow: computed.boxShadow
    };
  });

  const outlineWidth = Number.parseFloat(styles.outlineWidth) || 0;
  expect(
    outlineWidth > 0 || styles.outlineStyle !== 'none' || styles.boxShadow !== 'none'
  ).toBeTruthy();
}

async function getActiveMiniIndex(page) {
  return page.locator('[data-mini-carousel]').evaluate((root) => {
    const slides = Array.from(root.querySelectorAll('.carousel-slide'));
    const active = root.querySelector('.carousel-slide.coverflow-card--active, .carousel-slide.is-center');
    return slides.indexOf(active);
  });
}

async function expectExactParagraph(page, exactText) {
  const paragraph = page.locator('p').filter({ hasText: exactText }).first();
  await expect(paragraph).toHaveText(exactText);
}

async function expectThemeToggleProof(page, path) {
  await gotoPath(page, path);
  const toggle = page.locator('#theme-toggle');
  await expect(toggle).toBeVisible();
  await tabToLocator(page, toggle);
  await expectVisibleFocus(toggle);

  const toggleText = ((await toggle.textContent()) || '').trim();
  expect(toggleText).toMatch(/[☀🌙]/u);
  expect(toggleText).not.toMatch(/[�]/u);
}

async function expectValuesCtaContainment(page) {
  await gotoPath(page, '/EN/about/values.html');

  const copy = page.getByText('The projects section is where the values above stop being words on a page. Take a look.', { exact: true });
  const cta = page.getByRole('link', { name: /View Projects/ });

  await expect(copy).toBeVisible();
  await expect(cta).toBeVisible();

  const beforeParagraphBox = await copy.boundingBox();
  const beforeCtaBox = await cta.boundingBox();
  expect(beforeParagraphBox).not.toBeNull();
  expect(beforeCtaBox).not.toBeNull();
  expect(beforeCtaBox.y).toBeGreaterThanOrEqual(beforeParagraphBox.y + beforeParagraphBox.height - 2);

  await cta.hover();
  await page.waitForTimeout(150);

  const afterParagraphBox = await copy.boundingBox();
  const afterCtaBox = await cta.boundingBox();
  expect(afterParagraphBox).not.toBeNull();
  expect(afterCtaBox).not.toBeNull();
  expect(afterCtaBox.y).toBeGreaterThanOrEqual(afterParagraphBox.y + afterParagraphBox.height - 2);
}

async function expectPhotographyProof(page) {
  await gotoPath(page, '/EN/hobbies/photography.html');
  const carousel = page.locator('[data-mini-carousel]').first();
  await expect(carousel).toHaveAttribute('data-gallery-coverflow-init', 'true', { timeout: 10000 });
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: 10000 });

  await expectExactParagraph(page, text.photographyIntro);
  await expectExactParagraph(page, text.photographyBody);
  await expectExactParagraph(page, text.photographyGear);
  await expect(page.getByText(text.photographyGallery, { exact: true })).toBeVisible();

  const dots = page.locator('.carousel-dot');
  await expect(dots.first()).toBeVisible();
  const dotTexts = await dots.evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  expect(dotTexts.length).toBeGreaterThan(0);
  for (const value of dotTexts) {
    expect(value).toMatch(/^\d+$/);
  }

  const dotStyles = await page.locator('.carousel-dots').evaluate((node) => {
    const computed = window.getComputedStyle(node);
    return {
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      paddingBottom: computed.paddingBottom
    };
  });
  expect([dotStyles.overflowX, dotStyles.overflowY]).toContain('visible');
  expect(Number.parseFloat(dotStyles.paddingBottom)).toBeGreaterThanOrEqual(4);

  const beforeIndex = await getActiveMiniIndex(page);
  await page.locator('.carousel-btn-next').first().click();
  await page.waitForTimeout(800);
  const afterIndex = await getActiveMiniIndex(page);
  expect(afterIndex).not.toBe(beforeIndex);
}

async function expectCookingProof(page) {
  await gotoPath(page, '/EN/hobbies/cooking.html');
  await expectExactParagraph(page, text.cookingIntro);
  await expectExactParagraph(page, text.cookingGoals);
  await expectExactParagraph(page, text.cookingBreakfast);
  await expectExactParagraph(page, text.cookingSystem);
  await expect(page.getByText('Weekly Staples', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Principles', { exact: true })).toHaveCount(0);
}

async function expectWhispersProof(page) {
  await gotoPath(page, '/EN/hobbies/whispers.html');
  await expectExactParagraph(page, text.whispersMission);
  await expectExactParagraph(page, text.whispersWhy);
  await expectExactParagraph(page, text.whispersAudience);
  await expectExactParagraph(page, text.whispersWriting);
}

async function expectCarProof(page) {
  await gotoPath(page, '/EN/hobbies/car.html');
  await expectExactParagraph(page, 'I do not just want to drive fast. I love making this car fit my exact personality, and it thrills me to tweak the software and bolt on new parts. I just want to see what happens when I push the limits.');
  await expectExactParagraph(page, 'The B58 engine offers a massive playground, so I flashed an MHD Stage 2 tune to wake it up. The tune alters the boost and timing, and the car pulls much harder now. Under the hood, I installed a cold air intake, a new turbo inlet, an upgraded charge pipe, and a catless downpipe. I chopped off the muffler to let the engine scream. I wrapped the glass in 5% tint all around and 20% on the windshield. The body sits wide with a front lip, side skirts, and a rear diffuser. Wheel spacers push the stance out flush, and a recent paint correction makes the whole thing shine.');
  await expectExactParagraph(page, 'I want this raw experience in my 20s. My main goal is to have absolute fun, experiment, and do stupid things today. I can still get away with it right now. This car represents my first real taste of adult freedom. It showcases my deep passion for learning and tearing things apart.');
  await expectExactParagraph(page, 'Building this car taught me a hard lesson about money. You must read real stories before buying expensive car parts. Real driver experiences matter far more than flashy ads. Forums like Bimmerpost and Reddit saved me from making bad choices. Real people gave me the exact answers I needed.');
  await expectExactParagraph(page, 'Owning this car forces me to grow up no matter what. I love this car. It reminds me every day to respect my hard work and care for my things.');

  for (const imageName of ['car_byOceanONE.jpg', 'car_by_sunset.jpg', 'me_and_car.jpg']) {
    const image = page.locator(`img[src*="${imageName}"]`);
    await image.scrollIntoViewIfNeeded();
    await expect(image).toBeVisible();
    await expect
      .poll(async () => image.evaluate((node) => node.complete ? node.naturalWidth : 0), {
        timeout: 10000
      })
      .toBe(533);

    const imageState = await image.evaluate((node) => ({
      style: node.getAttribute('style') || '',
      widthAttr: node.getAttribute('width'),
      heightAttr: node.getAttribute('height'),
      transform: window.getComputedStyle(node).transform,
      naturalWidth: node.naturalWidth,
      naturalHeight: node.naturalHeight
    }));

    expect(imageState.style.includes('rotate')).toBeFalsy();
    expect(imageState.transform).toBe('none');
    expect(imageState.widthAttr).toBe('533');
    expect(imageState.heightAttr).toBe('800');
    expect(imageState.naturalWidth).toBe(533);
    expect(imageState.naturalHeight).toBe(800);
  }
}

async function expectBackgroundProof(page) {
  await gotoPath(page, '/EN/about/background.html');
  await expect(page.locator('p').filter({ hasText: 'We speak Chaldean, a dialect related to the language Jesus spoke.' }).first()).toContainText('We speak Chaldean, a dialect related to the language Jesus spoke.');
  await expectExactParagraph(page, text.backgroundFamily);
  await expect(page.getByText('This background is not a sob story. It is actually a pretty good one. It creates hunger, adaptability, and a refusal to settle for less than what you are capable of.', { exact: true })).toBeVisible();
  await expectExactParagraph(page, text.backgroundSystems);
  await expect(page.getByText('Documentation That Actually Helps', { exact: true })).toHaveCount(0);
}

async function expectProjectsRouletteProof(page) {
  await page.context().addInitScript(() => {
    const values = [0.11, 0.53];
    let index = 0;
    const originalRandom = Math.random;
    Math.random = () => values[index++] ?? originalRandom();
  });

  await gotoPath(page, '/EN/projects/');
  const carousel = page.locator('[data-luxury-coverflow]');
  await expect(carousel).toHaveAttribute('data-coverflow-ready', 'true', { timeout: 10000 });

  const startUrl = page.url();
  const rouletteTrigger = page.locator('[data-roulette-trigger], .roulette-trigger-btn').first();
  await expect(rouletteTrigger).toBeVisible();
  await rouletteTrigger.click();

  const overlay = page.locator('.luxury-roulette-overlay');
  await expect(overlay).toHaveAttribute('aria-hidden', 'false', { timeout: 10000 });
  await expect(overlay).toHaveAttribute('data-result-kind', 'winner', { timeout: 10000 });
  await page.waitForURL((url) => url.toString() !== startUrl && /\/(?:EN\/)?projects\/.+/.test(url.toString()), { timeout: 10000 });
}

for (const profile of viewports) {
  test.describe(profile.name, () => {
    test.use(profile.use);

    test('passes strict text fidelity and runtime checks', async ({ page }) => {
      await expectThemeToggleProof(page, '/EN/index.html');
      await expectThemeToggleProof(page, '/EN/about.html');
      await expectValuesCtaContainment(page);
      await expectPhotographyProof(page);
      await expectCookingProof(page);
      await expectWhispersProof(page);
      await expectCarProof(page);
      await expectBackgroundProof(page);
      await expectProjectsRouletteProof(page);
    });
  });
}
