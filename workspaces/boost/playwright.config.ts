/*
 * Copyright Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { defineConfig } from '@playwright/test';

const frontendPort = 3100;
const backendPort = 7107;

export default defineConfig({
  timeout: 2 * 60 * 1000,
  expect: { timeout: 10_000 },
  testDir: 'e2e-tests',
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never', outputFolder: 'e2e-test-report' }]],
  outputDir: 'node_modules/.cache/e2e-test-results',
  webServer: process.env.PLAYWRIGHT_URL
    ? undefined
    : {
        command: 'yarn start',
        // The frontend is ready before the backend. Waiting for the backend
        // avoids racing the guest sign-in flow at the start of the suite.
        port: backendPort,
        reuseExistingServer: false,
        cwd: __dirname,
        env: {
          ...process.env,
          APP_CONFIG_app_baseUrl: `"http://localhost:${frontendPort}"`,
          APP_CONFIG_backend_baseUrl: `"http://localhost:${backendPort}"`,
          APP_CONFIG_backend_listen_port: String(backendPort),
          APP_CONFIG_backend_cors_origin: `"http://localhost:${frontendPort}"`,
        },
      },
  use: {
    baseURL: process.env.PLAYWRIGHT_URL ?? `http://localhost:${frontendPort}`,
    channel: 'chrome',
    actionTimeout: 15_000,
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
});
