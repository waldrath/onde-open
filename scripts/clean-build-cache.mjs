// Rebuild generated styles from source instead of restoring stale compiler output.
import {rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
rmSync(fileURLToPath(new URL('../.next/cache/', import.meta.url)), {recursive:true, force:true});
