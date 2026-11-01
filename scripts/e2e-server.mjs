// Playwright's webServer (see playwright.config.ts): builds Onde with
// `npm run build` (its prebuild clears the stale Turbopack cache), then serves
// the production build. E2E_SKIP_BUILD=1 serves the existing build.
//
// The server's pid goes to .next/e2e-server.pid so e2e/global-teardown.ts can
// stop it: Playwright stops a web server on Windows with `taskkill /T`, which
// fails on machines whose WMI service is broken and then waits forever.
import {spawn, spawnSync} from 'node:child_process';
import {rmSync, writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';

const port = process.env.E2E_PORT || '3100';
if (!/^\d{2,5}$/.test(port)) throw new Error('E2E_PORT must be a port number');
const pidFile = fileURLToPath(new URL('../.next/e2e-server.pid', import.meta.url));
const nextBin = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));

if (!process.env.E2E_SKIP_BUILD) {
  const windows = process.platform === 'win32';
  // npm is a .cmd script on Windows, which Node only starts through a shell.
  const build = spawnSync(windows ? 'npm.cmd' : 'npm', ['run', 'build'], {stdio: 'inherit', shell: windows});
  if (build.status !== 0) {
    console.error(JSON.stringify({event: 'e2e_build_failed', status: build.status, error: build.error?.message}));
    process.exit(build.status ?? 1);
  }
}

const server = spawn(process.execPath, [nextBin, 'start', '-p', port, '-H', '127.0.0.1'], {stdio: ['ignore', 'inherit', 'pipe']});
writeFileSync(pidFile, String(server.pid));
// Without a database every page logs catalogue_read_failed (expected, see
// app/page.tsx): drop that line, forward everything else.
createInterface({input: server.stderr}).on('line', line => {
  if (!line.includes('"event":"catalogue_read_failed"')) process.stderr.write(line + '\n');
});
const stop = () => server.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', code => {
  rmSync(pidFile, {force: true});
  process.exit(code ?? 0);
});
