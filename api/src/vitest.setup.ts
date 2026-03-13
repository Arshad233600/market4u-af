import { vi } from 'vitest';

/**
 * Global setup: mock @azure/functions so that app.http() calls in source
 * files are no-ops during tests. Without this, the package emits noisy
 * "WARNING: Failed to detect the Azure Functions runtime" messages on stderr
 * for every test suite that imports an Azure Function handler module.
 */
vi.mock('@azure/functions', async (importOriginal) => {
  const original = await importOriginal<typeof import('@azure/functions')>();
  return {
    ...original,
    app: {
      http: vi.fn(),
    },
  };
});
