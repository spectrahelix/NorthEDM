import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const moduleUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const coreUrl = moduleUrl(compile(await readFile('utils/artisanAudio.ts', 'utf8')));
const { validAudioPayment, ownAudioPath, audioPrice, audioFile, audioRefundState } = await import(coreUrl);
const seller = '11111111-1111-4111-8111-111111111111';
const buyer = '22222222-2222-4222-8222-222222222222';
const order = { id: 'order1', price_cents: 1000, fee_cents: 100, currency: 'usd', stripe_account_id: 'acct_creator' };
const payment = { status: 'succeeded', amount: 1000, amount_received: 1000, currency: 'usd', application_fee_amount: 100,
  transfer_data: { destination: 'acct_creator' }, metadata: { kind: 'artisan_audio_order', audio_order_id: 'order1' },
  latest_charge: { paid: true, refunded: false, amount_refunded: 0, disputed: false },
};
assert.equal(validAudioPayment(order, payment), true);
for (const change of [
  { status: 'requires_capture' }, { amount: 999 }, { amount_received: 999 }, { currency: 'eur' },
  { application_fee_amount: 0 }, { transfer_data: { destination: 'acct_attacker' } },
  { metadata: { ...payment.metadata, audio_order_id: 'another-order' } },
  { metadata: { ...payment.metadata, kind: 'store_order' } }, { latest_charge: 'ch_not_expanded' },
  ...[{ paid: false }, { refunded: true }, { amount_refunded: 1 }, { disputed: true }].map(c => ({ latest_charge: { ...payment.latest_charge, ...c } })),
]) assert.equal(validAudioPayment(order, { ...payment, ...change }), false, JSON.stringify(change));
assert.throws(() => audioPrice(-100)); assert.throws(() => audioPrice(50.5)); assert.throws(() => audioPrice(NaN));
assert.equal(audioPrice(50), 50);
assert.equal(ownAudioPath(`${seller}/original.mp3`, seller), true);
for (const path of [`${buyer}/original.mp3`, `${seller}/../other.mp3`, `${seller}//other.mp3`, 'https://example.com/audio.mp3'])
  assert.equal(ownAudioPath(path, seller), false);
assert.throws(() => audioFile({ name: 'script.html', size: 20 }));
assert.throws(() => audioFile({ name: 'demo.mp3', size: 16 * 1024 * 1024 }));
assert.equal(audioFile({ name: 'demo.MP3', size: 100 }).type, 'audio/mpeg');
assert.equal(audioRefundState([{ amount: 1000, status: 'pending' }], 1000), 'refund_pending');
assert.equal(audioRefundState([{ amount: 1000, status: 'failed' }], 1000), 'refund_pending');
assert.equal(audioRefundState([{ amount: 500, status: 'succeeded' }], 1000), 'partially_refunded');
assert.equal(audioRefundState([{ amount: 1000, status: 'succeeded' }], 1000), 'refunded');

// Execute the actual reconciliation helper with provider and database adapters.
// This proves redirects do not unlock files and webhook replays cannot restore
// a refunded/disputed/refund-pending purchase.
let row = { ...order, status: 'pending', checkout_session_id: 'cs1', payment_intent_id: null, paid_at: null };
let currentPayment = structuredClone(payment);
globalThis.__artisanTestStripe = {
  checkout: { sessions: { retrieve: async () => ({ id: 'cs1', metadata: payment.metadata,
    client_reference_id: 'order1', amount_total: 1000, currency: 'usd', payment_status: 'paid', payment_intent: 'pi1' }) } },
  paymentIntents: { retrieve: async () => currentPayment },
  refunds: { list: async () => ({ data: [{ amount: 500, status: 'succeeded' }] }) },
};
const stripeUrl = moduleUrl('export function getStripe() { return globalThis.__artisanTestStripe; }');
const serverSource = compile(await readFile('utils/artisanAudioServer.ts', 'utf8'))
  .replaceAll('@/utils/stripe', stripeUrl).replaceAll('@/utils/artisanAudio', coreUrl);
