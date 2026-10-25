import { defineConfig } from 'tsup';

/** Bundles the three entrypoints (api, mcp, worker) plus scripts; workspace packages are inlined. */
export default defineConfig({
  entry: {
    server: 'src/server.ts',
    render: 'src/render.ts',
    mcp: 'src/mcp.ts',
    worker: 'src/worker.ts',
    'scripts/db-setup': 'src/scripts/db-setup.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: [/^@lore\//],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
