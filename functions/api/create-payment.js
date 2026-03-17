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
    route: "create-payment",
    method: "GET",
    host: url.host,
    pathname: url.pathname
  });
}

export async function onRequestPost(context) {
  try {
    const MP_ACCESS_TOKEN = context.env.MP_ACCESS_TOKEN;
    const SITE_URL = context.env.SITE_URL || new URL(context.request.url).origin;
    const MP_WEBHOOK_URL = context.env.MP_WEBHOOK_URL || `${SITE_URL}/api/mp-webhook`;

    if (!MP_ACCESS_TOKEN) {
      return json(
        { error: "Falta configurar MP_ACCESS_TOKEN en Cloudflare Pages" },
        500
      );
    }

    let body;
    try {
      body = await context.request.json();
    } catch {
      return json({ error: "Body inválido, no es JSON" }, 400);
    }

    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return json({ error: "Items inválidos o vacíos" }, 400);
    }

    const items = body.items
      .map((item, index) => ({
        id: item.id || item.sku || String(index + 1),
        title: item.title || `Producto ${index + 1}`,
        description: item.description || item.title || `Producto ${index + 1}`,
        quantity: Number(item.quantity || 1),
        currency_id: item.currency_id || "USD",
        unit_price: Number(item.unit_price ?? item.price ?? 0)
      }))
      .filter(
        (item) =>
          Number.isFinite(item.quantity) &&
          item.quantity > 0 &&
          Number.isFinite(item.unit_price) &&
          item.unit_price > 0
      );

    if (!items.length) {
      return json({ error: "No hay items válidos para enviar a Mercado Pago" }, 400);
    }

    const preference = {
      items,
      payer: body.payer?.email
        ? {
            email: body.payer.email,
            name: body.payer.name || undefined,
            surname: body.payer.surname || undefined
          }
        : undefined,
      back_urls: {
        success: `${SITE_URL}/checkout-success.html`,
        failure: `${SITE_URL}/checkout-failure.html`,
        pending: `${SITE_URL}/checkout-pending.html`
      },
      auto_return: "approved",
      external_reference: body.orderId || `pedido-${Date.now()}`,
      notification_url: MP_WEBHOOK_URL,
      metadata: {
        source: "web-ecommerce",
        ...(body.metadata || {})
      }
    };

    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`
        },
        body: JSON.stringify(preference)
      }
    );

    const rawText = await mpResponse.text();

    let mpData;
    try {
      mpData = JSON.parse(rawText);
    } catch {
      return json(
        {
          error: "Mercado Pago devolvió una respuesta no JSON",
          details: rawText
        },
        502
      );
    }

    if (!mpResponse.ok) {
      return json(
        {
          error: "Error creando preferencia en Mercado Pago",
          status: mpResponse.status,
          details: mpData
        },
        502
      );
    }

    return json({
      ok: true,
      preferenceId: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point
    });
  } catch (error) {
    return json(
      {
        error: "Error interno en create-payment",
        details: error.message
      },
      500
    );
  }
}