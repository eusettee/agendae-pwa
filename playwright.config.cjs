const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests/browser',
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:3000', channel: 'chrome', headless: true },
  webServer: { command: 'node server.cjs', url: 'http://localhost:3000', reuseExistingServer: true }
});
