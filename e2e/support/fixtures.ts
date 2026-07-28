import { test as base } from '@playwright/test';
import { resetTestUserData } from './supabase-test-user';

// Every test that imports this `test` starts from a clean backend for the
// test user, so tests are order-independent against the shared branch.
export const test = base.extend<{ cleanData: void }>({
  cleanData: [
    async ({}, use) => {
      await resetTestUserData();
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';

let counter = 0;
/** A run-unique, human-readable name so assertions can target one entity. */
export function uniqueName(prefix: string): string {
  counter += 1;
  return `${prefix} ${process.pid}-${counter}`;
}
