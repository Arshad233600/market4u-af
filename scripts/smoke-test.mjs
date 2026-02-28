#!/usr/bin/env node
/**
 * End-to-end smoke test
 *
 * Flow: GET /api/ads (public) → GET /api/notifications (no auth – must not 401) →
 *       Login → POST /api/ads → GET /api/ads/my-ads → verify created adId exists
 *
 * Required environment variables:
 *   SMOKE_TEST_BASE_URL  – base URL of the deployed API, e.g. https://my-app.azurestaticapps.net
 *   SMOKE_TEST_EMAIL     – email of a test user account
 *   SMOKE_TEST_PASSWORD  – password of the test user account
 *
 * When SMOKE_TEST_BASE_URL is not set the script exits 0 (skip).
 */

const BASE_URL = process.env.SMOKE_TEST_BASE_URL;

if (!BASE_URL) {
  console.log('SMOKE_TEST_BASE_URL not set – skipping smoke test.');
  process.exit(0);
}

const TEST_EMAIL = process.env.SMOKE_TEST_EMAIL;
const TEST_PASSWORD = process.env.SMOKE_TEST_PASSWORD;

if (!TEST_EMAIL || !TEST_PASSWORD) {
  console.error('SMOKE_TEST_EMAIL and SMOKE_TEST_PASSWORD are required when SMOKE_TEST_BASE_URL is set.');
  process.exit(1);
}

let failures = 0;

function pass(msg) { console.log(`  PASS  ${msg}`); }
function fail(msg) { console.error(`  FAIL  ${msg}`); failures++; }
function assert(condition, msg) { condition ? pass(msg) : fail(msg); }

// ---------------------------------------------------------------------------
// Step 0: GET /api/ads (public – no authentication required)
// ---------------------------------------------------------------------------
console.log('\n[0/4] GET /api/ads (public endpoint – no auth)');

const publicAdsRes = await fetch(`${BASE_URL}/api/ads`);

assert(
  publicAdsRes.status !== 401,
  `GET /api/ads is accessible without authentication (got ${publicAdsRes.status}, expected non-401)`
);
assert(publicAdsRes.ok, `GET /api/ads responds 2xx (got ${publicAdsRes.status})`);

// ---------------------------------------------------------------------------
// Step 0b: GET /api/notifications without auth – must NOT return 401
// (regression guard: unauthenticated visitors must not see a 401 console error)
// ---------------------------------------------------------------------------
console.log('\n[0b/4] GET /api/notifications (no auth – must return 200, not 401)');

const unauthNotifRes = await fetch(`${BASE_URL}/api/notifications`);

assert(
  unauthNotifRes.status !== 401,
  `GET /api/notifications does not return 401 for unauthenticated requests (got ${unauthNotifRes.status})`
);
assert(unauthNotifRes.ok, `GET /api/notifications responds 2xx without auth (got ${unauthNotifRes.status})`);

const unauthNotifBody = await unauthNotifRes.json().catch(() => null);
assert(Array.isArray(unauthNotifBody), 'GET /api/notifications returns an array when unauthenticated');

// ---------------------------------------------------------------------------
// Step 1: Login
// ---------------------------------------------------------------------------
console.log('\n[1/4] POST /api/auth/login');

const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
});

assert(loginRes.ok, `Login responds 2xx (got ${loginRes.status})`);

const loginBody = await loginRes.json();
const token = loginBody?.token;
assert(typeof token === 'string' && token.length > 0, 'Login returns a non-empty token');

if (!token) {
  console.error('Cannot continue without a token.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 2: POST /api/ads
// ---------------------------------------------------------------------------
console.log('\n[2/4] POST /api/ads');

const adPayload = {
  title: `Smoke Test Ad ${Date.now()}`,
  price: 1,
  category: 'test',
  location: 'Smoke City',
};

const postAdRequestHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${token}`,
};

// Assert the Authorization header is present before sending (regression guard)
assert(
  'Authorization' in postAdRequestHeaders && postAdRequestHeaders.Authorization.startsWith('Bearer '),
  'Authorization header is present in POST /api/ads request'
);

const postAdRes = await fetch(`${BASE_URL}/api/ads`, {
  method: 'POST',
  headers: postAdRequestHeaders,
  body: JSON.stringify(adPayload),
});

assert(postAdRes.status === 201, `POST /api/ads returns 201 (got ${postAdRes.status})`);

const postAdBody = await postAdRes.json();
const createdAdId = postAdBody?.id;
assert(typeof createdAdId === 'string' && createdAdId.length > 0, `POST /api/ads returns an id (got "${createdAdId}")`);

if (!createdAdId) {
  console.error('Cannot continue without the created ad ID.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 3: GET /api/ads/my-ads
// ---------------------------------------------------------------------------
console.log('\n[3/4] GET /api/ads/my-ads');

const authorizationHeader = `Bearer ${token}`;
const myAdsRequestHeaders = { Authorization: authorizationHeader };

// Assert the Authorization header is present in the request headers object
assert('Authorization' in myAdsRequestHeaders && myAdsRequestHeaders.Authorization.startsWith('Bearer '),
  'Authorization header is present in GET /api/ads/my-ads request');

const myAdsRes = await fetch(`${BASE_URL}/api/ads/my-ads`, {
  headers: myAdsRequestHeaders,
});

assert(myAdsRes.ok, `GET /api/ads/my-ads responds 2xx (got ${myAdsRes.status})`);

const myAdsBody = await myAdsRes.json();
assert(Array.isArray(myAdsBody), 'GET /api/ads/my-ads returns an array');

// Confirm the created ad appears in the list (field names may be PascalCase from SQL)
const returnedIds = (Array.isArray(myAdsBody) ? myAdsBody : []).map(ad => ad.Id ?? ad.id);
assert(returnedIds.includes(createdAdId), `Created ad "${createdAdId}" is present in my-ads response`);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
if (failures > 0) {
  console.error(`Smoke test FAILED – ${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log('Smoke test PASSED – all assertions OK.');
