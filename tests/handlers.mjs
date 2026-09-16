import fs from 'node:fs/promises'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as crypto from 'node:crypto'
import { isIP } from 'node:net'
import { EventEmitter } from 'node:events'
import { NextRequest, NextResponse } from 'next/server.js'
import { z } from 'zod'
import { memberId } from './database.mjs'

export { NextRequest }
export const request = (path, body, headers = {}, method = 'POST') => new NextRequest(`https://tracker.test${path}`, {
  method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body ? { body: JSON.stringify(body) } : {}),
})

export async function handlerEnvironment(db, overrides = {}) {
  const state = { user: {id:memberId,email:'test@example.test',email_confirmed_at:'2026-01-01',user_metadata:{},app_metadata:{}},
    groqCalls:0, httpCalls:0, emailCalls:0, files:[], deletedUsers:0, lookupAddress:'93.184.216.34', ...overrides }
  const env = { NODE_ENV:'production', ADMIN_EMAIL:'admin@example.test', ADMIN_PASSWORD:'dummy-password', ADMIN_SESSION_SECRET:'test-secret-'.repeat(4),
    NEXT_PUBLIC_SUPABASE_URL:'https://test-project.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY:'dummy-key', ...overrides.env }
  const context = vm.createContext({ console, Buffer, URL, URLSearchParams, Headers, TextDecoder, Uint8Array, setTimeout, clearTimeout, process:{env} })
  const cache = new Map()
  const client = {
    async rpc(name, args) {
      if (state.rpcError) return {data:null,error:{code:'unavailable'}}
      const params = Object.values(args).map(v=>typeof v==='object' && v!==null ? JSON.stringify(v):v)
      const query = `select public.${name}(${params.map((_,i)=>`$${i+1}`).join(',')}) as result`
      const result = await db.query(query,params)
      return {data:result.rows[0].result,error:null}
    },
    auth: {getUser:async()=>({data:{user:state.user},error:null}), admin:{
      updateUserById:async()=>({error:state.metadataError ? {message:'failed'}:null}),
      deleteUser:async()=>{ state.deletedUsers++; return {error:state.deleteUserError ? {message:'failed'}:null} },
    }},
    from(table) {
      const filters=[]; let operation='select'; let values; let singular=false
      const builder={
        select(){return builder}, order(){return builder}, limit(){return builder},
        eq(key,value){filters.push([key,value]);return builder},
        maybeSingle(){singular=true;return builder}, single(){singular=true;return builder},
        delete(){operation='delete';return builder}, update(value){operation='update';values=value;return builder},
        upsert(value){operation='upsert';values=value;return builder},
        then(resolve,reject){
          const run=async()=>{
            if(table==='job_applications' || table==='application_stages') {
              if(operation!=='select') throw new Error('Deletion must use the Auth cascade')
              return {data:table==='job_applications'?[{id:'job'}]:[],error:null}
            }
            if(state.membershipError && table==='app_memberships') return {data:null,error:{code:'unavailable'}}
            if(state.completionError && table==='analysis_report_jobs' && values?.status==='sent') return {data:null,error:{code:'unavailable'}}
            const params=filters.map(([,v])=>v)
            const where=filters.length?' where '+filters.map(([k],i)=>`${k}=$${i+1}`).join(' and '):''
            let sql=`select * from ${table}${where}`
            if(operation==='delete') sql=`delete from ${table}${where} returning *`
            if(operation==='update') {
              const pairs=Object.entries(values).map(([key,value])=>{params.push(value);return `${key}=$${params.length}`})
              sql=`update ${table} set ${pairs.join(',')}${where} returning *`
            }
            if(operation==='upsert') {
              const keys=Object.keys(values);params.length=0;params.push(...Object.values(values))
              sql=`insert into ${table}(${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) on conflict(user_id) do update set status=excluded.status returning *`
            }
            const result=await db.query(sql,params)
            return {data:singular?result.rows[0]??null:result.rows,error:null}
          }
          return run().then(resolve,reject)
        },
      }
      return builder
    },
    storage:{from:()=>({
      list:async(prefix,{offset,limit})=>{
        if(state.listError) return {data:null,error:new Error('List failed')}
        const entries=new Map()
        for(const path of state.files) {
          if(!path.startsWith(prefix+'/')) continue
          const relative=path.slice(prefix.length+1),name=relative.split('/')[0]
          entries.set(name,{name,id:relative.includes('/')?null:path})
        }
        return {data:[...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(offset,offset+limit),error:null}
      },
      remove:async paths=>{
        if(state.removeError) return {error:new Error('Remove failed')}
        if(!state.stuckStorage) state.files=state.files.filter(p=>!paths.includes(p))
        return {error:null}
      },
    })},
  }
  function fakeHttp(options,callback) {
    void options
    state.httpCalls++
    const req=new EventEmitter();req.destroy=error=>req.emit('error',error)
    req.end=()=>queueMicrotask(()=>{
      const res=new EventEmitter();res.statusCode=200;res.headers={'content-type':'text/html'}
      res.destroy=error=>res.emit('error',error);callback(res)
      res.emit('data',Buffer.from('<html><title>Engineer role</title><body>Example company seeks an engineer to build and maintain its software products. Apply for this position today.</body></html>'))
      res.emit('end')
    })
    return req
  }
  const mocks={
    'next/server':{NextRequest,NextResponse}, 'next/headers':{cookies:async()=>({getAll:()=>[],set(){}})},
    '@supabase/supabase-js':{createClient:()=>client}, '@supabase/ssr':{createServerClient:()=>client},
    '@/lib/admin-supabase':{getAdminSupabase:()=>client}, 'node:crypto':crypto, 'node:net':{isIP}, zod:{z},
    'node:dns/promises':{lookup:async()=>[{address:state.lookupAddress,family:4}]},
    'node:http':{request:fakeHttp}, 'node:https':{request:fakeHttp},
    '@/lib/groq':{
      groqJson:async()=>{state.groqCalls++;return {model:'mock',data:{job_title:'Engineer',company:'Example',executive_summary:'Summary',strengths:[],bottlenecks:[],patterns:[],recommendations:[],next_7_days:[]}}},
      groqWebJson:async()=>{state.groqCalls++;return null},
    },
    '@/lib/application-analysis':{buildApplicationAnalysisSnapshot:()=>({totalApplications:1,statusCounts:{},sourcePerformance:[],rejectionStages:[],monthlyActivity:[],recentApplications:[]})},
    '@/lib/analysis-pdf':{buildApplicationAnalysisPdf:()=>Buffer.from('mock pdf')},
    '@/lib/resend-broadcast':{getResendConfig:()=>({from:'dummy'}),sendPdfEmail:async()=>{state.emailCalls++}},
  }
  async function load(id) {
    if(cache.has(id)) return cache.get(id)
    const pending = (async () => {
    let mod
    if(id in mocks) {
      const values=mocks[id]
      mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v)},{context,identifier:id})
    } else {
      const file=id.startsWith('@/')?`${id.slice(2)}.ts`:id
      const source=stripTypeScriptTypes(await fs.readFile(new URL('../'+file,import.meta.url),'utf8'),{mode:'transform'})
      mod=new vm.SourceTextModule(source,{context,identifier:id})
    }
    await mod.link(load);return mod
    })()
    // Cache the promise before asynchronous file reads: shared imports must use
    // one module instance even when the VM linker requests them concurrently.
    cache.set(id,pending)
    return pending
  }
  return {state,env,async module(id){const mod=await load(id);if(mod.status!=='evaluated')await mod.evaluate();return mod.namespace}}
}
