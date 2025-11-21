// functions/api/handy-create-payment.js

export async function onRequestPost({ request, env }) {
  try {
    const HANDY_SECRET = env.HANDY_SECRET;

    if (!HANDY_SECRET) {
      return new Response(
        JSON.stringify({ error: "Falta variable HANDY_SECRET en Cloudflare" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Orden enviada desde tu checkout (buildOrderObject)
    const order = await request.json();
    const items = Array.isArray(order.items) ? order.items : [];

    // Armamos el cuerpo según la API de Handy
    const body = {
      CallbackUrl: "https://ecolifebyvolfer.com.uy/checkout.html", // o página de gracias
      ResponseType: "Json",
      Cart: {
        InvoiceNumber: String(order.orderNumber || Date.now()),
        Currency: 858, // UYU
        TaxedAmount: Number(order.taxedAmount || 0),
        TotalAmount: Number(order.total || 0),
        LinkImageUrl:
          (items[0] && items[0].image) ||
          "https://ecolifebyvolfer.com.uy/img/logoecolife.png",
        TransactionExternalId:
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now())),
        Products: items.map((i) => ({
          Name: i.name,
          Quantity: Number(i.qty || 1),
          Amount: Number(i.price || 0),
          TaxedAmount: Number(i.taxed || 0)
        }))
      },
      Client: {
        CommerceName: "EcoLife by Volfer",
        SiteUrl: "https://ecolifebyvolfer.com.uy/tienda.html"
      }
    };

    // Llamamos a la API de Handy (testing/prod según tu clave)
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

    // Devolvemos solo la URL hacia el front
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
