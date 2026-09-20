const WORKER_URL = "https://my-blog-likes.delta2024.workers.dev";

export async function onRequest({ request }) {
  const method = request.method;

  if (method !== "GET" && method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const res = await fetch(WORKER_URL, { method });

    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: "upstream_unreachable" }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  }
}
