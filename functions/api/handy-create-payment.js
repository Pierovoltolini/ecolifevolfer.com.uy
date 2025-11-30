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

    const order = await request.json();
    const items = Array.isArray(order.items) ? order.items : [];

    // === 👇 ACÁ CONVERTIMOS USD → UYU (ya lo hacías en el checkout) ===
    const USD_TO_UYU = 40;
    const totalUSD = Number(order.total || 0);
    const totalUYU = Math.round(totalUSD * USD_TO_UYU);

    const body = {
      CallbackUrl: "https://ecolifevolfer.com.uy/checkout.html",
      ResponseType: "Json",
      Cart: {
        InvoiceNumber: String(order.orderNumber || Date.now()),
        
        // === 👇 CORRECCIÓN IMPORTANTE ===
        Currency: "UYU",          // Handy NO acepta 858
        TotalAmount: totalUYU,    // Total en pesos
        
        TaxedAmount: 0,
        LinkImageUrl:
          (items[0] && items[0].image) ||
          "https://ecolifevolfer.com.uy/img/logoecolife.png",
        TransactionExternalId:
          crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        Products: items.map((i) => ({
          Name: i.name,
          Quantity: Number(i.qty || 1),
          Amount: Math.round((Number(i.price) || 0) * USD_TO_UYU), // PRODUCTO EN UYU
          TaxedAmount: 0
        }))
      },
      Client: {
        CommerceName: "EcoLife by Volfer",
        SiteUrl: "https://ecolifevolfer.com.uy/tienda.html"
      }
    };

    // === 👇 ENDPOINT PRODUCCIÓN CORRECTO ===
    const handyRes = await fetch(
      "https://payments.plexo.com.uy/api/v2/payments",
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
    console.log("Respuesta Handy:", handyRes.status, data);

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
    console.error("Error interno Handy:", err);
    return new Response(
      JSON.stringify({ error: "Error interno en servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
