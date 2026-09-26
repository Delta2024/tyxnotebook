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

    const id = env.LIKE_COUNTER.idFromName('global');
    const stub = env.LIKE_COUNTER.get(id);
    const res = await stub.fetch(request);

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
