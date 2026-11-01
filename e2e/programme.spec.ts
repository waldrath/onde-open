import {test, expect, openApp, goTo} from './fixtures';

test('Programme: no channel guide is expanded by default', async ({page}, info) => {
  await openApp(page);
  await goTo(page, info, 'guide');
  // The mocked grids (e2e/fixtures.ts) list Télé-Québec and Savoir média.
  await expect(page.locator('details.expanded-guide')).not.toHaveCount(0);
  await expect(page.locator('details.expanded-guide[open]')).toHaveCount(0);
});

test('reminders: an alert appears when the programme starts and its button starts the channel', async ({page}) => {
  const REMINDER_DELAY = 3_000;
  await page.addInitScript(delay => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    const start = new Date(Date.now() + delay).toISOString();
    localStorage.setItem('onde-reminders', JSON.stringify([{channelId: 'telequebec', start, title: 'Rappel de test'}]));
  }, REMINDER_DELAY);
  await openApp(page);
  // Marks this document: it must still be the same one when the alert shows.
  await page.evaluate(() => { (window as Window & {e2eMarker?: number}).e2eMarker = 1; });

  const alert = page.locator('.reminder-alert');
  await expect(alert).toHaveCount(1, {timeout: REMINDER_DELAY + 7_000});
  expect(await page.evaluate(() => (window as Window & {e2eMarker?: number}).e2eMarker)).toBe(1);
  // Announced once: the reminder left storage.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('onde-reminders') || '[]').length)).toBe(0);

  await alert.locator('.primary').click();
  await expect(alert).toHaveCount(0);
  await expect(page.locator('#contenu.view-main-home')).toBeVisible();
  const player = page.locator('.watch-section');
  await expect(player.locator('.report-option')).toBeVisible();
  await expect(player.locator('.player-toolbar strong')).toHaveText('Télé-Québec');
});
