// 点赞计数：单一 Durable Object 实例串行处理所有读写，保证强一致。
export class LikeCounter {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    let count = (await this.storage.get('count')) ?? 0;

    if (request.method === 'POST') {
      count += 1;
      await this.storage.put('count', count);
    }

    return new Response(JSON.stringify({ likes: count }), {
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

    const id = env.LIKE_COUNTER.idFromName('global');
    const stub = env.LIKE_COUNTER.get(id);
    const res = await stub.fetch(request);

    return new Response(res.body, {
      status: res.status,
      headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
    });
  },
};
