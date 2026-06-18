const XLSX = require('xlsx');

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[,\s]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function valueFrom(row, keys, fallback = '') {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== '') return row[key];
  }
  return fallback;
}

function parseCsv(text) {
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

  const header = (rows.shift() || []).map((item) => String(item || '').trim());
  return rows
    .filter((items) => items.some((item) => String(item || '').trim()))
    .map((items) => Object.fromEntries(header.map((key, index) => [key, items[index] ?? ''])));
}

function workbookRows(buffer, sheetName) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const selectedSheetName = sheetName && workbook.Sheets[sheetName] ? sheetName : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[selectedSheetName];

  if (!worksheet) return [];

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
    raw: false,
  });
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
    ], '');
    const parsed = toNumber(value, 0);
    if (parsed > 0) values.push(parsed);
  }

  if (values.length >= 2) return values;

  const history = valueFrom(row, ['trend', 'history', 'prices', '走勢', '歷史價格'], '');
  if (typeof history === 'string' && history.trim()) {
    const parsed = history
      .split(/[|,，\s]+/)
      .map((item) => toNumber(item, 0))
      .filter((value) => value > 0);
    if (parsed.length >= 2) return parsed;
  }

  return [];
}

function normalizeRows(rows, source, sheetName) {
  const items = rows
    .map((row, index) => {
      const name = String(valueFrom(row, [
        'name',
        'itemName',
        'item_name',
        'title',
        'item',
        '商品名稱',
        '名稱',
        '商品',
        '道具名稱',
        '物品名稱',
      ], '')).trim();

      if (!name) return null;

      const category = String(valueFrom(row, [
        'category',
        'type',
        'kind',
        '分類',
        '類別',
        '種類',
      ], '其他')).trim() || '其他';

      const latest = toNumber(valueFrom(row, [
        'latest',
        'lastPrice',
        'last_price',
        'price',
        'currentPrice',
        'current_price',
        '最後報價',
        '最新價格',
        '價格',
        '現價',
        '成交價',
      ], 0));

      const avg24h = toNumber(valueFrom(row, [
        'avg24h',
        'avg_24h',
        'dailyAvg',
        'dayAvg',
        'avg1d',
        'avg_1d',
        '日均',
        '24H均價',
        '24h均價',
        '24小時均價',
        '一天均價',
      ], latest), latest);

      const avg7d = toNumber(valueFrom(row, [
        'avg7d',
        'avg_7d',
        'weekAvg',
        'sevenDayAvg',
        'avg7days',
        '7日均',
        '七日均',
        '7天均價',
        '週均價',
      ], avg24h), avg24h);

      const derivedChange = avg7d > 0 ? ((latest - avg7d) / avg7d) * 100 : 0;
      const change = toNumber(valueFrom(row, [
        'change',
        'changePercent',
        'change_percent',
        'rate',
        '漲跌幅',
        '漲跌',
        '變化率',
      ], derivedChange), derivedChange);

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

  return {
    source,
    sheet: sheetName || '',
    updatedAt: new Date().toISOString(),
    items,
  };
}

async function loadRowsFromSource() {
  const excelUrl = process.env.ARTALE_PRICE_EXCEL_URL || '';
  const csvUrl = process.env.ARTALE_PRICE_CSV_URL || '';
  const legacyJsonUrl = process.env.ARTALE_PRICE_DATA_URL || '';
  const sheetName = process.env.ARTALE_PRICE_EXCEL_SHEET || '';
  const authHeader = process.env.ARTALE_PRICE_DATA_AUTH_HEADER || '';

  const sourceUrl = excelUrl || csvUrl || legacyJsonUrl;

  if (!sourceUrl) {
    return {
      status: 503,
      payload: {
        source: 'not-configured',
        error: 'ARTALE_PRICE_EXCEL_URL or ARTALE_PRICE_CSV_URL is not configured.',
        items: [],
      },
    };
  }

  const headers = { Accept: '*/*' };
  if (authHeader) headers.Authorization = authHeader;

  const response = await fetch(sourceUrl, { headers });
  const contentType = response.headers.get('content-type') || '';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!response.ok) {
    return {
      status: response.status,
      payload: {
        source: sourceUrl,
        error: `Upstream returned HTTP ${response.status}`,
        items: [],
      },
    };
  }

  const lowerUrl = sourceUrl.toLowerCase();
  const isCsv = Boolean(csvUrl) || lowerUrl.endsWith('.csv') || contentType.includes('csv') || contentType.startsWith('text/');
  const isJson = Boolean(legacyJsonUrl && !excelUrl && !csvUrl) || lowerUrl.endsWith('.json') || contentType.includes('json');

  if (isJson) {
    const text = buffer.toString('utf8');
    const payload = JSON.parse(text);
    const rawRows = Array.isArray(payload)
      ? payload
      : payload.items || payload.data || payload.prices || payload.market || payload.rows || [];
    return {
      status: 200,
      payload: normalizeRows(rawRows, sourceUrl, ''),
    };
  }

  const rows = isCsv
    ? parseCsv(buffer.toString('utf8').replace(/^\uFEFF/, ''))
    : workbookRows(buffer, sheetName);

  return {
    status: 200,
    payload: normalizeRows(rows, sourceUrl, sheetName),
  };
}

module.exports = async function handler(req, res) {
  try {
    const result = await loadRowsFromSource();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', result.status === 200 ? 'public, max-age=300, stale-while-revalidate=600' : 'no-store');
    res.status(result.status).send(JSON.stringify(result.payload));
  } catch (error) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).send(JSON.stringify({
      source: process.env.ARTALE_PRICE_EXCEL_URL || process.env.ARTALE_PRICE_CSV_URL || process.env.ARTALE_PRICE_DATA_URL || 'unknown',
      error: error instanceof Error ? error.message : 'Failed to load Artale price file.',
      items: [],
    }));
  }
};
