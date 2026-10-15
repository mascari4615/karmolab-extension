export function volumeValue(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') throw new Error('Volume must be between 0 and 300');
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 300) throw new Error('Volume must be between 0 and 300');
  return Math.round(number);
}
export function siteInfo(url) {
  const parsed = new URL(url);
  if (!['https:', 'http:'].includes(parsed.protocol) || ['chromewebstore.google.com', 'microsoftedge.microsoft.com'].includes(parsed.hostname)) throw new Error('Unsupported page');
  return { origin: parsed.origin, host: parsed.host, pattern: `${parsed.protocol}//${parsed.hostname}/*` };
}
export const volumeScriptId = pattern => 'volume-' + Array.from(new TextEncoder().encode(pattern), byte => byte.toString(16).padStart(2, '0')).join('');
