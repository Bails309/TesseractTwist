import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:9090",
    headless: true,
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--use-gl=angle", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    command: "docker-compose up -d --build",
    url: "http://127.0.0.1:9090",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
