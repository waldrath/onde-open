import {test as base, expect, type Page, type Route, type TestInfo} from '@playwright/test';

// Shared setup for every end-to-end test:
// - nothing leaves the test server: broadcaster players, streams, logos and
//   guide sites are answered with an empty 204, so no test depends on (or
//   waits for) a real stream;
// - the APIs that need the database or reach external sites from the server
//   (/api/reliability, /api/guide, /api/playback) are mocked with small fixtures.
// A test can override any of them with its own page.route (page routes win).

export type Mocks = {reliability: Record<string, [number, number]>};

/** A small programme grid around `now` for one channel. */
export function guideFixture(channel: string, now = Date.now()) {
  const hour = 3_600_000, start = Math.floor(now / hour) * hour;
  const programmes = [-1, 0, 1, 2].map(offset => ({
    start: new Date(start + offset * hour).toISOString(),
    end: new Date(start + (offset + 1) * hour).toISOString(),
    title: `Émission test ${offset + 2}`,
    detail: 'Programme de test',
  }));
  return {channel, programmes, source: 'https://example.test/guide', fetchedAt: new Date(now).toISOString(), sourceLabel: 'Grille de test'};
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});

async function installMocks(page: Page, origin: string, mocks: Mocks) {
  const context = page.context();
  await context.route(url => url.origin !== origin, route => route.fulfill({status: 204, body: ''}));
  await context.route('**/api/reliability', route => route.request().method() === 'GET' ? json(route, {channels: mocks.reliability}) : json(route, {ok: true}));
  await context.route('**/api/guide**', route => {
    const url = new URL(route.request().url()), channel = url.searchParams.get('channel');
    const ids = channel ? [channel] : url.searchParams.get('scope') === 'community' ? [] : ['telequebec', 'savoir'];
    return json(route, ids.map(id => guideFixture(id)));
  });
  // An embedded player whose page is the empty 204 above: the player reaches
  // its "embedded" state without any broadcaster involved.
  await context.route('**/api/playback**', route => json(route, {sources: [{kind: 'embed', url: 'https://player.example.test/live', label: 'Lecteur de test'}]}));
}

export const test = base.extend<{mocks: Mocks; mockNetwork: void}>({
  mocks: [{reliability: {}}, {option: true}],
  mockNetwork: [async ({page, baseURL, mocks}, use) => {
    await installMocks(page, new URL(baseURL!).origin, mocks);
    await use();
  }, {auto: true}],
});
export {expect};

export const isMobile = (info: TestInfo) => info.project.name === 'mobile';

/** Seeds localStorage once, before the app's first script (later navigations keep what the app wrote). */
export async function seedStorage(page: Page, entries: Record<string, string>) {
  await page.addInitScript(values => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
  }, entries);
}

export const VIEWS = ['home', 'channels', 'favorites', 'guide', 'selection'] as const;
export type View = (typeof VIEWS)[number];

/** The navigation bar of the current layout: bottom bar on phones, sidebar on desktop. */
export const navBar = (page: Page, info: TestInfo) => page.locator(isMobile(info) ? '.mobile-nav' : '.sidebar nav');
export const navButton = (page: Page, info: TestInfo, view: View) => navBar(page, info).locator('button').nth(VIEWS.indexOf(view));

/** Opens Onde and waits for the client app to be interactive. */
export async function openApp(page: Page) {
  await page.goto('/');
  await expect(page.locator('#contenu.view-main-home')).toBeVisible();
  // A mount effect records the "discover" row: once it is written, React has
  // hydrated and the buttons answer clicks.
  await page.waitForFunction(() => localStorage.getItem('onde-discover-seen') !== null);
}

export async function goTo(page: Page, info: TestInfo, view: View) {
  await navButton(page, info, view).click();
  await expect(page.locator(`#contenu.view-main-${view}`)).toBeVisible();
  await expect(navButton(page, info, view)).toHaveAttribute('aria-current', 'page');
}
