import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Stops the server started by scripts/e2e-server.mjs before Playwright tries
// to (its Windows `taskkill /T` can hang). Its launcher exits with it.
export default function globalTeardown(): void {
  const pidFile = fileURLToPath(new URL('../.next/e2e-server.pid', import.meta.url));
  let pid: number;
  try {
    pid = Number(readFileSync(pidFile, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; // a server Playwright did not start
    throw error;
  }
  if (!Number.isSafeInteger(pid) || pid <= 0) return;
  try {
    process.kill(pid);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; // already gone
  }
}
