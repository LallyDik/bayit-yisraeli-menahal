import { describe, expect, it } from 'vitest';
import { shouldShowOnboarding } from '../src/utils/onboarding';

describe('shouldShowOnboarding', () => {
  it('shows the guide when metadata is missing', () => {
    expect(shouldShowOnboarding(undefined, 1)).toBe(true);
  });

  it('shows the guide when the stored version is older', () => {
    expect(shouldShowOnboarding({ onboarding_version: 1 }, 2)).toBe(true);
  });

  it('does not show the guide after the current version was completed', () => {
    expect(shouldShowOnboarding({ onboarding_version: 2 }, 2)).toBe(false);
  });

  it('treats malformed metadata as incomplete', () => {
    expect(shouldShowOnboarding({ onboarding_version: '2' }, 2)).toBe(true);
  });
});
