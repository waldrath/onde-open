import {test, expect, openApp, goTo, isMobile, VIEWS, type View} from './fixtures';

// The page swap lasts 260 ms (SWAP_MS in app/television.tsx). Sampling runs
// at least this long and, on a slow machine, until every animation inside
// #contenu (the swap, the dock's pop-in) has finished.
const SWAP_SAMPLE_MS = 400;

test('navigates between Accueil, Chaînes, Favoris, Programme and Sélection', async ({page}, info) => {
  await openApp(page);
  // Forward through every page, then backward jumps.
  for (const view of ['channels', 'favorites', 'guide', 'selection', 'home', 'guide', 'channels'] as View[]) {
    await goTo(page, info, view);
    await expect(page.locator(`.page-heading.heading-${view}`)).toBeVisible();
  }
});

test('the bottom bar stays above the sliding page during a swap @mobile', async ({page}) => {
  await openApp(page);
  for (const view of ['channels', 'favorites', 'guide', 'selection', 'home'] as View[]) {
    const result = await page.evaluate(async ({index, minimum}) => {
      const bar = document.querySelector<HTMLElement>('.mobile-nav')!;
      const rect = bar.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const started = performance.now();
      bar.querySelectorAll('button')[index].click();
      // The swap starts its animations synchronously in the click handler.
      const swap = document.getAnimations().filter(a => (a.effect as KeyframeEffect | null)?.target?.closest('#contenu'));
      const running = () => swap.some(a => a.playState !== 'finished');
      const misses: string[] = [];
      let checksDuringSwap = 0;
      const check = (label: string) => {
        if (running()) checksDuringSwap++;
        const hit = document.elementFromPoint(x, y);
        if (!hit?.closest('.mobile-nav')) misses.push(`${label}: ${hit ? hit.tagName + '.' + (hit.getAttribute('class') || '') : 'nothing'}`);
      };
      // ~90 ms after the tap is when the old sliding page covered the bar.
      const at90 = new Promise<void>(resolve => setTimeout(() => { check('90ms'); resolve(); }, 90));
      const everyFrame = new Promise<void>(resolve => {
        const frame = () => {
          const elapsed = performance.now() - started;
          check(`${Math.round(elapsed)}ms`);
          if ((elapsed < minimum || running()) && elapsed < 3000) requestAnimationFrame(frame); else resolve();
        };
        requestAnimationFrame(frame);
      });
      await Promise.all([at90, everyFrame]);
      return {animations: swap.length, checksDuringSwap, misses};
    }, {index: VIEWS.indexOf(view), minimum: SWAP_SAMPLE_MS});
    // The swap must actually animate and be observed, or this test proves nothing.
    expect(result.animations, `the swap to ${view} should animate`).toBeGreaterThan(0);
    expect(result.checksDuringSwap, `bar checked while the swap to ${view} runs`).toBeGreaterThanOrEqual(2);
    expect(result.misses, `bottom bar covered while swapping to ${view}`).toEqual([]);
    await expect(page.locator(`#contenu.view-main-${view}`)).toBeVisible();
  }
});

test('the mini player is docked on Chaînes and does not move horizontally during swaps', async ({page}, info) => {
  await openApp(page);
  await goTo(page, info, 'selection');
  await page.locator('.selection-play').first().click();
  // Choosing a channel opens it in the big player on Accueil.
  await expect(page.locator('#contenu.view-main-home')).toBeVisible();
  await expect(page.locator('.watch-section .report-option')).toBeVisible();

  const navSelector = isMobile(info) ? '.mobile-nav' : '.sidebar nav';
  // Accueil → Chaînes docks the player; Chaînes ↔ Favoris keeps it docked.
  for (const view of ['channels', 'favorites', 'channels'] as View[]) {
    // Horizontal centre of the dock, sampled every ~16 ms through the swap. The
    // centre, not the left edge: the dock's own pop-in (dock-in in skins.css)
    // scales it from .98 around its centre, which is not a horizontal move.
    const result = await page.evaluate(async ({selector, index, minimum}) => {
      const started = performance.now();
      document.querySelectorAll<HTMLButtonElement>(`${selector} button`)[index].click();
      const swap = document.getAnimations().filter(a => (a.effect as KeyframeEffect | null)?.target?.closest('#contenu'));
      const running = () => swap.some(a => a.playState !== 'finished');
      const centres: (number | null)[] = [];
      let samplesDuringSwap = 0;
      for (;;) {
        const elapsed = performance.now() - started;
        if (!((elapsed < minimum || running()) && elapsed < 3000)) break;
        if (running()) samplesDuringSwap++;
        const rect = document.querySelector('.watch-dock')?.getBoundingClientRect();
        centres.push(rect ? rect.left + rect.width / 2 : null);
        await new Promise(resolve => setTimeout(resolve, 16));
      }
      return {animations: swap.length, samplesDuringSwap, centres};
    }, {selector: navSelector, index: VIEWS.indexOf(view), minimum: SWAP_SAMPLE_MS});
    await expect(page.locator(`#contenu.view-main-${view}`)).toBeVisible();
    await expect(page.locator('.watch-dock')).toBeVisible();
    expect(result.animations, `the swap to ${view} should animate`).toBeGreaterThan(0);
    expect(result.samplesDuringSwap, `dock sampled while the swap to ${view} runs`).toBeGreaterThanOrEqual(2);
    expect(result.centres.includes(null), `dock missing during the swap to ${view}`).toBe(false);
    const centres = result.centres as number[];
    expect(Math.max(...centres) - Math.min(...centres), `dock moved horizontally while swapping to ${view}`).toBeLessThanOrEqual(1);
  }
});
