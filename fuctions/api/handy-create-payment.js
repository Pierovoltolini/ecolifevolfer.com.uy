export async function onRequestPost({ request, env }) {
  try {
    const HANDY_SECRET = env.HANDY_SECRET;

    if (!HANDY_SECRET) {
      return new Response(
        JSON.stringify({ error: "Falta variable HANDY_SECRET en Cloudflare" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const order = await request.json();

    const body = {
      CallbackUrl: "https://ecolifebyvolfer.com.uy/api/handy-webhook",
      ResponseType: "Json",
      Cart: {
        InvoiceNumber: String(order.orderNumber || Date.now()),
        Currency: 858, // UYU
        TaxedAmount: order.taxedAmount || 0,
        TotalAmount: order.total || 0,
        LinkImageUrl:
          (order.items && order.items[0] && order.items[0].image) ||
          "https://ecolifebyvolfer.com.uy/img/logoecolife.png",
        TransactionExternalId:
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now())),
        Products: (order.items || []).map((i) => ({
          Name: i.name,
          Quantity: i.qty,
          Amount: i.price,
          TaxedAmount: i.taxed || 0
        }))
      },
      Client: {
        CommerceName: "EcoLife by Volfer",
        // Esta es SOLO la URL de "volver al comercio" que muestra Handy.
        // Si NO tenés pago-confirmado.html, cambiá esto a la que quieras:
        SiteUrl: "https://ecolifebyvolfer.com.uy/tienda.html"
      }
    };

    const handyRes = await fetch(
      "https://api.payments.arriba.uy/api/v2/payments",
      {
        method: "POST",
        headers: {
          "merchant-secret-key": HANDY_SECRET,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );

    const data = await handyRes.json();
    console.log("Respuesta de Handy:", handyRes.status, data);

    if (!handyRes.ok || !data.url) {
      return new Response(
        JSON.stringify({
          error: "Error al crear el pago en Handy",
          detail: data
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ url: data.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Error interno función Handy:", err);
    return new Response(
      JSON.stringify({ error: "Error interno en servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
