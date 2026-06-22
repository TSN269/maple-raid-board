
function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const raw = value.trim();
    let multiplier = 1;
    if (raw.includes('億')) multiplier = 100000000;
    else if (raw.includes('萬') || raw.includes('万')) multiplier = 10000;
    const cleaned = raw.replace(/[,\s]/g, '').replace(/[萬万億%％]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed * multiplier;
  }
  return fallback;
}

function normalizeKey(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[()（）_%％-]/g, '')
    .toLowerCase();
}

const NAME_KEYS = ['name', 'itemName', 'item_name', 'title', 'item', '商品名稱', '名稱', '商品', '道具名稱', '物品名稱', '品名', '物品', '道具', '裝備名稱', '卷軸名稱'];
const CATEGORY_KEYS = ['category', 'type', 'kind', '分類', '類別', '種類', '物品分類', '商品分類'];
const LATEST_KEYS = ['latest', 'lastPrice', 'last_price', 'price', 'currentPrice', 'current_price', '最後報價', '最新價格', '價格', '現價', '成交價', '目前價格', '最新成交', '最新成交價', '即時價格', '市場價格', '均價'];
const AVG7D_KEYS = ['avg7d', 'avg_7d', 'weekAvg', 'sevenDayAvg', 'avg7days', '7日均', '七日均', '7天均價', '週均價', '周均價', '7日平均', '一週均價'];
const AVG30D_KEYS = ['avg30d', 'avg_30d', 'monthAvg', 'thirtyDayAvg', 'avg30days', '30日均', '三十日均', '30天均價', '月均價', '30日平均'];
const CHANGE_KEYS = ['change', 'changePercent', 'change_percent', 'rate', '漲跌幅', '漲跌', '變化率', '漲跌%', '漲跌％', '漲幅', '跌幅'];

function valueFrom(row, keys, fallback = '') {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== '') return row[key];
  }

  const normalizedTargets = new Set(keys.map(normalizeKey));
  for (const [key, value] of Object.entries(row)) {
    if (normalizedTargets.has(normalizeKey(key)) && value !== '') return value;
  }

  return fallback;
}

function stableItemKey(rawId, name) {
  const explicitId = String(rawId || '').trim();
  if (explicitId) return explicitId;

  const normalizedName = String(name || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_+|_+$/g, '');

  return `name:${normalizedName || encodeURIComponent(String(name || 'unknown'))}`;
}

function normalizeHistoryName(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }

  row.push(field);
  rows.push(row);

  return rows
    .map((items) => items.map((item) => String(item || '').replace(/^\uFEFF/, '').trim()))
    .filter((items) => items.some((item) => item));
}

function headerScore(row) {
  const normalized = row.map(normalizeKey);
  const hasName = NAME_KEYS.some((key) => normalized.includes(normalizeKey(key)));
  const hasLatest = LATEST_KEYS.some((key) => normalized.includes(normalizeKey(key)));
  const hasCategory = CATEGORY_KEYS.some((key) => normalized.includes(normalizeKey(key)));
  const hasAvg = AVG7D_KEYS.some((key) => normalized.includes(normalizeKey(key))) || AVG30D_KEYS.some((key) => normalized.includes(normalizeKey(key)));
  return Number(hasName) * 4 + Number(hasLatest) * 4 + Number(hasCategory) + Number(hasAvg);
}

function parseCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return { rows: [], headers: [], headerIndex: -1 };

  let headerIndex = rows.findIndex((row) => headerScore(row) >= 5);
  if (headerIndex < 0) headerIndex = 0;

  const headers = rows[headerIndex].map((item, index) => item || `column${index + 1}`);
  const dataRows = rows.slice(headerIndex + 1)
    .filter((items) => items.some((item) => String(item || '').trim()))
    .map((items) => Object.fromEntries(headers.map((key, index) => [key, items[index] ?? ''])));

  return { rows: dataRows, headers, headerIndex };
}

function average(values) {
  const safe = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!safe.length) return 0;
  return safe.reduce((sum, value) => sum + value, 0) / safe.length;
}

