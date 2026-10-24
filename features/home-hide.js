(() => {
  const prefix='hiddenHomeChannel:', cards='ytd-browse[page-subtype="home"]:not([hidden]) ytd-rich-grid-renderer ytd-rich-item-renderer';
  const pending=new WeakSet(); let records={},loaded=false,timer;
  const msg=key=>chrome.i18n.getMessage(key);
  const visible=e=>e&&e.getClientRects().length&&!e.closest('[hidden],[aria-hidden="true"]');
  function person(card) {
    const links=[...card.querySelectorAll('.ytLockupMetadataViewModelMetadata a[href],#channel-name a[href],ytd-channel-name a[href]')];
    for(const link of links) {
      const id=KarmoUserBlock.identify(link.getAttribute('href'));
      if(id)return{id,name:link.textContent.trim()||id};
    }
    return null;
  }
  function find(scope,selector,step) {
    return [...scope.querySelectorAll(selector)].find(e=>visible(e)&&e.getAttribute('aria-disabled')!=='true'&&!e.disabled&&KarmoHomeFeedback.matches(step,e.textContent));
  }
  function waitFor(read,signal) {
    return new Promise((resolve,reject)=> {
      let observer,timeout;
      const finish=(error,value)=>{observer?.disconnect();clearTimeout(timeout);signal.removeEventListener('abort',abort);error?reject(error):resolve(value);};
      const abort=()=>finish(new Error('Navigation interrupted feedback'));
      const check=()=>{try{const value=read();if(value)finish(null,value);}catch(error){finish(error);}};
      if(signal.aborted){abort();return;}
      observer=new MutationObserver(check);
      observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','aria-hidden','checked','aria-checked','opened','style']});
      signal.addEventListener('abort',abort,{once:true});timeout=setTimeout(()=>finish(new Error('YouTube control not available')),6000);check();
    });
  }
  function adapter(card,signal) {
    let menu,dialog;
    const active=()=>{if(signal.aborted||location.pathname!=='/'||!card.isConnected)throw Error('Video changed');};
    const control=async(scope,selector,step)=>{const e=await waitFor(()=>{active();return find(scope,selector,step);},signal);e.click();return e;};
    return {
      async openMenu() {
        active();const more=card.querySelector('button[aria-label="추가 작업"],button[aria-label="More actions"]');
        if(!visible(more))throw Error('Video menu unavailable');more.click();
        menu=await waitFor(()=>[...document.querySelectorAll('ytd-menu-popup-renderer')].find(visible),signal);
      },
      notInterested:()=>control(menu,'[role="menuitem"]','notInterested'),
      tellWhy:()=>control(card,'button,[role="button"],a','tellWhy'),
      async dislike() {
        dialog=await waitFor(()=>{active();return [...document.querySelectorAll('[role="dialog"],tp-yt-paper-dialog,ytd-dismissal-follow-up-renderer')].find(e=>visible(e)&&find(e,'[role="checkbox"],tp-yt-paper-checkbox','dislike'));},signal);
        const checkbox=find(dialog,'[role="checkbox"],tp-yt-paper-checkbox','dislike');
        const checked=()=>checkbox.getAttribute('aria-checked')==='true'||checkbox.hasAttribute('checked');
        if(!checked())checkbox.click();await waitFor(()=>{active();return checked();},signal);
      },
      async submit(){await control(dialog,'button,[role="button"]','submit');await waitFor(()=>!dialog.isConnected||!visible(dialog),signal);},
    };
  }
  const host=document.createElement('div');host.id='kl-home-hide-notice';const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>:host{font:14px/1.5 Roboto,Arial,sans-serif}section{position:fixed;bottom:20px;left:20px;z-index:2400;max-width:min(440px,calc(100vw - 40px));padding:12px 16px;background:#212121;color:#f1f1f1;border:1px solid #717171;border-radius:8px;box-shadow:0 4px 16px #0003} [hidden]{display:none!important}p{margin:0 0 8px}small{display:block;margin-bottom:8px;color:#ccc}button{min-height:44px;padding:8px 12px;font:inherit;background:transparent;color:#8ecaff;border:0;cursor:pointer}button:focus-visible{outline:2px solid currentColor}</style><section hidden><p role="status"></p><small></small><button id="undo" type="button"></button><button id="close" type="button"></button></section>`;
  const notice=shadow.querySelector('section');let noticeKey;
  shadow.querySelector('#undo').textContent=msg('homeHideUndo');shadow.querySelector('#close').textContent=msg('undoDismiss');
  shadow.querySelector('#close').addEventListener('click',()=>{notice.hidden=true;});
  shadow.querySelector('#undo').addEventListener('click',async()=> {
    try{await chrome.storage.local.remove(noticeKey);notice.hidden=true;}catch{shadow.querySelector('p').textContent=msg('panelSaveError');}
  });
  function announce(key,record,feedback=false) {
    if(!host.isConnected)document.documentElement.append(host);
    noticeKey=prefix+record.id;shadow.querySelector('p').textContent=record.name+': '+msg(key);
    shadow.querySelector('small').textContent=feedback?msg('homeHideUndoHint'):'';notice.hidden=false;
  }
  async function hide(card,button) {
    const current=person(card),video=card.querySelector('h3 a[href*="/watch"],a#video-title[href*="/watch"]')?.getAttribute('href');
    if(!current||!video||pending.has(card))return;
    pending.add(card);button.disabled=true;
    const controller=new AbortController();
    const navigation=()=>controller.abort();document.addEventListener('yt-navigate-start',navigation,{once:true});
    let saved=false;
    try {
      await chrome.storage.local.set({[prefix+current.id]:{name:current.name,ids:[current.id],created:Date.now()}});saved=true;
      if(person(card)?.id!==current.id||card.querySelector('h3 a[href*="/watch"],a#video-title[href*="/watch"]')?.getAttribute('href')!==video)throw Error('Video changed');
      await KarmoHomeFeedback.run(adapter(card,controller.signal));announce('homeHideSent',current,true);
    } catch(error) {
      if(saved)announce(error.completed?.includes('notInterested')?'homeHideReasonFailed':'homeHideFeedbackFailed',current,Boolean(error.completed?.includes('notInterested')));
      else {announce('panelSaveError',current);shadow.querySelector('#undo').hidden=true;}
    } finally {pending.delete(card);button.disabled=false;document.removeEventListener('yt-navigate-start',navigation);schedule();}
  }
  function scan() {
    if(!loaded)return;
    for(const card of document.querySelectorAll(cards)) {
      const current=person(card),anchor=card.querySelector('.ytLockupMetadataViewModelTextContainer,#meta');
      if(!current||!anchor)continue;
      const hidden=Object.values(records).some(record=>record?.ids?.includes(current.id));
      card.classList.toggle('kl-home-muted',hidden&&!pending.has(card));
      let button=anchor.querySelector('.kl-home-hide-button');
      if(!button) {
        button=document.createElement('button');button.type='button';button.className='kl-home-hide-button';
        button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.5 5.3A11 11 0 0112 5c5.8 0 9 7 9 7a17 17 0 01-3.3 4.2M6.1 6.1A18 18 0 003 12s3.2 7 9 7a11 11 0 004.1-.8"/></svg>';
        button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();shadow.querySelector('#undo').hidden=false;void hide(card,button);});anchor.append(button);
      }
      button.title=msg('homeHideHint');button.setAttribute('aria-label',msg('homeHideChannel')+': '+current.name);
    }
  }
  function schedule(){if(!timer)timer=setTimeout(()=>{timer=undefined;scan();},100);}
  chrome.storage.local.get(null).then(values=>{records=Object.fromEntries(Object.entries(values).filter(([key])=>key.startsWith(prefix)));loaded=true;scan();}).catch(()=>console.warn('KarmoLab: Home hidden channels could not be read'));
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;for(const [key,value] of Object.entries(changes))if(key.startsWith(prefix)){if(value.newValue===undefined)delete records[key];else records[key]=value.newValue;schedule();}});
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});document.addEventListener('yt-navigate-finish',schedule);
})();
