import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { database, asUser, memberId, outsiderId } from './database.mjs'

let db
before(async () => { db = await database() })
after(async () => { await db.close() })

test('only Auth invitations create membership; editable invitation flags do not', async () => {
  assert.equal((await db.query('select * from app_memberships')).rows.length, 1)
  const id = '33333333-3333-4333-8333-333333333333'
  await db.query('insert into auth.users values ($1, now(), $2)', [id, '{}'])
  assert.equal((await db.query('select * from app_memberships where user_id=$1', [id])).rows.length, 1)
  await assert.rejects(asUser(db, outsiderId, `insert into app_memberships(user_id) values ('${outsiderId}')`), /permission denied/)
  await assert.rejects(asUser(db, outsiderId, `select consume_security_budget('[]')`), /permission denied/)
  await assert.rejects(asUser(db, outsiderId, `select reserve_ai_work('${outsiderId}', 'import')`), /permission denied/)
  await assert.rejects(asUser(db, outsiderId, `select reserve_analysis_report('${outsiderId}')`), /permission denied/)
})

test('RLS enforces membership AND ownership for applications, stages, history and resumes', async () => {
  const result = await asUser(db, memberId, `insert into job_applications(user_id,job_title) values ('${memberId}','Engineer') returning id`)
  const id = result.rows[0].id
  await asUser(db, memberId, `insert into application_stages(application_id,user_id,name) values ('${id}','${memberId}','Interview')`)
  await asUser(db, memberId, `insert into storage.objects(bucket_id,name) values ('resumes','${memberId}/cv.pdf')`)
  for (const table of ['job_applications','application_stages','application_stage_events','storage.objects']) {
    assert.ok((await asUser(db, memberId, `select * from ${table}`)).rows.length > 0)
    assert.equal((await asUser(db, outsiderId, `select * from ${table}`)).rows.length, 0)
  }
  await assert.rejects(asUser(db, outsiderId, `insert into job_applications(user_id,job_title) values ('${outsiderId}','Intruder')`), /row-level security/)
  await assert.rejects(asUser(db, outsiderId, `insert into storage.objects(bucket_id,name) values ('resumes','${outsiderId}/cv.pdf')`), /row-level security/)
  await asUser(db, outsiderId, `update job_applications set job_title='Changed' where id='${id}'`)
  assert.equal((await db.query('select job_title from job_applications where id=$1',[id])).rows[0].job_title, 'Engineer')
  await db.query("update app_memberships set status='deleting' where user_id=$1",[memberId])
  assert.equal((await asUser(db, memberId, 'select * from job_applications')).rows.length, 0)
  await assert.rejects(asUser(db, memberId, `insert into storage.objects(bucket_id,name) values ('resumes','${memberId}/new.pdf')`), /row-level security/)
  await db.query("update app_memberships set status='active' where user_id=$1",[memberId])
})

test('shared atomic budgets stop parallel bursts and permit requests after expiry', async () => {
  const rules = [{key:'test:account',limit:5,seconds:60},{key:'test:ip',limit:10,seconds:900}]
  const calls = await Promise.all(Array.from({length:30},()=>db.query('select consume_security_budget($1::jsonb) as retry',[JSON.stringify(rules)])))
  assert.equal(calls.filter(r=>r.rows[0].retry===0).length,5)
  assert.equal((await db.query("select count from security_rate_limits where key='test:ip'")).rows[0].count,5)
  await db.exec("update security_rate_limits set expires_at=now()-interval '1 second'")
  assert.equal((await db.query('select consume_security_budget($1::jsonb) as retry',[JSON.stringify(rules)])).rows[0].retry,0)
})

test('AI reservations enforce membership, per-user concurrency, daily and global budgets', async () => {
  await db.exec('truncate security_rate_limits, security_work_leases')
  const reserve = id => db.query("select reserve_ai_work($1, 'import') as result",[id]).then(r=>r.rows[0].result)
  assert.equal((await reserve(outsiderId)).denied,true)
  const leases = await Promise.all(Array.from({length:12},()=>reserve(memberId)))
  assert.equal(leases.filter(r=>r.lease_id).length,3)
  await db.exec('truncate security_work_leases')
  await db.query("insert into security_rate_limits values ($1,40,now()+interval '1 day') on conflict(key) do update set count=40",[`ai:import:${memberId}:day`])
  assert.ok((await reserve(memberId)).retry_after>0)
  await db.exec("truncate security_rate_limits; insert into security_rate_limits values ('ai:global:day',1000,now()+interval '1 day')")
  assert.ok((await reserve(memberId)).retry_after>0)
  assert.equal((await db.query('select * from security_work_leases')).rows.length,0)
})

test('analysis reservations prevent duplicate workers, boundary races, and monthly retries after failure', async () => {
  const reserve = period => db.query('select reserve_analysis_report($1,$2) as id',[memberId,period]).then(r=>r.rows[0].id)
  const results=await Promise.all(Array.from({length:8},()=>reserve(null)))
  assert.equal(results.filter(Boolean).length,1)
  await db.exec("update analysis_report_jobs set window_key='manual:previous-window', status='failed'")
  assert.equal(await reserve(null),null)
  await db.exec("update analysis_report_jobs set created_at=now()-interval '16 minutes'")
  assert.ok(await reserve('2026-09'))
  await db.exec("update analysis_report_jobs set created_at=now()-interval '16 minutes',status='failed'")
  assert.equal(await reserve('2026-09'),null)
})
