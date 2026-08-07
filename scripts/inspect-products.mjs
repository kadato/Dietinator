#!/usr/bin/env node
/**
 * Diagnostic: inspect real YAZIO product payloads to validate the app's
 * per-gram vs per-100 g nutrient-scaling heuristics.
 *
 * Reads credentials from .env.local. Prints raw API values only — nothing is
 * written, logged to your account, or committed.
 */
import { Yazio } from 'yazio';
import { readFileSync } from 'node:fs';

let env = {};
try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2];
  }
} catch {
  console.error('No .env.local — put YAZIO_EMAIL/YAZIO_PASSWORD there.');
  process.exit(1);
}

const email = env.YAZIO_EMAIL;
const password = env.YAZIO_PASSWORD;
if (!email || !password) {
  console.error('Missing YAZIO_EMAIL/YAZIO_PASSWORD in .env.local');
  process.exit(1);
}

const queries = ['banana', 'olive oil', 'cucumber', 'lettuce', 'apple', 'milk', 'chocolate', 'coca cola', 'butter', 'rice'];

const yazio = new Yazio({ credentials: { username: email, password } });
await yazio.user.get();

for (const q of queries) {
  try {
    const results = await yazio.products.search({ query: q, countries: ['US'], sex: 'male' });
    const hit = results.find((r) => r.product_id) ?? results[0];
    if (!hit) {
      console.log(`\n== ${q}: no results`);
      continue;
    }
    const detail = await yazio.products.get(hit.product_id);
    if (!detail) {
      console.log(`\n== ${q}: no detail`);
      continue;
    }
    const kcal = detail.nutrients['energy.energy'];
    const first = detail.servings[0];
    const kcalPerServing = (serving) =>
      serving
        ? `~${(kcal * serving.amount).toFixed(2)} kcal per ${serving.serving} (amount ${serving.amount}${detail.base_unit})`
        : 'no servings';
    console.log(`\n== ${q} → "${detail.name}" (${detail.base_unit})`);
    console.log(`   raw energy: ${kcal}  (per-gram semantics ⇒ ${(kcal * 100).toFixed(1)} kcal/100${detail.base_unit})`);
    console.log(`   servings: ${detail.servings.map((s) => `${s.serving} @${s.amount}`).join(' | ')}`);
    console.log(`   search-row: "${hit.serving}" amount=${hit.amount} serving_quantity=${hit.serving_quantity} searchKcal=${hit.nutrients['energy.energy']}`);
  } catch (error) {
    console.log(`\n== ${q}: ERROR ${error instanceof Error ? error.message : String(error)}`);
  }
}
