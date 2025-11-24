export async function onRequestPost({ request, env }) {
  try {
    const HANDY_SECRET = env.HANDY_SECRET;

    if (!HANDY_SECRET) {
      return new Response(
        JSON.stringify({ error: "Falta variable HANDY_SECRET" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const order = await request.json();
    const USD_RATE = 40;

    // Total y montos convertidos a UYU
    const totalUYU = Math.round((order.total || 0) * USD_RATE);

    const items = Array.isArray(order.items) ? order.items : [];

    const body = {
      CallbackUrl: "https://ecolifevolfer.com.uy/checkout", 
      ResponseType: "Json",
      Cart: {
        InvoiceNumber: String(order.orderNumber || Date.now()),
        Currency: 858, 
        TaxedAmount: 0,
        TotalAmount: totalUYU,
        LinkImageUrl:
          (items[0] && items[0].image) ||
          "https://ecolifevolfer.com.uy/img/logoecolife.png",
        TransactionExternalId:
          crypto?.randomUUID?.() ?? String(Date.now()),
        Products: items.map((i) => ({
          Name: i.name,
          Quantity: Number(i.qty || 1),
          Amount: Math.round(Number(i.price || 0) * USD_RATE),
          TaxedAmount: 0
        }))
      },
      Client: {
        CommerceName: "EcoLife by Volfer",
        SiteUrl: "https://ecolifevolfer.com.uy"
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

    console.log("Handy dijo:", handyRes.status, data);

    if (!handyRes.ok || !data.url) {
      return new Response(
        JSON.stringify({
          error: "Error en Handy",
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
    console.error("Error Worker Handy:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
