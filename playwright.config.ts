import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',testMatch:'**/*.spec.ts',fullyParallel:false,workers:1,retries:0,
 timeout:60000,expect:{timeout:15000},
 reporter:[['list'],['html',{open:'never',outputFolder:'playwright-report'}]],
 use:{baseURL:'http://127.0.0.1:3000',...devices['Desktop Chrome'],trace:'retain-on-failure'},
});
