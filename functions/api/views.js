const WORKER_URL = "https://my-blog-likes.delta2024.workers.dev/views";

function pick(value, max = 512) {
  if (value === undefined || value === null) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) : s;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export async function onRequest({ request }) {
  const method = request.method;

  if (method !== "GET" && method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const search = new URL(request.url).search;

  if (method === "GET") {
    const authorization = request.headers.get("Authorization");
    try {
      const res = await fetch(`${WORKER_URL}${search}`, {
        method: "GET",
        headers: authorization ? { Authorization: authorization } : undefined,
      });
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return json({ error: "upstream_unreachable" }, 502);
    }
  }

  // POST：在边缘采集访客信息（只有入口请求才有 request.cf / 真实 IP），
  // 连同前端上报的页面信息一起转发给 worker 入库。
  let body = {};
  try {
    body = await request.json();
  } catch {
    // 忽略空 body
  }

  const cf = request.cf ?? {};
  const payload = {
    // 前端提供
    path: pick(body?.path, 2048),
    referrer: pick(body?.referrer, 2048),
    visitorId: pick(body?.visitorId, 128),
    language: pick(body?.language, 256),
    screen: pick(body?.screen, 64),
    // 边缘提供
    ip: pick(request.headers.get("CF-Connecting-IP"), 64),
    country: pick(cf.country ?? request.headers.get("CF-IPCountry"), 8),
    region: pick(cf.region, 128),
    city: pick(cf.city, 128),
    colo: pick(cf.colo, 16),
    asn: typeof cf.asn === "number" ? cf.asn : null,
    as_org: pick(cf.asOrganization, 256),
    ua: pick(request.headers.get("User-Agent"), 1024),
  };

  try {
    const res = await fetch(`${WORKER_URL}${search}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return json({ error: "upstream_unreachable" }, 502);
  }
}
