import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { once } from 'node:events'
import { RunStore } from '../../plugins/agh/mqtt-audit-tools/run-store.mjs'
import { buildToolDefs } from '../../plugins/agh/mqtt-audit-tools/index.mjs'
import { createProcessServices } from '../../plugins/agh/mqtt-audit-tools/process-services.mjs'
import { planNext, JEV_URL, JEV_MODEL } from '../../plugins/agh/mqtt-audit-tools/jev.mjs'
import { mergeEvents, reduceProcess, eventLabel, buildAuditPrompt } from '../../plugins/agh/mqtt-audit-tools/process-model.mjs'
import { readProcessSession } from '../../plugins/agh/mqtt-audit-tools/dashboard-session.mjs'
import { startHealthMonitor } from '../../plugins/agh/mqtt-audit-tools/health-monitor.mjs'
import { resolveCredentialCandidates, resolveResultsDirectory } from '../../plugins/agh/mqtt-audit-tools/paths.mjs'
import { probePublish, probeSubscribe } from '../../core/prober.mjs'
import { parsePacket, decodePublish } from '../../core/mqtt-client.mjs'

function setup(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'mpa-process-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  return new RunStore(dir)
}
test('fixed reproducible credentials take precedence over legacy env when both exist', t => {
  const root = mkdtempSync(path.join(tmpdir(), 'mpa-paths-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const name of ['reproducible','env']) {
    const dir = path.join(root, '.local', name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'creds.json'), '{}')
  }
  const pluginRoot = path.join(root, 'plugins', 'agh', 'mqtt-audit-tools')
  const candidates = resolveCredentialCandidates(pluginRoot, undefined, root, null)
  assert.equal(candidates[0], path.join(root, '.local', 'reproducible', 'creds.json'))
  assert.equal(resolveResultsDirectory({ root: pluginRoot, workspaceRoot: root, configuredCreds: null }), path.join(root, '.local', 'reproducible', 'agh-runs'))
  assert.equal(resolveCredentialCandidates(pluginRoot, undefined, root, 'explicit-credential-path')[0], 'explicit-credential-path')
})
test('prepare creates no network work; first partial rejected, once-only execution and cross-store instance exclusion', t => {
  const store = setup(t), other = new RunStore(store.directory)
  assert.throws(() => store.prepare({ checkIds:['c1'] }), /initial-run/)
  assert.throws(() => store.prepare({ checkIds:['c9'] }), /invalid-checks/)
  const a = store.prepare(), b = other.prepare()
  const release = store.begin(a.runId)
  assert.throws(() => other.begin(b.runId), /busy/)
  store.emit(a.runId, { type:'run.completed' }); release()
  assert.throws(() => other.begin(a.runId), /already-executed/)
  const child = other.prepare({ parentRunId:a.runId, checkIds:['c3'] })
  assert.equal(child.scope, 'partial'); assert.equal(child.rootRunId, a.runId)
  other.emit(child.runId, { type:'run.failed' })
  const grandchild = store.prepare({ parentRunId:child.runId, checkIds:['c3'] })
  store.emit(grandchild.runId, { type:'run.failed' })
  assert.throws(() => store.prepare({ parentRunId:grandchild.runId }), /retest-limit/)
})
test('event journal incrementally reads 200 entries, deduplicates, detects loss and strips secrets', t => {
  const store = setup(t), {runId} = store.prepare()
  for (let i=0;i<230;i++) store.emit(runId,{ type:'publish.ack', topic:'合成测试主题', password:'SECRET', payload:'PAYLOAD' })
  const first = store.events(runId), next = store.events(runId, first.events.at(-1).seq)
  assert.equal(first.events.length,200); assert.equal(first.hasMore,true)
  // A batch cut at the limit is pagination, not an observation gap; the follow-up
  // batch must clear any transient flag so the panel warning can settle to false.
  assert.equal(first.incomplete,false); assert.equal(next.incomplete,false); assert.equal(next.hasMore,false)
  const merged = mergeEvents(first.events,[...first.events,...next.events],runId)
  assert.equal(merged.events.length,231); assert.equal(merged.incomplete,false)
  const conflicted = mergeEvents(first.events,[{...first.events[0],type:'message.received'}],runId)
  assert.equal(conflicted.incomplete,true)
  assert.equal(conflicted.events[0].type,'run.prepared')
  assert.equal(JSON.stringify(merged).includes('SECRET'),false)
  assert.equal(merged.events.at(-1).topic,'合成测试主题')
  assert.equal(mergeEvents([], [first.events[2]], runId).incomplete,true)
  assert.throws(() => store.events(runId,0,201), /invalid-cursor/)
  const file = store.file(runId,'events.jsonl')
  writeFileSync(file, readFileSync(file,'utf8').split('\n').filter((_,i)=>i!==3).join('\n'))
  assert.equal(store.events(runId).incomplete,true)
  const small = store.prepare()
  store.emit(small.runId,{ type:'run.completed' })
  appendFileSync(store.file(small.runId,'events.jsonl'), '{"runId":"incomplete"')
  assert.equal(store.events(small.runId).incomplete,true)
})
test('dead execution becomes interrupted; stale lock reclaimed without claiming completion', t => {
  const store = setup(t), state = store.prepare()
  store.write(store.file(state.runId,'state.json'), { ...state, status:'running', pid:2147483647 })
  assert.equal(store.status(state.runId).status,'interrupted')
  writeFileSync(path.join(store.directory,'local-isolated.lock'),JSON.stringify({pid:2147483647}))
  const release = store.begin(store.prepare().runId); release()
})
test('queries reject paths, added parameters, unsafe cursor and preserve stale/unknown health', async t => {
  const store = setup(t), {runId} = store.prepare()
  const [status,events,health] = createProcessServices(store.directory)
  assert.equal((await status.handler({runId:'../foo'})).status,'error')
  assert.equal((await events.handler({runId,afterSeq:-1})).status,'error')
  assert.equal((await events.handler({runId,url:'x'})).status,'error')
  assert.equal((await events.handler({runId})).events[0].type,'run.prepared')
  assert.equal((await health.handler({})).stale,true)
  store.write(path.join(store.directory,'health.json'), { monitoring:true, sampledAt:'invalid', sides:{} })
  assert.equal((await health.handler({})).stale,true)
  assert.equal('pid' in (await status.handler({runId})).run,false)
})
test('shared reducer never interprets PUBACK as receipt; denial and delivery are distinct', () => {
  const raw = [
    {type:'check.started',checkId:'c1',action:'publish'},
    {type:'publish.ack',checkId:'c1',side:'source',role:'identity',ok:true},
    {type:'message.timeout',checkId:'c1',side:'source',role:'witness'},
    {type:'verdict',checkId:'c1',side:'source',observed:'unknown'},
    {type:'message.received',checkId:'c1',side:'target',role:'witness'},
    {type:'subscribe.ack',checkId:'c1',side:'target',role:'identity',grants:[128]},
  ].map((e,i)=>({...e,runId:'run-test',seq:i+1,time:new Date(i*100).toISOString()}))
  const live = reduceProcess(raw), replay = reduceProcess(raw,raw.length)
  assert.deepEqual(live,replay)
  assert.equal(live.checks.c1.sides.source.observed,'unknown')
  assert.equal(live.checks.c1.sides.source.roles.witness.received,undefined)
  assert.equal(live.checks.c1.sides.target.roles.witness.received,true)
  assert.equal(live.checks.c1.sides.target.roles.identity.denied,true)
  assert.match(eventLabel(raw[5]),/0x80/)
  assert.equal(reduceProcess(raw,2).checks.c1.sides.target.roles.witness,undefined)
})
test('process session sees prepared run before completion and rejects mismatched session', async () => {
  const nodes = [{kind:'tool',name:'mqtt_audit_prepare_run',status:'completed',seq:1,resultPreview:'{"runId":"run-a"}'},{kind:'tool',name:'mqtt_audit_run_check',status:'running',seq:2,argsPreview:'{"runId":"run-a","password":"PRIVATE"}'}]
  const projection = async () => ({status:'available',value:{sessionId:'a',opState:{phase:'infer'},nodes}})
  const state = await readProcessSession({sessionId:'a',readProjection:projection})
  assert.deepEqual(state.runs,['run-a']); assert.equal(state.busy,true)
  assert.equal(JSON.stringify(state).includes('PRIVATE'),false)
  assert.deepEqual((await readProcessSession({sessionId:'b',readProjection:projection})).runs,[])
  assert.match(buildAuditPrompt({parentRunId:'run-a',checkIds:['c3']}),/parentRunId=run-a/)
  assert.throws(()=>buildAuditPrompt({parentRunId:'../foo',checkIds:['c3']}))
})
test('prepared tool executes selected retest and reports bounded coverage, rejects concurrent reuse', async t => {
  const store = setup(t), creds = path.join(store.directory,'creds.json')
  writeFileSync(creds,'{"auditor":"synthetic"}')
  let selected
  const tools = buildToolDefs({credsPath:creds,resultsDir:store.directory,runAuditImpl:async args => { selected=args.caseSet.checks.map(c=>c.id); return {schema:'mqtt-permission-audit/1',checks:[],summary:{overall:'unknown'}} }})
  const full = (await tools[1].execute({caseId:'migration-baseline'})).structured
  const prepared = (await tools.find(t=>t.name==='mqtt_audit_prepare_run').execute({caseId:'migration-baseline',parentRunId:full.runId,checkIds:['c3']})).structured
  const result = (await tools[1].execute({caseId:'migration-baseline',runId:prepared.runId})).structured
  assert.deepEqual(selected,['c3']); assert.equal(result.coverage,'partial'); assert.equal(result.parentRunId,full.runId)
  assert.equal((await tools[1].execute({caseId:'migration-baseline',runId:prepared.runId})).structured.status,'error')
})
test('Jev disabled/missing key does not call provider and records unavailable, no adoption inference', async t => {
  const store = setup(t), {runId} = store.prepare()
  const fetchImpl = () => { throw new Error('must not call') }
  assert.equal((await planNext({store,runId,env:{},fetchImpl})).reason,'disabled')
  assert.equal((await planNext({store,runId,env:{MQTT_AUDIT_JEV_ENABLED:'true'},fetchImpl})).reason,'missing-key')
  assert.equal(store.events(runId).events.at(-1).type,'jev.unavailable')
})
test('Jev fixed request, sanitized observations, strict choices, max three calls shared by retests', async t => {
  const store = setup(t), {runId} = store.prepare()
  const env = {MQTT_AUDIT_JEV_ENABLED:'true',TYPESAFE_API_KEY:'SYNTHETIC-TEST-KEY'}
  let calls = 0
  const fetchImpl = async (url,request) => {
    calls++; assert.equal(url,JEV_URL)
    assert.equal(request.headers.Authorization,'Bearer SYNTHETIC-TEST-KEY')
    const body = JSON.parse(request.body); assert.equal(body.model,JEV_MODEL)
    assert.equal(request.body.includes('SYNTHETIC-TEST-KEY'),false)
    assert.equal(request.body.includes(store.directory),false)
    const probabilities = Object.fromEntries(Object.keys(body.questions.next_action.criteria).map(key=>[key,key==='evidence'?1:0]))
    return new Response(JSON.stringify({model:JEV_MODEL,answers:{next_action:{type:'choice',choice:'evidence',confidence:1,probabilities}}}), {status:200})
  }
  const first = await planNext({store,runId,env,fetchImpl})
  assert.equal(first.status,'ok'); assert.equal(first.adopted,false)
  store.emit(runId,{type:'run.failed'})
  const child = store.prepare({parentRunId:runId,checkIds:['c3']})
  await planNext({store,runId:child.runId,env,fetchImpl}); await planNext({store,runId:child.runId,env,fetchImpl})
  assert.equal((await planNext({store,runId,env,fetchImpl})).reason,'call-limit')
  assert.equal(calls,3)
  assert.equal(readFileSync(store.file(runId,'events.jsonl'),'utf8').includes('SYNTHETIC-TEST-KEY'),false)
})
test('Jev malformed choice, transport failure and timeout degrade without implicit retries', async t => {
  const store = setup(t), {runId} = store.prepare(), env = {MQTT_AUDIT_JEV_ENABLED:'true',TYPESAFE_API_KEY:'synthetic'}
  let calls=0
  for (const fetchImpl of [async()=>{calls++;return new Response(JSON.stringify({answers:{next_action:{choice:'shell'}}}),{status:200})},async()=>{calls++;throw new Error('network')},async(_,options)=>{calls++;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}))}]) {
    const keepAlive = setTimeout(()=>{},100)
    const result=await planNext({store,runId,env,fetchImpl,timeoutMs:10}); clearTimeout(keepAlive)
    assert.equal(result.status,'unavailable')
  }
  assert.equal(calls,3)
})
test('Jev rejects oversized responses and does not leak the provider body into events', async t => {
  const store = setup(t), { runId } = store.prepare()
  const env = { MQTT_AUDIT_JEV_ENABLED:'true', TYPESAFE_API_KEY:'synthetic' }
  const response = new Response('SECRET-'.repeat(5000), { status:200 })
  const result = await planNext({ store, runId, env, fetchImpl:async()=>response })
  assert.equal(result.status, 'unavailable')
  assert.equal(readFileSync(store.file(runId,'events.jsonl'),'utf8').includes('SECRET-'),false)
})