const { reconcileAudioOrder } = await import(moduleUrl(serverSource));
const fakeDb = { from() {
  let changes = null; let allowed = null;
  const query = { select() { return query; }, eq() { return query; },
    in(_key, values) { allowed = values; return query; },
    update(value) { changes = value; return query; },
    async maybeSingle() {
      if (!changes) return { data: structuredClone(row), error: null };
      if (allowed && !allowed.includes(row.status)) return { data: null, error: null };
      Object.assign(row, changes); return { data: structuredClone(row), error: null };
    },
    then(resolve) { return query.maybeSingle().then(resolve); },
  }; return query;
} };
assert.equal(await reconcileAudioOrder(fakeDb, 'order1'), true);
assert.equal(row.status, 'paid');
assert.equal(row.payment_intent_id, 'pi1');
for (const status of ['refunded','partially_refunded','disputed','refund_pending','canceled']) {
  row.status = status;
  assert.equal(await reconcileAudioOrder(fakeDb, 'order1'), false);
  assert.equal(row.status, status);
}
row.status = 'pending'; currentPayment.latest_charge.disputed = true;
assert.equal(await reconcileAudioOrder(fakeDb, 'order1'), false); assert.equal(row.status, 'disputed');
row.status = 'pending'; currentPayment = structuredClone(payment); currentPayment.latest_charge.amount_refunded = 500;
assert.equal(await reconcileAudioOrder(fakeDb, 'order1'), false); assert.equal(row.status, 'partially_refunded');
delete globalThis.__artisanTestStripe;

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select current_user::text $$;
  create table auth.users(id uuid primary key);
  create table public.user_profiles(id uuid primary key);
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id serial primary key, bucket_id text, name text, unique(bucket_id,name));
  create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1, '/') $$;
  alter table storage.objects enable row level security;
  grant usage on schema public,auth,storage to anon,authenticated,service_role;
  grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
  grant usage on sequence storage.objects_id_seq to anon,authenticated,service_role;
`);
await db.exec(await readFile('supabase/migrations/20260624000000_artisans.sql', 'utf8'));
await db.exec(await readFile('supabase/migrations/20261110230000_artisan_audio.sql', 'utf8'));
await db.exec(`insert into auth.users values ('${seller}'), ('${buyer}');
  insert into public.artisan_works(user_id,kind,title) values ('${seller}','audio','Voice demo');
  insert into storage.objects(bucket_id,name) values
    ('artisan-audio-previews','${seller}/demo.mp3'), ('artisan-audio-originals','${seller}/full.wav');
  grant select,insert,update,delete on public.artisan_works to authenticated;
  grant usage on sequence public.artisan_works_id_seq to authenticated;`);
await db.exec('set role anon');
assert.equal((await db.query("select * from storage.objects where bucket_id='artisan-audio-previews'")).rows.length, 1);
assert.equal((await db.query("select * from storage.objects where bucket_id='artisan-audio-originals'")).rows.length, 0);
await assert.rejects(db.query('select private_path from public.artisan_audio_orders'), /permission denied/);
await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${buyer}'`);
assert.equal((await db.query("select * from storage.objects where bucket_id='artisan-audio-originals'")).rows.length, 0);
await assert.rejects(db.query(`insert into storage.objects(bucket_id,name) values ('artisan-audio-originals','${seller}/stolen.wav')`), /row-level security/);
await assert.rejects(db.query('select stripe_account_id from public.artisan_sellers'), /permission denied/);
await assert.rejects(db.query('select private_path from public.artisan_audio_offers'), /permission denied/);
await db.exec(`set request.jwt.claim.sub='${seller}'`);
assert.equal((await db.query("select * from storage.objects where bucket_id='artisan-audio-originals'")).rows.length, 1);
assert.equal((await db.query("delete from storage.objects where bucket_id='artisan-audio-originals' returning *")).rows.length, 0);
assert.equal((await db.query("update storage.objects set name='changed.wav' where bucket_id='artisan-audio-originals' returning *")).rows.length, 0);
await db.exec('reset role');
const insertOrder = `insert into public.artisan_audio_orders(work_id,buyer_user_id,seller_user_id,title,private_path,filename,license,terms_version,price_cents,fee_cents,currency,stripe_account_id,immediate_delivery_requested)
  values (1,'${buyer}','${seller}','Voice demo','${seller}/full.wav','full.wav','Personal use only','2026-11-10',1000,100,'usd','acct_creator',true)`;
await db.exec(insertOrder);
await assert.rejects(db.exec(insertOrder), /duplicate key/);
await db.exec(`delete from public.artisan_works where id=1`);
const saved = (await db.query('select * from public.artisan_audio_orders')).rows[0];
assert.equal(saved.work_id, null); assert.equal(saved.private_path, `${seller}/full.wav`); assert.equal(saved.license, 'Personal use only');
await db.close();
console.log('Artisan audio: payment integrity, replay protection, storage privacy, owner isolation, duplicate checkout and retained purchase tests passed.');
