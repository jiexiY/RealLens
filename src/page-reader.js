// Read rendered information only. Closed details and hidden alternatives stay out.
export function readableText(root){
  const label=el=>el.getAttribute('aria-label')||[...(el.labels||[])].map(n=>n.textContent.trim()).join(' ');
  function walk(node){
    if(node.nodeType===3)return node.textContent;
    if(node.nodeType!==1)return '';
    const el=node,tag=el.tagName;
    if(el.hidden||el.getAttribute('aria-hidden')==='true'||el.matches('[data-read-control],script,style,button,option,input[type=password]'))return '';
    const style=getComputedStyle(el);
    if(style.display==='none'||style.visibility==='hidden')return '';
    if(tag==='DETAILS'&&!el.open)return `${walk(el.querySelector('summary'))}. Collapsed. `;
    if(tag==='SELECT')return `${label(el)}: ${[...el.selectedOptions].map(o=>o.textContent).join(', ')}. `;
    if(tag==='INPUT')return ['checkbox','radio'].includes(el.type)?`${label(el)}: ${el.checked?'checked':'not checked'}. `:el.value?`${label(el)}: ${el.value}. `:'';
    if(tag==='TEXTAREA')return el.value?`${label(el)}: ${el.value}. `:'';
    if(tag==='SVG'||el.getAttribute('role')==='img')return el.getAttribute('aria-label')||el.getAttribute('alt')||'';
    if(tag==='IMG')return el.alt||'';
    // A form label is read with its control, including the selected value.
    if(tag==='LABEL')return [...el.querySelectorAll('input,select,textarea')].map(walk).join(' ');
    const text=[...el.childNodes].map(walk).join(' ');
    return /^(P|DIV|SECTION|ARTICLE|LI|H[1-6]|SUMMARY|BR|LEGEND)$/.test(tag)?text+'\n':text;
  }
  return walk(root).replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{2,}/g,'\n').trim();
}

export function mountPageReader({main,toolbar,player,rate,announce}){
  let source=null,activeButton=null,lastText='';
  const read=document.createElement('button');read.type='button';read.textContent='Read page';
  read.dataset.readControl='page';read.setAttribute('aria-label','Read page information aloud');
  const stop=document.createElement('button');stop.type='button';stop.textContent='Stop reading';stop.hidden=true;stop.dataset.readControl='stop';
  toolbar.append(read,stop);
  const reset=()=>{if(document.activeElement===stop&&activeButton?.isConnected)activeButton.focus();source=null;activeButton=null;stop.hidden=true;};
  function start(target,button){
    const text=readableText(target);
    if(!text){announce('No information is available to read yet.');return;}
    player.cancel();
    if(player.speak(text,rate())){source=target;lastText=text;activeButton=button;stop.hidden=false;}
  }
  read.addEventListener('click',()=>start(main,read));
  stop.addEventListener('click',()=>{const returnTo=activeButton;player.cancel();reset();returnTo?.focus();announce('Reading stopped.');});
  function enhance(){
    for(const details of main.querySelectorAll('details')){
      if(details.querySelector(':scope > [data-read-control]'))continue;
      const summary=details.querySelector(':scope > summary');if(!summary)continue;
      const button=document.createElement('button');button.type='button';button.className='button button-outline detail-reader';button.dataset.readControl='details';
      button.textContent='Read details';button.setAttribute('aria-label',`Read details aloud: ${summary.textContent.trim()}`);
      button.addEventListener('click',()=>start(details,button));summary.after(button);
    }
  }
  enhance();
  const observer=new MutationObserver(records=>{
    const contentChanged=source&&records.some(r=>source.contains(r.target)&&!(r.target.nodeType===1?r.target:r.target.parentElement)?.closest('[data-read-control],#transit-status,#transit-freshness,#closure-status,#closure-freshness')&&(r.type==='characterData'||![...r.addedNodes,...r.removedNodes].every(n=>n.nodeType===1&&n.matches('[data-read-control]'))));
    if(source&&(!source.isConnected||(contentChanged&&readableText(source)!==lastText))){
      player.cancel();reset();announce('Page information changed. Choose Read page or Read details to hear the latest.');
    }
    enhance();
  });
  observer.observe(main,{childList:true,subtree:true,characterData:true});
  for(const type of ['input','change'])main.addEventListener(type,event=>{if(source?.contains(event.target)){player.cancel();reset();}});
  main.addEventListener('toggle',event=>{if(event.target.tagName==='DETAILS'&&!event.target.open&&source&&(source===main||event.target.contains(source))){player.cancel();reset();}},true);
  window.addEventListener('pagehide',()=>{observer.disconnect();player.cancel();reset();});
  return {sync(active){if(!active)reset();}};
}
