import {test, expect, openApp, goTo, seedStorage, isMobile} from './fixtures';

const PAGE_SIZE = 48; // cards shown before "Afficher 48 chaînes de plus"
const countIn = (text: string | null) => Number((text || '').replace(/\D/g, ''));

test('filters: a region applied from the sheet shows its channels @mobile', async ({page}, info) => {
  await openApp(page);
  await goTo(page, info, 'channels');
  const bar = page.locator('.filter-bar'), apply = page.locator('.filter-panel-apply .primary');

  await page.locator('.filter-toggle').click();
  await expect(bar).toHaveClass(/filter-open/);
  await expect(page.locator('.filter-panel')).toBeVisible();
  const total = countIn(await apply.textContent());

  await page.locator('.filter-field-region select').selectOption('Québec');
  await expect.poll(async () => countIn(await apply.textContent())).not.toBe(total);
  const count = countIn(await apply.textContent());
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThan(total);

  await apply.click();
  await expect(bar).not.toHaveClass(/filter-open/);
  await expect(page.locator('.filter-panel')).toBeHidden();
  const cards = page.locator('.channel-grid .channel-card');
  await expect(cards).toHaveCount(Math.min(count, PAGE_SIZE));
  await expect(cards.first().locator('.card-meta')).toContainText('Québec');
});

test('search: Enter shows the filtered Chaînes grid without starting a player', async ({page}, info) => {
  await openApp(page);
  // Phones hide the search field on Accueil's top bar: search from Sélection there.
  if (isMobile(info)) await goTo(page, info, 'selection');
  const input = page.locator('.topbar .search-box input');
  await input.fill('tele-quebec');
  await input.press('Enter');

  await expect(page.locator('#contenu.view-main-channels')).toBeVisible();
  await expect(input).toHaveValue('tele-quebec');
  const cards = page.locator('.channel-grid .channel-card');
  await expect(cards.locator('.visual-telequebec')).toHaveCount(1);
  expect(await cards.count()).toBeLessThan(PAGE_SIZE);
  await expect(page.locator('.watch-dock')).toHaveCount(0);
  await expect(page.locator('.player-shell iframe, .player-shell video')).toHaveCount(0);
});

test.describe('reliability', () => {
  test.use({mocks: {reliability: {telequebec: [18, 1]}}});

  test('a channel with enough successful starts is labelled reliable', async ({page}, info) => {
    await seedStorage(page, {
      'onde-preferences-v2:guest': JSON.stringify({data: {favorites: ['telequebec'], lists: [], lastChannel: null, lastAt: null}, revision: 0}),
    });
    await openApp(page);
    await goTo(page, info, 'favorites');
    const card = page.locator('.channel-card').filter({has: page.locator('.visual-telequebec')});
    // Fetched 1.5 s after the page settles.
    await expect(card.locator('.channel-reliability.is-reliable')).toBeVisible();
  });
});
