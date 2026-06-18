function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[,\s]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function firstArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  return payload.items || payload.data || payload.prices || payload.market || payload.rows || [];
}

function normalizePayload(payload, source) {
  const rawItems = firstArray(payload);
  const items = rawItems
    .map((raw, index) => {
      const item = raw && typeof raw === 'object' ? raw : {};
      const name = String(item.name || item.itemName || item.item_name || item.title || item.item || '').trim();
      if (!name) return null;

      const latest = toNumber(item.latest ?? item.lastPrice ?? item.last_price ?? item.price ?? item.currentPrice ?? item.current_price);
      const avg24h = toNumber(item.avg24h ?? item.avg_24h ?? item.dailyAvg ?? item.dayAvg ?? item.avg1d ?? item.avg_1d, latest);
      const avg7d = toNumber(item.avg7d ?? item.avg_7d ?? item.weekAvg ?? item.sevenDayAvg ?? item.avg7days, avg24h);
      const rawTrend = Array.isArray(item.trend) ? item.trend : Array.isArray(item.history) ? item.history : Array.isArray(item.prices) ? item.prices : [];
      const trend = rawTrend
        .map((point) => {
          if (typeof point === 'number' || typeof point === 'string') return toNumber(point);
          if (point && typeof point === 'object') return toNumber(point.price ?? point.value ?? point.close ?? point.avg);
          return 0;
        })
        .filter((value) => Number.isFinite(value) && value > 0);

      const change = toNumber(item.change ?? item.changePercent ?? item.change_percent ?? item.rate, avg7d > 0 ? ((latest - avg7d) / avg7d) * 100 : 0);

      return {
        id: String(item.id || item.key || item.item_id || `${name}-${index}`),
        name,
        category: String(item.category || item.type || item.kind || '其他'),
        latest,
        avg24h,
        avg7d,
        change,
        trend: trend.length >= 2 ? trend : [avg7d || latest, avg24h || latest, latest].filter((value) => value > 0),
      };
    })
    .filter(Boolean);

  return {
    source,
    updatedAt: payload?.updatedAt || payload?.updated_at || new Date().toISOString(),
    items,
  };
}

exports.handler = async function handler() {
  const sourceUrl = process.env.ARTALE_PRICE_DATA_URL;
  const authHeader = process.env.ARTALE_PRICE_DATA_AUTH_HEADER;

  if (!sourceUrl) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        source: 'not-configured',
        error: 'ARTALE_PRICE_DATA_URL is not configured. Set it to a JSON endpoint that returns Artale price data.',
        items: [],
      }),
    };
  }

  try {
    const headers = { Accept: 'application/json' };
    if (authHeader) headers.Authorization = authHeader;

    const response = await fetch(sourceUrl, { headers });
    const text = await response.text();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ source: sourceUrl, error: `Upstream returned HTTP ${response.status}`, items: [] }),
      };
    }

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
        body: JSON.stringify({ source: sourceUrl, error: 'Upstream did not return JSON.', items: [] }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
      body: JSON.stringify(normalizePayload(payload, sourceUrl)),
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ source: sourceUrl, error: error instanceof Error ? error.message : 'Fetch failed.', items: [] }),
    };
  }
};
