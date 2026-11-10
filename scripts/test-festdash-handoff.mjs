import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
process.on("uncaughtException", error => { console.error(error.message, error.code ?? "", error.position ?? "", error.where ?? ""); process.exit(1); });

const db = new PGlite();
const customer = randomUUID(), dasher = randomUUID(), shop = randomUUID(), stranger = randomUUID();
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users (id uuid primary key);
  create table public.user_profiles (id uuid primary key, vendor_id bigint);
  create table public.vendors (id bigint primary key, user_id uuid);
  create table public.festdash_drivers (user_id uuid primary key, is_active boolean);
  create table public.festdash_orders (id uuid primary key, vendor_id bigint, customer_id uuid,
    driver_id uuid, fulfillment text default 'delivery', status text, payment_status text,
    confirmed_at timestamptz, updated_at timestamptz default now(), confirmation_code text);
`);
for (const id of [customer, dasher, shop, stranger]) await db.query("insert into auth.users values ($1)", [id]);
await db.query("insert into public.vendors values (1, $1)", [shop]);
await db.query("insert into public.user_profiles values ($1, 1)", [shop]);
await db.query("insert into public.festdash_drivers values ($1, true)", [dasher]);
await db.exec(await readFile(new URL("../supabase/migrations/20261110220000_festdash_two_party_handoff.sql", import.meta.url), "utf8"));

async function order({ pickup = false, driver = dasher } = {}) {
  const id = randomUUID();
  await db.query("insert into public.festdash_orders (id,vendor_id,customer_id,driver_id,fulfillment,status,payment_status) values ($1,1,$2,$3,$4,'in_transit','authorized')", [id, customer, driver, pickup ? "pickup" : "delivery"]);
  return id;
}
async function action(id, actor, operation = "view", code = null) {
  const result = await db.query("select public.festdash_handoff($1,$2,$3,$4,'1234','5678','Problem at handover') as state", [id, actor, operation, code]);
  return result.rows[0].state;
}
async function state(id) { return (await db.query("select status,payment_status from public.festdash_orders where id=$1", [id])).rows[0]; }

try {
  const id = await order();
  assert.equal((await action(id, stranger)).http_status, 403);
  const c = await action(id, customer);
  const d = await action(id, dasher);
  assert.equal(c.own_code, "1234"); assert.equal(d.own_code, "5678");
  assert(!JSON.stringify(c).includes("5678")); assert(!JSON.stringify(d).includes("1234"));
  assert.equal((await action(id, customer, "confirm", "1234")).http_status, 422, "own code cannot confirm the other party");
  assert.equal((await action(id, dasher, "confirm", "555-1234")).http_status, 422, "phone suffix coercion is forbidden");
  const first = await action(id, customer, "confirm", "5678");
  assert(first.customer_confirmed && !first.fulfiller_confirmed && !first.ready);
  assert.equal((await state(id)).status, "in_transit");
  await assert.rejects(db.query("update public.festdash_orders set status='delivered' where id=$1", [id]), /Both parties/);
  await assert.rejects(db.query("update public.festdash_orders set payment_status='released' where id=$1", [id]), /Both parties/);
  const second = await action(id, dasher, "confirm", "1234");
  assert(second.ready); assert.equal(second.order_status, "delivered"); assert.equal(second.own_code, null);
  assert.equal((await action(id, dasher, "confirm", "")).ready, true, "authenticated retry preserves confirmations");

  const locked = await order();
  for (let i = 0; i < 10; i++) assert.equal((await action(locked, dasher, "confirm", "9999")).http_status, 422);
  assert((await action(locked, dasher)).locked, "refresh cannot reset guesses");
  assert.equal((await action(locked, dasher, "confirm", "1234")).http_status, 429);
  assert.equal((await state(locked)).status, "in_transit");

  const failed = await order();
  await action(failed, dasher, "confirm", "1234");
  await db.query("update public.festdash_orders set status='declined' where id=$1 and status='in_transit'", [failed]);
  assert.equal((await action(failed, customer, "confirm", "5678")).http_status, 409);
  await assert.rejects(db.query("update public.festdash_orders set payment_status='capturing' where id=$1", [failed]), /Both parties/);

  const paused = await order();
  await action(paused, customer, "problem");
  assert((await action(paused, dasher)).problem_reported);
  assert.equal((await action(paused, dasher, "confirm", "1234")).http_status, 409);

  const pickup = await order({ pickup: true, driver: null });
  assert.equal((await action(pickup, dasher)).http_status, 403);
  assert.equal((await action(pickup, shop)).party, "fulfiller");
  await action(pickup, shop, "confirm", "1234");
  assert((await action(pickup, customer, "confirm", "5678")).ready);

  const selfDelivery = await order({ driver: customer });
  await action(selfDelivery, customer, "confirm", "5678");
  assert(!(await action(selfDelivery, customer, "confirm", "1234")).ready, "one account cannot provide both confirmations");

  const privileges = (await db.query(`select
    has_table_privilege('authenticated','public.festdash_handoffs','select') as codes,
    has_function_privilege('authenticated','public.festdash_handoff(uuid,uuid,text,text,text,text,text)','execute') as confirm,
    has_table_privilege('service_role','public.festdash_handoffs','select') as server`)).rows[0];
  assert.deepEqual(privileges, { codes: false, confirm: false, server: true });
  console.log("FestDash database checks passed: private codes, two distinct accounts, both confirmations, pickup authorization, ten-guess lock, cancellation, problem pause, and release guard.");
} finally { await db.close(); }
