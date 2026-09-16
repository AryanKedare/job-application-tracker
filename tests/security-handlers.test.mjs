import { test, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { database, memberId, outsiderId } from './database.mjs'
import { handlerEnvironment, request } from './handlers.mjs'

let db
before(async()=>{db=await database()})
beforeEach(async()=>{await db.exec("truncate security_rate_limits, security_work_leases, analysis_report_jobs; update app_memberships set status='active'")})
after(async()=>{await db.close()})

test('admin guesses across workers are throttled before credentials, even with spoofed forwarded IPs',async()=>{
  const environments=await Promise.all([handlerEnvironment(db),handlerEnvironment(db)])
  const routes=await Promise.all(environments.map(e=>e.module('app/api/admin/login/route.ts')))
  const responses=await Promise.all(Array.from({length:30},(_,i)=>routes[i%2].POST(request('/api/admin/login',{email:'wrong',password:'bad'},{'x-forwarded-for':`192.0.2.${i}`}))))
  assert.equal(responses.filter(r=>r.status===401).length,5)
  assert.equal(responses.filter(r=>r.status===429).length,25)
  assert.ok(Number(responses.find(r=>r.status===429).headers.get('retry-after'))>0)
  assert.equal((await routes[0].POST(request('/api/admin/login',{email:'admin@example.test',password:'dummy-password'}))).status,429)
  await db.exec("update security_rate_limits set expires_at=now()-interval '1 second'")
  const valid=await routes[0].POST(request('/api/admin/login',{email:'admin@example.test',password:'dummy-password'}))
  assert.equal(valid.status,200);assert.match(valid.headers.get('set-cookie'),/HttpOnly/)
})

test('protection failures reject admin and AI work without network or model calls',async()=>{
  const e=await handlerEnvironment(db,{rpcError:true})
  const login=await e.module('app/api/admin/login/route.ts')
  assert.equal((await login.POST(request('/api/admin/login',{}))).status,503)
  const route=await e.module('app/api/jobs/import/route.ts')
  assert.equal((await route.POST(request('/api/jobs/import',{url:'https://example.test/job'}))).status,503)
  assert.equal(e.state.httpCalls+e.state.groqCalls,0)
})

test('imports require membership, preserve SSRF checks, and cap repeated paid work',async()=>{
  const e=await handlerEnvironment(db)
  const route=await e.module('app/api/jobs/import/route.ts')
  const call=()=>route.POST(request('/api/jobs/import',{url:'https://example.test/job'}))
  e.state.user=null;assert.equal((await call()).status,401)
  e.state.user={id:outsiderId,user_metadata:{invited_by_admin:true}};assert.equal((await call()).status,403)
  assert.equal(e.state.httpCalls,0)
  e.state.user={id:memberId};e.state.lookupAddress='127.0.0.1';assert.equal((await call()).status,422)
  assert.equal(e.state.httpCalls,0)
  e.state.lookupAddress='93.184.216.34'
  const responses=[];for(let i=0;i<12;i++)responses.push(await call())
  assert.equal(responses.filter(r=>r.status===200).length,5)
  assert.equal(responses.filter(r=>r.status===429).length,7)
  assert.equal(e.state.groqCalls,5)
})

test('logo lookups cannot bypass per-user quotas by varying company text',async()=>{
  await db.query("insert into security_rate_limits values ($1,200,now()+interval '1 day')",[`ai:logo:${memberId}:day`])
  const e=await handlerEnvironment(db),route=await e.module('app/api/company-icon/route.ts')
  for(let i=0;i<5;i++) assert.equal((await route.GET(request(`/api/company-icon?company=Company${i}`,null,{},'GET'))).status,429)
  assert.equal(e.state.groqCalls+e.state.httpCalls,0)
})

test('two isolated analysis workers generate and email at most once',async()=>{
  const a=await handlerEnvironment(db),b=await handlerEnvironment(db)
  const routes=await Promise.all([a.module('app/api/analysis-report/route.ts'),b.module('app/api/analysis-report/route.ts')])
  const responses=await Promise.all(routes.map(route=>route.POST(request('/api/analysis-report',{}, {authorization:'Bearer dummy'}))))
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,429])
  assert.equal(a.state.groqCalls+b.state.groqCalls,1);assert.equal(a.state.emailCalls+b.state.emailCalls,1)
  assert.equal((await db.query('select status from analysis_report_jobs')).rows[0].status,'sent')
})

