/**
 * Onboarding state helpers — separate from the component to allow
 * the component itself to be lazy-loaded while the state check
 * remains in the main bundle.
 */

const ONBOARDED_KEY = "lumina_onboarded";
const LEGACY_ONBOARDED_KEY = "juphdcare_onboarded";

export function hasCompletedOnboarding(): boolean {
  return localStorage.getItem(ONBOARDED_KEY) === "true"
    || localStorage.getItem(LEGACY_ONBOARDED_KEY) === "true";
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDED_KEY, "true");
  localStorage.removeItem(LEGACY_ONBOARDED_KEY);
}
