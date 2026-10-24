(() => {
  const msg = key => chrome.i18n.getMessage(key);
  class HomeSize {
    constructor() {
      this.host = document.createElement('div');
      this.view = this.host.attachShadow({mode:'open'});
      this.view.innerHTML = `<style>
        :host{display:block;min-width:0;color:var(--hs-text,#0f0f0f);font:13px/1.4 Roboto,Arial,sans-serif;color-scheme:light}
        *{box-sizing:border-box}.top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:32px}
        .native{display:flex;align-items:center;gap:6px;min-height:44px;cursor:pointer}input{accent-color:var(--hs-accent,#065fd4)}
        .steps{position:relative;display:flex;touch-action:pan-y;user-select:none}
        .steps::before{content:"";position:absolute;top:13px;inset-inline:10%;height:2px;background:var(--hs-line,#999)}
        .choice{position:relative;display:flex;flex:1;min-width:44px;min-height:48px;align-items:center;flex-direction:column;gap:4px;cursor:pointer}
        input[type=radio]{appearance:none;width:20px;height:20px;flex-shrink:0;margin:4px 0 0;border:2px solid var(--hs-line,#777);border-radius:50%;background:var(--hs-bg,#fff);cursor:pointer}
        input[type=radio]:checked{background:var(--hs-accent,#065fd4);border-color:var(--hs-accent,#065fd4);box-shadow:inset 0 0 0 3px var(--hs-bg,#fff)}
        input:focus-visible{outline:2px solid var(--hs-accent,#065fd4);outline-offset:3px}input:disabled{opacity:.5;cursor:default}
        output{color:var(--hs-secondary,#606060);font-size:12px;min-height:17px;display:block}output:empty{display:none}
        :host([data-inline]){display:grid;grid-template-columns:auto minmax(220px,1fr) auto;align-items:center;gap:4px 12px;width:560px!important}
        :host([data-inline]) .top{display:contents}:host([data-inline]) #title{grid-column:1;grid-row:1;white-space:nowrap}
        :host([data-inline]) .steps{grid-column:2;grid-row:1}:host([data-inline]) .native{grid-column:3;grid-row:1}
        :host([data-inline]) output{grid-column:2;grid-row:2}
        @media(max-width:600px){:host([data-inline]){display:block}:host([data-inline]) .top{display:flex}}
      </style><div class="top"><span id="title"></span><label class="native"><input type="checkbox" id="native"><span id="native-label"></span></label></div>
      <div class="steps" role="radiogroup"></div><output role="status" aria-live="polite"></output>`;
      this.view.querySelector('#title').textContent = msg('homeColumnsLabel');
      this.view.querySelector('#native-label').textContent = msg('densityDefault');
      const steps = this.view.querySelector('.steps'); steps.setAttribute('aria-label',msg('homeColumnsLabel'));
      for(let n=2;n<=6;n++) {
        const label=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('span');
        label.className='choice';radio.type='radio';radio.name='columns';radio.value=n;
        text.textContent=chrome.i18n.getMessage('homeColumnsCount',String(n));
        label.append(radio,text);steps.append(label);
        radio.addEventListener('change',()=>this.choose('custom',n));
      }
      this.view.querySelector('#native').addEventListener('change',event=>this.choose(event.target.checked?'default':'custom',this.state.homeColumns));
      let dragging;
      const pick = event => {
        const rect=steps.getBoundingClientRect();
        const count=2+Math.max(0,Math.min(4,Math.floor((event.clientX-rect.left)/(rect.width/5))));
        this.choose('custom',count);
      };
      steps.addEventListener('pointerdown',event=> {
        if(event.button!==0 || !this.state?.loaded) return;
        dragging=event.pointerId;steps.setPointerCapture(dragging);pick(event);
      });
      steps.addEventListener('pointermove',event=>{if(event.pointerId===dragging) pick(event);});
      const release=()=>{dragging=undefined;};
      steps.addEventListener('pointerup',release);steps.addEventListener('pointercancel',release);
      this.view.addEventListener('keydown',event=>{if(event.key!=='Escape')event.stopPropagation();});
      this.view.addEventListener('keyup',event=>event.stopPropagation());
      this.connect();
    }
    connect() {
      this.unsubscribe=KarmoDensityLayout.subscribeHome(state=>{this.state=state;this.render();});
      this.theme = new MutationObserver(()=>this.renderTheme());
      this.theme.observe(document.documentElement,{attributes:true,attributeFilter:['dark']});this.renderTheme();
    }
    renderTheme() {
      const dark=document.documentElement.hasAttribute('dark');
      const colors=dark?{text:'#f1f1f1',secondary:'#aaa',bg:'#0f0f0f',line:'#999',accent:'#3ea6ff'}:{text:'#0f0f0f',secondary:'#606060',bg:'#fff',line:'#777',accent:'#065fd4'};
      for(const [key,value] of Object.entries(colors))this.host.style.setProperty('--hs-'+key,value);
      this.host.style.colorScheme=dark?'dark':'light';
    }
    choose(mode,count) {
      if(!this.state?.loaded || (this.state.homeDensity===mode&&this.state.homeColumns===count))return;
      void KarmoDensityLayout.selectHome(mode,count).catch(()=>{});
    }
    render() {
      const state=this.state;
      const native=this.view.querySelector('#native');native.checked=state.homeDensity==='default';native.disabled=!state.loaded;
      for(const input of this.view.querySelectorAll('input[type=radio]')){input.checked=!native.checked&&Number(input.value)===state.homeColumns;input.disabled=!state.loaded;}
      this.view.querySelector('output').textContent=state.error?msg('panelSaveError'):state.actual&&state.actual!==state.homeColumns?chrome.i18n.getMessage('homeColumnsActual',String(state.actual)):'';
    }
  }
  globalThis.KarmoHomeSize = { create:()=>new HomeSize().host };
  const toolbar=document.createElement('div');toolbar.id='kl-home-size-toolbar';
  toolbar.style.cssText='display:flex;justify-content:flex-end;padding:4px 24px 12px;box-sizing:border-box;';
  const control=KarmoHomeSize.create();control.dataset.inline='';control.style.width='320px';control.style.maxWidth='100%';toolbar.append(control);
  function mount() {
    const grid=location.pathname==='/'?document.querySelector('ytd-browse[page-subtype="home"]:not([hidden]) ytd-rich-grid-renderer'):null;
    if(grid) {if(toolbar.nextElementSibling!==grid)grid.before(toolbar);}
    else toolbar.remove();
  }
  let frame;
  new MutationObserver(()=>{if(!frame){frame=requestAnimationFrame(()=>{frame=undefined;mount();});}}).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('yt-navigate-start',()=>toolbar.remove());document.addEventListener('yt-navigate-finish',mount);mount();
})();
