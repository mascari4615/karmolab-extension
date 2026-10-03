const EDGE = 'https://api.addons.microsoftedge.microsoft.com/v1';
const CHROME = 'https://chromewebstore.googleapis.com';
const GUID = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

export function requireEnv(env, names) {
  const missing = names.filter(name => !env[name]);
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
}

export function createStoreApi({ fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 24, delayMs = 5000 } = {}) {
  async function request(url, options = {}, expected = 200) {
    const response = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (response.status !== expected) throw new Error(`Store request failed: HTTP ${response.status}`);
    return response;
  }
  async function poll(read, field, success, inProgress) {
    for (let i = 0; i < attempts; i++) {
      const result = await read();
      if (result[field] === success) return result;
      if (!inProgress.includes(result[field])) throw new Error(`Operation failed: ${result[field] || 'missing status'} (${result.errorCode || 'no code'})`);
      if (i + 1 < attempts) await sleep(delayMs);
    }
    throw new Error('Operation still in progress; resume from the saved receipt, do not upload again');
  }
  function edgeOperation(location) {
    // 서버가 돌려준 URL을 직접 호출하지 않음. 공식 호스트로만 인증 전송
    const id = String(location || '').split('/').pop();
    if (!GUID.test(id)) throw new Error('Invalid Edge operation ID');
    return id;
  }
  const edge = (env) => {
    requireEnv(env, ['EDGE_PRODUCT_ID', 'EDGE_CLIENT_ID', 'EDGE_API_KEY']);
    if (!GUID.test(env.EDGE_PRODUCT_ID)) throw new Error('Invalid EDGE_PRODUCT_ID');
    const base = `${EDGE}/products/${env.EDGE_PRODUCT_ID}`;
    const headers = { Authorization: `ApiKey ${env.EDGE_API_KEY}`, 'X-ClientID': env.EDGE_CLIENT_ID };
    const read = async (kind, id) => {
      if (!GUID.test(id)) throw new Error('Invalid Edge operation ID');
      return (await request(`${base}/submissions/${kind === 'upload' ? 'draft/package/' : ''}operations/${id}`, { headers })).json();
    };
    return {
      read,
      async submit(bytes, notes, receipt, save) {
        if (!receipt.uploadOperationId) {
          if (receipt.uploadStarted) throw new Error('Edge upload outcome unknown; inspect Partner Center before retrying');
          receipt.uploadStarted = true; save(receipt);
          const response = await request(`${base}/submissions/draft/package`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: bytes }, 202);
          receipt.uploadOperationId = edgeOperation(response.headers.get('Location')); save(receipt);
        }
        if (!receipt.uploadSucceeded) {
          await poll(() => read('upload', receipt.uploadOperationId), 'status', 'Succeeded', ['InProgress']);
          receipt.uploadSucceeded = true; save(receipt);
        }
        if (!receipt.publishOperationId) {
          if (receipt.publishStarted) throw new Error('Edge publish outcome unknown; inspect Partner Center before retrying');
          receipt.publishStarted = true; save(receipt);
          const response = await request(`${base}/submissions`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) }, 202);
          receipt.publishOperationId = edgeOperation(response.headers.get('Location')); save(receipt);
        }
        await poll(() => read('publish', receipt.publishOperationId), 'status', 'Succeeded', ['InProgress']);
        receipt.status = 'SUBMISSION_ACCEPTED';
        receipt.reviewStatus = 'CHECK_PARTNER_CENTER'; save(receipt);
        return receipt;
      },
    };
  };
  const chrome = async (env) => {
    requireEnv(env, ['CWS_PUBLISHER_ID', 'CWS_EXTENSION_ID', 'CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN']);
    if (!/^[a-p]{32}$/.test(env.CWS_EXTENSION_ID) || !/^[\w-]+$/.test(env.CWS_PUBLISHER_ID)) throw new Error('Invalid Chrome store identity');
    const token = await (await request('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.CWS_CLIENT_ID, client_secret: env.CWS_CLIENT_SECRET, refresh_token: env.CWS_REFRESH_TOKEN, grant_type: 'refresh_token' }),
    })).json();
    if (!token.access_token) throw new Error('Chrome token response has no access token');
    const name = `publishers/${env.CWS_PUBLISHER_ID}/items/${env.CWS_EXTENSION_ID}`;
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const read = async () => (await request(`${CHROME}/v2/${name}:fetchStatus`, { headers })).json();
    return {
      read,
      async submit(bytes, version, receipt, save) {
        const current = await read();
        if (current.takenDown || current.warned) throw new Error('Chrome item has a policy warning; inspect developer dashboard');
        const submitted = current.submittedItemRevisionStatus;
        const published = current.publishedItemRevisionStatus;
        const sameVersion = revision => revision?.distributionChannels?.some(channel => channel.crxVersion === version);
        if (sameVersion(published) && published.state === 'PUBLISHED') {
          receipt.status = 'PUBLISHED'; save(receipt); return receipt;
        }
        if (submitted && ['PENDING_REVIEW', 'STAGED'].includes(submitted.state)) {
          if (!sameVersion(submitted)) throw new Error('Another Chrome version is in review; do not replace or cancel it');
          receipt.status = submitted.state; save(receipt); return receipt;
        }
        if (!receipt.uploadSucceeded) {
          let upload;
          if (!receipt.uploadStarted) {
            // POST 자동 재시도 없음. 응답 유실 시 수동 상태 확인 후 재개
            receipt.uploadStarted = true; save(receipt);
            upload = await (await request(`${CHROME}/upload/v2/${name}:upload`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: bytes })).json();
          } else {
            upload = { uploadState: current.lastAsyncUploadState };
          }
          if (['IN_PROGRESS', 'UPLOAD_IN_PROGRESS'].includes(upload.uploadState)) {
            await poll(read, 'lastAsyncUploadState', 'SUCCEEDED', ['IN_PROGRESS', 'UPLOAD_IN_PROGRESS']);
          } else if (upload.uploadState !== 'SUCCEEDED') throw new Error(`Chrome upload failed: ${upload.uploadState || 'unknown; inspect dashboard'}`);
          if (upload.crxVersion && upload.crxVersion !== version) throw new Error('Chrome upload version mismatch');
          receipt.uploadSucceeded = true; save(receipt);
        }
        if (receipt.publishStarted) throw new Error('Chrome publish outcome unknown; inspect status before retrying');
        receipt.publishStarted = true; save(receipt);
        const result = await (await request(`${CHROME}/v2/${name}:publish`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH', skipReview: false, blockOnWarnings: true }),
        })).json();
        if (!['PENDING_REVIEW', 'PUBLISHED', 'STAGED'].includes(result.state)) throw new Error(`Chrome submission failed: ${result.state || 'unknown'}`);
        receipt.status = result.state; save(receipt); return receipt;
      },
    };
  };
  return { edge, chrome };
}
