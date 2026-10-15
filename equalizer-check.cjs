/* TugLife FM — teste do equalizador e do disco (equalizer.js)
   Versão 3.11.0 (SPRINT 30) · 2026-10-15T20:30:00-03:00 · Jossian Brito
   v3.11.0 [MOD] Espectro circular → 20 barras em linha ao lado do disco:
           - o tom de 440 Hz acende mais a barra 7 (faixa 376–502 Hz);
           - repouso = perfil estático (não mais 0,035 em todas);
           - o disco (#radio-disc) gira só tocando, para na pausa e
             não anima com movimento reduzido.
           Navegador: Edge por padrão; PW_CHROME=<caminho do Chromium> usa outro.
   Uso: python3 server.py (outro terminal) → node equalizer-check.cjs */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
// Real decoded PCM test signal; the analyser itself is not mocked.
function tone() {
 const rate=44100, samples=rate*120, b=Buffer.alloc(44+samples*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);
 b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);
 b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);
 for(let i=0;i<samples;i++) b.writeInt16LE(Math.round(12000*Math.sin(2*Math.PI*440*i/rate)),44+i*2);
 return b;
}
(async()=>{
 const b=await chromium.launch(process.env.PW_CHROME ? {executablePath:process.env.PW_CHROME} : {channel:'msedge',headless:true});
 const p=await b.newPage(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://**/*',r=>r.request().url().includes(':7098/live') ? r.fulfill({status:200,contentType:'audio/wav',headers:{'Access-Control-Allow-Origin':'*'},body:tone()}) : r.abort());
 await p.goto('http://localhost:8787',{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.querySelectorAll('#spectrum-bars span').length===20);
 const rest=await p.evaluate(()=>[...document.querySelectorAll('#spectrum-bars span')].map(e=>e.style.transform));
 const atRest=()=>p.waitForFunction(r=>[...document.querySelectorAll('#spectrum-bars span')].every((e,i)=>e.style.transform===r[i]),rest);
 assert.equal(new Set(rest).size>1,true,'repouso tem perfil (barras de alturas diferentes)');
 const spinning=()=>p.evaluate(()=>{const d=document.getElementById('radio-disc');const a=d.getAnimations()[0];return {cls:d.classList.contains('is-spinning'),state:a?a.playState:'none'};});
 assert.deepEqual(await spinning(),{cls:false,state:'paused'},'disco parado no standby');
 await p.locator('#btn-play').click();
 // espera o analisador assumir: status ao vivo e a barra 7 acima do pico de repouso (0,38)
 await p.waitForFunction(()=>document.getElementById('spectrum-status').textContent.includes('Frequências') && Number(document.querySelectorAll('#spectrum-bars span')[7].style.transform.match(/[\d.]+/)[0])>.5);
 assert.equal(await p.locator('#spectrum-bars span').count(),20);
 assert.equal(await p.locator('.spectrum-deck > #radio-disc + #spectrum-bars').count(),1,'disco à esquerda, equalizador à direita');
 const pico=await p.evaluate(()=>{const v=[...document.querySelectorAll('#spectrum-bars span')].map(e=>Number(e.style.transform.match(/[\d.]+/)[0]));return v.indexOf(Math.max(...v));});
 assert.equal(pico,7,'440 Hz acende a barra 7 (376–502 Hz)');
 assert.deepEqual(await spinning(),{cls:true,state:'running'},'disco girando com a rádio tocando');
 const lado=await p.evaluate(()=>{const d=document.getElementById('radio-disc').getBoundingClientRect(),e=document.getElementById('spectrum-bars').getBoundingClientRect();return {esq:d.right<=e.left, centro:Math.abs((d.top+d.bottom)/2-(e.top+e.bottom)/2)};});
 assert.equal(lado.esq,true,'equalizador à direita do disco');
 console.log('PASS: real PCM analysis, 440 Hz na barra 7, disco girando');
 await p.emulateMedia({reducedMotion:'reduce'});
 console.log(await p.evaluate(()=>({label:document.getElementById('spectrum-status').textContent, paused:document.getElementById('radio-stream').paused, time:document.getElementById('radio-stream').currentTime, reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}))); 
 await p.waitForFunction(()=>document.getElementById('spectrum-status').textContent.includes('Movimento reduzido'));
 await atRest();
 assert.equal(await p.evaluate(()=>getComputedStyle(document.getElementById('radio-disc')).animationName),'none','movimento reduzido: disco sem animação');
 await p.emulateMedia({reducedMotion:'no-preference'});
 await p.locator('#btn-play').click();
 await atRest();
 assert.deepEqual(await spinning(),{cls:false,state:'paused'},'disco para na pausa');
 for(const width of [360,768,1440]){await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await p.locator('#btn-play').click();
 await p.waitForFunction(()=>document.getElementById('spectrum-status').textContent.includes('Frequências'));
 if(process.argv[2]) await p.screenshot({path:`${process.argv[2]}/tuglife-v3.11-disco.png`,fullPage:true});
 assert.deepEqual(errors,[]);
 const fallback=await b.newPage();
 await fallback.route('https://**/*',r=>r.request().url().includes(':7098/live') && r.request().resourceType()==='media' ? r.fulfill({status:200,contentType:'audio/wav',body:tone()}) : r.abort());
 await fallback.goto('http://localhost:8787',{waitUntil:'domcontentloaded'});
 await fallback.locator('#btn-play').click();
 await fallback.waitForFunction(()=>!document.getElementById('radio-stream').paused && document.getElementById('spectrum-status').textContent==='Visualização indisponível');
 assert.equal(await fallback.evaluate(()=>document.getElementById('radio-disc').classList.contains('is-spinning')),true,'sem CORS o disco gira igual');
 assert.equal(await fallback.evaluate(()=>RadioAudio.analyser),undefined);
 console.log('PASS: pause, resume, reduced motion, responsive layout, CORS failure keeps direct playback.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
