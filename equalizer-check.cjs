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
 const b=await chromium.launch({channel:'msedge',headless:true});
 const p=await b.newPage(); const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://**/*',r=>r.request().url().includes(':7098/live') ? r.fulfill({status:200,contentType:'audio/wav',headers:{'Access-Control-Allow-Origin':'*'},body:tone()}) : r.abort());
 await p.goto('http://localhost:8787',{waitUntil:'domcontentloaded'});
 await p.locator('#btn-play').click();
 await p.waitForFunction(()=>Array.from(document.querySelectorAll('#spectrum-bars span')).some(e=>Number(e.style.transform.match(/[\d.]+/)[0])>.1));
 assert.equal(await p.locator('#spectrum-bars span').count(),32);
 console.log('PASS: decoded 440 Hz PCM drives real AnalyserNode bars');
 await p.emulateMedia({reducedMotion:'reduce'});
 console.log(await p.evaluate(()=>({label:document.getElementById('spectrum-status').textContent, paused:document.getElementById('radio-stream').paused, time:document.getElementById('radio-stream').currentTime, reduced:matchMedia('(prefers-reduced-motion: reduce)').matches}))); 
 await p.waitForFunction(()=>document.getElementById('spectrum-status').textContent.includes('Movimento reduzido'));
 await p.waitForFunction(()=>Array.from(document.querySelectorAll('#spectrum-bars span')).every(e=>e.style.transform==='scaleY(0.035)'));
 await p.emulateMedia({reducedMotion:'no-preference'});
 await p.locator('#btn-play').click();
 await p.waitForFunction(()=>Array.from(document.querySelectorAll('#spectrum-bars span')).every(e=>e.style.transform==='scaleY(0.035)'));
 for(const width of [360,768,1440]){await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
 await p.locator('#btn-play').click();
 await p.waitForFunction(()=>document.getElementById('spectrum-status').textContent.includes('Frequências'));
 await p.screenshot({path:'../../outputs/tuglife-v2.3-equalizador.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const fallback=await b.newPage();
 await fallback.route('https://**/*',r=>r.request().url().includes(':7098/live') && r.request().resourceType()==='media' ? r.fulfill({status:200,contentType:'audio/wav',body:tone()}) : r.abort());
 await fallback.goto('http://localhost:8787',{waitUntil:'domcontentloaded'});
 await fallback.locator('#btn-play').click();
 await fallback.waitForFunction(()=>!document.getElementById('radio-stream').paused && document.getElementById('spectrum-status').textContent==='Visualização indisponível');
 assert.equal(await fallback.evaluate(()=>RadioAudio.analyser),undefined);
 console.log('PASS: pause, resume, reduced motion, responsive layout, CORS failure keeps direct playback.');
 await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
