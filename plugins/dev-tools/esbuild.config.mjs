import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: true,
  minify: false,
});

console.log('Build complete: dist/server.js');
