export const CURRENT_ONBOARDING_VERSION = 1;

type UserMetadata = Record<string, unknown> | null | undefined;

export function onboardingVersion(metadata: UserMetadata): number {
  const value = metadata?.onboarding_version;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function shouldShowOnboarding(
  metadata: UserMetadata,
  currentVersion = CURRENT_ONBOARDING_VERSION,
): boolean {
  return onboardingVersion(metadata) < currentVersion;
}
