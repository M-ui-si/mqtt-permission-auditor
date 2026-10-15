// Synthetic browser harness using the actual plugin components. Not AGH/model evidence.
import { build } from '../../vendor/agnes-harness/node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
const root=path.resolve('.'),base=path.join(root,'plugins/agh/mqtt-audit-tools/extensions/dashboard/client')
const events=[
 {type:'run.prepared'}, {type:'run.started'},
 {type:'health.observed',side:'source',ok:true},{type:'health.observed',side:'target',ok:true},
 {type:'check.started',checkId:'c3',identity:'device-sensor',topic:'factory/admin/secret',action:'publish'},
 {type:'connect.result',checkId:'c3',side:'source',role:'witness',ok:true},
 {type:'connect.result',checkId:'c3',side:'source',role:'identity',ok:true},
 {type:'publish.request',checkId:'c3',side:'source',role:'identity',topic:'factory/admin/secret'},
 {type:'publish.ack',checkId:'c3',side:'source',role:'identity',ok:true},
 {type:'message.timeout',checkId:'c3',side:'source',role:'witness'},
 {type:'verdict',checkId:'c3',side:'source',observed:'unknown'},
 {type:'connect.result',checkId:'c3',side:'target',role:'identity',ok:true},
 {type:'publish.request',checkId:'c3',side:'target',role:'identity'},
 {type:'publish.ack',checkId:'c3',side:'target',role:'identity',ok:true},
 {type:'message.received',checkId:'c3',side:'target',role:'witness',topic:'factory/admin/secret'},
 {type:'verdict',checkId:'c3',side:'target',observed:'allow'},
 {type:'check.ended',checkId:'c3',requirement:'fail'}, {type:'run.completed'},
].map((e,i)=>({...e,runId:'run-synthetic',seq:i+1,time:new Date(Date.UTC(2026,9,13,8,0,0)+i*150).toISOString()}))
const source=`
import {createElement as h} from 'react';
import {createRoot} from 'react-dom/client';
import {apply} from '../plugins/agh/mqtt-audit-tools/extensions/dashboard/client/index.js';
const events=${JSON.stringify(events)};
const roots=[],listeners=new Set(),projections=new Set(),prompts=[];
let sessionId='synthetic', delayed, slow=false;
const nodes=[{kind:'tool',name:'mqtt_audit_prepare_run',seq:1,status:'completed',resultPreview:'{"runId":"run-synthetic"}'},{kind:'tool',name:'mqtt_audit_run_check',seq:2,status:'completed',resultPreview:'{"runId":"run-synthetic"}'}];
const result={schema:'mqtt-permission-audit/1',runId:'run-synthetic',generatedAt:new Date().toISOString(),checks:[{checkId:'c3',identity:'device-sensor',action:'publish',topic:'factory/admin/secret',expect:'deny',requirement:'fail',sides:{source:{observed:'unknown'},target:{observed:'allow'}},evidence:{source:{puback:true,witnessReceived:false},target:{puback:true,witnessReceived:true}}}],summary:{overall:'fail'},caseSet:{id:'synthetic'}};
const ctx={session:{get sessionId(){return sessionId},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},projection:{read:async()=>({status:'available',value:{sessionId,nodes:sessionId==='empty'?[]:nodes,turns:[],opState:null}}),subscribe(fn){projections.add(fn);return()=>projections.delete(fn)}},commands:{prompt:async input=>{prompts.push(input);return {ok:true}}}},agnes:{services:{call:async(name,input)=>{
if(name==='mqtt.audit.health')return {status:'ok',mode:'Agnes',sampledAt:new Date().toISOString(),sides:{source:{connection:'connected',roundtrip:'received'},target:{connection:'connected',roundtrip:'received'}}};
if(slow&&name==='mqtt.audit.runstatus')return new Promise(resolve=>delayed=resolve);
if(name==='mqtt.audit.runstatus')return {status:'ok',run:{runId:input.runId,status:'completed',checkIds:['c3'],scope:'partial',round:0}};
if(name==='mqtt.audit.events')return {status:'ok',events:events.filter(e=>e.seq>input.afterSeq),lastSeq:events.length};
return {status:'ok',result};
}}},slots:{register(name,Component){const el=document.querySelector('[data-mount="'+name+'"]'),root=createRoot(el);root.render(h(Component));roots.push(root)}}};
const pause=(ms=80)=>new Promise(resolve=>setTimeout(resolve,ms));
const button=text=>[...document.querySelectorAll('button')].find(el=>el.textContent===text);
const check=(ok,message)=>{if(!ok)throw new Error(message)};
localStorage.clear();apply(ctx,{});await pause(200);
if(location.hash==='#full'){document.querySelector('[aria-label="全屏查看"]').click();}
if(location.hash==='#test')try{
check(document.querySelectorAll('.mpa-topology').length===2,'two independent brokers');
check(document.querySelector('.mpa-topology').textContent.includes('无法判定'),'source PUBACK no delivery stays unknown');
check(document.querySelectorAll('.mpa-flow-path.is-delivered').length===1,'only witnessed path delivered');
document.querySelector('.mpa-flow-node').dispatchEvent(new MouseEvent('click',{bubbles:true}));await pause();
check(document.querySelector('.mpa-process-evidence').open,'node evidence expanded');
button('暂停画面').click();await pause();check(document.querySelector('.mpa-run-progress').textContent.includes('历史回放'),'visual pause');
const slider=document.querySelector('input[type=range]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
set.call(slider,'9');slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));await pause();
check(document.querySelectorAll('.mpa-flow-path.is-delivered').length===0,'seek before witness has no delivered path');
button('下一送达').click();await pause();check(document.querySelectorAll('.mpa-flow-path.is-delivered').length===1,'jump actual receipt');
button('单步').click();await pause();check(document.querySelector('input[type=range]').value==='16','step event');
button('实时').click();await pause();check(prompts.length===0,'playback never executes');
button('发起验收').click();button('发起验收').click();await pause();check(prompts.length===1,'duplicate submission blocked');check(prompts[0].text.includes('mqtt_audit_prepare_run'),'goal through AGH prompt');
document.querySelector('[aria-label="全屏查看"]').click();await pause();check(document.querySelector('[role=dialog]'),'full screen');
document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await pause();check(!document.querySelector('[role=dialog]'),'escape');
document.querySelector('.mpa-shell-toggle').click();await pause();document.querySelector('.mpa-sidebar-entry').click();await pause();
slow=true;sessionId='slow';for(const fn of listeners)fn();await pause();sessionId='empty';for(const fn of listeners)fn();await pause();
delayed?.({status:'ok',run:{runId:'run-synthetic',status:'completed'}});await pause();check(document.querySelectorAll('.mpa-flow-path.is-delivered').length===0,'session late-response isolation');
for(const root of roots)root.unmount();await pause();check(!listeners.size&&!projections.size,'dispose subscriptions');
document.querySelector('#result').textContent='PASS: topology, unknown, receipt, evidence, pause, seek, jump, step, no execution on replay, prompt, duplicate guard, fullscreen, Escape, collapse, session race, dispose';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack}
`
const compiled=await build({stdin:{contents:source,resolveDir:path.join(root,'.local')},bundle:true,format:'esm',write:false,alias:{react:path.join(root,'vendor/agnes-harness/node_modules/.pnpm/react@18.3.1/node_modules/react'),'react-dom':path.join(root,'vendor/agnes-harness/node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom')}})
const css=['index.css','official-shell.css','process.css'].map(file=>readFileSync(path.join(base,file),'utf8')).join('\n')
mkdirSync('.local',{recursive:true})
writeFileSync('.local/process-preview.html',`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>MQTT 过程 · 合成浏览器验证</title><style>*{box-sizing:border-box}body{margin:0;font:14px 'Segoe UI','Microsoft YaHei',sans-serif;background:#fafafa;color:#242534}#main-content{padding:40px}.preview-chat{max-width:600px}#result{position:fixed;bottom:0;background:#fff;z-index:999;font-size:11px}${css}</style><main id="main-content"><h1>Agnes Harness</h1><div class="preview-chat"><h2>验收本地 MQTT 权限迁移</h2><p>目标端见证者收到了管理主题上的合成消息，不符合业务要求。源端只有 PUBACK，没有送达，也没有明确主题级拒绝证据，因此仍是 unknown。</p><p>此页面使用合成数据，仅验证真实插件组件，不作为模型接入证据。</p><div data-mount="sidebar.panellist"></div></div></main><aside data-agnes-region="rightbar"><div data-mount="rightbar"></div></aside><div data-mount="shell.overlay"></div><output id="result"></output><script type="module">${compiled.outputFiles[0].text}</script></html>`)
console.log('Built .local/process-preview.html (synthetic browser harness)')