function normalizeRows(rows, source, meta = {}) {
  const items = rows
    .map((row, index) => {
      const name = String(valueFrom(row, NAME_KEYS, '')).trim();
      if (!name) return null;

      const category = String(valueFrom(row, CATEGORY_KEYS, '其他')).trim() || '其他';
      const latest = toNumber(valueFrom(row, LATEST_KEYS, 0));
      if (!latest) return null;

      const avg7d = toNumber(valueFrom(row, AVG7D_KEYS, latest), latest);
      const avg30d = toNumber(valueFrom(row, AVG30D_KEYS, avg7d), avg7d);
      const derivedChange = avg7d > 0 ? ((latest - avg7d) / avg7d) * 100 : 0;
      const change = toNumber(valueFrom(row, CHANGE_KEYS, derivedChange), derivedChange);

      return {
        id: stableItemKey(valueFrom(row, ['id', 'key', 'item_id', '商品ID', '編號', '固定ID', '固定id', '商品固定ID'], ''), name),
        name,
        category,
        latest,
        avg7d,
        avg30d,
        change,
        trend: [avg30d || avg7d || latest, avg7d || latest, latest].filter((value) => value > 0),
      };
    })
    .filter(Boolean);

  const headers = meta.headers || [];
  return {
    updatedAt: new Date().toISOString(),
    rowsRead: rows.length,
    headers,
    items,
    error: items.length
      ? undefined
      : `物價資料來源沒有回傳可用商品資料。已讀到 ${rows.length} 列，欄位：${headers.length ? headers.join(', ') : '無'}`,
  };
}

function resolveGoogleSheetUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    if (!url.hostname.includes('docs.google.com')) return sourceUrl;
    if (!url.pathname.includes('/spreadsheets/')) return sourceUrl;

    if (url.pathname.includes('/pubhtml')) {
      url.pathname = url.pathname.replace('/pubhtml', '/pub');
      url.searchParams.set('output', 'csv');
      return url.toString();
    }

    if (url.pathname.endsWith('/pub')) {
      url.searchParams.set('output', 'csv');
      return url.toString();
    }

    const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
    if (match) {
      const gidFromHash = url.hash.match(/gid=([0-9]+)/)?.[1];
      const gid = process.env.ARTALE_PRICE_GOOGLE_SHEET_GID || url.searchParams.get('gid') || gidFromHash || '0';
      return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
    }
  } catch {
    return sourceUrl;
  }

  return sourceUrl;
}

function todayInTimezone(timeZone = 'Asia/Taipei') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dateDaysAgo(days, timeZone = 'Asia/Taipei') {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function getSupabaseRestConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.ARTALE_PRICE_SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !serviceKey) return null;

  return {
    restUrl: `${url.replace(/\/$/, '')}/rest/v1`,
    serviceKey,
  };
}

async function supabaseRestRequest(path, options = {}) {
  const config = getSupabaseRestConfig();
  if (!config) throw new Error('SUPABASE_SERVICE_ROLE_KEY 未設定，未寫入每日最後報價。');

  const response = await fetch(`${config.restUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.details || text || `Supabase REST HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function mergeLegacyPriceKeys(items = []) {
  try {
    const payload = items.map((item) => ({
      id: item.id,
      name: item.name,
    }));

    const result = await supabaseRestRequest('/rpc/merge_artale_price_key_aliases_for_items', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ p_items: payload }),
    });

    return {
      ok: true,
      result: Array.isArray(result) ? result : [],
    };
  } catch (error) {
    try {
      const fallback = await supabaseRestRequest('/rpc/merge_artale_price_key_aliases', {
        method: 'POST',
        headers: {
          Prefer: 'return=representation',
        },
        body: '{}',
      });

      return {
        ok: true,
        result: Array.isArray(fallback) ? fallback : [],
        fallback: true,
      };
    } catch (fallbackError) {
      return {
        ok: false,
        message: fallbackError instanceof Error ? fallbackError.message : error instanceof Error ? error.message : 'Legacy key merge skipped.',
      };
    }
  }
}

