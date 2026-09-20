const ALLOWED_ORIGINS = [
  'https://tyxnotebook.pages.dev', // 生产环境域名（不要带结尾斜杠）
  'http://localhost:4321', // astro dev
  'http://localhost:3000',
];

function resolveOrigin(request) {
  const origin = request.headers.get('Origin') ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // 允许 Cloudflare Pages 的预览部署
  if (/^https:\/\/[a-z0-9-]+\.tyxnotebook\.pages\.dev$/.test(origin)) {
    return origin;
  }
  return ALLOWED_ORIGINS[0];
}

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': resolveOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // KV 中存储的键名，你可以自定义
    const key = 'total_likes';
    let count = parseInt(await env.LIKES_KV.get(key)) || 0;

    if (request.method === 'POST') {
      count += 1;
      await env.LIKES_KV.put(key, count.toString());
      return new Response(JSON.stringify({ likes: count }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ likes: count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};