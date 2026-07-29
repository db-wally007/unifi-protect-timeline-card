import { defineConfig } from 'vite';

// Single-file ESM build for HACS / Lovelace resource use.
// Everything (lit + @use-gesture) is bundled so the file works as a
// standalone /local/ resource — HA does not reliably expose these as
// importable bare specifiers to dashboard resources.
export default defineConfig({
  // Vite library mode does NOT substitute process.env.NODE_ENV, but bundled deps
  // (@use-gesture) reference it. In a browser `process` is undefined, so the
  // module throws on load ("process is not defined") and the card never
  // registers. Define it at build time so those branches become dead code.
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  // Force esbuild to use LEGACY TypeScript decorators. Lit 3 reactive decorators
  // (@customElement/@property/@state) require experimentalDecorators +
  // useDefineForClassFields:false; without this esbuild silently compiles them as
  // TC39 standard decorators, which breaks the card at runtime ("Configuration
  // error" in HA). tsconfigRaw guarantees the flags regardless of tsconfig discovery.
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'es2021',
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
  build: {
    lib: {
      entry: 'src/card.ts',
      name: 'UnifiProtectTimelineCard',
      fileName: () => 'unifi-protect-timeline-card.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: [], // bundle all dependencies
    },
    outDir: 'dist',
    sourcemap: false,
    target: 'es2021',
    minify: 'esbuild',
  },
});