// A tiny loopback-only protocol fixture exercises the real client/prober I/O.
async function broker(t, mode) {
  const subscribers = new Set(), sockets = new Set()
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close',()=>{sockets.delete(socket);subscribers.delete(socket)})
    socket.on('error',()=>{})
    let buffer=Buffer.alloc(0)
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk])
      for(;;){
        const packet=parsePacket(buffer); if(!packet)break; buffer=buffer.subarray(packet.consumed)
        if(packet.type===1)socket.write(Buffer.from([0x20,2,0,0]))
        if(packet.type===8){subscribers.add(socket);socket.write(Buffer.from([0x90,3,0,1,mode==='deny'?128:0]))}
        if(packet.type===3){
          socket.write(Buffer.from([0x40,2,0,1]))
          if(mode==='deliver'){
            const msg=decodePublish(packet.flags,packet.body),topic=Buffer.from(msg.topic),body=Buffer.concat([Buffer.from([topic.length>>8,topic.length&255]),topic,Buffer.from(msg.payload)])
            for(const recipient of subscribers)recipient.write(Buffer.concat([Buffer.from([0x30,body.length]),body]))
          }
        }
      }
    })
  })
  server.listen(0,'127.0.0.1'); await once(server,'listening')
  t.after(async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve))})
  return {host:'127.0.0.1',port:server.address().port}
}
for(const mode of ['deliver','silent','deny']) test(`real loopback protocol fixture ${mode}: observed events agree with verdict`,async t=>{
  const endpoint=await broker(t,mode),events=[]
  const args={broker:endpoint,identity:'device-sensor',password:'synthetic',witness:'auditor',witnessPassword:'synthetic',publisher:'device-sensor',publisherPassword:'synthetic',topic:'telemetry/up',filter:'telemetry/up',publishTopic:'telemetry/up',tag:'synthetic-correlation',timeouts:{connect:200,ack:200,delivery:30},onEvent:e=>events.push(e)}
  const result=await (mode==='deny'?probeSubscribe(args):probePublish(args))
  assert.equal(result.observed,mode==='deliver'?'allow':mode==='deny'?'deny':'unknown')
  assert.equal(events.some(e=>e.type==='message.received'),mode==='deliver')
  if(mode==='silent'){assert.ok(events.some(e=>e.type==='publish.ack'));assert.ok(events.some(e=>e.type==='message.timeout'))}
  if(mode==='deny')assert.ok(events.some(e=>e.type==='subscribe.ack'&&e.grants.includes(128)))
  assert.equal(JSON.stringify(events).includes('password'),false)
})
test('health sampler does not overlap and aborts active probe on dispose',async t=>{
  const store=setup(t),root=path.resolve('plugins/agh/mqtt-audit-tools')
  const credsPath = path.join(store.directory,'creds.json')
  writeFileSync(credsPath,'{"auditor":"synthetic"}')
  let active=0,maximum=0,aborted=0
  const probe=async({signal,identity,witness,tag})=>{assert.equal(identity,'device-sensor');assert.equal(witness,'auditor');assert.match(tag,/^health:/);active++;maximum=Math.max(maximum,active);return new Promise(resolve=>signal.addEventListener('abort',()=>{active--;aborted++;resolve({observed:'unknown'})},{once:true}))}
  const stop=startHealthMonitor({root,resultsDir:store.directory,credsPath,intervalMs:5,probe})
  await new Promise(resolve=>setTimeout(resolve,30));stop();await new Promise(resolve=>setTimeout(resolve,10))
  assert.equal(maximum,2);assert.equal(active,0);assert.equal(aborted,maximum)
})
test('health snapshot keeps a successful side when the other probe throws', async t => {
  const store=setup(t), root=path.resolve('plugins/agh/mqtt-audit-tools')
  const credsPath=path.join(store.directory,'creds.json')
  writeFileSync(credsPath,'{"auditor":"synthetic","device-sensor":"synthetic"}')
  const probe=async({broker,onEvent})=>{
    if (broker.port === 11883) { onEvent({type:'connect.result',ok:true}); return {observed:'allow'} }
    throw new Error('synthetic probe failure')
  }
  const stop=startHealthMonitor({root,resultsDir:store.directory,credsPath,intervalMs:1000,probe})
  t.after(stop)
  const healthFile=path.join(store.directory,'health.json')
  for (let i=0;i<50 && !existsSync(healthFile);i++) await new Promise(resolve=>setTimeout(resolve,10))
  const snapshot=JSON.parse(readFileSync(healthFile,'utf8'))
  assert.deepEqual({connection:snapshot.sides.source.connection,roundtrip:snapshot.sides.source.roundtrip},{connection:'connected',roundtrip:'received'})
  assert.deepEqual({connection:snapshot.sides.target.connection,roundtrip:snapshot.sides.target.roundtrip},{connection:'unknown',roundtrip:'unknown'})
  assert.equal((await createProcessServices(store.directory)[2].handler({})).stale,false)
  stop()
  const halted=await createProcessServices(store.directory)[2].handler({})
  assert.equal(halted.monitoring,false)
  assert.equal(halted.stale,true)
})
