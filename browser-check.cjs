const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 const page = await browser.newPage();
 const errors=[]; page.on('pageerror', e => errors.push(e.message));
 await page.route('https://**/*', route => route.abort());
 await page.goto('http://localhost:8787', {waitUntil:'domcontentloaded'});
 await page.evaluate(() => {
   const audio=document.getElementById('radio-stream');
   window.playCalls=0;
   audio.load=()=>{};
   audio.play=()=>{window.playCalls++;audio.dispatchEvent(new Event('playing'));return Promise.resolve();};
 });
 for (const width of [360,390,768,1440]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);
 }
 assert.equal(await page.locator('#mariner-panel').getAttribute('open'),null);
 assert.equal(await page.locator('#map-view iframe').count(),0);
 await page.locator('#mariner-panel summary').click();
 await page.waitForSelector('#map-view iframe');
 await page.locator('#mariner-panel summary').click();
 await page.getByRole('button',{name:'Sábado',exact:true}).click();
 assert.equal(await page.locator('#schedule-list li').count(),13);
 await page.getByRole('button',{name:'Hoje',exact:true}).click();
 assert.ok(await page.locator('.program-duration').textContent());
 await page.setViewportSize({width:390,height:844});
 await page.locator('#mini-play').click();
 assert.equal(await page.evaluate(()=>window.playCalls),1);
 assert.equal(await page.locator('#mini-status').textContent(),'Você está ouvindo');
 await page.evaluate(()=>document.getElementById('radio-stream').dispatchEvent(new Event('error')));
 assert.match(await page.locator('#mini-status').textContent(),/Sem conexão/);
 await page.evaluate(()=>document.getElementById('radio-stream').dispatchEvent(new Event('pause')));
 await page.screenshot({path:'../../outputs/tuglife-v2.2-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Alternar tema claro e escuro'}).click();
 assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('light-theme')),true);
 await page.screenshot({path:'../../outputs/tuglife-v2.2-light.png',fullPage:true});
 await page.getByRole('button',{name:'Alternar tema claro e escuro'}).click();
 await page.setViewportSize({width:1440,height:1000});
 await page.screenshot({path:'../../outputs/tuglife-v2.2-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: 4 widths, schedule navigation, theme, lazy map, compact player, error state; no JS errors. Audio mocked; external requests blocked.');
 await browser.close();
})().catch(error=>{console.error(error);process.exit(1);});
