(function () {
  "use strict";
  var CFG = window.MEKACHI_CONFIG, CAT = window.MEKACHI_CATALOGO, SINT = window.MEKACHI_SINTOMAS,
      TALL = window.MEKACHI_TALLERES, ESP = window.MEKACHI_ESPECIALIDADES, URG = window.MEKACHI_URGENCIA;
  var byId = {}; CAT.forEach(function (p) { byId[p.id] = p; });
  var sintById = {}; SINT.forEach(function (s) { sintById[s.id] = s; });
  var tallById = {}; TALL.forEach(function (t) { tallById[t.id] = t; });

  // ---- Almacenamiento. Hoy vive en el navegador; esta capa es la que se
  // ---- cambia por la base de datos cuando la app se conecte al servidor.
  var store = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem("mekachi." + k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("mekachi." + k, JSON.stringify(v)); } catch (e) {} }
  };

  var MODES = {
    conductor: [["diag", "Diagnóstico"], ["talleres", "Talleres"], ["solicitudes", "Mis solicitudes"]],
    taller: [["trabajos", "Trabajos"], ["catalogo", "Repuestos"], ["carrito", "Carrito"], ["pedidos", "Pedidos"], ["perfil", "Mi taller"]]
  };
  var state = {
    mode: "conductor", view: "diag",
    // conductor
    dq: "", dcat: "Todos", dsel: null, fesp: "Todas", fzona: "Todas", pos: null, tsel: null,
    solicitudes: store.get("solicitudes", []),
    conductor: store.get("conductor", { nombre: "", tel: "", marca: "", modelo: "", anio: "" }),
    // taller
    q: "", cat: "Todas",
    cart: store.get("cart", []),
    orders: store.get("orders", []),
    taller: store.get("taller", { nombre: "", contacto: "", telefono: "", direccion: "", zona: CFG.zonas[0] })
  };

  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var usd = function (n) { return "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var cartCount = function () { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); };
  var saveCart = function () { store.set("cart", state.cart); };
  var line = function (id) { return state.cart.filter(function (l) { return l.id === id; })[0]; };
  var opts = function (list, sel) { return list.map(function (z) { return "<option" + (z === sel ? " selected" : "") + ">" + esc(z) + "</option>"; }).join(""); };
  var fecha = function (iso) { return new Date(iso).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }); };
  var wa = function (text) { return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text); };
  var nextNum = function (key, prefix) { var n = store.get(key, 0) + 1; store.set(key, n); return prefix + "-" + String(n).padStart(4, "0"); };

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  // ---------- Navegación
  function nav() {
    var n = cartCount();
    $("#modes").innerHTML = [["conductor", "Conductor"], ["taller", "Taller"]].map(function (m) {
      return '<button data-mode="' + m[0] + '" aria-pressed="' + (state.mode === m[0]) + '">' + m[1] + "</button>";
    }).join("");
    var cur = state.view === "solicitar" ? "talleres" : state.view;
    $("#tabs").innerHTML = MODES[state.mode].map(function (v) {
      var badge = v[0] === "carrito" && n ? n : v[0] === "trabajos" && state.solicitudes.length ? state.solicitudes.length : 0;
      return '<button data-go="' + v[0] + '"' + (cur === v[0] ? ' aria-current="page"' : "") + ">" + v[1] +
        (badge ? '<span class="badge">' + badge + "</span>" : "") + "</button>";
    }).join("");
  }
  function go(v) {
    state.view = v; render();
    var w = $("#appwin");
    if (w.getBoundingClientRect().top < 0) w.scrollIntoView({ block: "start" });
  }
  function setMode(m, view) { state.mode = m; go(view || MODES[m][0][0]); }

  // =====================================================================
  // CONDUCTOR
  // =====================================================================

  // ---------- Diagnóstico
  var STOP = { para: 1, cuando: 1, auto: 1, carro: 1, tiene: 1, hace: 1, esta: 1, como: 1, pero: 1, desde: 1, mucho: 1, algo: 1, sale: 1 };
  function matchSint() {
    var words = norm(state.dq).split(/[^a-z0-9/]+/).filter(function (w) { return w.length > 2 && !STOP[w]; })
      .map(function (w) { return w.length > 5 ? w.slice(0, 5) : w; });
    var list = SINT.filter(function (s) { return state.dcat === "Todos" || s.cat === state.dcat; });
    if (!words.length) return list;
    return list.map(function (s) {
      var hay = norm(s.titulo + " " + s.claves.join(" ") + " " + s.cat);
      return { s: s, n: words.filter(function (w) { return hay.indexOf(w) >= 0; }).length };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; }).map(function (x) { return x.s; });
  }
  function sintListHtml() {
    var items = matchSint();
    if (!items.length) return '<div class="empty">No encontramos un síntoma parecido.<br>Prueba con otras palabras o elige una categoría.<br><br><button class="btn sm" data-go="talleres">Ver talleres de todos modos</button></div>';
    return items.map(function (s) {
      return '<button class="sint" data-sint="' + s.id + '"><span><b>' + esc(s.titulo) + '</b><small>' + esc(s.cat) + '</small></span><i class="dot ' + s.urgencia + '"></i></button>';
    }).join("");
  }
  function viewDiag() {
    if (state.dsel) return viewResultado(sintById[state.dsel]);
    var cats = ["Todos"].concat(SINT.map(function (s) { return s.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    return "<h1>¿Qué le pasa a tu auto?</h1><p class='muted small'>Cuéntalo con tus palabras o elige un síntoma. Te damos una primera orientación.</p>" +
      '<input type="search" id="dq" placeholder="Ej.: chilla al frenar, no prende, se calienta…" value="' + esc(state.dq) + '" aria-label="Describe el problema">' +
      '<div class="chips">' + cats.map(function (c) { return '<button data-dcat="' + esc(c) + '" aria-pressed="' + (state.dcat === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
      '<div class="list" id="sintomas">' + sintListHtml() + "</div>";
  }
  function viewResultado(s) {
    var u = URG[s.urgencia];
    var li = function (a) { return "<ul class='plain'>" + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
    return '<button class="back" data-volver="1">← Otro síntoma</button><h1>' + esc(s.titulo) + "</h1>" +
      '<div class="urg ' + s.urgencia + '"><b>' + esc(u.titulo) + "</b><span>" + esc(u.texto) + "</span></div>" +
      (s.nota ? '<div class="notice">' + esc(s.nota) + "</div>" : "") +
      '<div class="card"><h2>Causas más probables</h2>' + li(s.causas) + "</div>" +
      '<div class="card"><h2>Servicio recomendado</h2><p>' + esc(s.servicio) + "</p><h2>Repuestos que suele requerir</h2>" + li(s.repuestos) + "</div>" +
      '<button class="btn primary block" data-buscartaller="' + esc(s.esp) + '">Ver talleres de ' + esc(s.esp.toLowerCase()) + "</button>" +
      '<p class="muted small" style="margin-top:12px">Orientación inicial basada en síntomas comunes. No reemplaza la revisión de un mecánico.</p>';
  }

  // ---------- Talleres y mapa
  function dist(a, b) {
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function talleresFiltrados() {
    var list = TALL.filter(function (t) {
      return (state.fesp === "Todas" || t.esp.indexOf(state.fesp) >= 0) && (state.fzona === "Todas" || t.zona === state.fzona);
    }).map(function (t) { return { t: t, d: state.pos ? dist(state.pos, t) : null }; });
    if (state.pos) list.sort(function (a, b) { return a.d - b.d; });
    return list;
  }
  function viewTalleres() {
    var list = talleresFiltrados();
    return "<h1>Talleres cerca de ti</h1><p class='muted small'>Talleres de ejemplo para la demostración; todavía no son talleres reales.</p>" +
      '<div class="row"><div class="field"><label for="f-esp">Especialidad</label><select id="f-esp">' + opts(["Todas"].concat(ESP), state.fesp) + "</select></div>" +
      '<div class="field"><label for="f-zona">Zona</label><select id="f-zona">' + opts(["Todas"].concat(CFG.zonas), state.fzona) + "</select></div></div>" +
      '<div id="mapa" aria-label="Mapa de talleres"></div>' +
      '<button class="btn sm block" data-ubicar="1" style="margin:10px 0 14px">' + (state.pos ? "Ordenado por cercanía · actualizar ubicación" : "Usar mi ubicación para ordenar por cercanía") + "</button>" +
      '<div class="list" id="tlist">' + (list.length ? list.map(function (x) {
        var t = x.t;
        return '<div class="tcard" id="tc-' + t.id + '"><div><div class="name">' + esc(t.nombre) + '</div><div class="meta">' + esc(t.sector) + " · " + esc(t.zona) +
          (x.d != null ? " · a " + x.d.toFixed(1).replace(".", ",") + " km" : "") + '</div><div class="tags">' +
          t.esp.map(function (e) { return "<span" + (e === state.fesp ? ' class="on"' : "") + ">" + esc(e) + "</span>"; }).join("") + "</div></div>" +
          '<button class="btn sm primary" data-solicitar="' + t.id + '">Solicitar</button></div>';
      }).join("") : '<div class="empty">No hay talleres con ese filtro.</div>') + "</div>";
  }
  var map = null;
  function initMap() {
    var el = $("#mapa"); if (!el) return;
    if (map) { map.remove(); map = null; }
    if (!window.L) { el.innerHTML = '<div class="empty">El mapa no se pudo cargar. La lista de talleres está abajo.</div>'; return; }
    var list = talleresFiltrados();
    map = L.map(el, { scrollWheelZoom: false }).setView([-0.19, -78.49], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    var icon = L.divIcon({ className: "pin", html: '<svg viewBox="0 0 32 32"><use href="#mk"/></svg>', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
    var pts = list.map(function (x) {
      var t = x.t;
      L.marker([t.lat, t.lng], { icon: icon, title: t.nombre }).addTo(map)
        .bindPopup("<b>" + esc(t.nombre) + "</b><br>" + esc(t.sector) + "<br>" + esc(t.esp.join(" · ")))
        .on("click", function () {
          var c = $("#tc-" + t.id); if (!c) return;
          [].forEach.call(document.querySelectorAll(".tcard.hl"), function (n) { n.classList.remove("hl"); });
          c.classList.add("hl"); c.scrollIntoView({ block: "nearest", behavior: "smooth" });
        });
      return [t.lat, t.lng];
    });
    if (state.pos) {
      L.circleMarker([state.pos.lat, state.pos.lng], { radius: 8, color: "#fff", weight: 3, fillColor: "#1560d4", fillOpacity: 1 }).addTo(map).bindPopup("Tu ubicación");
      pts.push([state.pos.lat, state.pos.lng]);
    }
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14 });
  }

  // ---------- Solicitar servicio
  function viewSolicitar() {
    var t = tallById[state.tsel], c = state.conductor, s = state.dsel ? sintById[state.dsel] : null;
    var hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return '<button class="back" data-go="talleres">← Volver a talleres</button><h1>Solicitar servicio</h1>' +
      '<div class="notice"><b>' + esc(t.nombre) + "</b> · " + esc(t.sector) + "</div>" +
      '<form class="card" id="f-solicitud">' +
      '<div class="field"><label for="s-prob">¿Qué necesitas?</label><textarea id="s-prob" rows="2" required>' + esc(s ? s.titulo : "") + "</textarea></div>" +
      '<div class="row3"><div class="field"><label for="s-marca">Marca</label><input id="s-marca" required value="' + esc(c.marca) + '" placeholder="Chevrolet"></div>' +
      '<div class="field"><label for="s-modelo">Modelo</label><input id="s-modelo" required value="' + esc(c.modelo) + '" placeholder="Sail"></div>' +
      '<div class="field"><label for="s-anio">Año</label><input id="s-anio" inputmode="numeric" pattern="(19|20)[0-9]{2}" required value="' + esc(c.anio) + '" placeholder="2018"></div></div>' +
      '<div class="row"><div class="field"><label for="s-nombre">Tu nombre</label><input id="s-nombre" required value="' + esc(c.nombre) + '"></div>' +
      '<div class="field"><label for="s-tel">Teléfono</label><input id="s-tel" type="tel" required value="' + esc(c.tel) + '"></div></div>' +
      '<div class="field"><label for="s-dia">Día preferido</label><input id="s-dia" type="date" required min="' + hoy + '" value="' + hoy + '"></div>' +
      '<button class="btn primary block">Enviar solicitud</button></form>';
  }
  function solicitudText(o) {
    return ["Solicitud Mekachi " + o.num, "Taller: " + o.taller.nombre + " (" + o.taller.sector + ")", "Cliente: " + o.cliente.nombre + " · " + o.cliente.tel,
      "Vehículo: " + o.vehiculo, "Día preferido: " + o.dia, "Necesita: " + o.problema].join("\n");
  }
  function viewSolicitudes() {
    if (!state.solicitudes.length) return "<h1>Mis solicitudes</h1><div class='empty'>Aún no has pedido ningún servicio.<br><br><button class='btn primary' data-go='diag'>Empezar con el diagnóstico</button></div>";
    return "<h1>Mis solicitudes</h1><div class='notice'>En la demo la solicitud aparece en la pestaña «Trabajos» del modo Taller. Cambia de modo arriba para verla como la vería el taller.</div>" +
      state.solicitudes.map(function (o) {
        return '<div class="card"><div class="order-head"><div><h2>' + esc(o.num) + " · " + esc(o.taller.nombre) + '</h2><div class="muted small">' + fecha(o.fecha) + '</div></div><span class="status">Enviada</span></div>' +
          "<p>" + esc(o.problema) + '</p><p class="muted small">' + esc(o.vehiculo) + " · Día preferido: " + esc(o.dia) + "</p>" +
          '<div class="actions"><a class="btn sm primary" target="_blank" rel="noopener" href="' + esc(wa(solicitudText(o))) + '">Enviar por WhatsApp</a></div></div>';
      }).join("");
  }

  // =====================================================================
  // TALLER
  // =====================================================================

  function viewTrabajos() {
    if (!state.solicitudes.length) return "<h1>Trabajos</h1><div class='empty'>Aquí llegan las solicitudes de los conductores.<br>Crea una desde el modo Conductor para ver el recorrido completo.<br><br><button class='btn primary' data-mode='conductor'>Ir al modo Conductor</button></div>";
    return "<h1>Trabajos</h1><p class='muted small'>Solicitudes de conductores. En la demo se muestran todas, sin importar el taller elegido.</p>" +
      state.solicitudes.map(function (o) {
        var s = o.sintoma ? sintById[o.sintoma] : null;
        return '<div class="card"><div class="order-head"><div><h2>' + esc(o.vehiculo) + '</h2><div class="muted small">' + esc(o.num) + " · " + esc(o.cliente.nombre) + " · " + esc(o.dia) + '</div></div><span class="status">Nuevo</span></div>' +
          "<p>" + esc(o.problema) + "</p>" +
          (s ? '<p class="muted small"><b>Diagnóstico inicial:</b> ' + esc(s.causas.join("; ")) + ".<br><b>Repuestos probables:</b> " + esc(s.repuestos.join(", ")) + ".</p>" : "") +
          '<div class="actions"><button class="btn sm primary" data-buscar="' + esc(s ? s.buscar : "") + '">' + (s && s.buscar ? "Buscar repuestos sugeridos" : "Pedir repuestos") + "</button></div></div>";
      }).join("");
  }

  function totals(lines) {
    var sub = 0, porCotizar = 0;
    lines.forEach(function (l) { if (l.custom) porCotizar += 1; else sub += l.precio * l.qty; });
    var iva = sub * CFG.iva;
    return { sub: sub, iva: iva, total: sub + iva, porCotizar: porCotizar };
  }
  function cartLines() {
    return state.cart.map(function (l) {
      if (l.custom) return l;
      var p = byId[l.id];
      return p ? { id: l.id, qty: l.qty, nombre: p.nombre, compat: p.compat, precio: p.precio } : null;
    }).filter(Boolean);
  }
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
      '<div class="cartbar" id="cartbar">' + cartbarHtml() + "</div>" +
      '<form class="card" id="f-otro" style="margin-top:18px"><h2>¿No está en la lista?</h2><p class="muted small">Descríbelo y te enviamos precio y disponibilidad.</p>' +
      '<div class="field"><label for="o-desc">Repuesto</label><input id="o-desc" required placeholder="Ej.: bomba de agua"></div>' +
      '<div class="row3"><div class="field"><label for="o-marca">Marca</label><input id="o-marca" required placeholder="Chevrolet"></div>' +
      '<div class="field"><label for="o-modelo">Modelo</label><input id="o-modelo" required placeholder="Aveo"></div>' +
      '<div class="field"><label for="o-anio">Año</label><input id="o-anio" inputmode="numeric" pattern="(19|20)[0-9]{2}" required placeholder="2014"></div></div>' +
      '<button class="btn block">Agregar al pedido para cotizar</button></form>';
  }
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
      '<div class="row"><div class="field"><label for="p-zona">Zona</label><select id="p-zona">' + opts(CFG.zonas, tl.zona) + "</select></div>" +
      '<div class="field"><label for="p-pago">Forma de pago</label><select id="p-pago">' + opts(CFG.pagos) + "</select></div></div>" +
      '<div class="field"><label for="p-nota">Nota para el despacho (opcional)</label><textarea id="p-nota" rows="2" placeholder="Ej.: urgente, el auto está en el elevador"></textarea></div>' +
      '<button class="btn primary block">Confirmar pedido</button></form>';
  }
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
  function viewPedidos() {
    if (!state.orders.length) return "<h1>Pedidos</h1><div class='empty'>Aquí aparecerán tus pedidos.</div>";
    return "<h1>Pedidos</h1><div class='notice'>El pedido llega a Mekachi cuando lo envías por WhatsApp. El seguimiento automático del estado se activa al conectar la app con el servidor.</div>" +
      state.orders.map(function (o) {
        return '<div class="card"><div class="order-head"><div><h2>' + esc(o.num) + '</h2><div class="muted small">' + fecha(o.fecha) + " · " + esc(o.pago) + '</div></div><span class="status">Registrado</span></div>' +
          '<ul class="order-lines">' + o.lines.map(function (l) {
            return "<li><span>" + l.qty + " × " + esc(l.nombre) + ' <span class="muted">· ' + esc(l.custom ? l.vehiculo : l.compat) + "</span></span><span>" + (l.custom ? "Por cotizar" : usd(l.precio * l.qty)) + "</span></li>";
          }).join("") + "</ul><div class='totals' style='margin-bottom:12px'><div class='total' style='border:0;padding:0;font-size:1.05rem'><span>Total con IVA</span><span>" + usd(o.total) + "</span></div></div>" +
          '<div class="actions"><a class="btn sm primary" target="_blank" rel="noopener" href="' + esc(wa(orderText(o))) + '">Enviar por WhatsApp</a>' +
          '<button class="btn sm" data-repeat="' + esc(o.num) + '">Repetir pedido</button></div></div>';
      }).join("");
  }
  function viewPerfil() {
    var t = state.taller;
    return "<h1>Mi taller</h1><p class='muted small'>Estos datos se usan en cada pedido.</p><form class='card' id='f-perfil'>" +
      '<div class="field"><label for="t-nombre">Nombre del taller</label><input id="t-nombre" required value="' + esc(t.nombre) + '"></div>' +
      '<div class="row"><div class="field"><label for="t-contacto">Persona de contacto</label><input id="t-contacto" value="' + esc(t.contacto) + '"></div>' +
      '<div class="field"><label for="t-tel">Teléfono</label><input id="t-tel" type="tel" value="' + esc(t.telefono) + '"></div></div>' +
      '<div class="field"><label for="t-dir">Dirección</label><input id="t-dir" value="' + esc(t.direccion) + '" placeholder="Calle, número y referencia"></div>' +
      '<div class="field"><label for="t-zona">Zona de Quito</label><select id="t-zona">' + opts(CFG.zonas, t.zona) + "</select></div>" +
      '<button class="btn primary block">Guardar</button></form>' +
      '<p class="muted small">Versión de prueba: los datos se guardan solo en este teléfono o computador.</p>';
  }

  // =====================================================================
  var VIEW = { diag: viewDiag, talleres: viewTalleres, solicitar: viewSolicitar, solicitudes: viewSolicitudes,
    trabajos: viewTrabajos, catalogo: viewCatalogo, carrito: viewCarrito, pedidos: viewPedidos, perfil: viewPerfil };
  function render() {
    nav();
    if (map) { map.remove(); map = null; }
    $("#app").innerHTML = VIEW[state.view]();
    if (state.view === "talleres") initMap();
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
    var open = e.target.closest("a[data-open]");
    if (open) { setMode(open.dataset.open, open.dataset.view); return; }
    var b = e.target.closest("button"); if (!b) return;
    var d = b.dataset;
    if (d.mode) setMode(d.mode);
    else if (d.go) go(d.go);
    else if (d.inc) change(d.inc, 1);
    else if (d.dec) change(d.dec, -1);
    else if (d.cat) { state.cat = d.cat; render(); }
    else if (d.dcat) { state.dcat = d.dcat; render(); }
    else if (d.sint) { state.dsel = d.sint; go("diag"); }
    else if (d.volver) { state.dsel = null; render(); }
    else if (d.buscartaller) { state.fesp = d.buscartaller; go("talleres"); }
    else if (d.solicitar) { state.tsel = d.solicitar; go("solicitar"); }
    else if ("buscar" in d) { state.q = d.buscar; state.cat = "Todas"; go("catalogo"); }
    else if (d.ubicar) {
      if (!navigator.geolocation) return toast("Este navegador no permite obtener la ubicación.");
      toast("Buscando tu ubicación…");
      navigator.geolocation.getCurrentPosition(function (p) {
        state.pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (state.view === "talleres") render();
      }, function () { toast("No pudimos obtener tu ubicación. Revisa los permisos."); }, { timeout: 10000 });
    }
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
    else if (e.target.id === "dq") { state.dq = e.target.value; $("#sintomas").innerHTML = sintListHtml(); }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "f-esp") { state.fesp = e.target.value; render(); }
    else if (e.target.id === "f-zona") { state.fzona = e.target.value; render(); }
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
    } else if (e.target.id === "f-solicitud") {
      var t = tallById[state.tsel];
      state.conductor = { nombre: v("s-nombre"), tel: v("s-tel"), marca: v("s-marca"), modelo: v("s-modelo"), anio: v("s-anio") };
      store.set("conductor", state.conductor);
      state.solicitudes.unshift({
        num: nextNum("seqsv", "SV"), fecha: new Date().toISOString(), taller: { id: t.id, nombre: t.nombre, sector: t.sector },
        cliente: { nombre: state.conductor.nombre, tel: state.conductor.tel },
        vehiculo: state.conductor.marca + " " + state.conductor.modelo + " " + state.conductor.anio,
        dia: v("s-dia"), problema: v("s-prob"), sintoma: state.dsel
      });
      store.set("solicitudes", state.solicitudes);
      state.dsel = null; go("solicitudes"); toast("Solicitud enviada al taller");
    } else if (e.target.id === "f-pedido") {
      var lines = cartLines(), tt = totals(lines);
      state.taller.nombre = v("p-nombre"); state.taller.direccion = v("p-dir"); state.taller.zona = v("p-zona");
      store.set("taller", state.taller);
      state.orders.unshift({
        num: nextNum("seq", "MK"), fecha: new Date().toISOString(), lines: lines,
        sub: tt.sub, iva: tt.iva, total: tt.total, porCotizar: tt.porCotizar, pago: v("p-pago"), nota: v("p-nota"),
        taller: JSON.parse(JSON.stringify(state.taller))
      });
      store.set("orders", state.orders);
      state.cart = []; saveCart(); go("pedidos"); toast("Pedido registrado. Envíalo por WhatsApp.");
    }
  });

  render();
})();
