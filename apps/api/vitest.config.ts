import { defineConfig } from 'vitest/config'

// Tests only ever touch the local docker Postgres (port 5433), database alacena_test.
// The URL is forced here (overriding any DATABASE_URL in the shell) and
// test/globalSetup.ts refuses to run against anything else.
const TEST_DATABASE_URL = 'postgresql://alacena:alacena@localhost:5433/alacena_test?schema=public'
process.env.DATABASE_URL = TEST_DATABASE_URL

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      ALLOWED_ORIGINS: 'http://localhost:8081,https://alacena.example',
    },
    globalSetup: ['test/globalSetup.ts'],
    setupFiles: ['test/setup.ts'],
    fileParallelism: false,
  },
})
