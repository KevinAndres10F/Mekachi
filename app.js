(function () {
  "use strict";
  var CFG = window.MEKACHI_CONFIG, CAT = window.MEKACHI_CATALOGO, SINT = window.MEKACHI_SINTOMAS,
      TALL = window.MEKACHI_TALLERES, ESP = window.MEKACHI_ESPECIALIDADES, URG = window.MEKACHI_URGENCIA;
  var byId = {}; CAT.forEach(function (p) { byId[p.id] = p; });
  var sintById = {}; SINT.forEach(function (s) { sintById[s.id] = s; });
  var tallById = {}; TALL.forEach(function (t) { tallById[t.id] = t; });

  // ---- Almacenamiento. Hoy vive en el navegador; esta capa es la que se
  // ---- cambia por la base de datos cuando la app se conecte al servidor.
  var PREFIX = "mekachi.";
  var store = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(PREFIX + k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {} },
    clear: function () { try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); }); } catch (e) {} }
  };

  // ---- Iconos
  var ICONS = {
    home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    pulse: "M3 12h4l3-8 4 16 3-8h4",
    pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
    car: "M5 17v2M19 17v2M3 17h18v-5l-2-5H5l-2 5zM3 12h18M7 14.5h.01M17 14.5h.01",
    wrench: "M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z M14.5 6.5L17 4a4 4 0 0 0-5.3 5.2",
    box: "M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9",
    truck: "M2 6h11v10H2zM13 9h5l3 3v4h-8zM6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    chart: "M5 20V11M11 20V4M17 20v-7M2 20h20",
    info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5h.01"
  };
  var ico = function (n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n] + '"/></svg>'; };

  var MODES = {
    conductor: { label: "Conductor", tabs: [["c-inicio", "Inicio", "home"], ["diag", "Diagnóstico", "pulse"], ["talleres", "Talleres", "pin"], ["solicitudes", "Solicitudes", "list"], ["garaje", "Garaje", "car"]] },
    taller: { label: "Taller", tabs: [["t-inicio", "Inicio", "home"], ["trabajos", "Trabajos", "wrench"], ["catalogo", "Repuestos", "box"], ["pedidos", "Pedidos", "truck"], ["perfil", "Mi taller", "user"]] },
    despacho: { label: "Despacho", tabs: [["d-resumen", "Resumen", "chart"], ["d-pedidos", "Pedidos", "truck"], ["d-servicios", "Servicios", "wrench"]] }
  };
  // Subpantallas: qué pestaña queda marcada mientras se muestran.
  var PARENT = { solicitar: "talleres", carrito: "catalogo" };
  var VIEWMODE = { solicitar: "conductor", carrito: "taller" };
  Object.keys(MODES).forEach(function (m) { MODES[m].tabs.forEach(function (t) { VIEWMODE[t[0]] = m; }); });
  var ESTADOS = ["Registrado", "Confirmado", "En camino", "Entregado"];

  var state = {
    mode: store.get("rol", null), view: null,
    dq: "", dcat: "Todos", dsel: null, fesp: "Todas", fzona: "Todas", pos: null, tsel: null,
    solicitudes: store.get("solicitudes", []),
    conductor: store.get("conductor", { nombre: "", tel: "", marca: "", modelo: "", anio: "" }),
    garaje: store.get("garaje", []),
    q: "", cat: "Todas",
    cart: store.get("cart", []),
    orders: store.get("orders", []),
    taller: store.get("taller", { nombre: "", contacto: "", telefono: "", direccion: "", zona: CFG.zonas[0] })
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var usd = function (n) { return "$" + n.toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var norm = function (s) { return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var cartCount = function () { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); };
  var saveCart = function () { store.set("cart", state.cart); };
  var saveOrders = function () { store.set("orders", state.orders); };
  var saveSol = function () { store.set("solicitudes", state.solicitudes); };
  var line = function (id) { return state.cart.filter(function (l) { return l.id === id; })[0]; };
  var opts = function (list, sel) { return list.map(function (z) { return "<option" + (z === sel ? " selected" : "") + ">" + esc(z) + "</option>"; }).join(""); };
  var fecha = function (iso) { return new Date(iso).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }); };
  var wa = function (text) { return "https://wa.me/" + CFG.whatsapp + "?text=" + encodeURIComponent(text); };
  var nextNum = function (key, prefix) { var n = store.get(key, 0) + 1; store.set(key, n); return prefix + "-" + String(n).padStart(4, "0"); };
  var estadoPedido = function (o) { return o.estado || ESTADOS[0]; };
  var estadoSol = function (o) { return o.estado || "Enviada"; };
  var find = function (arr, num) { return arr.filter(function (x) { return x.num === num; })[0]; };
  var count = function (arr, fn) { return arr.filter(fn).length; };
  var statusCls = { Enviada: "info", Cotizada: "warn", Aceptada: "info", Terminada: "ok", Registrado: "warn", Confirmado: "info", "En camino": "info", Entregado: "ok" };
  var chip = function (e) { return '<span class="status ' + (statusCls[e] || "") + '">' + esc(e) + "</span>"; };

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  // ---------- Navegación
  function badgeFor(v) {
    if (v === "catalogo") return cartCount();
    if (v === "trabajos") return count(state.solicitudes, function (o) { return estadoSol(o) === "Enviada" || estadoSol(o) === "Aceptada"; });
    if (v === "solicitudes") return count(state.solicitudes, function (o) { return estadoSol(o) === "Cotizada"; });
    if (v === "d-pedidos") return count(state.orders, function (o) { return estadoPedido(o) !== "Entregado"; });
    return 0;
  }
  function nav() {
    document.body.classList.toggle("welcome", !state.mode);
    if (!state.mode) return;
    var modes = Object.keys(MODES).map(function (m) {
      return '<button data-mode="' + m + '" aria-pressed="' + (state.mode === m) + '">' + MODES[m].label + "</button>";
    }).join("");
    $$(".modes").forEach(function (el) { el.innerHTML = modes; });
    var cur = PARENT[state.view] || state.view;
    var tabs = MODES[state.mode].tabs.map(function (t) {
      var b = badgeFor(t[0]);
      return '<button data-go="' + t[0] + '"' + (cur === t[0] ? ' aria-current="page"' : "") + ">" + ico(t[2]) + "<span>" + t[1] + "</span>" +
        (b ? '<span class="badge">' + b + "</span>" : "") + "</button>";
    }).join("");
    $("#sidenav").innerHTML = tabs; $("#tabbar").innerHTML = tabs;
    $("#side-acerca").innerHTML = ico("info") + "<span>Acerca de la demo</span>";
    $("#side-acerca").setAttribute("aria-current", state.view === "acerca" ? "page" : "false");
    $("#top-acerca").innerHTML = ico("info");
  }
  function go(v, replace) {
    if (VIEWMODE[v]) state.mode = VIEWMODE[v];
    state.view = v; render(); window.scrollTo(0, 0);
    var h = "#/" + v;
    if (location.hash !== h) { if (replace) history.replaceState(null, "", h); else history.pushState(null, "", h); }
  }
  function setMode(m) { state.mode = m; store.set("rol", m); go(MODES[m].tabs[0][0]); }
  function fromHash() {
    var v = location.hash.replace(/^#\/?/, "");
    if (!state.mode) return render();
    if (v === "solicitar" && !state.tsel) v = "talleres";
    if (!VIEW[v]) v = MODES[state.mode].tabs[0][0];
    if (VIEWMODE[v]) state.mode = VIEWMODE[v];
    state.view = v; render();
  }

  // =====================================================================
  // BIENVENIDA Y ACERCA
  // =====================================================================
  function viewBienvenida() {
    var role = function (m, icon, t, d) { return '<button class="role" data-mode="' + m + '">' + ico(icon) + "<span><b>" + t + "</b><small>" + d + "</small></span></button>"; };
    return '<div class="welcome-screen"><div class="welcome-box"><span class="logo"><svg><use href="#mk"/></svg>Mekachi</span>' +
      "<h1>Mecánicas de confianza. <em>Repuestos garantizados.</em></h1>" +
      "<p>Diagnóstico inicial de tu auto, talleres verificados en Quito y el repuesto correcto en horas.</p>" +
      '<div class="roles">' +
      role("conductor", "car", "Soy conductor", "Quiero saber qué tiene mi auto y encontrar un taller") +
      role("taller", "wrench", "Soy taller", "Quiero recibir clientes y pedir repuestos") +
      role("despacho", "truck", "Soy Mekachi", "Despacho: atender pedidos y cotizaciones") +
      '</div><p class="foot">Versión de demostración. Puedes cambiar de perfil en cualquier momento.</p></div></div>';
  }
  function viewAcerca() {
    return "<h1>Acerca de la demo</h1><p class='muted'>Mekachi conecta conductores, talleres y repuestos en un solo lugar. Esta versión muestra el recorrido completo, todavía sin servidor.</p>" +
      '<div class="card"><h2>Cómo funciona</h2><div class="steps3" style="margin-top:10px">' +
      "<div><b>El conductor cuenta qué pasa</b><span>Recibe un diagnóstico inicial y elige un taller en el mapa.</span></div>" +
      "<div><b>El taller da precio cerrado</b><span>El conductor lo acepta antes de dejar el auto.</span></div>" +
      "<div><b>Mekachi lleva el repuesto</b><span>El taller lo pide en la app y despacho lo entrega en horas.</span></div></div></div>" +
      '<div class="card"><h2>Ya funciona en la demo</h2><ul class="ticks">' +
      "<li>Diagnóstico inicial por síntomas, con urgencia y repuestos probables</li><li>Mapa de talleres con filtro por especialidad, zona y cercanía</li>" +
      "<li>Solicitud de servicio, precio cerrado, aceptación y calificación</li><li>Garaje con pico y placa, revisión técnica y cambio de aceite</li>" +
      "<li>Pedido de repuestos con cotización de piezas fuera de lista</li><li>Panel de despacho: cotizar, confirmar, enviar y entregar</li>" +
      "<li>Instalable en el teléfono como aplicación</li></ul></div>" +
      '<div class="card"><h2>Falta para operar de verdad</h2><ul class="todo">' +
      '<li><span class="p1">Siguiente</span><b>Cuentas y base de datos</b><small>Hoy todo se guarda en este dispositivo; los tres perfiles deben compartir datos en un servidor.</small></li>' +
      '<li><span class="p1">Siguiente</span><b>Talleres y precios reales</b><small>Red de talleres verificados y lista de precios de los distribuidores.</small></li>' +
      '<li><span class="p2">Después</span><b>Avisos automáticos</b><small>Notificaciones por WhatsApp al cambiar un estado.</small></li>' +
      '<li><span class="p2">Después</span><b>Pagos y factura electrónica</b><small>Tarjeta, Deuna y comprobantes del SRI.</small></li>' +
      '<li><span class="p3">Más adelante</span><b>Diagnóstico con inteligencia artificial</b><small>Conversación libre, fotos y sonidos en lugar de reglas fijas.</small></li>' +
      '<li><span class="p3">Más adelante</span><b>Flotas</b><small>Varios vehículos, reportes de gasto y una sola factura.</small></li></ul></div>' +
      '<div class="card"><h2>Datos de la demo</h2><p class="muted small">Talleres, precios y pedidos son de ejemplo y se guardan solo en este navegador.</p>' +
      '<div class="actions"><button class="btn sm danger" data-reset="1">Borrar datos de la demo</button><a class="btn sm" href="plan/">Ver plan de crecimiento</a></div></div>';
  }

  // =====================================================================
  // CONDUCTOR
  // =====================================================================
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function digito(placa) { var m = /(\d)\D*$/.exec(placa || ""); return m ? +m[1] : null; }
  // Pico y placa en Quito: 1-2 lunes, 3-4 martes, 5-6 miércoles, 7-8 jueves, 9-0 viernes.
  function diaPico(d) { return d == null ? null : d === 0 ? 5 : Math.ceil(d / 2); }
  // Calendario habitual de matriculación y revisión: dígito 1 en febrero … 9 en octubre, 0 en noviembre.
  function mesRevision(d) { return d == null ? null : d === 0 ? 10 : d; }
  var KM_ACEITE = 5000;

  function viewCInicio() {
    var hoy = new Date().getDay(), avisos = [];
    state.garaje.forEach(function (v) {
      var d = digito(v.placa), nombre = v.marca + " " + v.modelo;
      if (diaPico(d) === hoy) avisos.push("<b>Hoy tienes pico y placa</b> con tu " + esc(nombre) + ". Buen día para llevarlo al taller.");
      if (mesRevision(d) === new Date().getMonth()) avisos.push("<b>Este mes te toca la revisión técnica</b> del " + esc(nombre) + ".");
      if (v.km && v.kmAceite && v.kmAceite + KM_ACEITE - v.km <= 500) avisos.push("<b>Cambio de aceite cerca</b> en tu " + esc(nombre) + ".");
    });
    var cot = count(state.solicitudes, function (o) { return estadoSol(o) === "Cotizada"; });
    if (cot) avisos.unshift("<b>Tienes " + cot + (cot === 1 ? " precio" : " precios") + " por aceptar</b> en tus solicitudes.");
    var q = function (v, icon, t, d) { return '<button data-go="' + v + '">' + ico(icon) + "<span><b>" + t + "</b>" + d + "</span></button>"; };
    return '<div class="hero-card"><h1>¿Qué le pasa a tu auto?</h1><p>Cuéntanos el síntoma y recibe un diagnóstico inicial en segundos.</p>' +
      '<button class="btn amber" data-go="diag">Empezar diagnóstico</button></div>' +
      avisos.map(function (a) { return '<div class="notice">' + a + "</div>"; }).join("") +
      '<div class="quick">' + q("talleres", "pin", "Talleres", "Mapa de talleres cerca de ti") + q("solicitudes", "list", "Solicitudes", "Precios y estado de tus servicios") +
      q("garaje", "car", "Mi garaje", "Pico y placa y recordatorios") + "</div>" +
      (state.garaje.length ? "" : '<div class="card"><h2>Agrega tu auto</h2><p class="muted small">Con la placa te avisamos tu día de pico y placa y el mes de revisión técnica.</p><button class="btn sm primary" data-go="garaje">Agregar vehículo</button></div>');
  }

  // ---------- Diagnóstico
  var STOP = { motor: 1, para: 1, cuando: 1, auto: 1, carro: 1, tiene: 1, hace: 1, esta: 1, como: 1, pero: 1, desde: 1, mucho: 1, algo: 1, sale: 1 };
  function matchSint() {
    var words = norm(state.dq).split(/[^a-z0-9/]+/).filter(function (w) { return w.length > 2 && !STOP[w]; })
      .map(function (w) { return w.length > 5 ? w.slice(0, 5) : w; });
    var list = SINT.filter(function (s) { return state.dcat === "Todos" || s.cat === state.dcat; });
    if (!words.length) return list;
    return list.map(function (s) {
      // Coincidir con el síntoma pesa el doble que coincidir solo con la categoría.
      var hay = norm(s.titulo + " " + s.claves.join(" ")), cat = norm(s.cat);
      return { s: s, n: words.reduce(function (n, w) { return n + (hay.indexOf(w) >= 0 ? 2 : cat.indexOf(w) >= 0 ? 1 : 0); }, 0) };
    }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; }).map(function (x) { return x.s; });
  }
  function sintListHtml() {
    var items = matchSint();
    if (!items.length) return '<div class="empty">No encontramos un síntoma parecido.<br>Prueba con otras palabras o elige una categoría.<br><br><button class="btn sm" data-go="talleres">Ver talleres de todos modos</button></div>';
    return items.map(function (s) {
      return '<button class="sint" data-sint="' + s.id + '"><span><b>' + esc(s.titulo) + "</b><small>" + esc(s.cat) + '</small></span><i class="dot ' + s.urgencia + '"></i></button>';
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
      '<div class="row" style="margin-top:10px"><div class="field"><label for="f-esp">Especialidad</label><select id="f-esp">' + opts(["Todas"].concat(ESP), state.fesp) + "</select></div>" +
      '<div class="field"><label for="f-zona">Zona</label><select id="f-zona">' + opts(["Todas"].concat(CFG.zonas), state.fzona) + "</select></div></div>" +
      '<div class="tgrid"><div><div id="mapa" aria-label="Mapa de talleres"></div>' +
      '<button class="btn sm block" data-ubicar="1" style="margin-top:10px">' + (state.pos ? "Ordenado por cercanía · actualizar ubicación" : "Usar mi ubicación para ordenar por cercanía") + "</button></div>" +
      '<div class="list" id="tlist">' + (list.length ? list.map(function (x) {
        var t = x.t;
        return '<div class="tcard" id="tc-' + t.id + '"><div><div class="name">' + esc(t.nombre) + '</div><div class="meta">' + esc(t.sector) + " · " + esc(t.zona) +
          (x.d != null ? " · a " + x.d.toFixed(1).replace(".", ",") + " km" : "") + '</div><div class="tags">' +
          t.esp.map(function (e) { return "<span" + (e === state.fesp ? ' class="on"' : "") + ">" + esc(e) + "</span>"; }).join("") + "</div></div>" +
          '<button class="btn sm primary" data-solicitar="' + t.id + '">Solicitar</button></div>';
      }).join("") : '<div class="empty">No hay talleres con ese filtro.</div>') + "</div></div>";
  }
  var map = null;
  function initMap() {
    var el = $("#mapa"); if (!el) return;
    if (!window.L) { el.innerHTML = '<div class="empty">El mapa no se pudo cargar. La lista de talleres sigue disponible.</div>'; return; }
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
          $$(".tcard.hl").forEach(function (n) { n.classList.remove("hl"); });
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
    var t = tallById[state.tsel], c = state.conductor, s = state.dsel ? sintById[state.dsel] : null, g = state.garaje[0] || {};
    var hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return '<button class="back" data-go="talleres">← Volver a talleres</button><h1>Solicitar servicio</h1>' +
      '<div class="notice"><b>' + esc(t.nombre) + "</b> · " + esc(t.sector) + "<br>El taller te responde con un precio cerrado antes de que lleves el auto.</div>" +
      '<form class="card" data-form="solicitud">' +
      '<div class="field"><label for="s-prob">¿Qué necesitas?</label><textarea id="s-prob" rows="2" required>' + esc(s ? s.titulo : "") + "</textarea></div>" +
      '<div class="row3"><div class="field"><label for="s-marca">Marca</label><input id="s-marca" required value="' + esc(g.marca || c.marca) + '" placeholder="Chevrolet"></div>' +
      '<div class="field"><label for="s-modelo">Modelo</label><input id="s-modelo" required value="' + esc(g.modelo || c.modelo) + '" placeholder="Sail"></div>' +
      '<div class="field"><label for="s-anio">Año</label><input id="s-anio" inputmode="numeric" pattern="(19|20)[0-9]{2}" required value="' + esc(g.anio || c.anio) + '" placeholder="2018"></div></div>' +
      '<div class="row"><div class="field"><label for="s-nombre">Tu nombre</label><input id="s-nombre" required value="' + esc(c.nombre) + '"></div>' +
      '<div class="field"><label for="s-tel">Teléfono</label><input id="s-tel" type="tel" required value="' + esc(c.tel) + '"></div></div>' +
      '<div class="field"><label for="s-dia">Día preferido</label><input id="s-dia" type="date" required min="' + hoy + '" value="' + hoy + '"></div>' +
      '<button class="btn primary block">Enviar solicitud</button></form>';
  }
  function solicitudText(o) {
    return ["Solicitud Mekachi " + o.num, "Taller: " + o.taller.nombre + " (" + o.taller.sector + ")", "Cliente: " + o.cliente.nombre + " · " + o.cliente.tel,
      "Vehículo: " + o.vehiculo, "Día preferido: " + o.dia, "Necesita: " + o.problema].join("\n");
  }
  var estrellas = function (n) { return '<span class="stars"><span>' + "★★★★★".slice(0, n) + "</span></span>"; };
  function viewSolicitudes() {
    if (!state.solicitudes.length) return "<h1>Mis solicitudes</h1><div class='empty'>Aún no has pedido ningún servicio.<br><br><button class='btn primary' data-go='diag'>Empezar con el diagnóstico</button></div>";
    return "<h1>Mis solicitudes</h1><p class='muted small'>En la demo, el taller responde desde el perfil Taller en este mismo dispositivo.</p>" +
      state.solicitudes.map(function (o) {
        var e = estadoSol(o), extra = "";
        if (e === "Enviada") extra = '<p class="muted small">Esperando el precio del taller.</p>';
        if (e === "Cotizada") extra = '<div class="notice"><b>Precio cerrado: ' + usd(o.precio) + "</b>" + (o.notaTaller ? "<br>" + esc(o.notaTaller) : "") + '</div><div class="actions"><button class="btn sm primary" data-aceptar="' + o.num + '">Aceptar precio</button></div>';
        if (e === "Aceptada") extra = '<p class="small"><b>Precio acordado: ' + usd(o.precio) + '</b></p><p class="muted small">Lleva tu auto el día acordado. El taller marcará el trabajo como terminado.</p>';
        if (e === "Terminada") extra = '<p class="small"><b>Pagaste: ' + usd(o.precio) + "</b> · Garantía registrada</p>" + (o.rating
          ? '<p class="small">Tu calificación: ' + estrellas(o.rating) + "</p>"
          : '<p class="small" style="margin-bottom:2px">Califica al taller:</p><div class="stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-rate="' + o.num + '" data-n="' + n + '" aria-label="' + n + ' estrellas">★</button>'; }).join("") + "</div>");
        return '<div class="card"><div class="head"><div><h2>' + esc(o.taller.nombre) + '</h2><div class="muted small">' + esc(o.num) + " · " + esc(o.vehiculo) + " · " + esc(o.dia) + "</div></div>" + chip(e) + "</div>" +
          "<p>" + esc(o.problema) + "</p>" + extra +
          (e === "Enviada" ? '<div class="actions"><a class="btn sm" target="_blank" rel="noopener" href="' + esc(wa(solicitudText(o))) + '">Enviar por WhatsApp</a></div>' : "") + "</div>";
      }).join("");
  }

  // ---------- Garaje
  function viewGaraje() {
    return "<h1>Mi garaje</h1><p class='muted small'>Guarda tus vehículos para recibir recordatorios.</p>" +
      state.garaje.map(function (v) {
        var d = digito(v.placa), dp = diaPico(d), mr = mesRevision(d);
        var aceite = v.km && v.kmAceite ? v.kmAceite + KM_ACEITE - v.km : null;
        return '<div class="card"><div class="head"><div><h2>' + esc(v.marca + " " + v.modelo + " " + v.anio) + '</h2><span class="plate">' + esc(v.placa) + "</span></div>" +
          '<button class="btn sm danger" data-delveh="' + v.id + '">Quitar</button></div><div class="veh">' +
          "<div><small>Pico y placa</small><b>" + (dp ? "Los " + DIAS[dp] : "Sin dígito en la placa") + "</b></div>" +
          "<div><small>Revisión técnica</small><b>" + (mr != null ? "En " + MESES[mr] : "—") + "</b></div>" +
          "<div><small>Cambio de aceite</small><b>" + (aceite == null ? "Agrega el kilometraje" : aceite <= 0 ? "Ya te toca" : "En " + aceite.toLocaleString("es-EC") + " km") + "</b></div></div>" +
          '<button class="btn sm primary" data-go="diag">Diagnosticar este auto</button></div>';
      }).join("") +
      '<form class="card" data-form="vehiculo"><h2>Agregar vehículo</h2>' +
      '<div class="row3"><div class="field"><label for="g-marca">Marca</label><input id="g-marca" required placeholder="Chevrolet"></div>' +
      '<div class="field"><label for="g-modelo">Modelo</label><input id="g-modelo" required placeholder="Sail"></div>' +
      '<div class="field"><label for="g-anio">Año</label><input id="g-anio" inputmode="numeric" pattern="(19|20)[0-9]{2}" required placeholder="2018"></div></div>' +
      '<div class="field"><label for="g-placa">Placa</label><input id="g-placa" required placeholder="PBA-1234" style="text-transform:uppercase"></div>' +
      '<div class="row"><div class="field"><label for="g-km">Kilometraje actual (opcional)</label><input id="g-km" inputmode="numeric" pattern="[0-9]*" placeholder="85000"></div>' +
      '<div class="field"><label for="g-kma">Km del último cambio de aceite (opcional)</label><input id="g-kma" inputmode="numeric" pattern="[0-9]*" placeholder="82000"></div></div>' +
      '<button class="btn primary block">Guardar vehículo</button></form>' +
      '<p class="muted small">Pico y placa según el último dígito (1-2 lunes … 9-0 viernes) y revisión según el calendario habitual. Confirma horarios y fechas vigentes con la AMT.</p>';
  }

  // =====================================================================
  // TALLER
  // =====================================================================
  function viewTInicio() {
    var nuevos = count(state.solicitudes, function (o) { return estadoSol(o) === "Enviada"; });
    var curso = count(state.solicitudes, function (o) { return estadoSol(o) === "Aceptada"; });
    var ped = count(state.orders, function (o) { return estadoPedido(o) !== "Entregado"; });
    var q = function (v, icon, t, d) { return '<button data-go="' + v + '">' + ico(icon) + "<span><b>" + t + "</b>" + d + "</span></button>"; };
    return "<h1>" + (state.taller.nombre ? esc(state.taller.nombre) : "Tu taller") + "</h1><p class='muted small'>Resumen de hoy</p>" +
      '<div class="kpis"><div class="kpi"><b>' + nuevos + "</b><span>Trabajos por cotizar</span></div><div class='kpi'><b>" + curso + "</b><span>Trabajos en curso</span></div>" +
      "<div class='kpi'><b>" + ped + "</b><span>Pedidos en camino</span></div></div>" +
      '<div class="quick">' + q("trabajos", "wrench", "Trabajos", "Solicitudes de conductores") + q("catalogo", "box", "Pedir repuestos", "Catálogo y cotizaciones") + q("pedidos", "truck", "Mis pedidos", "Seguimiento de entregas") + "</div>" +
      (state.taller.nombre ? "" : '<div class="card"><h2>Completa los datos de tu taller</h2><p class="muted small">Se usan como dirección de entrega en cada pedido.</p><button class="btn sm primary" data-go="perfil">Completar datos</button></div>');
  }
  function viewTrabajos() {
    if (!state.solicitudes.length) return "<h1>Trabajos</h1><div class='empty'>Aquí llegan las solicitudes de los conductores.<br>Crea una desde el perfil Conductor para ver el recorrido completo.<br><br><button class='btn primary' data-mode='conductor'>Ir al perfil Conductor</button></div>";
    return "<h1>Trabajos</h1><p class='muted small'>Solicitudes de conductores. En la demo se muestran todas, sin importar el taller elegido.</p>" +
      state.solicitudes.map(function (o) {
        var s = o.sintoma ? sintById[o.sintoma] : null, e = estadoSol(o), act = "";
        if (e === "Enviada") act = '<form class="inline" data-form="cotizar-trabajo" data-num="' + o.num + '"><input name="precio" type="number" min="1" step="0.01" required placeholder="Precio $" aria-label="Precio cerrado"><button class="btn sm primary">Enviar precio cerrado</button></form>';
        if (e === "Cotizada") act = '<p class="muted small">Precio enviado: <b>' + usd(o.precio) + "</b>. Esperando al cliente.</p>";
        if (e === "Aceptada") act = '<p class="small"><b>Cliente aceptó ' + usd(o.precio) + '</b></p><div class="actions"><button class="btn sm primary" data-buscar="' + esc(s ? s.buscar : "") + '">Pedir repuestos</button><button class="btn sm" data-terminar="' + o.num + '">Marcar terminado</button></div>';
        if (e === "Terminada") act = '<p class="small">Cobrado: <b>' + usd(o.precio) + "</b>" + (o.rating ? " · " + estrellas(o.rating) : " · sin calificar") + "</p>";
        return '<div class="card"><div class="head"><div><h2>' + esc(o.vehiculo) + '</h2><div class="muted small">' + esc(o.num) + " · " + esc(o.cliente.nombre) + " · " + esc(o.dia) + "</div></div>" + chip(e === "Enviada" ? "Nuevo" : e) + "</div>" +
          "<p>" + esc(o.problema) + "</p>" +
          (s ? '<p class="muted small"><b>Diagnóstico inicial:</b> ' + esc(s.causas.join("; ")) + ".<br><b>Repuestos probables:</b> " + esc(s.repuestos.join(", ")) + ".</p>" : "") + act + "</div>";
      }).join("");
  }

  function totals(lines) {
    var sub = 0, porCotizar = 0;
    lines.forEach(function (l) { if (l.precio == null) porCotizar += 1; else sub += l.precio * l.qty; });
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
  var lineDesc = function (l) { return l.custom ? l.vehiculo : l.compat; };
  var linePrice = function (l) { return l.precio == null ? "Por cotizar" : usd(l.precio * l.qty); };
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
      '<input type="search" id="q" placeholder="Buscar: pastillas Aveo, filtro Sail…" value="' + esc(state.q) + '" aria-label="Buscar repuesto" style="margin-top:8px">' +
      '<div class="chips">' + cats.map(function (c) { return '<button data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
      '<div class="list" id="lista">' + listHtml() + "</div>" +
      '<form class="card" data-form="otro" style="margin-top:18px"><h2>¿No está en la lista?</h2><p class="muted small">Descríbelo y despacho te envía precio y disponibilidad.</p>' +
      '<div class="field"><label for="o-desc">Repuesto</label><input id="o-desc" required placeholder="Ej.: bomba de agua"></div>' +
      '<div class="row3"><div class="field"><label for="o-marca">Marca</label><input id="o-marca" required placeholder="Chevrolet"></div>' +
      '<div class="field"><label for="o-modelo">Modelo</label><input id="o-modelo" required placeholder="Aveo"></div>' +
      '<div class="field"><label for="o-anio">Año</label><input id="o-anio" inputmode="numeric" pattern="(19|20)[0-9]{2}" required placeholder="2014"></div></div>' +
      '<button class="btn block">Agregar al pedido para cotizar</button></form>' +
      '<div class="cartbar" id="cartbar">' + cartbarHtml() + "</div>";
  }
  function viewCarrito() {
    var lines = cartLines();
    if (!lines.length) return "<h1>Carrito</h1><div class='empty'>Todavía no has agregado repuestos.<br><br><button class='btn primary' data-go='catalogo'>Ver repuestos</button></div>";
    var t = totals(lines), tl = state.taller;
    return '<button class="back" data-go="catalogo">← Seguir agregando</button><h1>Carrito</h1><div class="list" style="margin-top:12px">' + lines.map(function (l) {
      return '<div class="item"><div><div class="name">' + esc(l.nombre) + '</div><div class="meta">' + esc(lineDesc(l)) +
        '</div><div class="price">' + (l.precio == null ? '<span class="meta">Por cotizar</span>' : usd(l.precio * l.qty)) + "</div></div>" +
        stepper(l.custom ? l.key : l.id, l.qty) + "</div>";
    }).join("") + "</div>" +
      '<div class="card" style="margin-top:12px"><div class="totals"><div><span>Subtotal</span><span>' + usd(t.sub) + "</span></div><div><span>IVA " + Math.round(CFG.iva * 100) + " %</span><span>" + usd(t.iva) +
      '</span></div><div class="total"><span>Total</span><span>' + usd(t.total) + "</span></div></div>" +
      (t.porCotizar ? '<p class="muted small" style="margin:8px 0 0">Incluye ' + t.porCotizar + (t.porCotizar === 1 ? " repuesto" : " repuestos") + " por cotizar; despacho confirma el precio antes de enviar.</p>" : "") + "</div>" +
      '<form class="card" data-form="pedido"><h2>Entrega</h2>' +
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
    o.lines.forEach(function (l) { t.push("• " + l.qty + " x " + l.nombre + " — " + lineDesc(l) + " — " + linePrice(l)); });
    t.push("", "Total con IVA: " + usd(o.total) + (o.porCotizar ? " + repuestos por cotizar" : ""), "Pago: " + o.pago);
    if (o.nota) t.push("Nota: " + o.nota);
    return t.join("\n");
  }
  function track(o) {
    var i = ESTADOS.indexOf(estadoPedido(o));
    return '<div class="track">' + ESTADOS.map(function (e, k) { return "<div" + (k <= i ? ' class="on"' : "") + "><i></i>" + e + "</div>"; }).join("") + "</div>";
  }
  function orderLines(o) {
    return '<ul class="lines">' + o.lines.map(function (l) {
      return "<li><span>" + l.qty + " × " + esc(l.nombre) + ' <span class="muted">· ' + esc(lineDesc(l)) + "</span></span><span>" + linePrice(l) + "</span></li>";
    }).join("") + "</ul>";
  }
  var orderTotal = function (o) { return "<div class='totals' style='margin-bottom:12px'><div class='total' style='border:0;padding:0;font-size:1.05rem'><span>Total con IVA" + (o.porCotizar ? " (parcial)" : "") + "</span><span>" + usd(o.total) + "</span></div></div>"; };
  function viewPedidos() {
    if (!state.orders.length) return "<h1>Pedidos</h1><div class='empty'>Aquí aparecerán tus pedidos.<br><br><button class='btn primary' data-go='catalogo'>Pedir repuestos</button></div>";
    return "<h1>Pedidos</h1><p class='muted small'>En la demo, el estado lo cambia el perfil Despacho en este mismo dispositivo.</p>" +
      state.orders.map(function (o) {
        return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + '</h2><div class="muted small">' + fecha(o.fecha) + " · " + esc(o.pago) + "</div></div>" + chip(estadoPedido(o)) + "</div>" +
          track(o) + orderLines(o) + orderTotal(o) +
          '<div class="actions"><a class="btn sm" target="_blank" rel="noopener" href="' + esc(wa(orderText(o))) + '">Enviar por WhatsApp</a>' +
          '<button class="btn sm" data-repeat="' + esc(o.num) + '">Repetir pedido</button></div></div>';
      }).join("");
  }
  function viewPerfil() {
    var t = state.taller;
    return "<h1>Mi taller</h1><p class='muted small'>Estos datos se usan en cada pedido.</p><form class='card' data-form='perfil'>" +
      '<div class="field"><label for="t-nombre">Nombre del taller</label><input id="t-nombre" required value="' + esc(t.nombre) + '"></div>' +
      '<div class="row"><div class="field"><label for="t-contacto">Persona de contacto</label><input id="t-contacto" value="' + esc(t.contacto) + '"></div>' +
      '<div class="field"><label for="t-tel">Teléfono</label><input id="t-tel" type="tel" value="' + esc(t.telefono) + '"></div></div>' +
      '<div class="field"><label for="t-dir">Dirección</label><input id="t-dir" value="' + esc(t.direccion) + '" placeholder="Calle, número y referencia"></div>' +
      '<div class="field"><label for="t-zona">Zona de Quito</label><select id="t-zona">' + opts(CFG.zonas, t.zona) + "</select></div>" +
      '<button class="btn primary block">Guardar</button></form>';
  }

  // =====================================================================
  // DESPACHO
  // =====================================================================
  function viewDResumen() {
    var o = state.orders, s = state.solicitudes;
    var ventas = o.reduce(function (n, x) { return n + x.total; }, 0);
    var servicios = s.filter(function (x) { return estadoSol(x) === "Terminada"; }).reduce(function (n, x) { return n + (x.precio || 0); }, 0);
    var k = function (v, l) { return '<div class="kpi"><b>' + v + "</b><span>" + l + "</span></div>"; };
    return "<h1>Despacho Mekachi</h1><p class='muted small'>Lo que entra por la app, visto desde la operación.</p>" +
      '<div class="section-title">Repuestos</div><div class="kpis">' +
      k(count(o, function (x) { return estadoPedido(x) === "Registrado"; }), "Pedidos por atender") +
      k(count(o, function (x) { return x.porCotizar > 0; }), "Con piezas por cotizar") +
      k(count(o, function (x) { return estadoPedido(x) === "En camino"; }), "En camino") +
      k(usd(ventas), "Venta de repuestos") + "</div>" +
      '<div class="section-title">Servicios</div><div class="kpis">' +
      k(s.length, "Solicitudes") + k(count(s, function (x) { return estadoSol(x) === "Aceptada"; }), "En curso") +
      k(count(s, function (x) { return estadoSol(x) === "Terminada"; }), "Terminados") + k(usd(servicios), "Cobrado por talleres") + "</div>" +
      '<div class="actions"><button class="btn primary" data-go="d-pedidos">Atender pedidos</button><button class="btn" data-go="d-servicios">Ver servicios</button></div>';
  }
  function viewDPedidos() {
    if (!state.orders.length) return "<h1>Pedidos de talleres</h1><div class='empty'>Todavía no hay pedidos.<br>Crea uno desde el perfil Taller.<br><br><button class='btn primary' data-mode='taller'>Ir al perfil Taller</button></div>";
    return "<h1>Pedidos de talleres</h1><p class='muted small'>Cotiza las piezas fuera de lista y avanza el estado de cada pedido.</p>" +
      state.orders.map(function (o) {
        var e = estadoPedido(o), i = ESTADOS.indexOf(e), sig = ESTADOS[i + 1];
        var cot = o.lines.filter(function (l) { return l.precio == null; }).map(function (l) {
          return '<form class="inline" data-form="cotizar-linea" data-num="' + o.num + '" data-key="' + esc(l.key) + '" style="margin-bottom:8px"><span class="small" style="flex:1">' + esc(l.nombre) + " · " + esc(l.vehiculo) +
            '</span><input name="precio" type="number" min="0.01" step="0.01" required placeholder="Precio $" aria-label="Precio unitario"><button class="btn sm">Cotizar</button></form>';
        }).join("");
        return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + " · " + esc(o.taller.nombre) + '</h2><div class="muted small">' + fecha(o.fecha) + " · " + esc(o.taller.direccion) + " (" + esc(o.taller.zona) + ") · " + esc(o.pago) + "</div></div>" + chip(e) + "</div>" +
          track(o) + orderLines(o) + cot + orderTotal(o) + (o.nota ? '<p class="muted small">Nota: ' + esc(o.nota) + "</p>" : "") +
          (sig ? '<div class="actions"><button class="btn sm primary" data-avanzar="' + o.num + '"' + (o.porCotizar && i === 0 ? " disabled title='Cotiza primero las piezas pendientes'" : "") + ">Marcar como " + sig.toLowerCase() + "</button>" +
            (o.porCotizar && i === 0 ? '<span class="muted small">Cotiza primero las piezas pendientes.</span>' : "") + "</div>" : "") + "</div>";
      }).join("");
  }
  function viewDServicios() {
    if (!state.solicitudes.length) return "<h1>Servicios</h1><div class='empty'>Todavía no hay solicitudes de conductores.</div>";
    return "<h1>Servicios</h1><p class='muted small'>Solicitudes entre conductores y talleres.</p>" +
      state.solicitudes.map(function (o) {
        return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + " · " + esc(o.taller.nombre) + '</h2><div class="muted small">' + esc(o.cliente.nombre) + " · " + esc(o.vehiculo) + " · " + esc(o.dia) + "</div></div>" + chip(estadoSol(o)) + "</div>" +
          "<p>" + esc(o.problema) + "</p>" + (o.precio ? '<p class="small"><b>' + usd(o.precio) + "</b>" + (o.rating ? " · " + estrellas(o.rating) : "") + "</p>" : "") + "</div>";
      }).join("");
  }

  // =====================================================================
  var VIEW = { "c-inicio": viewCInicio, diag: viewDiag, talleres: viewTalleres, solicitar: viewSolicitar, solicitudes: viewSolicitudes, garaje: viewGaraje,
    "t-inicio": viewTInicio, trabajos: viewTrabajos, catalogo: viewCatalogo, carrito: viewCarrito, pedidos: viewPedidos, perfil: viewPerfil,
    "d-resumen": viewDResumen, "d-pedidos": viewDPedidos, "d-servicios": viewDServicios, acerca: viewAcerca };
  function render() {
    nav();
    if (map) { map.remove(); map = null; }
    var app = $("#app");
    app.classList.toggle("wide", state.view === "talleres");
    app.innerHTML = state.mode ? VIEW[state.view]() : viewBienvenida();
    if (state.view === "talleres" && state.mode) initMap();
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
  function retotal(o) { var t = totals(o.lines); o.sub = t.sub; o.iva = t.iva; o.total = t.total; o.porCotizar = t.porCotizar; }

  // ---------- Eventos
  document.addEventListener("click", function (e) {
    var home = e.target.closest("a[data-home]");
    if (home) { e.preventDefault(); if (state.mode) go(MODES[state.mode].tabs[0][0]); return; }
    var b = e.target.closest("button"); if (!b || b.disabled) return;
    var d = b.dataset, o;
    if (d.mode) setMode(d.mode);
    else if (d.go) go(d.go);
    else if (d.inc) change(d.inc, 1);
    else if (d.dec) change(d.dec, -1);
    else if (d.cat) { state.cat = d.cat; render(); }
    else if (d.dcat) { state.dcat = d.dcat; render(); }
    else if (d.sint) { state.dsel = d.sint; render(); window.scrollTo(0, 0); }
    else if (d.volver) { state.dsel = null; render(); }
    else if (d.buscartaller) { state.fesp = d.buscartaller; go("talleres"); }
    else if (d.solicitar) { state.tsel = d.solicitar; go("solicitar"); }
    else if ("buscar" in d) { state.q = d.buscar; state.cat = "Todas"; go("catalogo"); }
    else if (d.aceptar) { find(state.solicitudes, d.aceptar).estado = "Aceptada"; saveSol(); render(); toast("Precio aceptado. El taller te espera."); }
    else if (d.terminar) { find(state.solicitudes, d.terminar).estado = "Terminada"; saveSol(); render(); toast("Trabajo terminado y registrado."); }
    else if (d.rate) { find(state.solicitudes, d.rate).rating = +d.n; saveSol(); render(); toast("Gracias por calificar."); }
    else if (d.delveh) { state.garaje = state.garaje.filter(function (v) { return v.id !== d.delveh; }); store.set("garaje", state.garaje); render(); }
    else if (d.avanzar) {
      o = find(state.orders, d.avanzar); o.estado = ESTADOS[ESTADOS.indexOf(estadoPedido(o)) + 1]; saveOrders(); render(); toast(o.num + ": " + o.estado.toLowerCase());
    }
    else if (d.reset) {
      if (!window.confirm("¿Borrar todos los datos de la demo en este navegador?")) return;
      store.clear(); location.hash = ""; location.reload();
    }
    else if (d.ubicar) {
      if (!navigator.geolocation) return toast("Este navegador no permite obtener la ubicación.");
      toast("Buscando tu ubicación…");
      navigator.geolocation.getCurrentPosition(function (p) {
        state.pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (state.view === "talleres") render();
      }, function () { toast("No pudimos obtener tu ubicación. Revisa los permisos."); }, { timeout: 10000 });
    }
    else if (d.repeat) {
      o = find(state.orders, d.repeat);
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
    var f = e.target, kind = f.dataset.form, o;
    var v = function (id) { return $("#" + id).value.trim(); };
    if (kind === "otro") {
      state.cart.push({ custom: true, key: "x" + Date.now(), nombre: v("o-desc"), vehiculo: v("o-marca") + " " + v("o-modelo") + " " + v("o-anio"), qty: 1 });
      saveCart(); render(); toast("Agregado al pedido para cotizar");
    } else if (kind === "perfil") {
      state.taller = { nombre: v("t-nombre"), contacto: v("t-contacto"), telefono: v("t-tel"), direccion: v("t-dir"), zona: v("t-zona") };
      store.set("taller", state.taller); nav(); toast("Datos guardados");
    } else if (kind === "vehiculo") {
      state.garaje.push({ id: "v" + Date.now(), marca: v("g-marca"), modelo: v("g-modelo"), anio: v("g-anio"), placa: v("g-placa").toUpperCase(), km: +v("g-km") || 0, kmAceite: +v("g-kma") || 0 });
      store.set("garaje", state.garaje); render(); toast("Vehículo guardado");
    } else if (kind === "solicitud") {
      var t = tallById[state.tsel];
      state.conductor = { nombre: v("s-nombre"), tel: v("s-tel"), marca: v("s-marca"), modelo: v("s-modelo"), anio: v("s-anio") };
      store.set("conductor", state.conductor);
      state.solicitudes.unshift({
        num: nextNum("seqsv", "SV"), fecha: new Date().toISOString(), estado: "Enviada", taller: { id: t.id, nombre: t.nombre, sector: t.sector },
        cliente: { nombre: state.conductor.nombre, tel: state.conductor.tel },
        vehiculo: state.conductor.marca + " " + state.conductor.modelo + " " + state.conductor.anio,
        dia: v("s-dia"), problema: v("s-prob"), sintoma: state.dsel
      });
      saveSol(); state.dsel = null; go("solicitudes", true); toast("Solicitud enviada al taller");
    } else if (kind === "cotizar-trabajo") {
      o = find(state.solicitudes, f.dataset.num); o.precio = +f.elements.precio.value; o.estado = "Cotizada"; saveSol(); render(); toast("Precio enviado al cliente");
    } else if (kind === "cotizar-linea") {
      o = find(state.orders, f.dataset.num);
      o.lines.forEach(function (l) { if (l.key === f.dataset.key) l.precio = +f.elements.precio.value; });
      retotal(o); saveOrders(); render(); toast("Pieza cotizada");
    } else if (kind === "pedido") {
      var lines = cartLines(), tt = totals(lines);
      state.taller.nombre = v("p-nombre"); state.taller.direccion = v("p-dir"); state.taller.zona = v("p-zona");
      store.set("taller", state.taller);
      state.orders.unshift({
        num: nextNum("seq", "MK"), fecha: new Date().toISOString(), estado: ESTADOS[0], lines: lines,
        sub: tt.sub, iva: tt.iva, total: tt.total, porCotizar: tt.porCotizar, pago: v("p-pago"), nota: v("p-nota"),
        taller: JSON.parse(JSON.stringify(state.taller))
      });
      saveOrders(); state.cart = []; saveCart(); go("pedidos", true); toast("Pedido enviado a despacho");
    }
  });
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("popstate", fromHash);

  fromHash();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
