// Unit tests for the GDPR cookie-consent widget's core logic:
//   - Google Consent Mode v2 signal mapping (what actually gates cookies)
//   - the default (pre-choice) consent state
//   - stored-choice validation (versioning + expiry + corruption)
// Pure functions, no DOM — the banner/panel rendering is exercised in the
// browser. Run: node --test 'tests/**/*.test.js'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// cookie-consent.js is a classic-script IIFE; its browser bootstrap is guarded
// on `typeof window`, so requiring it here only exposes the pure helpers.
const require = createRequire(import.meta.url);
const {
  DEFAULT_CONSENT, consentToSignals, validateStored, POLICY_VERSION, MAX_AGE_DAYS,
} = require('../assets/cookie-consent.js');

/* ---- Consent Mode v2 default (before any choice) ---- */

test('default denies all storable analytics/ad signals until the user chooses', () => {
  assert.equal(DEFAULT_CONSENT.analytics_storage, 'denied');
  assert.equal(DEFAULT_CONSENT.ad_storage, 'denied');
  assert.equal(DEFAULT_CONSENT.ad_user_data, 'denied');
  assert.equal(DEFAULT_CONSENT.ad_personalization, 'denied');
});

test('default still grants strictly-necessary (security + functionality) storage', () => {
  assert.equal(DEFAULT_CONSENT.security_storage, 'granted');
  assert.equal(DEFAULT_CONSENT.functionality_storage, 'granted');
});

/* ---- category choice -> Consent Mode v2 signals ---- */

test('accept all grants analytics + every ad signal', () => {
  assert.deepEqual(consentToSignals({ analytics: true, marketing: true }), {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  });
});

test('reject all denies analytics + every ad signal', () => {
  assert.deepEqual(consentToSignals({ analytics: false, marketing: false }), {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
});

test('analytics-only grants analytics_storage but keeps ad signals denied', () => {
  const s = consentToSignals({ analytics: true, marketing: false });
  assert.equal(s.analytics_storage, 'granted');
  assert.equal(s.ad_storage, 'denied');
  assert.equal(s.ad_user_data, 'denied');
  assert.equal(s.ad_personalization, 'denied');
});

test('marketing-only grants ad signals but keeps analytics denied', () => {
  const s = consentToSignals({ analytics: false, marketing: true });
  assert.equal(s.analytics_storage, 'denied');
  assert.equal(s.ad_storage, 'granted');
  assert.equal(s.ad_user_data, 'granted');
  assert.equal(s.ad_personalization, 'granted');
});

test('signals map never leaks a "necessary" key (it is not a Consent Mode signal)', () => {
  const s = consentToSignals({ analytics: true, marketing: true, necessary: true });
  assert.deepEqual(Object.keys(s).sort(), [
    'ad_personalization', 'ad_storage', 'ad_user_data', 'analytics_storage',
  ]);
});

/* ---- stored-choice validation ---- */

const NOW = 1_700_000_000_000;
const rec = (over = {}) => JSON.stringify(
  Object.assign({ version: POLICY_VERSION, ts: NOW, consent: { analytics: true, marketing: false, necessary: true } }, over)
);

test('a valid, current record round-trips', () => {
  const v = validateStored(rec(), NOW);
  assert.ok(v);
  assert.deepEqual(v.consent, { analytics: true, marketing: false, necessary: true });
});

test('missing storage returns null (banner should show)', () => {
  assert.equal(validateStored(null, NOW), null);
  assert.equal(validateStored('', NOW), null);
});

test('corrupt JSON returns null instead of throwing', () => {
  assert.equal(validateStored('{not json', NOW), null);
});

test('a record from an older policy version is discarded (forces re-consent)', () => {
  assert.equal(validateStored(rec({ version: POLICY_VERSION - 1 }), NOW), null);
});

test('a record older than the max age is discarded (re-prompt)', () => {
  const stale = NOW - (MAX_AGE_DAYS * 864e5 + 1);
  assert.equal(validateStored(rec({ ts: stale }), NOW), null);
});

test('a record exactly at the max-age boundary is still valid', () => {
  const edge = NOW - MAX_AGE_DAYS * 864e5;
  assert.ok(validateStored(rec({ ts: edge }), NOW));
});
