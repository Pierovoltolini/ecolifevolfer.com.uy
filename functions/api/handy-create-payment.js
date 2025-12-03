async function createHandyPayment(order) {
  try {
    const res = await fetch("/api/handy-create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    });

    const data = await res.json();

    if (data.url) {
      alert("Pedido enviado correctamente. Serás dirigido a Handy para procesar el pago.");
      window.location.href = data.url;
    } else {
      alert("Ocurrió un error al generar el pago.");
      console.error(data);
    }
  } catch (err) {
    alert("Error inesperado. Intenta de nuevo.");
    console.error(err);
  }
}
