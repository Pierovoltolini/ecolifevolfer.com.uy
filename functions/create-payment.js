export async function onRequestPost(context) {
  try {
    // 📦 Leer body del frontend
    const body = await context.request.json();

    // 🛑 Validación básica
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(JSON.stringify({
        error: "Items inválidos"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 🔐 Token desde Cloudflare (NUNCA hardcodeado)
    const accessToken = context.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      return new Response(JSON.stringify({
        error: "Falta configurar MP_ACCESS_TOKEN en Cloudflare"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 💳 Crear preferencia en Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        items: body.items,

        back_urls: {
          success: "https://ecolifevolfer.com.uy",
          failure: "https://ecolifevolfer.com.uy",
          pending: "https://ecolifevolfer.com.uy"
        },

        auto_return: "approved"
      })
    });

    const data = await mpResponse.json();

    // 🛑 Manejo de error de Mercado Pago
    if (!mpResponse.ok) {
      return new Response(JSON.stringify({
        error: "Error en Mercado Pago",
        detail: data
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 🚀 Respuesta al frontend
    return new Response(JSON.stringify({
      init_point: data.init_point
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: "Error creando preferencia",
      detail: error.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}