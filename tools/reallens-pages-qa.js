async (page) => {
 const base=await page.evaluate(()=>location.origin),checks=[],errors=[],requests=[];
 const assert=(value,message)=>{if(!value)throw Error(message);checks.push(message);};
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('reallens.narration.v1','off'));
 page.on('request',request=>{if(request.url().includes('/api/'))requests.push(request.url());});
 // Hold only the splash timer for static layout scans; timing has its own suite.
 const holdSplash=async()=>{if(await page.evaluate(()=>location.pathname==='/demo'))await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));};
 await page.route('**/api/voice',route=>route.fulfill({json:{configured:false}}));
 await page.route('**/api/transit',route=>route.fulfill({json:{status:'unavailable'}}));
 const scan=async()=>{
  await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
  return page.evaluate(async()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))}));
 };
 await page.goto(base+'/');await page.evaluate(()=>{localStorage.clear();localStorage.setItem('reallens.narration.v1','off');sessionStorage.clear();});
 assert((await page.title()).startsWith('RealLens'),'Bare domain opens RealLens intro');
 await page.locator('.primary-link').first().locator('img').click();await page.waitForURL('**/demo');
 await holdSplash();
 assert(await page.getByRole('link',{name:'RealLens Open home',exact:true}).count()===1,'White welcome has a named, native icon link');
 assert(await page.locator('h1').innerText()==='RealLens'&&await page.locator('#demo-action').evaluate(el=>el.getBoundingClientRect().width===1)&&!await page.locator('#demo-hint').isVisible(),'White-screen main content stays product name and icon, with separate voice controls');
 assert(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor)==='rgb(255, 255, 255)','Welcome background is white');
 await page.keyboard.press('Tab');await page.keyboard.press('Tab');
 assert(await page.locator('.demo-entry').evaluate(el=>el===document.activeElement),'White welcome is reachable by keyboard');
 await page.keyboard.press('Enter');await page.waitForURL('**/welcome');
 const names=['Plan a trip','Talk to RealLens','Check conditions','Bus alerts'],paths=['plan','talk','conditions','bus'];
 assert(await page.locator('.welcome-tile').count()===4,'Home contains exactly four primary actions');
 await page.keyboard.press('Tab');
 for(let i=0;i<4;i++){
  const link=page.getByRole('link',{name:names[i],exact:true});
  assert(await link.getAttribute('href')==='/'+paths[i],names[i]+' opens its own page');
  await page.keyboard.press('Tab');assert(await link.evaluate(el=>el===document.activeElement),'Keyboard order: '+names[i]);
  assert(!!await link.getAttribute('aria-describedby'),'Action has a separate screen-reader hint: '+names[i]);
 }
 assert(requests.length===0,'Muted intro, splash and four-block home make no data or voice requests');
 for(const route of ['/','/demo','/welcome','/plan','/conditions','/talk','/bus','/ride','/sources','/settings']){
  await page.goto(base+route);
  await holdSplash();
  assert((await page.title()).includes('RealLens'),'Deep link title: '+route);
  for(const [width,height]of [[1440,1000],[390,844]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);
   const result=await scan();
   assert(!result.overflow&&!result.violations.length,route+' '+width+'px: no overflow / axe violations '+JSON.stringify(result.violations));
   if(['/','/demo','/welcome','/plan'].includes(route))await page.screenshot({path:'output/playwright/reallens-'+(route.slice(1)||'intro')+'-'+width+'.png',fullPage:route==='/'});
   if(route==='/welcome')assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'Four blocks fit full screen at '+width+'px');
  }
 }
 await page.goto(base+'/settings');
 await page.getByLabel('Larger text',{exact:true}).check();await page.getByLabel('Higher contrast',{exact:true}).check();
 for(const route of ['/demo','/welcome','/plan','/conditions','/talk','/bus','/ride','/sources','/settings']){
  await page.goto(base+route);await page.setViewportSize({width:320,height:568});
  await holdSplash();
  assert(await page.evaluate(()=>document.documentElement.dataset.contrast==='high'&&document.documentElement.dataset.reading==='large'),'Preferences persist: '+route);
  const result=await scan();assert(!result.overflow&&!result.violations.length,'Large/high contrast 320px: '+route+' '+JSON.stringify(result.violations));
 }
 await page.goto(base+'/welcome');await page.evaluate(()=>document.documentElement.style.fontSize='32px');
 assert(await page.locator('.welcome-tile').evaluateAll(tiles=>tiles.every(tile=>tile.scrollWidth<=tile.clientWidth&&tile.scrollHeight<=tile.clientHeight)),'200% text is not clipped in home blocks');
 await page.evaluate(()=>localStorage.clear());
 await page.unroute('**/api/voice');await page.unroute('**/api/transit');
 assert(errors.length===0,'No JavaScript page errors: '+errors.join('; '));
 return {passed:checks.length,checks};
}
