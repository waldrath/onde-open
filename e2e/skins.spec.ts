import {test, expect, openApp, seedStorage} from './fixtures';
import {themes} from '../lib/themes';

// Smoke test of every skin: Accueil renders with it and logs no error.
for (const {id} of themes) {
  test(`skin "${id}" loads Accueil without console errors @desktop`, async ({page}) => {
    const errors: string[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => errors.push(error.message));
    await seedStorage(page, {'onde-theme': id});

    const reliability = page.waitForResponse('**/api/reliability');
    await openApp(page);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-theme', id);
    await expect(page.locator('.page-heading.heading-home h1')).toBeVisible();
    // The last request of a settled Accueil (1.5 s after mount).
    await reliability;
    expect(errors).toEqual([]);
  });
}

// The logo opening plays once, ends whole (both waves drawn, the word read as
// "onde") and leaves nothing running: an endless logo loop drained batteries.
test('the logo opening ends drawn and leaves no animation running', async ({page}, info) => {
  await openApp(page);
  const logo = page.locator(info.project.name === 'mobile' ? '.mobile-brand .logo' : '.sidebar .logo');
  await expect(logo.getByRole('img', {name: 'onde'})).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.getAnimations()
    .filter(animation => animation.playState === 'running' && (animation.effect as KeyframeEffect | null)?.target?.closest('.logo')).length),
  {timeout: 6000}).toBe(0);
  const state = await logo.evaluate(element => ({
    brushes: Array.from(element.querySelectorAll('.logo-brush'), brush => getComputedStyle(brush).strokeDashoffset),
    letters: Array.from(element.querySelectorAll('.logo-letter'), letter => getComputedStyle(letter).opacity),
  }));
  expect(state.brushes).toEqual(['0px', '0px']);
  expect(state.letters).toEqual(['1', '1', '1', '1']);
});
