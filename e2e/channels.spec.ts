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

  // Regions are a multi-value filter: Québec, then France on top of it.
  await page.locator('.filter-field-region summary').click();
  const regionOption = (name: string) => page.locator('.filter-field-region .multi-select-option', {hasText: new RegExp(`^${name}$`)}).locator('input');
  await regionOption('Québec').check();
  await expect.poll(async () => countIn(await apply.textContent())).not.toBe(total);
  const quebec = countIn(await apply.textContent());
  await regionOption('France').check();
  await expect.poll(async () => countIn(await apply.textContent())).toBeGreaterThan(quebec);
  const count = countIn(await apply.textContent());
  expect(quebec).toBeGreaterThan(0);
  expect(count).toBeLessThan(total);
  await expect(page.locator('.filter-field-region summary')).toContainText('Québec, France');

  await apply.click();
  await expect(bar).not.toHaveClass(/filter-open/);
  await expect(page.locator('.filter-panel')).toBeHidden();
  const cards = page.locator('.channel-grid .channel-card');
  await expect(cards).toHaveCount(Math.min(count, PAGE_SIZE));
  await expect(cards.first().locator('.card-meta')).toContainText('Québec');
});

test('filters: Chaînes premium lists the official-site premium channels', async ({page}, info) => {
  await openApp(page);
  await goTo(page, info, 'channels');
  // Phones open the filters as a sheet; desktops show them inline.
  if (isMobile(info)) await page.locator('.filter-toggle').click();
  const playback = page.locator('label.playback-filter', {hasText: 'Lecture dans Onde'}).locator('input');
  await expect(playback).toBeChecked();
  // Premium channels mostly link to the broadcaster's subscription site, so
  // asking for them lifts the "plays in Onde" filter.
  await page.locator('label.playback-filter', {hasText: 'Chaînes premium'}).locator('input').check();
  await expect(playback).not.toBeChecked();
  if (isMobile(info)) await page.locator('.filter-panel-apply .primary').click();
  const titles = page.locator('.channel-grid .channel-card .card-title');
  for (const name of ['RDS', 'TVA Sports', 'Crave', 'Canal+']) await expect(titles.filter({hasText: new RegExp(`^${name.replace('+', '\\+')}$`)})).toHaveCount(1);
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
