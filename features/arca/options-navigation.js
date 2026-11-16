(() => {
  document.body.classList.add('kl-arca-options');
  const fields = [...document.querySelectorAll('#tab-arca>fieldset')];
  const list = fields[7];
  const backup = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = '백업과 복원'; backup.append(legend);
  for (const row of [...list.querySelectorAll(':scope>.row')]) backup.append(row);
  const nodes = document.getElementById('lists'); list.append(nodes);
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = '작성자 검색'; search.setAttribute('aria-label','차단과 팔로우 작성자 검색');
  list.insertBefore(search,nodes);
  const filter = () => { const q=search.value.trim().toLocaleLowerCase(); for(const li of nodes.querySelectorAll('li')) li.hidden=!li.textContent.toLocaleLowerCase().includes(q); };
  search.addEventListener('input',filter); new MutationObserver(filter).observe(nodes,{childList:true,subtree:true});
  const host = document.createElement('div'); document.body.insertBefore(host,document.getElementById('tab-arca'));
  globalThis.KarmoSettingsNavigation(host,[
    {id:'people',title:'작성자',en:'Authors',nodes:[list]},
    {id:'rules',title:'차단 규칙',en:'Block rules',nodes:[fields[2],fields[5],fields[4]]},
    {id:'automatic',title:'자동 차단',en:'Auto block',nodes:[fields[6]]},
    {id:'appearance',title:'화면 표시',en:'Appearance',nodes:[fields[0],fields[1],fields[3]]},
    {id:'backup',title:'백업',en:'Backup',nodes:[backup]},
  ],'arca-options');
  document.getElementById('tab-arca').remove();
  if (window.top !== window) document.body.classList.add('embedded');
})();
