function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function onRequestGet(context) {
  const url = new URL(context.request.url);

  return json({
    ok: true,
    route: "mp-webhook",
    method: "GET",
    host: url.host,
    pathname: url.pathname
  });
}

export async function onRequestPost(context) {
  try {
    const headers = Object.fromEntries(context.request.headers.entries());
    const rawBody = await context.request.text();

    console.log("Webhook Mercado Pago recibido");
    console.log("Headers:", headers);
    console.log("Body:", rawBody);

    return json({ ok: true });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message
      },
      500
    );
  }
}