import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const chris = "33333333-3333-4333-8333-333333333333";

await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as
    $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
  grant usage on schema auth to authenticated;
  create table auth.users (id uuid primary key);
  insert into auth.users values ('${alice}'), ('${bob}'), ('${chris}');
  create table public.user_profiles (id uuid primary key, display_name text not null);
  insert into public.user_profiles values ('${alice}', 'Alice'), ('${bob}', 'Bob');
  create function public.is_verified() returns boolean language sql stable as
    $$select auth.uid() is not null$$;
  create table public.direct_messages (
    id bigint generated always as identity primary key,
    sender_id uuid not null references auth.users,
    recipient_id uuid not null references auth.users,
    subject text not null,
    body text not null,
    read boolean not null default false
  );
  create table public.notifications (
    user_id uuid not null references auth.users,
    type text not null, message text not null, link text
  );
  grant select, insert, update on public.direct_messages to authenticated;
  grant select, insert on public.notifications to authenticated;
  alter table public.direct_messages enable row level security;
  alter table public.notifications enable row level security;
  create policy "dm access" on public.direct_messages for select to authenticated
    using (auth.uid() in (sender_id, recipient_id));
  create policy "dm send" on public.direct_messages for insert to authenticated
    with check (auth.uid() = sender_id);
  create policy "dm mark read" on public.direct_messages for update to authenticated
    using (auth.uid() = recipient_id);
  create policy "own notifications" on public.notifications for select to authenticated
    using (auth.uid() = user_id);
  create policy "verified insert notification" on public.notifications for insert to authenticated
    with check (public.is_verified());
  insert into public.direct_messages(sender_id, recipient_id, subject, body)
    values ('${bob}', '${alice}', 'Old message', 'Before item attachments');
`);
await db.exec(await readFile("supabase/migrations/20261112143207_seller_messages_and_blocks.sql", "utf8"));

async function as(user) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
}
function send(from, to, path = null) {
  return db.query(`
    insert into public.direct_messages(sender_id, recipient_id, subject, body, item_path)
    values ($1, $2, 'Question about an item', 'Is it in stock?', $3)
    returning id
  `, [from, to, path]);
}
function block(from, to) {
  return db.query("insert into public.message_blocks(blocker_id, blocked_id) values ($1, $2)", [from, to]);
}
function unblock(from, to) {
  return db.query("delete from public.message_blocks where blocker_id = $1 and blocked_id = $2", [from, to]);
}

await db.exec("set role anon");
await assert.rejects(db.query("select * from public.message_blocks"), /permission denied/);
await as(bob);
await assert.rejects(send(bob, alice, "https://elsewhere.example/item"), /check constraint/);
await assert.rejects(send(bob, alice, "/shop/../login"), /check constraint/);
await send(bob, alice, "/marketplace/37/item/50");

await as(alice);
assert.deepEqual(
  (await db.query("select item_path from public.direct_messages order by id")).rows.map(row => row.item_path),
  [null, "/marketplace/37/item/50"],
);
assert.equal((await db.query("select count(*)::int as count from public.notifications where type = 'message'")).rows[0].count, 1);
await db.query("update public.direct_messages set read = true where recipient_id = $1", [alice]);
await assert.rejects(db.query("update public.direct_messages set body = 'forged' where recipient_id = $1", [alice]), /permission denied/);
await assert.rejects(block(alice, alice), /check constraint/);
await block(alice, bob);
await assert.rejects(send(alice, bob), /row-level security/);

await as(bob);
assert.deepEqual((await db.query("select blocked_id from public.message_blocks")).rows, []);
assert.equal((await unblock(alice, bob)).affectedRows, 0);
await assert.rejects(block(alice, chris), /row-level security/);
await assert.rejects(send(bob, alice), /row-level security/);
await assert.rejects(send(chris, alice), /row-level security/);
await assert.rejects(db.query("insert into public.notifications values ($1, 'message', 'Fake DM', '/messages')", [alice]), /row-level security/);
await db.query("insert into public.notifications values ($1, 'report', 'Report received', '/admin/reports')", [chris]);
await send(bob, chris);
await block(bob, alice);

await as(alice);
await unblock(alice, bob);
await assert.rejects(send(alice, bob), /row-level security/);
assert.equal((await db.query("select count(*)::int as count from public.notifications where type = 'message'")).rows[0].count, 1);
await as(bob);
await unblock(bob, alice);
await send(bob, alice, "/shop/sample-listing");
await db.close();
console.log("Message blocks, ownership, attachment paths, read status, and notification enforcement passed.");
