import { snapshotSettings, validateSettings, applySettings } from './migration-settings.js';

const fileInput = document.querySelector('#settingsFile');
const applyButton = document.querySelector('#applySettings');
const result = document.querySelector('#result');
let pending = null;
function notice(message, error = false) {
  result.textContent = message;
  result.dataset.error = String(error);
}
function renderSummary(container, settings) {
  const key = name => settings[`worldMonitor.${name}.v1`];
  const rows = [
    ['並び順', `${Object.entries(settings).filter(([name, value]) => name.endsWith('Items.v1') || name.endsWith('Tabs.v1') || name.endsWith('Panels.v1')).filter(([, value]) => Array.isArray(value) && value.length).length}項目`],
    ['地図レイヤー', `${Object.values(key('mapLayers') || {}).filter(value => value === true).length}選択`],
    ['緊急監視', key('alerts') ? (key('alerts').enabled !== false ? 'ON' : 'OFF') : '初期設定'],
    ['監視ジャンル', key('alerts')?.topics?.length ?? '初期設定'],
    ['しきい値', key('alerts')?.threshold ?? '初期設定'],
    ['起動時の地図', '2D']
  ];
  container.replaceChildren(...rows.flatMap(([name, value]) => {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = name;
    description.textContent = String(value);
    return [term, description];
  }));
}
function showCurrent() {
  try { renderSummary(document.querySelector('#currentSettings'), snapshotSettings(localStorage).settings); }
  catch { notice('このブラウザーの設定を読み取れない。保存領域を確認する必要がある。', true); }
}
document.querySelector('#exportSettings').addEventListener('click', () => {
  try {
    const file = snapshotSettings(localStorage);
    const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `world-monitor-settings-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice('設定ファイルを書き出した。');
  } catch { notice('設定を書き出せなかった。保存領域を確認する必要がある。', true); }
});
fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  document.querySelector('#fileName').textContent = file?.name || '未選択';
  pending = null;
  applyButton.disabled = true;
  document.querySelector('#importPreview').replaceChildren();
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('設定ファイルは1MB以下にする必要がある。');
    const input = JSON.parse(await file.text());
    const settings = validateSettings(input);
    if (fileInput.files[0] !== file) return;
    pending = { ...input, settings };
    renderSummary(document.querySelector('#importPreview'), settings);
    applyButton.disabled = false;
    notice('設定ファイルを読み込んだ。');
  } catch (error) {
    if (fileInput.files[0] === file) notice(error instanceof SyntaxError ? 'JSON形式を読み取れなかった。' : error.message, true);
  }
});
applyButton.addEventListener('click', () => {
  if (!pending) return;
  try {
    applySettings(localStorage, pending);
    notice('設定を適用した。');
    pending = null;
    applyButton.disabled = true;
    showCurrent();
  } catch (error) { notice(error.message, true); }
});
showCurrent();
window.lucide?.createIcons();
