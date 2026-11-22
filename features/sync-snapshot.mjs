const maxParts = 22;
const encoder = new TextEncoder();
const bytes = value => encoder.encode(JSON.stringify(value)).length;

export function createSyncSnapshot(area, header) {
  const partKey = (revision, index) => `${header}:${revision}:${index}`;
  async function remote() {
    const { [header]: meta } = await area.get(header);
    if (!meta) return null;
    if (!Number.isInteger(meta.count) || meta.count < 0 || meta.count > maxParts) throw Error('동기화 목록을 읽지 못했습니다.');
    if (typeof meta.revision !== 'string' || !/^[\da-f-]{36}$/.test(meta.revision)) throw Error('동기화 목록을 읽지 못했습니다.');
    const parts = Array.from({ length: meta.count }, (_, index) => partKey(meta.revision, index));
    const data = await area.get(parts);
    const rows = [];
    for (let index = 0; index < meta.count; index++) {
      const part = data[parts[index]];
      if (!Array.isArray(part)) throw Error('다른 기기의 목록을 받는 중입니다. 잠시 후 다시 시도하세요.');
      for (const row of part) {
        if (Array.isArray(row) && typeof row[0] === 'string') rows.push(row);
      }
    }
    return { parts, rows, revision: meta.revision };
  }

  async function publish(records, previous) {
    const revision = crypto.randomUUID();
    const chunks = [];
    let rows = [];
    for (const row of records) {
      if (rows.length && bytes([...rows, row]) > 7600) { chunks.push(rows); rows = []; }
      rows.push(row);
    }
    if (rows.length) chunks.push(rows);
    if (chunks.length > maxParts) throw Error('목록이 브라우저 동기화 한도를 넘었습니다.');
    const { [header]: current } = await area.get(header);
    if (current?.revision !== previous?.revision) {
      throw Object.assign(Error('다른 기기에서 목록을 저장했습니다. 잠시 후 다시 시도하세요.'), { code: 'snapshot-changed' });
    }
    const patch = { [header]: { revision, count: chunks.length } };
    for (const [index, chunk] of chunks.entries()) patch[partKey(revision, index)] = chunk;
    try { await area.set(patch); }
    catch { throw Error('브라우저 동기화에 저장하지 못했습니다. 동기화 설정이나 저장 용량을 확인하세요.'); }
    if (previous?.parts.length) await area.remove(previous.parts).catch(console.warn);
  }

  const changed = changes => Object.keys(changes).some(key => key === header || key.startsWith(header + ':'));
  return { remote, publish, changed };
}
