import {test, expect, openApp, goTo, seedStorage} from './fixtures';

const PREFERENCES_KEY = 'onde-preferences-v2:guest';

test('Favoris: a retired channel is announced and its clean-up keeps the others', async ({page}, info) => {
  await seedStorage(page, {
    [PREFERENCES_KEY]: JSON.stringify({data: {favorites: ['france24', 'retired-channel-x'], lists: [], lastChannel: null, lastAt: null}, revision: 0}),
  });
  await openApp(page);
  await goTo(page, info, 'favorites');

  const notice = page.locator('.retired-notice');
  await expect(notice).toBeVisible();
  await expect(page.locator('.channel-grid .visual-france24')).toBeVisible();

  await notice.locator('button').click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator('.channel-grid .visual-france24')).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null')?.data?.favorites, PREFERENCES_KEY)).toEqual(['france24']);
});
