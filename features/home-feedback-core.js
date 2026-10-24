(() => {
  const normalize = value => String(value).replace(/[’']/g,'').replace(/\s+/g,'').toLowerCase();
  const labels = {
    notInterested:['관심 없음','Not interested'],
    tellWhy:['이유를 알려주세요','Tell us why'],
    dislike:['동영상이 마음에 들지 않습니다',"I don't like the video"],
    submit:['제출','보내기','Submit'],
  };
  const matches = (step,text) => labels[step].some(label=>normalize(label)===normalize(text));
  async function run(adapter) {
    const completed=[];
    for(const step of ['openMenu','notInterested','tellWhy','dislike','submit']) {
      try { await adapter[step](); completed.push(step); }
      catch(cause) { throw Object.assign(new Error('Home feedback stopped'),{step,completed,cause}); }
    }
    return {completed};
  }
  const api={matches,run};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else globalThis.KarmoHomeFeedback=api;
})();
