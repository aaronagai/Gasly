#!/usr/bin/env node
/**
 * NSW FuelCheck API — smoke test (OAuth client credentials + sample price call).
 *
 * Set credentials from the API.NSW portal (Fuel API product), then:
 *   NSW_FUEL_KEY=your_api_key NSW_FUEL_SECRET=your_api_secret node scripts/nsw-fuel-try.mjs
 *
 * Do not commit keys. If keys were pasted in chat/screenshots, rotate the secret in the portal.
 *
 * Docs: https://api.nsw.gov.au/Product/Index/22
 * Token: POST https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken
 * Prices (example): GET .../FuelPriceCheck/v1/fuel/prices/location?fueltype=...&location=...
 */

const TOKEN_URL = 'https://api.onegov.nsw.gov.au/oauth/client_credential/accesstoken';
const SAMPLE_URL =
  'https://api.onegov.nsw.gov.au/FuelPriceCheck/v1/fuel/prices/location?fueltype=2&location=2000';

function basicAuthHeader(id, secret) {
  const raw = `${id}:${secret}`;
  const b64 = Buffer.from(raw, 'utf8').toString('base64');
  return `Basic ${b64}`;
}

async function fetchAccessToken(key, secret) {
  const attempts = [
    {
      label: 'JSON body',
      headers: {
        Authorization: basicAuthHeader(key, secret),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
    },
    {
      label: 'form body',
      headers: {
        Authorization: basicAuthHeader(key, secret),
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    },
  ];

  let lastErr = '';
  for (const a of attempts) {
    const res = await fetch(TOKEN_URL, { method: 'POST', headers: a.headers, body: a.body });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      lastErr = `${a.label}: non-JSON HTTP ${res.status}: ${text.slice(0, 120)}`;
      continue;
    }
    if (data.access_token) return data.access_token;
    lastErr = `${a.label}: HTTP ${res.status} keys=${Object.keys(data).join(',')} body=${text.slice(0, 160)}`;
  }
  throw new Error(
    `Token request failed (${lastErr}). From some networks the gateway only echoes the body — try again from Australia or contact API.NSW support.`,
  );
}

async function main() {
  const key = process.env.NSW_FUEL_KEY || '';
  const secret = process.env.NSW_FUEL_SECRET || '';
  if (!key || !secret) {
    console.error('Set NSW_FUEL_KEY and NSW_FUEL_SECRET (API key + secret from api.nsw).');
    process.exit(1);
  }

  console.log('Requesting access token…');
  const token = await fetchAccessToken(key, secret);
  console.log('Got token (length %d).', token.length);

  console.log('GET sample (Sydney area postcode 2000, fuel type code 2 — check LOVs for codes)…');
  const res = await fetch(SAMPLE_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const body = await res.text();
  console.log('Sample HTTP', res.status);
  try {
    const j = JSON.parse(body);
    console.log(JSON.stringify(j, null, 2).slice(0, 4000));
  } catch {
    console.log(body.slice(0, 2000));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
