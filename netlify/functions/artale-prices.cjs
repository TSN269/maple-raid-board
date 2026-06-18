const XLSX = require('xlsx');

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value
      .replace(/[,\s]/g, '')
      .replace(/[萬万]/g, '0000')
      .replace(/億/g, '00000000')
      .replace(/%/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
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
const AVG24H_KEYS = ['avg24h', 'avg_24h', 'dailyAvg', 'dayAvg', 'avg1d', 'avg_1d', '日均', '24H均價', '24h均價', '24小時均價', '一天均價', '日平均', '1日均', '1天均價'];
const AVG7D_KEYS = ['avg7d', 'avg_7d', 'weekAvg', 'sevenDayAvg', 'avg7days', '7日均', '七日均', '7天均價', '週均價', '周均價', '7日平均', '一週均價'];
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

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
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
  const hasAvg = AVG24H_KEYS.some((key) => normalized.includes(normalizeKey(key))) || AVG7D_KEYS.some((key) => normalized.includes(normalizeKey(key)));
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

function workbookRows(buffer, sheetName) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const selectedSheetName = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[selectedSheetName];

  if (!worksheet) return { rows: [], headers: [], sheetName: selectedSheetName || '' };

  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  const headerIndex = matrix.findIndex((row) => Array.isArray(row) && headerScore(row) >= 5);
  const selectedHeaderIndex = headerIndex >= 0 ? headerIndex : 0;
  const headers = (matrix[selectedHeaderIndex] || []).map((item, index) => String(item || `column${index + 1}`).trim());
  const rows = matrix.slice(selectedHeaderIndex + 1)
    .filter((items) => Array.isArray(items) && items.some((item) => String(item || '').trim()))
    .map((items) => Object.fromEntries(headers.map((key, index) => [key, items[index] ?? ''])));

  return { rows, headers, sheetName: selectedSheetName || '' };
}

function trendFromRow(row) {
  const values = [];
  for (let index = 1; index <= 30; index += 1) {
    const value = valueFrom(row, [
      `trend${index}`,
      `Trend${index}`,
      `price${index}`,
      `price_${index}`,
      `走勢${index}`,
      `價格${index}`,
      `第${index}筆`,
      `歷史${index}`,
    ], '');
    const parsed = toNumber(value, 0);
    if (parsed > 0) values.push(parsed);
  }

  if (values.length >= 2) return values;

  const history = valueFrom(row, ['trend', 'history', 'prices', '走勢', '歷史價格', '價格走勢'], '');
  if (typeof history === 'string' && history.trim()) {
    const parsed = history
      .split(/[|,，\s]+/)
      .map((item) => toNumber(item, 0))
      .filter((value) => value > 0);
    if (parsed.length >= 2) return parsed;
  }

  return [];
}

function normalizeRows(rows, source, sheetName, meta = {}) {
  const items = rows
    .map((row, index) => {
      const name = String(valueFrom(row, NAME_KEYS, '')).trim();
      if (!name) return null;

      const category = String(valueFrom(row, CATEGORY_KEYS, '其他')).trim() || '其他';
      const latest = toNumber(valueFrom(row, LATEST_KEYS, 0));
      if (!latest) return null;

      const avg24h = toNumber(valueFrom(row, AVG24H_KEYS, latest), latest);
      const avg7d = toNumber(valueFrom(row, AVG7D_KEYS, avg24h), avg24h);
      const derivedChange = avg7d > 0 ? ((latest - avg7d) / avg7d) * 100 : 0;
      const change = toNumber(valueFrom(row, CHANGE_KEYS, derivedChange), derivedChange);
      const trend = trendFromRow(row);
      const fallbackTrend = [avg7d || latest, avg24h || latest, latest].filter((value) => value > 0);

      return {
        id: String(valueFrom(row, ['id', 'key', 'item_id', '商品ID', '編號'], `${name}-${index}`)),
        name,
        category,
        latest,
        avg24h,
        avg7d,
        change,
        trend: trend.length >= 2 ? trend : fallbackTrend,
      };
    })
    .filter(Boolean);

  const headers = meta.headers || [];
  return {
    source,
    sheet: sheetName || '',
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

async function loadRowsFromSource() {
  const excelUrl = process.env.ARTALE_PRICE_EXCEL_URL || '';
  const csvUrl = process.env.ARTALE_PRICE_CSV_URL || '';
  const legacyJsonUrl = process.env.ARTALE_PRICE_DATA_URL || '';
  const sheetName = process.env.ARTALE_PRICE_EXCEL_SHEET || '';
  const authHeader = process.env.ARTALE_PRICE_DATA_AUTH_HEADER || '';

  const originalSourceUrl = excelUrl || csvUrl || legacyJsonUrl;

  if (!originalSourceUrl) {
    return {
      status: 503,
      payload: {
        source: 'not-configured',
        error: 'ARTALE_PRICE_EXCEL_URL or ARTALE_PRICE_CSV_URL is not configured.',
        items: [],
      },
    };
  }

  const sourceUrl = resolveGoogleSheetUrl(originalSourceUrl);
  const headers = { Accept: '*/*' };
  if (authHeader) headers.Authorization = authHeader;

  const response = await fetch(sourceUrl, { headers });
  const contentType = response.headers.get('content-type') || '';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const head = buffer.toString('utf8', 0, Math.min(buffer.length, 200)).trim().toLowerCase();

  if (!response.ok) {
    return {
      status: response.status,
      payload: {
        source: sourceUrl,
        originalSource: originalSourceUrl,
        error: `Upstream returned HTTP ${response.status}`,
        items: [],
      },
    };
  }

  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    return {
      status: 422,
      payload: {
        source: sourceUrl,
        originalSource: originalSourceUrl,
        error: '資料來源回傳 HTML，不是 CSV / Excel。Google Sheet 請使用「發布到網路」的 CSV 連結，或可公開讀取的 export?format=csv 連結。',
        items: [],
      },
    };
  }

  const lowerUrl = sourceUrl.toLowerCase();
  const isCsv = Boolean(csvUrl) || lowerUrl.endsWith('.csv') || lowerUrl.includes('output=csv') || lowerUrl.includes('format=csv') || contentType.includes('csv') || contentType.startsWith('text/');
  const isJson = Boolean(legacyJsonUrl && !excelUrl && !csvUrl) || lowerUrl.endsWith('.json') || contentType.includes('json');

  if (isJson) {
    const text = buffer.toString('utf8');
    const payload = JSON.parse(text);
    const rawRows = Array.isArray(payload)
      ? payload
      : payload.items || payload.data || payload.prices || payload.market || payload.rows || [];
    const normalized = normalizeRows(rawRows, sourceUrl, '', { headers: rawRows[0] && typeof rawRows[0] === 'object' ? Object.keys(rawRows[0]) : [] });
    return {
      status: normalized.items.length ? 200 : 422,
      payload: { ...normalized, originalSource: originalSourceUrl },
    };
  }

  const parsed = isCsv
    ? parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''))
    : workbookRows(buffer, sheetName);

  const normalized = normalizeRows(parsed.rows, sourceUrl, parsed.sheetName || sheetName, { headers: parsed.headers || [] });

  return {
    status: normalized.items.length ? 200 : 422,
    payload: { ...normalized, originalSource: originalSourceUrl, headerIndex: parsed.headerIndex },
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
        source: process.env.ARTALE_PRICE_EXCEL_URL || process.env.ARTALE_PRICE_CSV_URL || process.env.ARTALE_PRICE_DATA_URL || 'unknown',
        error: error instanceof Error ? error.message : 'Failed to load Artale price file.',
        items: [],
      }),
    };
  }
};
