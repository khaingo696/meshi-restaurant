#!/usr/bin/env node
/**
 * Lấy rating + số recenzí MESHi từ Google Places API (New), ghi google-rating.json.
 *
 * Cần GOOGLE_PLACES_API_KEY trong môi trường hoặc file .env ở root project.
 * Field mask chỉ lấy rating/userRatingCount → SKU Enterprise, 1.000 gọi/tháng free.
 *
 * Chạy: npm run rating:google
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'public/google-rating.json');
const QUERY = 'Meshi Restaurant nám. Republiky 107/14 Plzeň';
const BIAS = { latitude: 49.74664, longitude: 13.378536 };

function loadEnv() {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) {
  console.error('Thiếu GOOGLE_PLACES_API_KEY. Tạo file .env ở root với dòng:');
  console.error('GOOGLE_PLACES_API_KEY=...');
  process.exit(1);
}

function readPrev() {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'));
  } catch {
    return {};
  }
}

async function placesPost(path, body, fieldMask) {
  const res = await fetch('https://places.googleapis.com/v1/' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': fieldMask
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data.error?.message || text;
    throw new Error('Places API ' + res.status + ': ' + msg);
  }
  return data;
}

async function placesGet(placeId, fieldMask) {
  const res = await fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(placeId) + '?languageCode=cs', {
    headers: {
      'X-Goog-Api-Key': KEY,
      'X-Goog-FieldMask': fieldMask
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data.error?.message || text;
    throw new Error('Places API ' + res.status + ': ' + msg);
  }
  return data;
}

function pickPlace(places) {
  if (!places || !places.length) return null;
  return places.find(function (p) {
    return /meshi/i.test(p.displayName && p.displayName.text || '');
  }) || places[0];
}

const prev = readPrev();
let place;

if (prev.placeId) {
  place = await placesGet(prev.placeId, 'id,displayName,rating,userRatingCount,googleMapsUri');
} else {
  const found = await placesPost('places:searchText', {
    textQuery: QUERY,
    languageCode: 'cs',
    maxResultCount: 3,
    locationBias: { circle: { center: BIAS, radius: 400 } }
  }, 'places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri');
  place = pickPlace(found.places);
}

if (!place || place.rating == null || place.userRatingCount == null) {
  console.error('Google không trả rating. Giữ file cũ.');
  process.exit(1);
}

const payload = {
  rating: place.rating,
  count: place.userRatingCount,
  placeId: place.id || prev.placeId || '',
  mapsUrl: place.googleMapsUri || prev.mapsUrl || '',
  name: (place.displayName && place.displayName.text) || prev.name || 'MESHi',
  updatedAt: new Date().toISOString()
};

writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
console.log('Đã ghi', OUT);
console.log(payload.rating + ' ★ · ' + payload.count + ' recenzí · ' + payload.name);
