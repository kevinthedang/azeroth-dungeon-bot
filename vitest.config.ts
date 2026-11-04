import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        // Each test file runs in its own process, so the in-memory database and
        // temporary asset tree created by tests/helpers.ts stay isolated.
        pool: 'forks',
    },
})
