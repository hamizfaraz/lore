/** `pnpm dev` for the api package: runs api, worker, and mcp, each under `tsx watch`. */
import { spawn } from 'node:child_process';

const entries = ['src/server.ts', 'src/worker.ts', 'src/mcp.ts'];
const children = entries.map((e) =>
  spawn('pnpm', ['exec', 'tsx', 'watch', '--clear-screen=false', '--env-file-if-exists=../../.env', e], {
    stdio: 'inherit',
    env: process.env,
  }),
);
const stop = () => {
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
