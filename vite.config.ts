import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  assetsInclude: ['**/*.wasm'],
  build: {
    target: 'esnext',
  },
  optimizeDeps: {
    exclude: ['stockfish'],
  },
  plugins: [
    {
      name: 'copy-stockfish-wasm',
      closeBundle() {
        const srcDir = resolve(__dirname, 'node_modules/stockfish/src');
        const outDir = resolve(__dirname, 'dist/assets');
        
        // Copy all stockfish WASM files + JS
        const files = readdirSync(srcDir).filter(f => 
          f.startsWith('stockfish-17.1-single-') || 
          (f.startsWith('stockfish-17.1-single-') && f.endsWith('.wasm'))
        );
        
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
        
        for (const file of readdirSync(srcDir)) {
          if (file.startsWith('stockfish-17.1-lite-single-')) {
            copyFileSync(resolve(srcDir, file), resolve(outDir, file));
            console.log(`Copied: ${file}`);
          }
        }
      }
    }
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
