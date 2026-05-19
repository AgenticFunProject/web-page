const { defineConfig } = require('playwright');

const BASE_URL = process.env.E2E_BASE_URL || 'https://gateway.thankfulpond-5ed1bd9d.westeurope.azurecontainerapps.io';

module.exports = defineConfig({
    testDir: './e2e',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: BASE_URL,
        viewport: { width: 1280, height: 720 },
        screenshot: 'only-on-failure',
    },
});
