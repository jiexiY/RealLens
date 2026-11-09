async (page) => {
  const base=await page.evaluate(()=>location.origin),checks=[];
  const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label);};
  let revision=1,fail=false;
  await page.addInitScript(()=>localStorage.setItem('reallens.narration.v1','off'));
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('reallens.narration.v1','off');});
  const notice=()=>({id:'999991',title:'Test Route 11 detour',body:`Route 11 uses a temporary stop. Revision ${revision}.`,routes:['11'],postedAt:'2026-11-09T14:00:00Z',modifiedAt:'2026-11-09T14:00:00Z',serviceRelated:true});
  await page.route('**/api/transit',route=>route.fulfill({status:fail?503:200,json:fail?{status:'unavailable'}:{status:'available',fetchedAt:new Date().toISOString(),notices:[notice(),{...notice(),id:'999992',title:'Test holiday service change',routes:[]},{...notice(),id:'999993',title:'Test advisory meeting',routes:[],serviceRelated:false}]}}));
  await page.goto(base+'/bus');
  await page.getByRole('heading',{name:'Test Route 11 detour',exact:true}).waitFor();
  const help=page.locator('.transit-help'),summary=help.locator('summary');
  const detail=page.locator('details[data-transit-id="999991"]'),detailSummary=detail.locator('summary');
  check(!await help.getAttribute('open'),'Help starts collapsed');
  check(!await page.locator('#transit-freshness').isVisible(),'Retrieval explanation is hidden by default');
  check(!await page.getByLabel('Automatically check RTS posts',{exact:true}).isVisible(),'Extra settings are collapsed');
  check(await page.getByRole('heading',{name:'Test holiday service change',exact:true}).isVisible(),'Unspecified-route service notices remain visible');
  check(!await page.getByRole('heading',{name:'Test advisory meeting',exact:true}).isVisible(),'General posts remain collapsed');
  check(await page.getByRole('button',{name:'Listen to RTS updates',exact:true}).isVisible(),'Listen stays visible');
  check(await page.getByRole('button',{name:'Check RTS now',exact:true}).isVisible(),'Refresh stays visible');
  check(!await detail.locator('.transit-body').isVisible(),'Full alert text starts collapsed');
  const closedTree=await help.ariaSnapshot();
  check(!closedTree.includes('Automatically check RTS posts'),'Collapsed extras are absent from the accessibility tree');
  await summary.focus();await page.keyboard.press('Enter');
  check(await page.getByLabel('Automatically check RTS posts',{exact:true}).isVisible(),'Enter opens help');
  await page.keyboard.press('Tab');
  check(await help.locator('a[href="/talk"]').evaluate(e=>e===document.activeElement),'Tab enters expanded help in reading order');
  await summary.focus();await page.keyboard.press('Space');
  check(!await help.getAttribute('open'),'Space closes help');
  await detailSummary.focus();await page.keyboard.press('Enter');
  check(await detail.locator('.transit-body').isVisible(),'Enter opens alert details');
  check((await detailSummary.innerText()).includes('Test Route 11 detour'),'Alert details have a unique accessible label');
  revision=2;
  await page.locator('#transit-refresh').evaluate(e=>e.click());
  await page.waitForFunction(()=>document.querySelector('[data-transit-id="999991"] .transit-body').textContent.includes('Revision 2'));
  check(await detail.locator('.transit-body').isVisible(),'Expanded alert remains open after refresh');
  check(await detailSummary.evaluate(e=>e===document.activeElement),'Refresh preserves focus on alert details');
  await detailSummary.press('Space');
  fail=true;await page.getByRole('button',{name:'Check RTS now',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#transit-badge').textContent.includes('Stale'));
  check(await page.locator('#transit-badge').isVisible(),'Stale warning remains visible outside details');
  check(await page.locator('#transit-status').isVisible(),'Refresh failure remains visible outside details');
  check(await page.getByRole('heading',{name:'Test Route 11 detour',exact:true}).isVisible(),'Earlier alerts remain visible after failure');
  fail=false;await page.getByRole('button',{name:'Check RTS now',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#transit-badge').textContent==='RTS source checked');
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:900});
    for(const open of [false,true]){
      await help.evaluate((el,value)=>el.open=value,open);
      await page.addScriptTag({path:'node_modules/axe-core/axe.min.js'});
      const result=await page.evaluate(async()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id)}));
      check(!result.overflow&&!result.violations.length,`${width}px, help ${open?'open':'closed'}: no overflow or axe violations ${result.violations}`);
    }
    await help.evaluate(el=>el.open=false);
    if(width!==320)await page.screenshot({path:`output/playwright/bus-disclosure-${width}.png`,fullPage:true});
  }
  await page.evaluate(()=>{document.documentElement.dataset.reading='large';document.documentElement.dataset.contrast='high';});
  await help.evaluate(el=>el.open=true);
  const enlarged=await page.evaluate(async()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,violations:(await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}})).violations.map(v=>v.id)}));
  check(!enlarged.overflow&&!enlarged.violations.length,'Expanded help works at 320px with large text and high contrast');
  await page.unroute('**/api/transit');
  return {passed:checks.length,checks};
}
