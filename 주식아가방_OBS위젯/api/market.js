// Vercel 서버리스 함수 - 서버에서 직접 Yahoo Finance 호출 (CORS 없음)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');

  const symbols = {
    kospi:  '^KS11',
    kosdaq: '^KQ11',
    sp500:  '^GSPC',
    oil:    'CL=F',   // WTI 원유
    us10y:  '^TNX',   // 미국 10년 국채
  };

  async function fetchOne(sym) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=1d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const json = await r.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose || price;
    const diff  = price - prev;
    const pct   = prev ? (diff / prev * 100) : 0;
    return {
      price: +price.toFixed(2),
      diff:  +diff.toFixed(2),
      pct:   +pct.toFixed(2),
      state: meta.marketState || 'CLOSED',
    };
  }

  try {
    const results = await Promise.allSettled(
      Object.entries(symbols).map(async ([key, sym]) => {
        const data = await fetchOne(sym);
        return [key, data];
      })
    );

    const out = {};
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const [key, data] = r.value;
        out[key] = data;
      }
    }
    out.timestamp = Date.now();
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
