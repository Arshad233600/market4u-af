import path from 'path';
import { execSync } from 'child_process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
/// <reference types="vitest" />

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

    // Safety gate: never ship a production build with mock data enabled.
    // VITE_USE_MOCK_DATA=true in production would expose demo data to real users
    // and cause a 401 → logout loop when mock tokens hit the real backend.
    if (isProduction && (env.VITE_USE_MOCK_DATA === 'true' || env.REACT_APP_USE_MOCK_DATA === 'true')) {
      throw new Error(
        '[BUILD ERROR] VITE_USE_MOCK_DATA is set to "true" in a production build.\n' +
        'Remove VITE_USE_MOCK_DATA or set it to "false" before building for production.'
      );
    }

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
        outDir: 'bulid',
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
      test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: [
          'utils/__tests__/**/*.test.ts',
          'utils/__tests__/**/*.test.tsx',
          'components/__tests__/**/*.test.tsx',
          'src/**/__tests__/**/*.test.ts',
          'src/**/__tests__/**/*.test.tsx',
        ],
        coverage: {
          provider: 'v8',
          reporter: ['text', 'lcov'],
        },
      },
    };
});

