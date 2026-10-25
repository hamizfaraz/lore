/**
 * Render free-tier entrypoint.
 *
 * Render does not offer free background workers, so the demo deployment runs
 * the API and BullMQ worker as sibling processes in one web service. The normal
 * server/worker entrypoints remain separate for Docker Compose deployments.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const children: ChildProcess[] = [];
let shuttingDown = false;

function start(entrypoint: string) {
  const child = spawn(process.execPath, [fileURLToPath(new URL(entrypoint, import.meta.url))], {
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);
  return child;
}

const api = start('./server.js');
const worker = start('./worker.js');

async function shutdown(signal: NodeJS.Signals = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill(signal);
}

for (const child of [api, worker]) {
  child.once('exit', (code, signal) => {
    if (!shuttingDown) {
      void shutdown('SIGTERM');
      process.exitCode = code ?? (signal ? 1 : 0);
    }
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
