/**
 * Docker 開発用: Prisma Client を生成してから tsx watch で API を起動する。
 * schema.prisma が変わったら generate → サーバー再起動する（古い Client による Unknown field を防ぐ）。
 */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';

const backendDir = process.cwd();
const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');

/** @type {import('node:child_process').ChildProcess | null} */
let server = null;
let generating = false;
let pendingRestart = false;
let debounceTimer = null;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: backendDir,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`${command} killed by ${signal}`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function generateClient() {
  console.log('[dev-server] Generating Prisma client...');
  await run('npx', ['prisma', 'generate', '--schema=./prisma/schema.prisma']);
}

function stopServer() {
  if (!server || server.killed) {
    server = null;
    return Promise.resolve();
  }
  const proc = server;
  server = null;
  return new Promise((resolve) => {
    const done = () => resolve();
    proc.once('exit', done);
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL');
      done();
    }, 3000);
  });
}

function startServer() {
  console.log('[dev-server] Starting tsx watch...');
  server = spawn('npx', ['tsx', 'watch', 'src/index.ts'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: process.env,
    shell: false,
  });
  server.on('exit', (code, signal) => {
    if (server === null) return; // intentional stop
    console.error(`[dev-server] tsx exited (code=${code}, signal=${signal})`);
    process.exit(code ?? 1);
  });
}

async function restartWithGenerate() {
  if (generating) {
    pendingRestart = true;
    return;
  }
  generating = true;
  try {
    await stopServer();
    await generateClient();
    startServer();
  } catch (err) {
    console.error('[dev-server] Failed to regenerate / restart:', err);
    process.exit(1);
  } finally {
    generating = false;
    if (pendingRestart) {
      pendingRestart = false;
      void restartWithGenerate();
    }
  }
}

function scheduleRestart() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log('[dev-server] schema.prisma changed — regenerating Prisma client');
    void restartWithGenerate();
  }, 400);
}

await generateClient();
startServer();

try {
  watch(schemaPath, { persistent: true }, (eventType) => {
    if (eventType === 'change' || eventType === 'rename') scheduleRestart();
  });
  console.log('[dev-server] Watching', schemaPath);
} catch (err) {
  console.warn('[dev-server] Could not watch schema.prisma:', err);
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await stopServer();
    process.exit(0);
  });
}