async function persistDailyPricesAndApplyHistory(items, source) {
  if (!items.length) {
    return {
      items,
      historySaved: false,
      historyMessage: '沒有可寫入的物價資料。',
    };
  }

  const today = todayInTimezone();
  const since = dateDaysAgo(365);
  const upsertRows = items.map((item) => ({
    item_key: item.id,
    price_date: today,
    item_name: item.name,
    category: item.category,
    last_price: item.latest,
    source: source || '',
  }));

  try {
    await supabaseRestRequest('/artale_price_daily_records?on_conflict=item_key,price_date', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(upsertRows),
    });

    const keyMergeResult = await mergeLegacyPriceKeys(items);

    const records = await supabaseRestRequest(`/artale_price_daily_records?select=item_key,item_name,price_date,last_price,updated_at&price_date=gte.${since}&order=price_date.asc`, {
      method: 'GET',
    });

    const itemById = new Map(items.map((item) => [String(item.id), item]));
    const itemIdByName = new Map(items.map((item) => [normalizeHistoryName(item.name), String(item.id)]));
    const historyMap = new Map();

    for (const record of records || []) {
      const recordKey = String(record.item_key || '');
      const recordNameKey = normalizeHistoryName(record.item_name);
      const targetId = itemById.has(recordKey) ? recordKey : itemIdByName.get(recordNameKey);

      if (!targetId) continue;
      if (!historyMap.has(targetId)) historyMap.set(targetId, new Map());

      const dateKey = String(record.price_date || '');
      const price = toNumber(record.last_price, 0);
      if (!dateKey || price <= 0) continue;

      const previous = historyMap.get(targetId).get(dateKey);
      const updatedAt = String(record.updated_at || '');
      if (!previous || updatedAt >= previous.updatedAt) {
        historyMap.get(targetId).set(dateKey, {
          date: dateKey,
          price,
          updatedAt,
        });
      }
    }

    const allMatchedRecords = [];
    for (const dayMap of historyMap.values()) {
      for (const record of dayMap.values()) allMatchedRecords.push(record);
    }

    const historyUpdatedAt = allMatchedRecords
      .map((record) => record.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) || '';

    const nextItems = items.map((item) => {
      const history = Array.from(historyMap.get(item.id)?.values() || [])
        .filter((record) => record.price > 0)
        .sort((a, b) => a.date.localeCompare(b.date));
      const prices = history.map((record) => record.price);
      const latest = prices.length ? prices[prices.length - 1] : item.latest;
      const avg7d = average(prices.slice(-7)) || item.avg7d || latest;
      const avg30d = average(prices.slice(-30)) || item.avg30d || avg7d;
      const change = avg7d > 0 ? ((latest - avg7d) / avg7d) * 100 : item.change;

      return {
        ...item,
        latest,
        avg7d,
        avg30d,
        change,
        trend: prices.length >= 2 ? prices.slice(-30) : item.trend,
        historyDates: history.map((record) => record.date).slice(-30),
      };
    });

    return {
      items: nextItems,
      historySaved: true,
      historyRows: allMatchedRecords.length,
      priceDate: today,
      historyUpdatedAt,
      keyMerge: keyMergeResult,
    };
  } catch (error) {
    return {
      items,
      historySaved: false,
      historyMessage: error instanceof Error ? error.message : '每日最後報價寫入失敗。',
    };
  }
}

async function loadRowsFromSource() {
  const csvUrl = process.env.ARTALE_PRICE_CSV_URL || process.env.ARTALE_PRICE_EXCEL_URL || process.env.ARTALE_PRICE_DATA_URL || '';
  const authHeader = process.env.ARTALE_PRICE_DATA_AUTH_HEADER || '';

  if (!csvUrl) {
    return {
      status: 503,
      payload: {
        error: 'ARTALE_PRICE_CSV_URL is not configured.',
        items: [],
      },
    };
  }

  const sourceUrl = resolveGoogleSheetUrl(csvUrl);
  const headers = { Accept: '*/*' };
  if (authHeader) headers.Authorization = authHeader;

  const response = await fetch(sourceUrl, { headers });
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  const head = text.trim().slice(0, 200).toLowerCase();

  if (!response.ok) {
    return {
      status: response.status,
      payload: {
        error: `Upstream returned HTTP ${response.status}`,
        items: [],
      },
    };
  }

  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return {
      status: 422,
      payload: {
        error: '資料來源回傳 HTML，不是 CSV。Google Sheet 請使用「發布到網路」的 CSV 連結，或可公開讀取的 export?format=csv 連結。',
        items: [],
      },
    };
  }

  const lowerUrl = sourceUrl.toLowerCase();
  const isJson = lowerUrl.endsWith('.json') || contentType.includes('json');

  let normalized;
  if (isJson) {
    const payload = JSON.parse(text);
    const rawRows = Array.isArray(payload)
      ? payload
      : payload.items || payload.data || payload.prices || payload.market || payload.rows || [];
    normalized = normalizeRows(rawRows, sourceUrl, { headers: rawRows[0] && typeof rawRows[0] === 'object' ? Object.keys(rawRows[0]) : [] });
  } else {
    const parsed = parseCsv(text.replace(/^\uFEFF/, ''));
    normalized = normalizeRows(parsed.rows, sourceUrl, { headers: parsed.headers || [] });
    normalized.headerIndex = parsed.headerIndex;
  }

  if (!normalized.items.length) {
    return {
      status: 422,
      payload: normalized,
    };
  }

  const historyResult = await persistDailyPricesAndApplyHistory(normalized.items, sourceUrl);

  return {
    status: 200,
    payload: {
      ...normalized,
      source: undefined,
      items: historyResult.items,
      historySaved: historyResult.historySaved,
      historyMessage: historyResult.historyMessage,
      historyRows: historyResult.historyRows || 0,
      priceDate: historyResult.priceDate,
      historyUpdatedAt: historyResult.historyUpdatedAt || '',
    },
  };
}

exports.handler = async function handler() {
  try {
    const result = await loadRowsFromSource();
    return {
      statusCode: result.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': result.status === 200 ? 'public, max-age=300, stale-while-revalidate=600' : 'no-store',
      },
      body: JSON.stringify(result.payload),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to load Artale price CSV.',
        items: [],
      }),
    };
  }
};
