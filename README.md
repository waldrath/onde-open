# Onde

Onde is an open-source TV guide and player for free, legal live channels. It brings public broadcasters and free streams into one calm, responsive interface with favorites, personal lists, schedules, and a built-in player.

This repository is the community edition. It is meant for learning, self-hosting, and contributions. Production hosting and its configuration are maintained privately by the project owner and are not part of this repository.

## Features

- More than 2,600 free channels from Quebec, Canada, France, the United States, and international sources.
- Integrated HLS playback with `hls.js` and native HLS on Safari.
- Official broadcaster players for channels that do not expose a compatible stream.
- Favorites, custom lists, recently watched channels, and last-channel resume.
- A TV guide with per-channel schedules and programme details.
- A curated selection of channels by genre.
- Twelve complete visual skins, each with its own palette, type, icon treatment, ambient motion, and surfaces.
- French and English interface. Catalogue metadata remains in the language supplied by the broadcaster.
- Responsive layouts for desktop, tablet, and mobile, including swipe navigation between main sections.
- Optional accounts for syncing preferences across devices.
- Progressive web app manifest, installable on mobile and desktop.
- Reduced-motion support and keyboard-accessible controls.

## Tech stack

- Next.js 16 (App Router) and React 19
- TypeScript
- Tailwind CSS 4 through PostCSS
- `hls.js` for HTTP Live Streaming
- PostgreSQL through the Neon serverless driver
- Neon Auth for optional accounts
- Node's built-in test runner for unit and catalogue tests

## Requirements

- Node.js 24 recommended (Node 22.18 or newer also works)
- npm
- A PostgreSQL database
- Optional: a Neon Auth project if you want accounts

## Getting started

1. Clone the repository and enter the project directory.

   ```bash
   git clone https://github.com/waldrath/onde-open.git
   cd onde-open
   ```

2. Install dependencies.

   ```bash
   npm install
   ```

3. Create your local environment file.

   ```bash
   cp .env.example .env.local
   ```

4. Fill in the values described below. Never commit `.env.local` or real credentials.

5. Run the database migration.

   ```bash
   npm run db:migrate
   ```

6. Start the development server.

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

The app works without an account. Accounts, preference sync, and catalogue maintenance require the corresponding services.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection used by the app. |
| `DATABASE_URL_UNPOOLED` | For migrations | Direct PostgreSQL connection used by `npm run db:migrate`. |
| `ONDE_APP_ORIGIN` | Production | Canonical public origin, used for origin checks and auth callbacks. |
| `NEON_AUTH_BASE_URL` | For accounts | Neon Auth project URL. |
| `NEON_AUTH_COOKIE_SECRET` | For accounts | Secret used to sign session cookies. Use a long random value. |
| `CATALOGUE_ADMIN_SECRET` | For maintenance | Shared secret for catalogue maintenance writes. |

`.env.example` contains names only. No secret, token, database URL, or private deployment identifier belongs in this repository.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. |
| `npm start` | Serve the production build. |
| `npm test` | Run the Node test suite. |
| `npm run db:migrate` | Apply the database schema. |
| `npm run prebuild` | Clear the generated Next.js build cache (runs automatically before `build`). |

On Node 22, run the tests with TypeScript stripping enabled:

```bash
NODE_OPTIONS=--experimental-strip-types npm test
```

On Node 24, `npm test` works directly.

## Project structure

```text
app/                 Next.js routes, pages, and client components
  api/               Catalogue, guide, playback, preferences, auth, reports
  sign-in/           Account access page
  television.tsx     Main application shell, navigation, and views
  player.tsx         Integrated player and report flow
  skins.css          Skin system: surfaces, icons, motion, and themes
  globals.css        Base design tokens and existing component styles
data/                Curated and imported channel catalogue
lib/                 Catalogue, guide, playback, auth, i18n, and storage helpers
migrations/          PostgreSQL schema
public/              Icons, images, and theme artwork
scripts/             Migration, import, and build helpers
tests/               Unit and catalogue validation tests
```

## How the catalogue works

The app reads a curated channel catalogue and public EPG sources. Each channel can expose a direct HLS stream, an official embedded player, or an official link only. Playback availability and schedules vary by region and broadcaster. Missing information is shown as unavailable rather than invented.

Catalogue maintenance is intentionally separate from viewer accounts. The maintenance secret is server-side only and is never sent to the browser.

## Accounts and privacy

Accounts are optional. A guest's favorites, lists, theme, language, and recent channels stay in the browser. When a verified account is used, preferences are stored in the configured database and isolated per account.

The app stores the selected theme and language in local storage and in small preference cookies so the server can render the first paint in the right skin and language.

## Contributing

Contributions are welcome through pull requests. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

- `main` is protected. Only the repository owner can merge to `main`.
- Fork the repository, create a focused branch, and open a pull request.
- Never commit environment files, credentials, access tokens, private URLs, or deployment configuration.
- Run `npm test` and `npm run build` before opening a pull request.
- Keep code and documentation in English. User-facing interface strings belong in both French and English.
- Respect the existing accessibility and reduced-motion behavior.

## Security

Please report security issues privately through GitHub Security Advisories rather than a public issue. See [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE).
