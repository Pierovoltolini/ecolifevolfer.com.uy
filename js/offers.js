// js/offers.js
// Reglas en data/offers.json -> ver ejemplo más abajo
(function (global) {
  // prioriza: sku > brand > category
  const rank = { sku: 3, brand: 2, category: 1 };

  function activeNow(rule, now = new Date()){
    if (!rule.start && !rule.end) return true;
    const t = now.getTime();
    const s = rule.start ? new Date(rule.start).getTime() : -Infinity;
    const e = rule.end   ? new Date(rule.end).getTime()   :  Infinity;
    return t >= s && t <= e;
  }

  function discountPrice(price, rule){
    if (rule.priceNew != null) return Number(rule.priceNew);
    if (rule.discountPct != null) return Math.round(Number(price) * (1 - Number(rule.discountPct)/100));
    return price;
  }

  // aplica sobre un array de productos {id, price, brand, category}
  function applyOffers(products, rules, now=new Date()){
    if (!Array.isArray(products)) return [];
    const act = Array.isArray(rules) ? rules.filter(r => activeNow(r, now)) : [];

    return products.map(p => {
      const cand = [];
      for (const r of act){
        if (r.type === 'sku'      && r.sku      && String(r.sku).toLowerCase() === String(p.id).toLowerCase()) cand.push(r);
        if (r.type === 'brand'    && r.brand    && String(r.brand).toLowerCase() === String(p.brand).toLowerCase()) cand.push(r);
        if (r.type === 'category' && r.category && String(r.category).toLowerCase() === String(p.category).toLowerCase()) cand.push(r);
      }
      if (!cand.length) return {...p, onSale:false, priceOld:null, price:Number(p.price||0)};

      // elegir la de mayor prioridad (y si empata, la mayor discountPct)
      cand.sort((a,b)=> (rank[b.type]-rank[a.type]) || ((b.discountPct||0)-(a.discountPct||0)));
      const best = cand[0];

      const old = Number(p.price||0);
      const newP = discountPrice(old, best);
      return {...p, onSale: newP < old, priceOld: old, price: newP, offerRule: best};
    });
  }

  global.applyOffers = applyOffers;
})(window);
