(function () {
  "use strict";
  var CFG = window.MEKACHI_CONFIG, CAT = window.MEKACHI_CATALOGO;
  var byId = {}; CAT.forEach(function (p) { byId[p.id] = p; });

  // ---- Almacenamiento. Hoy vive en el navegador; esta capa es la que se
  // ---- cambia por la base de datos cuando el panel se conecte al servidor.
  var store = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem("mekachi." + k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("mekachi." + k, JSON.stringify(v)); } catch (e) {} }
  };

  var state = {
    view: "catalogo", q: "", cat: "Todas",
    cart: store.get("cart", []),      // [{id, qty}] o [{custom:true, key, nombre, vehiculo, qty}]
    orders: store.get("orders", []),
    taller: store.get("taller", { nombre: "", contacto: "", telefono: "", direccion: "", zona: CFG.zonas[0] })
  };
  var VIEWS = [["catalogo", "Repuestos"], ["carrito", "Carrito"], ["pedidos", "Pedidos"], ["perfil", "Mi taller"]];

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var usd = function (n) { return "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var cartCount = function () { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); };
  var saveCart = function () { store.set("cart", state.cart); };
  var line = function (id) { return state.cart.filter(function (l) { return l.id === id; })[0]; };

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  function totals(lines) {
    var sub = 0, porCotizar = 0;
    lines.forEach(function (l) { if (l.custom) porCotizar += 1; else sub += l.precio * l.qty; });
    var iva = sub * CFG.iva;
    return { sub: sub, iva: iva, total: sub + iva, porCotizar: porCotizar };
  }
  // Líneas del carrito con nombre y precio resueltos.
  function cartLines() {
    return state.cart.map(function (l) {
      if (l.custom) return l;
      var p = byId[l.id];
      return p ? { id: l.id, qty: l.qty, nombre: p.nombre, compat: p.compat, precio: p.precio } : null;
    }).filter(Boolean);
  }

  // ---------- Navegación
  function nav() {
    var n = cartCount();
    var html = VIEWS.map(function (v) {
      return '<button data-go="' + v[0] + '"' + (state.view === v[0] ? ' aria-current="page"' : "") + ">" + v[1] +
        (v[0] === "carrito" && n ? '<span class="badge">' + n + "</span>" : "") + "</button>";
    }).join("");
    $("#tabs").innerHTML = html;
  }
  function go(v) {
    state.view = v; render();
    var w = $("#appwin");
    if (w.getBoundingClientRect().top < 0) w.scrollIntoView({ block: "start" });
  }

  // ---------- Catálogo
  function stepper(key, qty) {
    return '<div class="stepper"><button data-dec="' + key + '" aria-label="Quitar uno">−</button><span>' + qty +
      '</span><button data-inc="' + key + '" aria-label="Agregar uno">+</button></div>';
  }
  function listHtml() {
    var q = norm(state.q.trim());
    var items = CAT.filter(function (p) {
      if (state.cat !== "Todas" && p.cat !== state.cat) return false;
      if (!q) return true;
      var hay = norm(p.nombre + " " + p.compat + " " + p.cat);
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    });
    if (!items.length) return '<div class="empty">No hay repuestos con esa búsqueda.<br>Pídelo abajo y te lo cotizamos.</div>';
    return items.map(function (p) {
      var l = line(p.id);
      return '<div class="item"><div><div class="name">' + esc(p.nombre) + '</div><div class="meta">' + esc(p.compat) +
        '</div><div class="price">' + usd(p.precio) + ' <span class="meta">+ IVA</span></div></div>' +
        (l ? stepper(p.id, l.qty) : '<button class="btn sm primary" data-inc="' + p.id + '">Agregar</button>') + "</div>";
    }).join("");
  }
  function cartbarHtml() {
    var n = cartCount();
    return n ? '<button class="btn primary block" data-go="carrito">Ver carrito · ' + n + (n === 1 ? " artículo" : " artículos") + "</button>" : "";
  }
  function viewCatalogo() {
    var cats = ["Todas"].concat(CAT.map(function (p) { return p.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    return "<h1>Pedir repuestos</h1><p class='muted small'>Entrega en el taller. Precios de ejemplo mientras se carga la lista real.</p>" +
      '<input type="search" id="q" placeholder="Buscar: pastillas Aveo, filtro Sail…" value="' + esc(state.q) + '" aria-label="Buscar repuesto">' +
      '<div class="chips">' + cats.map(function (c) { return '<button data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
      '<div class="list" id="lista">' + listHtml() + "</div>" +
      '<form class="card" id="f-otro" style="margin-top:18px"><h2>¿No está en la lista?</h2><p class="muted small">Descríbelo y te enviamos precio y disponibilidad.</p>' +
      '<div class="field"><label for="o-desc">Repuesto</label><input id="o-desc" required placeholder="Ej.: bomba de agua"></div>' +
      '<div class="row3"><div class="field"><label for="o-marca">Marca</label><input id="o-marca" required placeholder="Chevrolet"></div>' +
      '<div class="field"><label for="o-modelo">Modelo</label><input id="o-modelo" required placeholder="Aveo"></div>' +
      '<div class="field"><label for="o-anio">Año</label><input id="o-anio" inputmode="numeric" pattern="(19|20)[0-9]{2}" required placeholder="2014"></div></div>' +
      '<button class="btn block">Agregar al pedido para cotizar</button></form>' +
      '<div class="cartbar" id="cartbar">' + cartbarHtml() + "</div>";
  }

  // ---------- Carrito
  function viewCarrito() {
    var lines = cartLines();
    if (!lines.length) return "<h1>Carrito</h1><div class='empty'>Todavía no has agregado repuestos.<br><br><button class='btn primary' data-go='catalogo'>Ver repuestos</button></div>";
    var t = totals(lines), tl = state.taller;
    return "<h1>Carrito</h1><div class='list' style='margin-top:12px'>" + lines.map(function (l) {
      return '<div class="item"><div><div class="name">' + esc(l.nombre) + '</div><div class="meta">' + esc(l.custom ? l.vehiculo : l.compat) +
        '</div><div class="price">' + (l.custom ? '<span class="meta">Por cotizar</span>' : usd(l.precio * l.qty)) + "</div></div>" +
        stepper(l.custom ? l.key : l.id, l.qty) + "</div>";
    }).join("") + "</div>" +
      '<div class="card" style="margin-top:12px"><div class="totals"><div><span>Subtotal</span><span>' + usd(t.sub) + "</span></div><div><span>IVA " + Math.round(CFG.iva * 100) + " %</span><span>" + usd(t.iva) +
      '</span></div><div class="total"><span>Total</span><span>' + usd(t.total) + "</span></div></div>" +
      (t.porCotizar ? '<p class="muted small" style="margin:8px 0 0">Incluye ' + t.porCotizar + (t.porCotizar === 1 ? " repuesto" : " repuestos") + " por cotizar; su precio se confirma antes del despacho.</p>" : "") + "</div>" +
      '<form class="card" id="f-pedido"><h2>Entrega</h2>' +
      '<div class="field"><label for="p-nombre">Nombre del taller</label><input id="p-nombre" required value="' + esc(tl.nombre) + '"></div>' +
      '<div class="field"><label for="p-dir">Dirección de entrega</label><input id="p-dir" required value="' + esc(tl.direccion) + '" placeholder="Calle, número y referencia"></div>' +
      '<div class="row"><div class="field"><label for="p-zona">Zona</label><select id="p-zona">' + CFG.zonas.map(function (z) { return "<option" + (z === tl.zona ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("") + "</select></div>" +
      '<div class="field"><label for="p-pago">Forma de pago</label><select id="p-pago">' + CFG.pagos.map(function (z) { return "<option>" + esc(z) + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="field"><label for="p-nota">Nota para el despacho (opcional)</label><textarea id="p-nota" rows="2" placeholder="Ej.: urgente, el auto está en el elevador"></textarea></div>' +
      '<button class="btn primary block">Confirmar pedido</button></form>';
  }

  // ---------- Pedidos
  function orderText(o) {
    var t = ["Pedido Mekachi " + o.num, "Taller: " + o.taller.nombre, "Dirección: " + o.taller.direccion + " (" + o.taller.zona + ")"];
    if (o.taller.telefono) t.push("Teléfono: " + o.taller.telefono);
    t.push("");
    o.lines.forEach(function (l) {
      t.push("• " + l.qty + " x " + l.nombre + " — " + (l.custom ? l.vehiculo + " (por cotizar)" : l.compat + " — " + usd(l.precio * l.qty)));
    });
    t.push("", "Total con IVA: " + usd(o.total) + (o.porCotizar ? " + repuestos por cotizar" : ""), "Pago: " + o.pago);
    if (o.nota) t.push("Nota: " + o.nota);
    return t.join("\n");
  }
  var waUrl = function (o) { return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(orderText(o)); };
  function viewPedidos() {
    if (!state.orders.length) return "<h1>Pedidos</h1><div class='empty'>Aquí aparecerán tus pedidos.</div>";
    return "<h1>Pedidos</h1><div class='notice'>El pedido llega a Mekachi cuando lo envías por WhatsApp. El seguimiento automático del estado se activa al conectar el panel con el servidor.</div>" +
      state.orders.map(function (o) {
        return '<div class="card"><div class="order-head"><div><h2>' + esc(o.num) + '</h2><div class="muted small">' +
          new Date(o.fecha).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }) + " · " + esc(o.pago) + '</div></div><span class="status">Registrado</span></div>' +
          '<ul class="order-lines">' + o.lines.map(function (l) {
            return "<li><span>" + l.qty + " × " + esc(l.nombre) + ' <span class="muted">· ' + esc(l.custom ? l.vehiculo : l.compat) + "</span></span><span>" + (l.custom ? "Por cotizar" : usd(l.precio * l.qty)) + "</span></li>";
          }).join("") + "</ul><div class='totals' style='margin-bottom:12px'><div class='total' style='border:0;padding:0;font-size:1.05rem'><span>Total con IVA</span><span>" + usd(o.total) + "</span></div></div>" +
          '<div class="actions"><a class="btn sm primary" target="_blank" rel="noopener" href="' + esc(waUrl(o)) + '">Enviar por WhatsApp</a>' +
          '<button class="btn sm" data-repeat="' + esc(o.num) + '">Repetir pedido</button></div></div>';
      }).join("");
  }

  // ---------- Perfil
  function viewPerfil() {
    var t = state.taller;
    return "<h1>Mi taller</h1><p class='muted small'>Estos datos se usan en cada pedido.</p><form class='card' id='f-perfil'>" +
      '<div class="field"><label for="t-nombre">Nombre del taller</label><input id="t-nombre" required value="' + esc(t.nombre) + '"></div>' +
      '<div class="row"><div class="field"><label for="t-contacto">Persona de contacto</label><input id="t-contacto" value="' + esc(t.contacto) + '"></div>' +
      '<div class="field"><label for="t-tel">Teléfono</label><input id="t-tel" type="tel" value="' + esc(t.telefono) + '"></div></div>' +
      '<div class="field"><label for="t-dir">Dirección</label><input id="t-dir" value="' + esc(t.direccion) + '" placeholder="Calle, número y referencia"></div>' +
      '<div class="field"><label for="t-zona">Zona de Quito</label><select id="t-zona">' + CFG.zonas.map(function (z) { return "<option" + (z === t.zona ? " selected" : "") + ">" + esc(z) + "</option>"; }).join("") + "</select></div>" +
      '<button class="btn primary block">Guardar</button></form>' +
      '<p class="muted small">Versión de prueba: los datos se guardan solo en este teléfono o computador.</p>';
  }

  function render() {
    nav();
    $("#app").innerHTML = { catalogo: viewCatalogo, carrito: viewCarrito, pedidos: viewPedidos, perfil: viewPerfil }[state.view]();
  }
  // Actualiza solo la lista para no perder el foco del buscador.
  function refreshList() {
    nav();
    if (state.view !== "catalogo") return render();
    $("#lista").innerHTML = listHtml(); $("#cartbar").innerHTML = cartbarHtml();
  }

  function change(key, d) {
    var l = state.cart.filter(function (x) { return (x.custom ? x.key : x.id) === key; })[0];
    if (!l) { if (d > 0 && byId[key]) state.cart.push({ id: key, qty: 1 }); }
    else { l.qty += d; if (l.qty <= 0) state.cart.splice(state.cart.indexOf(l), 1); }
    saveCart(); refreshList();
  }

  // ---------- Eventos
  document.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    var d = b.dataset;
    if (d.go) go(d.go);
    else if (d.inc) change(d.inc, 1);
    else if (d.dec) change(d.dec, -1);
    else if (d.cat) { state.cat = d.cat; render(); }
    else if (d.repeat) {
      var o = state.orders.filter(function (x) { return x.num === d.repeat; })[0];
      state.cart = o.lines.map(function (l) {
        return l.custom ? { custom: true, key: "x" + Date.now() + Math.random(), nombre: l.nombre, vehiculo: l.vehiculo, qty: l.qty } : { id: l.id, qty: l.qty };
      }).filter(function (l) { return l.custom || byId[l.id]; });
      saveCart(); go("carrito");
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "q") { state.q = e.target.value; refreshList(); }
  });
  document.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = function (id) { return $("#" + id).value.trim(); };
    if (e.target.id === "f-otro") {
      state.cart.push({ custom: true, key: "x" + Date.now(), nombre: v("o-desc"), vehiculo: v("o-marca") + " " + v("o-modelo") + " " + v("o-anio"), qty: 1 });
      saveCart(); render(); toast("Agregado al pedido para cotizar");
    } else if (e.target.id === "f-perfil") {
      state.taller = { nombre: v("t-nombre"), contacto: v("t-contacto"), telefono: v("t-tel"), direccion: v("t-dir"), zona: v("t-zona") };
      store.set("taller", state.taller); toast("Datos guardados");
    } else if (e.target.id === "f-pedido") {
      var lines = cartLines(), t = totals(lines);
      state.taller.nombre = v("p-nombre"); state.taller.direccion = v("p-dir"); state.taller.zona = v("p-zona");
      store.set("taller", state.taller);
      var seq = store.get("seq", 0) + 1; store.set("seq", seq);
      state.orders.unshift({
        num: "MK-" + String(seq).padStart(4, "0"), fecha: new Date().toISOString(), lines: lines,
        sub: t.sub, iva: t.iva, total: t.total, porCotizar: t.porCotizar, pago: v("p-pago"), nota: v("p-nota"),
        taller: JSON.parse(JSON.stringify(state.taller))
      });
      store.set("orders", state.orders);
      state.cart = []; saveCart(); go("pedidos"); toast("Pedido registrado. Envíalo por WhatsApp.");
    }
  });

  render();
})();