test('report completion errors are surfaced and failed reservations cannot generate again',async()=>{
  for(const failure of ['metadataError','completionError']) {
    await db.exec('truncate security_rate_limits, analysis_report_jobs')
    const e=await handlerEnvironment(db,{[failure]:true}),route=await e.module('app/api/analysis-report/route.ts')
    const call=()=>route.POST(request('/api/analysis-report',{}, {authorization:'Bearer dummy'}))
    assert.equal((await call()).status,500);assert.equal((await call()).status,429)
    assert.equal(e.state.groqCalls,1)
    assert.equal((await db.query('select status from analysis_report_jobs')).rows[0].status,'failed')
  }
})

test('resume cleanup removes multiple pages and nested folders, and detects storage failures',async()=>{
  const files=Array.from({length:250},(_,i)=>`${memberId}/${i}.pdf`).concat(`${memberId}/old/nested/cv.pdf`)
  const e=await handlerEnvironment(db,{files}),helper=await e.module('@/lib/delete-resumes')
  await helper.deleteResumeFolder(memberId);assert.equal(e.state.files.length,0)
  e.state.files=[`${memberId}/cv.pdf`];e.state.removeError=true
  await assert.rejects(helper.deleteResumeFolder(memberId),/Remove failed/)
  e.state.removeError=false;e.state.stuckStorage=true
  await assert.rejects(helper.deleteResumeFolder(memberId),/cleanup limit/)
})

test('account deletion preserves rows on storage failure and resumes while access stays revoked',async()=>{
  const e=await handlerEnvironment(db,{files:[`${memberId}/cv.pdf`],removeError:true})
  const auth=await e.module('@/lib/admin-auth'),route=await e.module('app/api/admin/users/route.ts')
  const call=()=>{
    const req=request('/api/admin/users',{userId:memberId},{},'DELETE')
    req.cookies.set(auth.ADMIN_COOKIE_NAME,auth.createAdminSessionToken('admin@example.test'))
    return route.DELETE(req)
  }
  assert.equal((await call()).status,500);assert.equal(e.state.deletedUsers,0)
  assert.equal((await db.query('select status from app_memberships where user_id=$1',[memberId])).rows[0].status,'deleting')
  e.state.removeError=false;e.state.deleteUserError=true
  assert.equal((await call()).status,500);assert.equal(e.state.files.length,0)
  e.state.deleteUserError=false;assert.equal((await call()).status,200)
})

test('CSP uses unpredictable nonces in both request and response, including maintenance rewrites',async()=>{
  const e=await handlerEnvironment(db),proxy=await e.module('proxy.ts')
  const a=proxy.proxy(request('/login',null,{},'GET')),b=proxy.proxy(request('/login',null,{},'GET'))
  const csp=a.headers.get('content-security-policy')
  assert.doesNotMatch(csp.split(';').find(s=>s.includes('script-src')),/unsafe-inline|unsafe-eval/)
  assert.notEqual(csp,b.headers.get('content-security-policy'))
  assert.equal(csp,a.headers.get('x-middleware-request-content-security-policy'))
  assert.match(a.headers.get('cache-control'),/no-store/)
  e.env.MAINTENANCE_MODE='true'
  const maintenance=proxy.proxy(request('/jobs',null,{},'GET'))
  assert.match(maintenance.headers.get('x-middleware-rewrite'),/maintenance/)
  assert.ok(maintenance.headers.get('content-security-policy'))
})
