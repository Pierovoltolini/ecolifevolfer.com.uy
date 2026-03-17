export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    // 🔥 Validación básica
    if (!body.items || !Array.isArray(body.items)) {
      return new Response(JSON.stringify({
        error: "Items inválidos"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 🔥 Llamada a Mercado Pago
    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer APP_USR-4374141298019499-031615-797bd08fbe5bf4fb509f308e81740251-3270627079"
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

    // 🔥 Respuesta al frontend
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