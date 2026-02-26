import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Resolve app version at build time (git short hash, falls back to 'dev')
let appVersion = 'dev';
try {
  appVersion = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch {
  // Not a git repo or git unavailable – version stays as 'dev'
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__APP_VERSION__': JSON.stringify(appVersion),
      },
      // Drop console/debugger statements at the transform level in production
      esbuild: {
        drop: isProduction ? ['console', 'debugger'] : [],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-router': ['react-router-dom'],
              'vendor-icons': ['lucide-react'],
            },
          },
        },
        chunkSizeWarningLimit: 1000,
        sourcemap: false, // Disable source maps in production for smaller build
        minify: 'esbuild',
        esbuildOptions: {
          drop: ['console', 'debugger'],
        },
      },
    };
});

