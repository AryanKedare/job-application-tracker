import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

export const memberId = '11111111-1111-4111-8111-111111111111'
export const outsiderId = '22222222-2222-4222-8222-222222222222'

export async function database() {
  const db = new PGlite()
  // Supabase owns these schemas/roles in production. Only its platform surface
  // is stubbed here; the complete application SQL and RLS execute in PostgreSQL.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, invited_at timestamptz, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
    grant usage on schema public, auth, storage to anon, authenticated, service_role;
    grant all on storage.objects to authenticated, service_role;
    insert into auth.users values ('${memberId}', now(), '{}'), ('${outsiderId}', null, '{"invited_by_admin":true}');
  `)
  const sql = (await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8'))
    .replace('create extension if not exists pgcrypto;', '-- gen_random_uuid is built into PostgreSQL')
  await db.exec(sql)
  await db.exec(sql) // Supported, idempotent upgrade path.
  return db
}

export async function asUser(db, userId, sql) {
  return db.transaction(async tx => {
    await tx.exec('set local role authenticated')
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId])
    return tx.query(sql)
  })
}
