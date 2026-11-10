(() => {
  const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}\p{Cf}]/gu, '');
  function classify(author, body) {
    const name = normalize(author), text = normalize(body);
    const adult = /공떡|무료야동|야동|섹파|조건만남|일탈영상|알몸|알몽/;
    const lure = /(?:내|제|형|누나)?(?:프로필|피드)(?:보|확인|들어|에|가면)|어른만(?:와|오)|성인만(?:와|오)/;
    const reasons = [];
    if (!adult.test(name) && /광고|스팸|신고|차단|조심/.test(text)) return { level: 'none', reasons };
    if (adult.test(name)) reasons.push('닉네임의 성인 광고 표현');
    if (adult.test(text)) reasons.push('본문의 성인 광고 표현');
    if (lure.test(text)) reasons.push('프로필 방문 또는 성인 방문 유도');
    const promotion = lure.test(text), sexual = adult.test(name) || adult.test(text);
    return { level: sexual && promotion ? 'high' : sexual && /구했|유출|보러|링크/.test(text) ? 'suspect' : 'none', reasons };
  }
  globalThis.KarmoCommentSpam = { classify, normalize };
})();
