// 全站计数器：单一 Durable Object 实例串行处理所有读写，保证强一致。
// 点赞（key='count'）与全站浏览量（key='views'）共用同一实例，避免并发自增丢数。
export class LikeCounter {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const isViews =
      new URL(request.url).pathname.replace(/\/+$/, '') === '/views';
    const key = isViews ? 'views' : 'count';
    const field = isViews ? 'views' : 'likes';

    let count = (await this.storage.get(key)) ?? 0;

    if (request.method === 'POST') {
      count += 1;
      await this.storage.put(key, count);
    }

    return new Response(JSON.stringify({ [field]: count }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// 公开的点赞接口，无凭证，直接回显请求 Origin，避免 CORS 成为干扰因素。
function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      request.headers.get('Access-Control-Request-Headers') || 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

function str(value, max = 512) {
  if (value === undefined || value === null) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

// 把一条访客明细写入 D1。尽力而为：失败只记日志，不影响浏览计数。
async function logVisit(request, env) {
  if (!env.DB) return;

  try {
    const payload = await request.clone().json();

    await env.DB.prepare(
      `INSERT INTO visits
         (ts, path, referrer, ip, country, region, city, colo, asn, as_org, ua, language, visitor_id, screen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        Date.now(),
        str(payload.path, 2048),
        str(payload.referrer, 2048),
        str(payload.ip, 64),
        str(payload.country, 8),
        str(payload.region, 128),
        str(payload.city, 128),
        str(payload.colo, 16),
        typeof payload.asn === 'number' ? payload.asn : null,
        str(payload.as_org, 256),
        str(payload.ua, 1024),
        str(payload.language, 256),
        str(payload.visitorId, 128),
        str(payload.screen, 64)
      )
      .run();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('visit log failed:', err);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders(request),
      });
    }

    const isViews =
      new URL(request.url).pathname.replace(/\/+$/, '') === '/views';

    // 浏览量只对持有令牌的人可读；未配置 VIEWS_TOKEN 时默认拒绝，避免误暴露。
    if (isViews && request.method === 'GET') {
      const expected = env.VIEWS_TOKEN;
      const provided = request.headers.get('Authorization') || '';
      if (!expected || provided !== `Bearer ${expected}`) {
        return json({ error: 'unauthorized' }, 401, request);
      }
    }

    // 浏览的 POST 在边缘已采集明细，这里落库；DO 只需按方法自增。
    if (isViews && request.method === 'POST') {
      await logVisit(request, env);
    }

    const id = env.LIKE_COUNTER.idFromName('global');
    const stub = env.LIKE_COUNTER.get(id);

    // 浏览 POST 用不带 body 的新请求转发，避免请求体被重复消费。
    const doRequest =
      isViews && request.method === 'POST'
        ? new Request(request.url, { method: 'POST' })
        : request;
    const res = await stub.fetch(doRequest);

    // 对外的自增请求不回显数字，防止任意访客通过 POST 读到浏览量。
    if (isViews && request.method === 'POST') {
      return json({ ok: true }, res.status, request);
    }

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  },
};
