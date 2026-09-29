const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.goto('http://localhost:8787',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>navigator.serviceWorker.ready);
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 const manifest=await page.evaluate(async()=> (await fetch('manifest.webmanifest')).json());
 assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,2);
 for (const width of [360,390,768,1440]) {
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.locator('#share-radio').click();
 assert.equal(await page.locator('#share-dialog').evaluate(e=>e.open),true);
 assert.equal(await page.locator('#share-url').inputValue(),'https://radiotuglifefm.netlify.app/');
 assert.ok(await page.locator('.share-qr').evaluate(e=>e.complete&&e.naturalWidth>0));
 await page.locator('#copy-link').click();
 await page.waitForFunction(()=>document.getElementById('share-status').textContent==='Link copiado!');
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://radiotuglifefm.netlify.app/');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'../../outputs/tuglife-v2.4-qrcode.png',fullPage:true});
 await page.keyboard.press('Escape');
 await page.locator('#install-app').click();
 assert.equal(await page.locator('#install-dialog').evaluate(e=>e.open),true);
 await page.locator('[aria-label="Fechar instruções"]').click();
 await page.evaluate(()=>{
   window.promptCount=0;const event=new Event('beforeinstallprompt',{cancelable:true});
   event.prompt=async()=>{window.promptCount++;};event.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(event);
 });
 await page.locator('#install-app').click();assert.equal(await page.evaluate(()=>window.promptCount),1);
 await context.setOffline(true);
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForSelector('#network-status:visible');
 assert.equal(await page.locator('#schedule-days button').count(),7);
 assert.ok(await page.locator('.official-cover img').evaluate(e=>e.complete&&e.naturalWidth>0));
 await page.screenshot({path:'../../outputs/tuglife-v2.4-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const cdp=await context.newCDPSession(page);
 const details=await cdp.send('Page.getAppManifest');
 assert.deepEqual(details.errors,[]);
 console.log('PASS: manifest, assets, 4 widths, QR dialog, clipboard, manual/native install flow, offline shell and schedule. OS installation not performed.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
