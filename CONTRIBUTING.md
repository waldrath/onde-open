# Contributing to Onde

Thank you for considering a contribution. Onde is a community project built around a simple idea: free television should be pleasant, fast, and accessible.

## Ground rules

- Be respectful and constructive. Harassment and discrimination are not welcome.
- Keep changes focused. One pull request should solve one problem.
- Never commit credentials, tokens, database URLs, private URLs, or production configuration.
- Do not add generated build output, local environment files, or dependencies that are not needed.
- Code, comments, documentation, commit messages, and pull request descriptions are written in English.
- User-facing interface strings must be added in French and English.

## Branch protection and merging

The `main` branch is protected.

- Contributors work from a fork and open a pull request.
- Only the repository owner can merge into `main`.
- Direct pushes to `main` are not available to contributors.
- Pull requests may be reviewed and discussed by anyone, but merging is reserved for the owner.

This keeps the public project open to participation while the production environment stays private.

## Development workflow

1. Fork the repository and clone your fork.

   ```bash
   git clone https://github.com/<your-account>/onde-open.git
   cd onde-open
   ```

2. Install dependencies and create your environment file.

   ```bash
   npm install
   cp .env.example .env.local
   ```

3. Create a branch with a descriptive name.

   ```bash
   git checkout -b fix/player-focus
   ```

4. Make your changes and run the checks.

   ```bash
   npm test
   npm run build
   ```

   On Node 22, enable TypeScript stripping for the tests:

   ```bash
   NODE_OPTIONS=--experimental-strip-types npm test
   ```

5. Commit with a clear message and push to your fork.

6. Open a pull request against `main` and describe:
   - what changed and why;
   - which screens or flows are affected;
   - how you tested it;
   - any accessibility, motion, or localization impact.

## Code guidelines

- Use the existing components, tokens, and CSS conventions before adding new patterns.
- Keep the design system coherent across all twelve skins.
- Respect `prefers-reduced-motion`; decorative motion must not be required to use the app.
- Keep touch targets at least 24 by 24 CSS pixels (44 pixels where practical).
- Provide visible focus states and text alternatives for icon-only controls.
- Do not hard-code production domains, deployment identifiers, or credentials.
- Keep server-only secrets on the server.

## Localization

The interface supports French and English. The French copy is the source text. Add English translations in `lib/i18n.ts` and use the `t()` helper for user-facing text.

Provider metadata such as channel names, descriptions, regions, and programme titles is displayed as supplied by the catalogue. It is not translated automatically.

## Reporting bugs

Open a GitHub issue with:

- a short, specific title;
- steps to reproduce;
- expected and actual behavior;
- browser, viewport, and whether reduced motion or a specific skin was active;
- screenshots or console output when useful.

Please do not include secrets or personal data in issues.
