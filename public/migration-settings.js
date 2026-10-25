const orderNames = ['regionTabs', 'spotlightTabs', 'feedTabs', 'contentTabs', 'dockPanels', 'trendItems', 'macroItems', 'statusItems', 'focusItems', 'worldTopicsItems', 'infraItems'];
const layerNames = ['alerts', 'risk', 'labels', 'tiles', 'heat', 'news', 'arcs', 'hq', 'autoHq', 'lab', 'corp', 'chip', 'research', 'japan', 'datacenter'];
const topicNames = ['models', 'chips', 'data-centers', 'cloud', 'security', 'policy', 'funding', 'geopolitics', 'economy', 'markets', 'energy', 'automotive', 'robotics', 'quantum'];
export const settingKeys = [...orderNames, 'mapLayers', 'mapMode', 'alerts'].map(name => `worldMonitor.${name}.v1`);

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
function validateValue(key, value) {
  if (value === null) return null;
  const name = key.split('.')[1];
  if (orderNames.includes(name)) {
    if (!Array.isArray(value) || value.length > 2000 || !value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 4096)) throw new Error('並び順の形式が不正だ。');
    return [...new Set(value)];
  }
  if (name === 'mapMode') {
    if (!['2d', '3d'].includes(value)) throw new Error('地図モードが不正だ。');
    return '2d';
  }
  if (name === 'mapLayers') {
    if (!isObject(value) || !Object.keys(value).every(key => layerNames.includes(key) && typeof value[key] === 'boolean')) throw new Error('地図レイヤーの形式が不正だ。');
    return Object.fromEntries(Object.entries(value));
  }
  if (name === 'alerts') {
    if (!isObject(value) || !Object.keys(value).every(key => ['enabled', 'threshold', 'topics', 'automotiveAlertMigrated'].includes(key))) throw new Error('アラート設定の形式が不正だ。');
    if (own(value, 'enabled') && typeof value.enabled !== 'boolean') throw new Error('監視状態が不正だ。');
    if (own(value, 'threshold') && (!Number.isFinite(value.threshold) || value.threshold < 1 || value.threshold > 99)) throw new Error('しきい値が不正だ。');
    if (own(value, 'topics') && (!Array.isArray(value.topics) || value.topics.length > topicNames.length || !value.topics.every(topic => topicNames.includes(topic)))) throw new Error('監視ジャンルが不正だ。');
    if (own(value, 'automotiveAlertMigrated') && typeof value.automotiveAlertMigrated !== 'boolean') throw new Error('アラート設定が不正だ。');
    return Object.fromEntries(Object.entries(value));
  }
  throw new Error('対象外の設定だ。');
}

export function validateSettings(file) {
  if (!isObject(file) || file.format !== 'world-monitor-settings' || file.version !== 1 || !isObject(file.settings)) throw new Error('World Monitorの設定ファイルではない。');
  if (!Object.keys(file.settings).every(key => settingKeys.includes(key))) throw new Error('対象外の設定が含まれている。');
  return Object.fromEntries(Object.entries(file.settings).map(([key, value]) => [key, validateValue(key, value)]));
}

export function snapshotSettings(storage) {
  const settings = Object.fromEntries(settingKeys.map(key => {
    const value = storage.getItem(key);
    return [key, value === null ? null : JSON.parse(value)];
  }));
  const file = { format: 'world-monitor-settings', version: 1, exportedAt: new Date().toISOString(), settings };
  file.settings = validateSettings(file);
  return file;
}

export function applySettings(storage, file) {
  const settings = validateSettings(file);
  const previous = new Map(Object.keys(settings).map(key => [key, storage.getItem(key)]));
  try {
    for (const [key, value] of Object.entries(settings)) {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, JSON.stringify(value));
    }
  } catch (error) {
    let restored = true;
    for (const [key, value] of previous) {
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch { restored = false; }
    }
    throw new Error(restored ? '保存に失敗した。変更前の設定に戻した。' : '保存に失敗し、一部の設定を戻せなかった。ブラウザーの保存領域を確認する必要がある。', { cause: error });
  }
  return Object.keys(settings).length;
}
