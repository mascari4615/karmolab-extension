const test=require('node:test'),assert=require('node:assert/strict');
const feedback=require('../features/home-feedback-core.js');
test('native feedback labels match only the intended action in Korean or English',()=> {
  assert.equal(feedback.matches('notInterested',' 관심 없음 '),true);
  assert.equal(feedback.matches('notInterested','채널 추천 안함'),false);
  assert.equal(feedback.matches('dislike',"I don't like the video"),true);
  assert.equal(feedback.matches('dislike','이미 시청한 동영상입니다'),false);
});
test('one click follows the reason flow in order, without a channel-wide feedback action',async()=> {
  const calls=[],adapter=Object.fromEntries(['openMenu','notInterested','tellWhy','dislike','submit'].map(step=>[step,async()=>calls.push(step)]));
  const result=await feedback.run(adapter);assert.deepEqual(result.completed,calls);assert.deepEqual(calls,['openMenu','notInterested','tellWhy','dislike','submit']);
});
test('missing native reason stops without retrying or reporting success',async()=> {
  const calls=[];
  await assert.rejects(feedback.run({openMenu:async()=>calls.push('menu'),notInterested:async()=>calls.push('notInterested'),tellWhy:async()=>{throw Error('not found');},dislike:async()=>calls.push('dislike'),submit:async()=>calls.push('submit')}),error=>error.step==='tellWhy'&&error.completed.includes('notInterested'));
  assert.deepEqual(calls,['menu','notInterested']);
});
