/**
 * Starts all backend apps in one terminal with prefixed output.
 *
 *   node scripts/run-all.ts dev    # nest start --watch for each app
 *   node scripts/run-all.ts prod   # node dist/... for each app (run `npm run build` first)
 *
 * Runs directly on Node 22.18+ (built-in TypeScript type stripping), so this
 * file may only use erasable TS syntax. If one app exits, the others keep
 * running (the services are independent); Ctrl+C stops them all.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

// Services first so the gateway's clients find them listening.
const APPS = ['auth', 'employee', 'attendance', 'gateway'] as const;
const COLORS = ['\x1b[36m', '\x1b[35m', '\x1b[33m', '\x1b[32m'];
const RESET = '\x1b[0m';

const mode = process.argv[2];
if (mode !== 'dev' && mode !== 'prod') {
  console.error('Usage: node scripts/run-all.ts <dev|prod>');
  process.exit(1);
}

const hasEnvFile = existsSync('.env');
if (!hasEnvFile) {
  console.warn('No backend/.env found, using defaults. Copy .env.example to .env.');
}

function commandFor(app: string): [string, string[]] {
  if (mode === 'dev') {
    const envArgs = hasEnvFile ? ['--env-file', '.env'] : [];
    return ['nest', ['start', app, '--watch', '--preserveWatchOutput', ...envArgs]];
  }
  // Output path follows nest-cli.json: dist/apps/<app>/ + entryFile.
  const envArgs = hasEnvFile ? ['--env-file=.env'] : [];
  return ['node', [...envArgs, `dist/apps/${app}/apps/${app}/src/main.js`]];
}

const children: ChildProcess[] = [];
let shuttingDown = false;

function stopAll(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
}

APPS.forEach((app, i) => {
  const [cmd, args] = commandFor(app);
  const label = `${COLORS[i]}[${app.padEnd(10)}]${RESET}`;
  const child = spawn(cmd, args, {
    env: { ...process.env, FORCE_COLOR: '1' },
    // npm puts node_modules/.bin on PATH; Windows needs a shell to run nest.cmd.
    shell: process.platform === 'win32',
  });
  children.push(child);

  for (const stream of [child.stdout, child.stderr]) {
    if (stream) {
      createInterface({ input: stream }).on('line', (line) => console.log(`${label} ${line}`));
    }
  }
  child.on('error', (error) => {
    // Usually a missing binary (e.g. npm install not run): nothing else will work either.
    console.error(`${label} failed to start: ${error.message}`);
    process.exitCode = 1;
    stopAll();
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`${label} exited (${signal ?? `code ${code}`}); other apps keep running`);
      if (code !== 0) process.exitCode = 1;
    }
  });
});

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
