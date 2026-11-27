(function () {
  "use strict";
  var CFG = window.MEKACHI_CONFIG, SINT = window.MEKACHI_SINTOMAS, ESP = window.MEKACHI_ESPECIALIDADES, URG = window.MEKACHI_URGENCIA;
  var sintById = {}; SINT.forEach(function (s) { sintById[s.id] = s; });
  var sb = window.supabase && CFG.supabaseUrl ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;

  // ---- Lo que vive solo en este dispositivo: rol elegido, carrito y garaje de invitado.
  var PREFIX = "mekachi.";
  var store = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(PREFIX + k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) {} }
  };

  var ICONS = {
    home: "M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z", pulse: "M3 12h4l3-8 4 16 3-8h4",
    pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    list: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01", car: "M5 17v2M19 17v2M3 17h18v-5l-2-5H5l-2 5zM3 12h18M7 14.5h.01M17 14.5h.01",
    wrench: "M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z M14.5 6.5L17 4a4 4 0 0 0-5.3 5.2", box: "M3 7.5l9-4.5 9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9",
    truck: "M2 6h11v10H2zM13 9h5l3 3v4h-8zM6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", chart: "M5 20V11M11 20V4M17 20v-7M2 20h20",
    shop: "M4 10v10h16V10M2 10l2-6h16l2 6a3 3 0 0 1-5 1 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-1zM9 20v-6h6v6"
  };
  var ico = function (n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n] + '"/></svg>'; };

  var MODES = {
    conductor: { label: "Conductor", tabs: [["c-inicio", "Inicio", "home"], ["diag", "Diagnóstico", "pulse"], ["talleres", "Talleres", "pin"], ["solicitudes", "Solicitudes", "list"], ["garaje", "Garaje", "car"]] },
    taller: { label: "Taller", tabs: [["t-inicio", "Inicio", "home"], ["trabajos", "Trabajos", "wrench"], ["catalogo", "Repuestos", "box"], ["pedidos", "Pedidos", "truck"], ["perfil", "Mi taller", "shop"]] },
    despacho: { label: "Despacho", tabs: [["d-resumen", "Resumen", "chart"], ["d-pedidos", "Pedidos", "truck"], ["d-servicios", "Servicios", "wrench"], ["d-talleres", "Talleres", "shop"]] }
  };
  var PARENT = { solicitar: "talleres", carrito: "catalogo" };
  var VIEWMODE = { solicitar: "conductor", carrito: "taller" };
  Object.keys(MODES).forEach(function (m) { MODES[m].tabs.forEach(function (t) { VIEWMODE[t[0]] = m; }); });
  var ESTADOS = ["Registrado", "Confirmado", "En camino", "Entregado"];
  var LIVE = { solicitudes: 1, trabajos: 1, pedidos: 1, "t-inicio": 1, "c-inicio": 1, "d-resumen": 1, "d-pedidos": 1, "d-servicios": 1 };

  var state = {
    mode: store.get("rol", null), view: null, loading: false,
    user: null, perfil: null, miTaller: null, acc: { rol: "conductor", tab: "login", after: null, msg: "" },
    talleres: [], productos: [],
    dq: "", dcat: "Todos", dsel: null, fesp: "Todas", fzona: "Todas", pos: null, tsel: [], vsel: null, draft: null,
    garaje: store.get("garaje", []), solicitudes: [], historial: [],
    q: "", cat: "Todas", sug: null, cart: store.get("cart", []), trabajos: [], pedidos: [],
    dPedidos: [], dSolicitudes: [], dTalleres: []
  };

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var usd = function (n) { return "$" + Number(n || 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var norm = function (s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  var opts = function (list, sel) { return list.map(function (z) { return "<option" + (z === sel ? " selected" : "") + ">" + esc(z) + "</option>"; }).join(""); };
  var fecha = function (iso) { return new Date(iso).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" }); };
  var count = function (arr, fn) { return arr.filter(fn).length; };
  var byId = function (arr, id) { return arr.filter(function (x) { return x.id === id; })[0]; };
  var cartCount = function () { return state.cart.reduce(function (n, l) { return n + l.qty; }, 0); };
  var saveCart = function () { store.set("cart", state.cart); };
  var statusCls = { Enviada: "info", Pendiente: "warn", Nuevo: "warn", Cotizada: "warn", Ajuste: "warn", Aceptada: "info", Terminada: "ok", Rechazada: "", Registrado: "warn", Confirmado: "info", "En camino": "info", Entregado: "ok", Verificado: "ok", "Por verificar": "warn", Ejemplo: "" };
  var chip = function (e) { return '<span class="status ' + (statusCls[e] || "") + '">' + esc(e) + "</span>"; };
  var estrellas = function (n) { return '<span class="stars"><span>' + "★★★★★".slice(0, Math.round(n)) + "</span></span>"; };
  var waNum = function (t) { var d = String(t || "").replace(/\D/g, ""); return d.indexOf("0") === 0 ? "593" + d.slice(1) : d; };
  var field = function (id, label, attrs, val) { return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" ' + (attrs || "") + ' value="' + esc(val) + '"></div>'; };
  var TEL = 'type="tel" pattern="(\\+593|0)[0-9 ]{8,10}" data-msg="Escribe un teléfono válido, por ejemplo 0991234567"';
  var ANIO = 'inputmode="numeric" pattern="(19|20)[0-9]{2}" data-msg="Escribe el año con cuatro dígitos, por ejemplo 2018"';
  var PLACA = 'pattern="[A-Za-z]{3}-?[0-9]{3,4}" data-msg="Escribe la placa con 3 letras y 3 o 4 números, por ejemplo PBA-1234" style="text-transform:uppercase"';

  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 3200);
  }
  var ERR = { "Invalid login credentials": "Correo o contraseña incorrectos.", "Email not confirmed": "Confirma tu correo antes de iniciar sesión.", "User already registered": "Ese correo ya tiene cuenta. Inicia sesión." };
  // Ejecuta una operación de Supabase; muestra el error y devuelve null si falla.
  async function call(promise) {
    try {
      var r = await promise;
      if (r.error) { toast(ERR[r.error.message] || r.error.message || "No se pudo completar la operación."); return null; }
      return r.data == null ? true : r.data;
    } catch (e) { toast("Sin conexión. Inténtalo de nuevo."); return null; }
  }

  // =====================================================================
  // DATOS
  // =====================================================================
  function mapTaller(t) { return { id: t.id, nombre: t.nombre, sector: t.sector, zona: t.zona, lat: t.lat, lng: t.lng, esp: t.especialidades || t.esp || [], verificado: !!t.verificado, demo: t.es_demo !== false && (t.es_demo || !t.owner_id), whatsapp: t.whatsapp || "", horario: t.horario || "", rs: t.rating_suma || 0, rt: t.rating_total || 0 }; }
  async function loadPublic() {
    var local = function () {
      state.talleres = window.MEKACHI_TALLERES.map(mapTaller);
      state.productos = window.MEKACHI_CATALOGO.map(function (p) { return { id: p.id, cat: p.cat, nombre: p.nombre, compat: p.compat, precio: p.precio }; });
    };
    if (!sb) return local();
    try {
      var r = await Promise.all([
        sb.from("mekachi_talleres").select("*").eq("activo", true).order("nombre"),
        sb.from("mekachi_productos").select("*").eq("activo", true).order("categoria").order("nombre")
      ]);
      if (r[0].error || r[1].error) return local();
      state.talleres = r[0].data.filter(function (t) { return t.verificado || t.es_demo; }).map(mapTaller);
      state.productos = r[1].data.map(function (p) { return { id: p.id, cat: p.categoria, nombre: p.nombre, compat: p.compatibilidad, precio: +p.precio }; });
    } catch (e) { local(); }
  }
  async function loadAuth() {
    state.user = null; state.perfil = null; state.miTaller = null;
    if (!sb) return;
    var s = await sb.auth.getSession();
    state.user = s.data && s.data.session ? s.data.session.user : null;
    if (!state.user) return;
    var pend = store.get("pending", null);
    var p = (await sb.from("mekachi_perfiles").select("*").eq("id", state.user.id).maybeSingle()).data;
    if (!p || (pend && pend.rol === "taller" && p.rol === "conductor")) {
      var r = pend || { rol: "conductor", nombre: "", telefono: "" };
      p = await call(sb.rpc("mekachi_registrar", { p_rol: r.rol, p_nombre: r.nombre, p_telefono: r.telefono }));
    }
    state.perfil = p && p.id ? p : null;
    var t = (await sb.from("mekachi_talleres").select("*").eq("owner_id", state.user.id).maybeSingle()).data;
    if (!t && pend && pend.taller) t = await call(sb.from("mekachi_talleres").insert(Object.assign({ owner_id: state.user.id }, pend.taller)).select().single());
    state.miTaller = t && t.id ? t : null;
    store.set("pending", null);
    // El garaje de invitado sube a la cuenta la primera vez.
    var local = store.get("garaje", []);
    if (local.length) {
      var ok = await call(sb.from("mekachi_vehiculos").insert(local.map(function (v) { return { marca: v.marca, modelo: v.modelo, anio: +v.anio || null, placa: v.placa, km: v.km || 0, km_aceite: v.km_aceite || v.kmAceite || 0 }; })));
      if (ok) store.set("garaje", []);
    }
  }
  async function loadMode() {
    if (!sb || !state.mode) return;
    var u = state.user, r;
    if (state.mode === "conductor") {
      if (!u) { state.garaje = store.get("garaje", []); state.solicitudes = []; state.historial = []; return; }
      r = await Promise.all([
        sb.from("mekachi_vehiculos").select("*").eq("owner_id", u.id).order("created_at"),
        sb.from("mekachi_solicitudes").select("*, cotizaciones:mekachi_cotizaciones(*, taller:mekachi_talleres(id,nombre,sector,whatsapp))").eq("conductor_id", u.id).order("created_at", { ascending: false }),
        sb.from("mekachi_historial").select("*").order("fecha", { ascending: false })
      ]);
      if (!r[0].error) state.garaje = r[0].data;
      if (!r[1].error) state.solicitudes = r[1].data;
      if (!r[2].error) state.historial = r[2].data;
    } else if (state.mode === "taller" && state.miTaller) {
      r = await Promise.all([
        sb.from("mekachi_cotizaciones").select("*, solicitud:mekachi_solicitudes(*)").eq("taller_id", state.miTaller.id).order("created_at", { ascending: false }),
        sb.from("mekachi_pedidos").select("*, items:mekachi_pedido_items(*)").eq("taller_id", state.miTaller.id).order("created_at", { ascending: false })
      ]);
      if (!r[0].error) state.trabajos = r[0].data.filter(function (c) { return c.solicitud; });
      if (!r[1].error) state.pedidos = r[1].data;
    } else if (state.mode === "despacho" && esDespacho()) {
      r = await Promise.all([
        sb.from("mekachi_pedidos").select("*, items:mekachi_pedido_items(*), taller:mekachi_talleres(nombre,direccion,zona,telefono)").order("created_at", { ascending: false }),
        sb.from("mekachi_solicitudes").select("*, taller:mekachi_talleres(nombre)").order("created_at", { ascending: false }),
        sb.from("mekachi_talleres").select("*").order("created_at", { ascending: false })
      ]);
      if (!r[0].error) state.dPedidos = r[0].data;
      if (!r[1].error) state.dSolicitudes = r[1].data;
      if (!r[2].error) state.dTalleres = r[2].data;
    }
  }
  var esDespacho = function () { return !!(state.perfil && state.perfil.rol === "despacho"); };
  async function reload() { await loadMode(); render(); }
  // Tras una escritura: recarga y avisa.
  async function done(res, msg) { if (!res) return false; await reload(); if (msg) toast(msg); return true; }

  // =====================================================================
  // NAVEGACIÓN
  // =====================================================================
  function badgeFor(v) {
    if (v === "catalogo") return cartCount();
    if (v === "trabajos") return count(state.trabajos, function (c) { return c.estado === "Pendiente" || c.estado === "Ajuste"; });
    if (v === "solicitudes") return count(state.solicitudes, function (o) { return o.estado === "Cotizada"; });
    if (v === "d-pedidos") return count(state.dPedidos, function (o) { return o.estado !== "Entregado"; });
    if (v === "d-talleres") return count(state.dTalleres, function (t) { return !t.verificado && !t.es_demo; });
    return 0;
  }
  function nav() {
    document.body.classList.toggle("welcome", !state.mode);
    if (!state.mode) return;
    var modes = Object.keys(MODES).map(function (m) { return '<button data-mode="' + m + '" aria-pressed="' + (state.mode === m) + '">' + MODES[m].label + "</button>"; }).join("");
    $$(".modes").forEach(function (el) { el.innerHTML = modes; });
    var cur = PARENT[state.view] || state.view;
    var tabs = MODES[state.mode].tabs.map(function (t) {
      var b = badgeFor(t[0]);
      return '<button data-go="' + t[0] + '"' + (cur === t[0] ? ' aria-current="page"' : "") + ">" + ico(t[2]) + "<span>" + t[1] + "</span>" + (b ? '<span class="badge">' + b + "</span>" : "") + "</button>";
    }).join("");
    $("#sidenav").innerHTML = tabs; $("#tabbar").innerHTML = tabs;
    $("#side-cuenta").innerHTML = ico("user") + "<span>" + (state.user ? "Mi cuenta" : "Iniciar sesión") + "</span>";
    $("#side-cuenta").setAttribute("aria-current", state.view === "cuenta" || state.view === "acceso" ? "page" : "false");
    $("#top-cuenta").innerHTML = ico("user");
  }
  // Pantallas que exigen sesión con cierto rol.
  function guard(v) {
    var m = VIEWMODE[v];
    if (m === "taller" && !(state.user && (state.miTaller || v === "perfil"))) return "taller";
    if (m === "despacho" && !esDespacho()) return "despacho";
    return null;
  }
  function go(v, replace) {
    if (VIEWMODE[v]) state.mode = VIEWMODE[v];
    var need = guard(v);
    if (need === "taller" && state.user) { v = "perfil"; need = null; toast("Completa los datos de tu taller para continuar."); }
    if (need) { state.acc = { rol: need, tab: state.user ? "login" : (need === "taller" ? "registro" : "login"), after: v, msg: "" }; v = "acceso"; }
    if (v === "cuenta" && !state.user && state.view !== "cuenta") state.acc = { rol: "conductor", tab: "registro", after: MODES[state.mode].tabs[0][0], msg: "" };
    state.view = v; render(); window.scrollTo(0, 0);
    var h = "#/" + v;
    if (location.hash !== h) { if (replace) history.replaceState(null, "", h); else history.pushState(null, "", h); }
    if (LIVE[v] || v === "garaje" || v === "d-talleres") reload();
    // El mapa siempre muestra la red al día: talleres recién verificados y calificaciones.
    if (v === "talleres" && state.ready) loadPublic().then(function () { if (state.view === "talleres") render(); });
  }
  function setMode(m) { state.mode = m; store.set("rol", m); go(MODES[m].tabs[0][0]); }
  function fromHash() {
    var v = location.hash.replace(/^#\/?/, "");
    if (!state.mode) return render();
    if (v === "solicitar" && !state.tsel.length) v = "talleres";
    if (!VIEW[v] || v === "acceso") v = MODES[state.mode].tabs[0][0];
    go(v, true);
  }

  // =====================================================================
  // BIENVENIDA, ACCESO Y CUENTA
  // =====================================================================
  function viewBienvenida() {
    var role = function (m, icon, t, d) { return '<button class="role" data-mode="' + m + '">' + ico(icon) + "<span><b>" + t + "</b><small>" + d + "</small></span></button>"; };
    return '<div class="welcome-screen"><div class="welcome-box"><span class="logo"><svg><use href="#mk"/></svg>Mekachi</span>' +
      "<h1>Mecánicas de confianza. <em>Repuestos garantizados.</em></h1>" +
      "<p>Diagnóstico inicial de tu auto, talleres verificados en Quito y el repuesto correcto en horas.</p>" +
      '<div class="roles">' +
      role("conductor", "car", "Soy conductor", "Diagnostica tu auto y encuentra un taller. Sin registro.") +
      role("taller", "wrench", "Soy taller", "Registra tu taller, recibe clientes y pide repuestos") +
      role("despacho", "truck", "Soy Mekachi", "Despacho: pedidos, cotizaciones y talleres") +
      '</div><p class="foot">Puedes cambiar de perfil en cualquier momento.</p></div></div>';
  }
  function viewAcceso() {
    var a = state.acc, reg = a.tab === "registro" && a.rol !== "despacho";
    var titulo = a.rol === "taller" ? (reg ? "Registra tu taller" : "Entra a tu taller") : a.rol === "despacho" ? "Acceso de despacho" : (reg ? "Crea tu cuenta" : "Inicia sesión");
    var intro = a.msg || (a.rol === "taller" ? "Con tu cuenta recibes solicitudes de conductores y pides repuestos." : a.rol === "despacho" ? "Solo para el equipo de Mekachi." : "Con tu cuenta guardas tus autos, tus solicitudes y el historial de servicios.");
    if (state.user && a.rol === "despacho") return "<h1>Acceso de despacho</h1><div class='notice'>Tu cuenta no tiene permiso de despacho. Pide al administrador de Mekachi que la habilite.</div><button class='btn' data-logout='1'>Cerrar sesión</button>";
    var extra = "";
    if (reg && a.rol === "conductor") extra = field("r-nombre", "Tu nombre", "required autocomplete=name", "") + field("r-tel", "Teléfono", TEL + " required", "");
    if (reg && a.rol === "taller") extra = field("r-taller", "Nombre del taller", "required", "") +
      '<div class="row">' + field("r-nombre", "Persona de contacto", "required", "") + field("r-tel", "Teléfono o WhatsApp", TEL + " required", "") + "</div>" +
      field("r-dir", "Dirección", 'required placeholder="Calle, número y referencia"', "") +
      '<div class="row">' + field("r-sector", "Sector o barrio", 'required placeholder="El Inca"', "") +
      '<div class="field"><label for="r-zona">Zona de Quito</label><select id="r-zona">' + opts(CFG.zonas) + "</select></div></div>" +
      '<div class="field"><label>Especialidades</label><div class="checks">' + ESP.map(function (e) { return '<label><input type="checkbox" name="esp" value="' + esc(e) + '"> ' + esc(e) + "</label>"; }).join("") + "</div></div>";
    return "<h1>" + titulo + "</h1><p class='muted'>" + esc(intro) + "</p>" +
      (a.rol !== "despacho" ? '<div class="chips"><button data-acctab="login" aria-pressed="' + !reg + '">Ya tengo cuenta</button><button data-acctab="registro" aria-pressed="' + reg + '">' + (a.rol === "taller" ? "Registrar taller" : "Crear cuenta") + "</button></div>" : "") +
      '<form class="card" data-form="' + (reg ? "registro" : "login") + '">' + extra +
      field("a-email", "Correo", 'type="email" required autocomplete="email" data-msg="Escribe un correo válido"', "") +
      field("a-pass", "Contraseña", 'type="password" required minlength="6" autocomplete="' + (reg ? "new-password" : "current-password") + '" data-msg="Mínimo 6 caracteres"', "") +
      '<button class="btn primary block">' + (reg ? (a.rol === "taller" ? "Registrar taller" : "Crear cuenta") : "Entrar") + "</button></form>" +
      (a.rol === "conductor" ? '<button class="back" data-go="c-inicio">Seguir sin cuenta</button>' : "");
  }
  function viewCuenta() {
    if (!state.user) return viewAcceso() + acercaHtml();
    var p = state.perfil || {};
    return "<h1>Mi cuenta</h1>" +
      '<div class="card"><h2>' + esc(p.nombre || "Sin nombre") + '</h2><p class="muted small">' + esc(state.user.email || "") + " · " + esc(p.rol === "taller" ? "Taller" : p.rol === "despacho" ? "Despacho Mekachi" : "Conductor") + "</p>" +
      '<form data-form="micuenta"><div class="row">' + field("c-nombre", "Nombre", "required", p.nombre) + field("c-tel", "Teléfono", TEL, p.telefono) + "</div>" +
      '<div class="actions"><button class="btn sm primary">Guardar</button><button type="button" class="btn sm" data-logout="1">Cerrar sesión</button></div></form></div>' + acercaHtml();
  }
  function acercaHtml() {
    return '<div class="section-title">Acerca de Mekachi</div><div class="card"><div class="steps3">' +
      "<div><b>El conductor cuenta qué pasa</b><span>Recibe un diagnóstico inicial y pide precio a talleres del mapa.</span></div>" +
      "<div><b>El taller da precio cerrado</b><span>Mano de obra y repuestos por separado; el conductor acepta antes de dejar el auto.</span></div>" +
      "<div><b>Mekachi lleva el repuesto</b><span>El taller lo pide en la app y despacho lo entrega.</span></div></div></div>" +
      '<div class="card"><p class="muted small">Versión piloto. Los talleres marcados como «Ejemplo» y los precios del catálogo son de demostración.</p>' +
      '<div class="actions"><a class="btn sm" href="plan/">Plan de crecimiento</a><a class="btn sm" href="presentacion/">Presentación</a></div></div>';
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
  var vehNombre = function (v) { return v.marca + " " + v.modelo + (v.anio ? " " + v.anio : ""); };
  var kmAceite = function (v) { return v.km_aceite || v.kmAceite || 0; };
  var vehSel = function () { return byId(state.garaje, state.vsel) || state.garaje[0] || null; };
  function diasPara(f) { return f ? Math.ceil((new Date(f + "T00:00:00") - new Date()) / 864e5) : null; }

  function viewCInicio() {
    var hoy = new Date().getDay(), avisos = [];
    state.garaje.forEach(function (v) {
      var d = digito(v.placa), n = esc(v.marca + " " + v.modelo), s = diasPara(v.soat_vence), m = diasPara(v.matricula_vence);
      if (diaPico(d) === hoy) avisos.push("<b>Hoy tienes pico y placa</b> con tu " + n + ". Buen día para llevarlo al taller.");
      if (mesRevision(d) === new Date().getMonth()) avisos.push("<b>Este mes te toca la revisión técnica</b> del " + n + ".");
      if (v.km && kmAceite(v) && kmAceite(v) + KM_ACEITE - v.km <= 500) avisos.push("<b>Cambio de aceite cerca</b> en tu " + n + ".");
      if (s != null && s <= 30) avisos.push("<b>" + (s < 0 ? "El SOAT está vencido" : "El SOAT vence en " + s + " días") + "</b> · " + n + ".");
      if (m != null && m <= 30) avisos.push("<b>" + (m < 0 ? "La matrícula está vencida" : "La matrícula vence en " + m + " días") + "</b> · " + n + ".");
    });
    var cot = count(state.solicitudes, function (o) { return o.estado === "Cotizada"; });
    if (cot) avisos.unshift("<b>Tienes " + cot + (cot === 1 ? " solicitud" : " solicitudes") + " con precio</b> por revisar.");
    var q = function (v, icon, t, d) { return '<button data-go="' + v + '">' + ico(icon) + "<span><b>" + t + "</b>" + d + "</span></button>"; };
    return '<div class="hero-card"><h1>¿Qué le pasa a tu auto?</h1><p>Cuéntanos el síntoma y recibe un diagnóstico inicial en segundos.</p>' +
      '<button class="btn amber" data-go="diag">Empezar diagnóstico</button></div>' +
      avisos.map(function (a) { return '<div class="notice">' + a + "</div>"; }).join("") +
      '<div class="quick">' + q("talleres", "pin", "Talleres", "Mapa de talleres cerca de ti") + q("solicitudes", "list", "Solicitudes", "Precios y estado de tus servicios") +
      q("garaje", "car", "Mi garaje", "Recordatorios e historial") + "</div>" +
      (state.user ? "" : '<div class="card"><h2>Guarda tu historial</h2><p class="muted small">Con una cuenta gratuita conservas tus autos, tus solicitudes y cada servicio realizado.</p><button class="btn sm primary" data-go="cuenta">Crear cuenta o entrar</button></div>');
  }

  // ---------- Diagnóstico
  var STOP = { motor: 1, para: 1, cuando: 1, auto: 1, carro: 1, tiene: 1, hace: 1, esta: 1, como: 1, pero: 1, desde: 1, mucho: 1, algo: 1, sale: 1, que: 1, del: 1, los: 1, las: 1, una: 1, con: 1, por: 1 };
  function matchSint() {
    var words = norm(state.dq).split(/[^a-z0-9/]+/).filter(function (w) { return w.length > 2 && !STOP[w]; }).map(function (w) { return w.length > 5 ? w.slice(0, 5) : w; });
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
      return '<button class="sint" data-sint="' + s.id + '"><span><b>' + esc(s.titulo) + "</b><small>" + esc(s.cat) + '</small></span><i class="dot ' + s.urgencia + '" title="' + esc(URG[s.urgencia].titulo) + '"></i></button>';
    }).join("");
  }
  function vehPicker() {
    if (!state.garaje.length) return "";
    var v = vehSel();
    if (state.garaje.length === 1) return '<p class="small" style="margin:8px 0 0">Para tu <b>' + esc(vehNombre(v)) + "</b></p>";
    return '<div class="field" style="margin-top:8px"><label for="vsel">Vehículo</label><select id="vsel">' + state.garaje.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === v.id ? " selected" : "") + ">" + esc(vehNombre(g)) + "</option>"; }).join("") + "</select></div>";
  }
  function viewDiag() {
    if (state.dsel) return viewResultado(sintById[state.dsel]);
    var cats = ["Todos"].concat(SINT.map(function (s) { return s.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    return "<h1>¿Qué le pasa a tu auto?</h1><p class='muted small'>Cuéntalo con tus palabras o elige un síntoma. Te damos una primera orientación.</p>" + vehPicker() +
      '<input type="search" id="dq" placeholder="Ej.: chilla al frenar, no prende, se calienta…" value="' + esc(state.dq) + '" aria-label="Describe el problema" style="margin-top:8px">' +
      '<div class="chips">' + cats.map(function (c) { return '<button data-dcat="' + esc(c) + '" aria-pressed="' + (state.dcat === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
      '<div class="legend"><span><i class="dot alta"></i>No conduzcas</span><span><i class="dot media"></i>Revisa esta semana</span><span><i class="dot baja"></i>Sin urgencia</span></div>' +
      '<div class="list" id="sintomas">' + sintListHtml() + "</div>";
  }
  function viewResultado(s) {
    var u = URG[s.urgencia], v = vehSel();
    var li = function (a) { return "<ul class='plain'>" + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
    return '<button class="back" data-volver="1">← Otro síntoma</button><h1>' + esc(s.titulo) + "</h1>" + (v ? '<p class="muted small">Diagnóstico para tu ' + esc(vehNombre(v)) + "</p>" : "") +
      '<div class="urg ' + s.urgencia + '"><b>' + esc(u.titulo) + "</b><span>" + esc(u.texto) + "</span></div>" +
      (s.nota ? '<div class="notice">' + esc(s.nota) + "</div>" : "") +
      '<div class="card"><h2>Causas más probables</h2>' + li(s.causas) + "</div>" +
      '<div class="card"><h2>Servicio recomendado</h2><p>' + esc(s.servicio) + "</p><h2>Repuestos que suele requerir</h2>" + li(s.repuestos) + "</div>" +
      (s.urgencia === "alta" ? '<button class="btn primary block" data-buscartaller="' + esc(s.esp) + '" data-tipo="grua">Pedir grúa o mecánico a domicilio</button><button class="btn block" style="margin-top:8px" data-buscartaller="' + esc(s.esp) + '">Ver talleres de ' + esc(s.esp.toLowerCase()) + "</button>"
        : '<button class="btn primary block" data-buscartaller="' + esc(s.esp) + '">Ver talleres de ' + esc(s.esp.toLowerCase()) + "</button>") +
      '<p class="muted small" style="margin-top:12px">Orientación inicial basada en síntomas comunes. No reemplaza la revisión de un mecánico.</p>';
  }

  // ---------- Talleres y mapa
  function dist(a, b) {
    var R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function talleresFiltrados() {
    var list = state.talleres.filter(function (t) {
      return (state.fesp === "Todas" || t.esp.indexOf(state.fesp) >= 0) && (state.fzona === "Todas" || t.zona === state.fzona);
    }).map(function (t) { return { t: t, d: state.pos && t.lat != null ? dist(state.pos, t) : null }; });
    if (state.pos) list.sort(function (a, b) { return (a.d == null ? 1e9 : a.d) - (b.d == null ? 1e9 : b.d); });
    return list;
  }
  var selBtn = function (id) { var on = state.tsel.indexOf(id) >= 0; return '<button class="btn sm ' + (on ? "" : "primary") + '" data-sel="' + id + '">' + (on ? "✓ Elegido" : "Elegir") + "</button>"; };
  function selBar() {
    var n = state.tsel.length;
    return n ? '<button class="btn primary block" data-go="solicitar">Pedir precio a ' + n + (n === 1 ? " taller" : " talleres") + "</button>" : "";
  }
  function viewTalleres() {
    var list = talleresFiltrados();
    return "<h1>Talleres cerca de ti</h1><p class='muted small'>Elige hasta 3 talleres para comparar precios.</p>" +
      '<div class="row" style="margin-top:10px"><div class="field"><label for="f-esp">Especialidad</label><select id="f-esp">' + opts(["Todas"].concat(ESP), state.fesp) + "</select></div>" +
      '<div class="field"><label for="f-zona">Zona</label><select id="f-zona">' + opts(["Todas"].concat(CFG.zonas), state.fzona) + "</select></div></div>" +
      '<div class="tgrid"><div><div id="mapa" aria-label="Mapa de talleres"></div>' +
      '<button class="btn sm block" data-ubicar="1" style="margin-top:10px">' + (state.pos ? "Ordenado por cercanía · actualizar ubicación" : "Usar mi ubicación para ordenar por cercanía") + "</button></div>" +
      '<div class="list" id="tlist">' + (list.length ? list.map(function (x) {
        var t = x.t;
        return '<div class="tcard" id="tc-' + t.id + '"><div><div class="name">' + esc(t.nombre) + " " + (t.demo ? chip("Ejemplo") : chip("Verificado")) + '</div><div class="meta">' + esc(t.sector) + " · " + esc(t.zona) +
          (x.d != null ? " · a " + x.d.toFixed(1).replace(".", ",") + " km" : "") + (t.horario ? " · " + esc(t.horario) : "") + "</div>" +
          (t.rt ? '<div class="meta">' + estrellas(t.rs / t.rt) + " " + (t.rs / t.rt).toFixed(1).replace(".", ",") + " (" + t.rt + ")</div>" : "") + '<div class="tags">' +
          t.esp.map(function (e) { return "<span" + (e === state.fesp ? ' class="on"' : "") + ">" + esc(e) + "</span>"; }).join("") + "</div></div>" + selBtn(t.id) + "</div>";
      }).join("") : '<div class="empty">No hay talleres con ese filtro.</div>') + "</div></div>" +
      '<div class="cartbar" id="selbar">' + selBar() + "</div>";
  }
  function toggleSel(id) {
    var i = state.tsel.indexOf(id);
    if (i >= 0) state.tsel.splice(i, 1);
    else if (state.tsel.length >= 3) return toast("Puedes elegir hasta 3 talleres.");
    else state.tsel.push(id);
    render();
  }
  var map = null;
  function initMap() {
    var el = $("#mapa"); if (!el) return;
    if (!window.L) { el.innerHTML = '<div class="empty">El mapa no se pudo cargar. La lista de talleres sigue disponible.</div>'; return; }
    var list = talleresFiltrados().filter(function (x) { return x.t.lat != null; });
    map = L.map(el, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([-0.19, -78.49], 11);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
    var icon = L.divIcon({ className: "pin", html: '<svg viewBox="0 0 32 32"><use href="#mk"/></svg>', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
    var pts = list.map(function (x) {
      var t = x.t, box = document.createElement("div");
      box.innerHTML = "<b>" + esc(t.nombre) + "</b><br>" + esc(t.sector) + "<br>" + esc(t.esp.join(" · ")) + '<br><button class="btn sm primary" style="margin-top:8px">' + (state.tsel.indexOf(t.id) >= 0 ? "Quitar" : "Elegir este taller") + "</button>";
      box.querySelector("button").addEventListener("click", function () { toggleSel(t.id); });
      L.marker([t.lat, t.lng], { icon: icon, title: t.nombre }).addTo(map).bindPopup(box).on("click", function () {
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
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 14, animate: false });
  }

  // ---------- Solicitar servicio
  function viewSolicitar() {
    var d = state.draft || {}, p = state.perfil || {}, s = state.dsel ? sintById[state.dsel] : null, g = vehSel() || {};
    var hoy = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    var ts = state.tsel.map(function (id) { return byId(state.talleres, id); }).filter(Boolean);
    return '<button class="back" data-go="talleres">← Volver a talleres</button><h1>Pedir precio</h1>' +
      '<div class="notice">Se envía a <b>' + esc(ts.map(function (t) { return t.nombre; }).join(", ")) + "</b>. Cada taller responde con un precio cerrado antes de que lleves el auto.</div>" +
      '<form class="card" data-form="solicitud">' +
      '<div class="field"><label for="s-prob">¿Qué necesitas?</label><textarea id="s-prob" rows="2" required>' + esc(d.problema || (s ? s.titulo : "")) + "</textarea></div>" +
      '<div class="field"><label for="s-tipo">¿Cómo prefieres el servicio?</label><select id="s-tipo">' + Object.keys(CFG.tipos).map(function (k) { return '<option value="' + k + '"' + (k === (d.tipo || state.tipo || "taller") ? " selected" : "") + ">" + esc(CFG.tipos[k]) + "</option>"; }).join("") + "</select></div>" +
      (state.garaje.length > 1 ? vehPicker() : "") +
      '<div class="row3">' + field("s-marca", "Marca", 'required placeholder="Chevrolet"', d.marca || g.marca) + field("s-modelo", "Modelo", 'required placeholder="Sail"', d.modelo || g.modelo) + field("s-anio", "Año", ANIO + ' required placeholder="2018"', d.anio || g.anio) + "</div>" +
      '<div class="row">' + field("s-nombre", "Tu nombre", "required", d.nombre || p.nombre) + field("s-tel", "Teléfono", TEL + " required", d.tel || p.telefono) + "</div>" +
      field("s-dia", "Día preferido", 'type="date" required min="' + hoy + '"', d.dia || hoy) +
      '<button class="btn primary block">' + (state.user ? "Enviar solicitud" : "Continuar") + "</button>" +
      (state.user ? "" : '<p class="muted small" style="margin-top:8px">Para enviarla te pediremos crear una cuenta; así recibes los precios y guardas el historial.</p>') + "</form>";
  }
  function viewSolicitudes() {
    if (!state.user) return "<h1>Mis solicitudes</h1><div class='empty'>Inicia sesión para ver tus solicitudes y los precios de los talleres.<br><br><button class='btn primary' data-go='cuenta'>Crear cuenta o entrar</button></div>";
    if (!state.solicitudes.length) return "<h1>Mis solicitudes</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Aún no has pedido ningún servicio.<br><br><button class='btn primary' data-go='diag'>Empezar con el diagnóstico</button>") + "</div>";
    return "<h1>Mis solicitudes</h1>" + state.solicitudes.map(function (o) {
      var cots = (o.cotizaciones || []).slice().sort(function (a, b) { return (a.mano_obra == null) - (b.mano_obra == null) || (a.mano_obra + a.repuestos) - (b.mano_obra + b.repuestos); });
      var abierta = o.estado === "Enviada" || o.estado === "Cotizada", body;
      if (abierta) body = cots.map(function (c) {
        var t = c.taller || {};
        if (c.estado === "Pendiente") return '<div class="quote"><div><b>' + esc(t.nombre) + '</b><div class="meta">Esperando su precio</div></div></div>';
        if (c.estado === "Ajuste") return '<div class="quote"><div><b>' + esc(t.nombre) + '</b><div class="meta">Pediste un ajuste; esperando nuevo precio</div></div></div>';
        if (c.estado === "Rechazada") return '<div class="quote off"><div><b>' + esc(t.nombre) + '</b><div class="meta">Rechazada</div></div></div>';
        return '<div class="quote"><div><b>' + esc(t.nombre) + '</b><div class="meta">Mano de obra ' + usd(c.mano_obra) + " · Repuestos " + usd(c.repuestos) + (c.nota ? "<br>" + esc(c.nota) : "") + '</div></div><div class="qprice">' + usd(+c.mano_obra + +c.repuestos) + "</div>" +
          '<div class="actions" style="grid-column:1/-1"><button class="btn sm primary" data-cot="' + c.id + '" data-acc="aceptar">Aceptar</button><button class="btn sm" data-cot="' + c.id + '" data-acc="ajuste">Pedir ajuste</button><button class="btn sm" data-cot="' + c.id + '" data-acc="rechazar">Rechazar</button></div></div>';
      }).join("");
      else {
        var ac = cots.filter(function (c) { return c.estado === "Aceptada"; })[0] || {}, t = ac.taller || {};
        body = '<p class="small"><b>' + esc(t.nombre || "Taller") + "</b> · " + (o.estado === "Terminada" ? "Pagaste " : "Precio acordado ") + "<b>" + usd(o.precio_final) + "</b></p>" +
          (ac.mano_obra != null ? '<p class="muted small">Mano de obra ' + usd(ac.mano_obra) + " · Repuestos " + usd(ac.repuestos) + "</p>" : "") +
          (o.estado === "Aceptada" ? '<p class="muted small">Lleva tu auto el día acordado. El taller marcará el trabajo como terminado.</p>' + (t.whatsapp ? '<div class="actions"><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(waNum(t.whatsapp)) + '">Escribir al taller por WhatsApp</a></div>' : "") : "") +
          (o.estado === "Terminada" ? (o.rating ? '<p class="small">Tu calificación: ' + estrellas(o.rating) + "</p>"
            : '<p class="small" style="margin-bottom:2px">Califica al taller:</p><div class="stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<button data-rate="' + o.id + '" data-n="' + n + '" aria-label="' + n + ' estrellas">★</button>'; }).join("") + "</div>") : "");
      }
      return '<div class="card"><div class="head"><div><h2>' + esc(o.problema) + '</h2><div class="muted small">' + esc(o.num) + " · " + esc(o.vehiculo_texto) + " · " + esc(o.dia || "") + " · " + esc(CFG.tipos[o.tipo] || "") + "</div></div>" + chip(o.estado) + "</div>" + body + "</div>";
    }).join("");
  }

  // ---------- Garaje
  function viewGaraje() {
    return "<h1>Mi garaje</h1><p class='muted small'>" + (state.user ? "Tus vehículos, recordatorios e historial de servicios." : "Se guarda en este dispositivo. Con una cuenta lo conservas y sumas el historial de servicios.") + "</p>" +
      state.garaje.map(function (v) {
        var d = digito(v.placa), dp = diaPico(d), mr = mesRevision(d), ka = kmAceite(v);
        var aceite = v.km && ka ? ka + KM_ACEITE - v.km : null, s = diasPara(v.soat_vence), m = diasPara(v.matricula_vence);
        var vence = function (n, f) { return n == null ? "Sin fecha" : n < 0 ? "Vencido" : new Date(f + "T00:00:00").toLocaleDateString("es-EC", { dateStyle: "medium" }); };
        var hist = state.historial.filter(function (h) { return h.vehiculo_id === v.id; });
        return '<div class="card"><div class="head"><div><h2>' + esc(vehNombre(v)) + '</h2><span class="plate">' + esc(v.placa) + "</span></div>" +
          '<button class="btn sm danger" data-delveh="' + esc(v.id) + '">Quitar</button></div><div class="veh">' +
          "<div><small>Pico y placa</small><b>" + (dp ? "Los " + DIAS[dp] : "—") + "</b></div>" +
          "<div><small>Revisión técnica</small><b>" + (mr != null ? "En " + MESES[mr] : "—") + "</b></div>" +
          "<div><small>Cambio de aceite</small><b>" + (aceite == null ? "Agrega el kilometraje" : aceite <= 0 ? "Ya te toca" : "En " + aceite.toLocaleString("es-EC") + " km") + "</b></div>" +
          "<div><small>SOAT</small><b>" + vence(s, v.soat_vence) + "</b></div><div><small>Matrícula</small><b>" + vence(m, v.matricula_vence) + "</b></div></div>" +
          (state.user ? '<div class="section-title" style="margin-top:4px">Historial de servicios</div>' + (hist.length ? '<ul class="lines">' + hist.map(function (h) {
            return "<li><span>" + esc(h.descripcion) + ' <span class="muted">· ' + esc(h.taller_nombre) + " · " + esc(h.fecha) + "</span></span><span>" + (h.precio != null ? usd(h.precio) : "") + "</span></li>";
          }).join("") + "</ul>" : '<p class="muted small">Aquí quedará cada servicio terminado con Mekachi.</p>') : "") +
          '<button class="btn sm primary" data-diagveh="' + esc(v.id) + '">Diagnosticar este auto</button></div>';
      }).join("") +
      '<form class="card" data-form="vehiculo"><h2>Agregar vehículo</h2>' +
      '<div class="row3">' + field("g-marca", "Marca", 'required placeholder="Chevrolet"', "") + field("g-modelo", "Modelo", 'required placeholder="Sail"', "") + field("g-anio", "Año", ANIO + ' required placeholder="2018"', "") + "</div>" +
      field("g-placa", "Placa", PLACA + ' required placeholder="PBA-1234"', "") +
      '<div class="row">' + field("g-km", "Kilometraje actual (opcional)", 'inputmode="numeric" pattern="[0-9]*" placeholder="85000"', "") + field("g-kma", "Km del último cambio de aceite (opcional)", 'inputmode="numeric" pattern="[0-9]*" placeholder="82000"', "") + "</div>" +
      '<div class="row">' + field("g-soat", "Vence el SOAT (opcional)", 'type="date"', "") + field("g-mat", "Vence la matrícula (opcional)", 'type="date"', "") + "</div>" +
      '<button class="btn primary block">Guardar vehículo</button></form>' +
      '<p class="muted small">Pico y placa según el último dígito (1-2 lunes … 9-0 viernes) y revisión según el calendario habitual. Confirma horarios y fechas vigentes con la AMT.</p>';
  }

  // =====================================================================
  // TALLER
  // =====================================================================
  function viewTInicio() {
    var t = state.miTaller;
    var nuevos = count(state.trabajos, function (c) { return c.estado === "Pendiente" || c.estado === "Ajuste"; });
    var curso = count(state.trabajos, function (c) { return c.estado === "Aceptada" && c.solicitud.estado === "Aceptada"; });
    var ped = count(state.pedidos, function (o) { return o.estado !== "Entregado"; });
    var q = function (v, icon, tt, d) { return '<button data-go="' + v + '">' + ico(icon) + "<span><b>" + tt + "</b>" + d + "</span></button>"; };
    return "<h1>" + esc(t.nombre) + " " + chip(t.verificado ? "Verificado" : "Por verificar") + "</h1><p class='muted small'>Resumen de hoy</p>" +
      (t.verificado ? "" : '<div class="notice">Tu taller está registrado. Aparecerá en el mapa de conductores cuando Mekachi lo verifique; mientras tanto ya puedes pedir repuestos.</div>') +
      (t.lat == null ? '<div class="notice">Falta la ubicación de tu taller para mostrarlo en el mapa. <button class="btn sm" data-go="perfil">Agregar ubicación</button></div>' : "") +
      '<div class="kpis"><div class="kpi"><b>' + nuevos + "</b><span>Trabajos por cotizar</span></div><div class='kpi'><b>" + curso + "</b><span>Trabajos en curso</span></div>" +
      "<div class='kpi'><b>" + ped + "</b><span>Pedidos en proceso</span></div>" + (t.rating_total ? "<div class='kpi'><b>" + (t.rating_suma / t.rating_total).toFixed(1).replace(".", ",") + " ★</b><span>" + t.rating_total + " calificaciones</span></div>" : "") + "</div>" +
      '<div class="quick">' + q("trabajos", "wrench", "Trabajos", "Solicitudes de conductores") + q("catalogo", "box", "Pedir repuestos", "Catálogo y cotizaciones") + q("pedidos", "truck", "Mis pedidos", "Seguimiento de entregas") + "</div>";
  }
  function viewTrabajos() {
    if (!state.trabajos.length) return "<h1>Trabajos</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Aquí llegan las solicitudes de los conductores que elijan tu taller.") + "</div>";
    return "<h1>Trabajos</h1><p class='muted small'>Responde con un precio cerrado. El cliente lo acepta antes de traer el auto.</p>" +
      state.trabajos.map(function (c) {
        var o = c.solicitud, s = o.sintoma_id ? sintById[o.sintoma_id] : null, act = "", est = c.estado === "Pendiente" ? "Nuevo" : o.estado === "Terminada" && c.estado === "Aceptada" ? "Terminada" : c.estado;
        var form = '<form data-form="cotizar" data-id="' + c.id + '"><div class="row">' +
          '<div class="field"><label>Mano de obra $</label><input name="mano" type="number" min="0" step="0.01" required value="' + (c.mano_obra == null ? "" : c.mano_obra) + '"></div>' +
          '<div class="field"><label>Repuestos $</label><input name="rep" type="number" min="0" step="0.01" required value="' + (c.repuestos == null ? "" : c.repuestos) + '"></div></div>' +
          '<div class="field"><label>Nota para el cliente (opcional)</label><input name="nota" maxlength="200" placeholder="Ej.: incluye purga y revisión de discos" value="' + esc(c.nota) + '"></div>' +
          '<button class="btn sm primary">Enviar precio cerrado</button></form>';
        if (c.estado === "Pendiente") act = form;
        if (c.estado === "Ajuste") act = '<div class="notice">El cliente pidió un ajuste del precio.</div>' + form;
        if (c.estado === "Enviada") act = '<p class="muted small">Precio enviado: <b>' + usd(+c.mano_obra + +c.repuestos) + "</b>. Esperando al cliente.</p>";
        if (c.estado === "Rechazada") act = '<p class="muted small">El cliente eligió otra opción.</p>';
        if (c.estado === "Aceptada" && o.estado === "Aceptada") act = '<p class="small"><b>Cliente aceptó ' + usd(o.precio_final) + "</b> · " + esc(o.cliente_nombre) + " · " + esc(o.cliente_tel) + '</p><div class="actions"><button class="btn sm primary" data-sug="' + c.id + '">Pedir repuestos</button><button class="btn sm" data-terminar="' + o.id + '">Marcar terminado</button>' +
          (o.cliente_tel ? '<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(waNum(o.cliente_tel)) + '">WhatsApp al cliente</a>' : "") + "</div>";
        if (o.estado === "Terminada" && c.estado === "Aceptada") act = '<p class="small">Cobrado: <b>' + usd(o.precio_final) + "</b>" + (o.rating ? " · " + estrellas(o.rating) : " · sin calificar") + "</p>";
        return '<div class="card"><div class="head"><div><h2>' + esc(o.vehiculo_texto) + '</h2><div class="muted small">' + esc(o.num) + " · " + esc(o.dia || "") + " · " + esc(CFG.tipos[o.tipo] || "") + "</div></div>" + chip(est) + "</div>" +
          "<p>" + esc(o.problema) + "</p>" +
          (s ? '<p class="muted small"><b>Diagnóstico inicial:</b> ' + esc(s.causas.join("; ")) + ".<br><b>Repuestos probables:</b> " + esc(s.repuestos.join(", ")) + ".</p>" : "") + act + "</div>";
      }).join("");
  }

  function cartLines() {
    return state.cart.map(function (l) {
      if (l.custom) return l;
      var p = byId(state.productos, l.id);
      return p ? { id: l.id, qty: l.qty, nombre: p.nombre, detalle: p.compat, precio: p.precio } : null;
    }).filter(Boolean);
  }
  function totals(lines) {
    var sub = 0, porCotizar = 0;
    lines.forEach(function (l) { if (l.precio == null) porCotizar += 1; else sub += l.precio * l.qty; });
    return { sub: sub, iva: sub * CFG.iva, total: sub * (1 + CFG.iva), porCotizar: porCotizar };
  }
  function stepper(key, qty) { return '<div class="stepper"><button data-dec="' + esc(key) + '" aria-label="Quitar uno">−</button><span>' + qty + '</span><button data-inc="' + esc(key) + '" aria-label="Agregar uno">+</button></div>'; }
  function listHtml() {
    var q = norm(state.q.trim());
    var items = state.productos.filter(function (p) {
      if (state.cat !== "Todas" && p.cat !== state.cat) return false;
      if (!q) return true;
      var hay = norm(p.nombre + " " + p.compat + " " + p.cat);
      return q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
    });
    if (!items.length) return '<div class="empty">No hay repuestos con esa búsqueda.<br>Pídelo abajo y despacho te lo cotiza.</div>';
    return items.map(function (p) {
      var l = state.cart.filter(function (x) { return x.id === p.id; })[0];
      return '<div class="item"><div><div class="name">' + esc(p.nombre) + '</div><div class="meta">' + esc(p.compat) + '</div><div class="price">' + usd(p.precio) + ' <span class="meta">+ IVA</span></div></div>' +
        (l ? stepper(p.id, l.qty) : '<button class="btn sm primary" data-inc="' + esc(p.id) + '">Agregar</button>') + "</div>";
    }).join("");
  }
  function cartbarHtml() { var n = cartCount(); return n ? '<button class="btn primary block" data-go="carrito">Ver carrito · ' + n + (n === 1 ? " artículo" : " artículos") + "</button>" : ""; }
  function viewCatalogo() {
    var cats = ["Todas"].concat(state.productos.map(function (p) { return p.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }));
    var g = state.sug, veh = g ? g.vehiculo.split(" ") : [];
    return "<h1>Pedir repuestos</h1><p class='muted small'>Entrega en el taller. Precios de ejemplo mientras se carga la lista real.</p>" +
      (g ? '<div class="notice"><b>' + esc(g.num) + " · " + esc(g.vehiculo) + '</b><br>Repuestos probables:<div class="chips" style="padding:8px 0 0">' + g.repuestos.map(function (r) { return '<button data-q="' + esc(r.replace(/\s*\(.*\)/, "")) + '">' + esc(r) + "</button>"; }).join("") + '<button data-nosug="1">Quitar</button></div></div>' : "") +
      '<input type="search" id="q" placeholder="Buscar: pastillas Aveo, filtro Sail…" value="' + esc(state.q) + '" aria-label="Buscar repuesto" style="margin-top:8px">' +
      '<div class="chips">' + cats.map(function (c) { return '<button data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
      '<div class="list" id="lista">' + listHtml() + "</div>" +
      '<form class="card" data-form="otro" style="margin-top:18px"><h2>¿No está en la lista?</h2><p class="muted small">Descríbelo y despacho te envía precio y disponibilidad.</p>' +
      field("o-desc", "Repuesto", 'required placeholder="Ej.: bomba de agua"', "") +
      '<div class="row3">' + field("o-marca", "Marca", 'required placeholder="Chevrolet"', veh[0]) + field("o-modelo", "Modelo", 'required placeholder="Aveo"', veh.slice(1, -1).join(" ")) + field("o-anio", "Año", ANIO + ' required placeholder="2014"', veh.length > 2 ? veh[veh.length - 1] : "") + "</div>" +
      '<button class="btn block">Agregar al pedido para cotizar</button></form>' +
      '<div class="cartbar" id="cartbar">' + cartbarHtml() + "</div>";
  }
  function viewCarrito() {
    var lines = cartLines();
    if (!lines.length) return "<h1>Carrito</h1><div class='empty'>Todavía no has agregado repuestos.<br><br><button class='btn primary' data-go='catalogo'>Ver repuestos</button></div>";
    var t = totals(lines), tl = state.miTaller;
    return '<button class="back" data-go="catalogo">← Seguir agregando</button><h1>Carrito</h1><div class="list" style="margin-top:12px">' + lines.map(function (l) {
      return '<div class="item"><div><div class="name">' + esc(l.nombre) + '</div><div class="meta">' + esc(l.detalle) + '</div><div class="price">' + (l.precio == null ? '<span class="meta">Por cotizar</span>' : usd(l.precio * l.qty)) + "</div></div>" + stepper(l.custom ? l.key : l.id, l.qty) + "</div>";
    }).join("") + "</div>" +
      '<div class="card" style="margin-top:12px"><div class="totals"><div><span>Subtotal</span><span>' + usd(t.sub) + "</span></div><div><span>IVA " + Math.round(CFG.iva * 100) + " %</span><span>" + usd(t.iva) + '</span></div><div class="total"><span>Total</span><span>' + usd(t.total) + "</span></div></div>" +
      (t.porCotizar ? '<p class="muted small" style="margin:8px 0 0">Incluye ' + t.porCotizar + (t.porCotizar === 1 ? " repuesto" : " repuestos") + " por cotizar; despacho confirma el precio antes de enviar.</p>" : "") + "</div>" +
      '<form class="card" data-form="pedido"><h2>Entrega</h2>' + field("p-dir", "Dirección de entrega", 'required placeholder="Calle, número y referencia"', tl.direccion) +
      '<div class="row"><div class="field"><label for="p-zona">Zona</label><select id="p-zona">' + opts(CFG.zonas, tl.zona) + "</select></div>" +
      '<div class="field"><label for="p-pago">Forma de pago</label><select id="p-pago">' + opts(CFG.pagos) + "</select></div></div>" +
      '<div class="field"><label for="p-nota">Nota para el despacho (opcional)</label><textarea id="p-nota" rows="2" placeholder="Ej.: urgente, el auto está en el elevador"></textarea></div>' +
      '<button class="btn primary block">Confirmar pedido</button></form>';
  }
  function track(o) {
    var i = ESTADOS.indexOf(o.estado);
    return '<div class="track">' + ESTADOS.map(function (e, k) { return "<div" + (k <= i ? ' class="on"' : "") + "><i></i>" + e + "</div>"; }).join("") + "</div>";
  }
  var itemPrice = function (l) { return l.precio_unit == null ? "Por cotizar" : usd(l.precio_unit * l.cantidad); };
  var pendientes = function (o) { return count(o.items || [], function (l) { return l.precio_unit == null; }); };
  function orderLines(o) {
    return '<ul class="lines">' + (o.items || []).map(function (l) { return "<li><span>" + l.cantidad + " × " + esc(l.nombre) + ' <span class="muted">· ' + esc(l.detalle) + "</span></span><span>" + itemPrice(l) + "</span></li>"; }).join("") + "</ul>";
  }
  var orderTotal = function (o) { return "<div class='totals' style='margin-bottom:12px'><div class='total' style='border:0;padding:0;font-size:1.05rem'><span>Total con IVA" + (pendientes(o) ? " (parcial)" : "") + "</span><span>" + usd(o.total) + "</span></div></div>"; };
  function viewPedidos() {
    if (!state.pedidos.length) return "<h1>Pedidos</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Aquí aparecerán tus pedidos.<br><br><button class='btn primary' data-go='catalogo'>Pedir repuestos</button>") + "</div>";
    return "<h1>Pedidos</h1>" + state.pedidos.map(function (o) {
      return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + '</h2><div class="muted small">' + fecha(o.created_at) + " · " + esc(o.pago) + "</div></div>" + chip(o.estado) + "</div>" +
        track(o) + orderLines(o) + orderTotal(o) + '<div class="actions"><button class="btn sm" data-repeat="' + o.id + '">Repetir pedido</button></div></div>';
    }).join("");
  }
  function viewPerfil() {
    var t = state.miTaller || {}, p = state.perfil || {};
    return "<h1>Mi taller</h1><p class='muted small'>Así te ven los conductores en el mapa.</p><form class='card' data-form='perfil'>" +
      field("t-nombre", "Nombre del taller", "required", t.nombre) +
      '<div class="row">' + field("t-contacto", "Persona de contacto", "", t.contacto || p.nombre) + field("t-tel", "Teléfono", TEL, t.telefono || p.telefono) + "</div>" +
      '<div class="row">' + field("t-wa", "WhatsApp para clientes", TEL, t.whatsapp) + field("t-horario", "Horario", 'placeholder="Lun a sáb, 8:00 a 18:00"', t.horario) + "</div>" +
      field("t-dir", "Dirección", 'required placeholder="Calle, número y referencia"', t.direccion) +
      '<div class="row">' + field("t-sector", "Sector o barrio", "required", t.sector) + '<div class="field"><label for="t-zona">Zona de Quito</label><select id="t-zona">' + opts(CFG.zonas, t.zona) + "</select></div></div>" +
      '<div class="field"><label>Especialidades</label><div class="checks">' + ESP.map(function (e) { return '<label><input type="checkbox" name="esp" value="' + esc(e) + '"' + ((t.especialidades || []).indexOf(e) >= 0 ? " checked" : "") + "> " + esc(e) + "</label>"; }).join("") + "</div></div>" +
      '<div class="field"><label>Ubicación en el mapa</label><div class="actions"><button type="button" class="btn sm" data-geo="1">Usar mi ubicación actual</button><span class="muted small" id="geo-txt">' + (t.lat != null ? "Guardada (" + (+t.lat).toFixed(4) + ", " + (+t.lng).toFixed(4) + ")" : "Sin ubicación") + '</span></div><input type="hidden" id="t-lat" value="' + esc(t.lat) + '"><input type="hidden" id="t-lng" value="' + esc(t.lng) + '"></div>' +
      '<button class="btn primary block">Guardar</button></form>';
  }

  // =====================================================================
  // DESPACHO
  // =====================================================================
  function viewDResumen() {
    var o = state.dPedidos, s = state.dSolicitudes;
    var ventas = o.reduce(function (n, x) { return n + +x.total; }, 0);
    var servicios = s.filter(function (x) { return x.estado === "Terminada"; }).reduce(function (n, x) { return n + +(x.precio_final || 0); }, 0);
    var k = function (v, l) { return '<div class="kpi"><b>' + v + "</b><span>" + l + "</span></div>"; };
    return "<h1>Despacho Mekachi</h1><p class='muted small'>Lo que entra por la app, visto desde la operación.</p>" +
      '<div class="section-title">Repuestos</div><div class="kpis">' + k(count(o, function (x) { return x.estado === "Registrado"; }), "Pedidos por atender") +
      k(count(o, function (x) { return pendientes(x) > 0; }), "Con piezas por cotizar") + k(count(o, function (x) { return x.estado === "En camino"; }), "En camino") + k(usd(ventas), "Venta de repuestos") + "</div>" +
      '<div class="section-title">Servicios</div><div class="kpis">' + k(s.length, "Solicitudes") + k(count(s, function (x) { return x.estado === "Aceptada"; }), "En curso") +
      k(count(s, function (x) { return x.estado === "Terminada"; }), "Terminados") + k(usd(servicios), "Cobrado por talleres") + "</div>" +
      '<div class="section-title">Red</div><div class="kpis">' + k(count(state.dTalleres, function (t) { return t.verificado; }), "Talleres verificados") + k(count(state.dTalleres, function (t) { return !t.verificado && !t.es_demo; }), "Por verificar") + "</div>" +
      '<div class="actions"><button class="btn primary" data-go="d-pedidos">Atender pedidos</button><button class="btn" data-go="d-talleres">Verificar talleres</button></div>';
  }
  function viewDPedidos() {
    if (!state.dPedidos.length) return "<h1>Pedidos de talleres</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Todavía no hay pedidos.") + "</div>";
    return "<h1>Pedidos de talleres</h1><p class='muted small'>Cotiza las piezas fuera de lista y avanza el estado de cada pedido.</p>" +
      state.dPedidos.map(function (o) {
        var i = ESTADOS.indexOf(o.estado), sig = ESTADOS[i + 1], t = o.taller || {}, bloq = pendientes(o) > 0 && i === 0;
        var cot = (o.items || []).filter(function (l) { return l.precio_unit == null; }).map(function (l) {
          return '<form class="inline" data-form="cotizar-linea" data-id="' + l.id + '" style="margin-bottom:8px"><span class="small" style="flex:1">' + esc(l.nombre) + " · " + esc(l.detalle) +
            '</span><input name="precio" type="number" min="0.01" step="0.01" required placeholder="Precio $" aria-label="Precio unitario"><button class="btn sm">Cotizar</button></form>';
        }).join("");
        return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + " · " + esc(t.nombre) + '</h2><div class="muted small">' + fecha(o.created_at) + " · " + esc(o.direccion) + " (" + esc(o.zona) + ") · " + esc(o.pago) + (t.telefono ? " · " + esc(t.telefono) : "") + "</div></div>" + chip(o.estado) + "</div>" +
          track(o) + orderLines(o) + cot + orderTotal(o) + (o.nota ? '<p class="muted small">Nota: ' + esc(o.nota) + "</p>" : "") +
          (sig ? '<div class="actions"><button class="btn sm primary" data-avanzar="' + o.id + '"' + (bloq ? " disabled" : "") + ">Marcar como " + sig.toLowerCase() + "</button>" + (bloq ? '<span class="muted small">Cotiza primero las piezas pendientes.</span>' : "") + "</div>" : "") + "</div>";
      }).join("");
  }
  function viewDServicios() {
    if (!state.dSolicitudes.length) return "<h1>Servicios</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Todavía no hay solicitudes de conductores.") + "</div>";
    return "<h1>Servicios</h1><p class='muted small'>Solicitudes entre conductores y talleres.</p>" + state.dSolicitudes.map(function (o) {
      return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + " · " + esc(o.vehiculo_texto) + '</h2><div class="muted small">' + esc(o.cliente_nombre) + " · " + esc(o.dia || "") + (o.taller ? " · " + esc(o.taller.nombre) : "") + "</div></div>" + chip(o.estado) + "</div>" +
        "<p>" + esc(o.problema) + "</p>" + (o.precio_final ? '<p class="small"><b>' + usd(o.precio_final) + "</b>" + (o.rating ? " · " + estrellas(o.rating) : "") + "</p>" : "") + "</div>";
    }).join("");
  }
  function viewDTalleres() {
    var reales = state.dTalleres.filter(function (t) { return !t.es_demo; });
    return "<h1>Talleres</h1><p class='muted small'>Los talleres verificados aparecen en el mapa de los conductores.</p>" +
      (reales.length ? reales.map(function (t) {
        return '<div class="card"><div class="head"><div><h2>' + esc(t.nombre) + '</h2><div class="muted small">' + esc(t.sector) + " · " + esc(t.zona) + " · " + esc(t.direccion) + "<br>" + esc(t.contacto) + " · " + esc(t.telefono || t.whatsapp) + (t.lat == null ? " · sin ubicación" : "") + "</div></div>" + chip(t.verificado ? "Verificado" : "Por verificar") + "</div>" +
          '<div class="tags" style="margin-bottom:10px">' + (t.especialidades || []).map(function (e) { return "<span>" + esc(e) + "</span>"; }).join("") + "</div>" +
          '<div class="actions"><button class="btn sm ' + (t.verificado ? "" : "primary") + '" data-verif="' + t.id + '" data-v="' + (t.verificado ? "0" : "1") + '">' + (t.verificado ? "Quitar verificación" : "Verificar taller") + "</button></div></div>";
      }).join("") : "<div class='empty'>Todavía no se ha registrado ningún taller real.</div>") +
      '<p class="muted small">Además hay ' + count(state.dTalleres, function (t) { return t.es_demo; }) + " talleres de ejemplo visibles en el mapa.</p>";
  }

  // =====================================================================
  var VIEW = { "c-inicio": viewCInicio, diag: viewDiag, talleres: viewTalleres, solicitar: viewSolicitar, solicitudes: viewSolicitudes, garaje: viewGaraje,
    "t-inicio": viewTInicio, trabajos: viewTrabajos, catalogo: viewCatalogo, carrito: viewCarrito, pedidos: viewPedidos, perfil: viewPerfil,
    "d-resumen": viewDResumen, "d-pedidos": viewDPedidos, "d-servicios": viewDServicios, "d-talleres": viewDTalleres, acceso: viewAcceso, cuenta: viewCuenta };
  function render() {
    nav();
    if (map) { map.remove(); map = null; }
    var app = $("#app");
    app.classList.toggle("wide", state.view === "talleres");
    app.innerHTML = !state.mode ? viewBienvenida() : state.ready ? VIEW[state.view]() : '<div class="empty">Cargando…</div>';
    if (state.view === "talleres" && state.mode && state.ready) initMap();
  }
  function refreshList() {
    nav();
    if (state.view !== "catalogo") return render();
    $("#lista").innerHTML = listHtml(); $("#cartbar").innerHTML = cartbarHtml();
  }
  function change(key, d) {
    var l = state.cart.filter(function (x) { return (x.custom ? x.key : x.id) === key; })[0];
    if (!l) { if (d > 0 && byId(state.productos, key)) state.cart.push({ id: key, qty: 1 }); }
    else { l.qty += d; if (l.qty <= 0) state.cart.splice(state.cart.indexOf(l), 1); }
    saveCart(); refreshList();
  }
  async function afterAuth() {
    state.loading = true;
    await loadAuth(); await loadPublic(); await loadMode();
    var a = state.acc, dest = a.after || MODES[state.mode].tabs[0][0];
    if (a.rol === "taller" && state.user && !state.miTaller) dest = "perfil";
    state.loading = false;
    go(dest, true);
  }

  // ---------- Eventos
  document.addEventListener("click", async function (e) {
    var home = e.target.closest("a[data-home]");
    if (home) { e.preventDefault(); if (state.mode) go(MODES[state.mode].tabs[0][0]); return; }
    var b = e.target.closest("button"); if (!b || b.disabled) return;
    var d = b.dataset, o;
    if (d.mode) setMode(d.mode);
    else if (d.go) go(d.go);
    else if (d.acctab) { state.acc.tab = d.acctab; render(); }
    else if (d.logout) { await sb.auth.signOut(); state.solicitudes = []; state.trabajos = []; state.pedidos = []; state.historial = []; await loadAuth(); state.garaje = store.get("garaje", []); toast("Sesión cerrada"); go(MODES[state.mode].tabs[0][0], true); }
    else if (d.inc) change(d.inc, 1);
    else if (d.dec) change(d.dec, -1);
    else if (d.cat) { state.cat = d.cat; render(); }
    else if ("q" in d) { state.q = d.q.split(" ").filter(function (w) { return w.length > 2; }).slice(0, 2).join(" "); state.cat = "Todas"; render(); }
    else if (d.nosug) { state.sug = null; state.q = ""; render(); }
    else if (d.dcat) { state.dcat = d.dcat; render(); }
    else if (d.sint) { state.dsel = d.sint; render(); window.scrollTo(0, 0); }
    else if (d.volver) { state.dsel = null; render(); }
    else if (d.buscartaller) { state.fesp = d.buscartaller; state.tipo = d.tipo || "taller"; go("talleres"); }
    else if (d.sel) toggleSel(d.sel);
    else if (d.diagveh) { state.vsel = d.diagveh; state.dsel = null; go("diag"); }
    else if (d.sug) {
      var c = byId(state.trabajos, d.sug), s = c.solicitud.sintoma_id ? sintById[c.solicitud.sintoma_id] : null;
      state.sug = { id: c.solicitud.id, num: c.solicitud.num, vehiculo: c.solicitud.vehiculo_texto, repuestos: s ? s.repuestos : [] };
      state.q = ""; state.cat = "Todas"; go("catalogo");
    }
    else if (d.cot) await done(await call(sb.rpc("mekachi_responder_cotizacion", { p_cotizacion: d.cot, p_accion: d.acc })), d.acc === "aceptar" ? "Precio aceptado. El taller te espera." : d.acc === "ajuste" ? "Pediste un ajuste al taller." : "Cotización rechazada.");
    else if (d.terminar) await done(await call(sb.rpc("mekachi_terminar_solicitud", { p_solicitud: d.terminar })), "Trabajo terminado y registrado.");
    else if (d.rate) await done(await call(sb.rpc("mekachi_calificar", { p_solicitud: d.rate, p_rating: +d.n })), "Gracias por calificar.");
    else if (d.avanzar) await done(await call(sb.rpc("mekachi_despacho_avanzar", { p_pedido: d.avanzar })), "Pedido actualizado.");
    else if (d.verif) await done(await call(sb.from("mekachi_talleres").update({ verificado: d.v === "1" }).eq("id", d.verif)), d.v === "1" ? "Taller verificado." : "Verificación retirada.");
    else if (d.delveh) {
      if (!window.confirm("¿Quitar este vehículo del garaje?" + (state.user ? " También se borra su historial." : ""))) return;
      if (state.user) await done(await call(sb.from("mekachi_vehiculos").delete().eq("id", d.delveh)), "Vehículo quitado.");
      else { state.garaje = state.garaje.filter(function (v) { return v.id !== d.delveh; }); store.set("garaje", state.garaje); render(); }
    }
    else if (d.geo) {
      if (!navigator.geolocation) return toast("Este navegador no permite obtener la ubicación.");
      navigator.geolocation.getCurrentPosition(function (p) {
        $("#t-lat").value = p.coords.latitude; $("#t-lng").value = p.coords.longitude;
        $("#geo-txt").textContent = "Lista para guardar (" + p.coords.latitude.toFixed(4) + ", " + p.coords.longitude.toFixed(4) + ")";
      }, function () { toast("No pudimos obtener tu ubicación. Revisa los permisos."); }, { timeout: 10000 });
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
      o = byId(state.pedidos, d.repeat);
      state.cart = o.items.map(function (l) {
        return l.producto_id ? { id: l.producto_id, qty: l.cantidad } : { custom: true, key: "x" + Date.now() + Math.random(), nombre: l.nombre, detalle: l.detalle, qty: l.cantidad };
      }).filter(function (l) { return l.custom || byId(state.productos, l.id); });
      saveCart(); go("carrito");
    }
  });
  document.addEventListener("input", function (e) {
    if (e.target.setCustomValidity) e.target.setCustomValidity("");
    if (e.target.id === "q") { state.q = e.target.value; refreshList(); }
    else if (e.target.id === "dq") { state.dq = e.target.value; $("#sintomas").innerHTML = sintListHtml(); }
  });
  // Mensajes de validación en español en lugar de los genéricos del navegador.
  document.addEventListener("invalid", function (e) {
    var el = e.target; el.setCustomValidity("");
    if (!el.validity.valid) el.setCustomValidity(el.validity.valueMissing ? "Completa este campo." : (el.dataset.msg || "Revisa este dato."));
  }, true);
  document.addEventListener("change", function (e) {
    if (e.target.id === "f-esp") { state.fesp = e.target.value; render(); }
    else if (e.target.id === "f-zona") { state.fzona = e.target.value; render(); }
    else if (e.target.id === "vsel") { state.vsel = e.target.value; state.draft = null; render(); }
  });
  document.addEventListener("submit", async function (e) {
    e.preventDefault();
    var f = e.target, kind = f.dataset.form, btn = f.querySelector("button:not([type=button])");
    var v = function (id) { var el = $("#" + id); return el ? el.value.trim() : ""; };
    var checks = function () { return [].slice.call(f.querySelectorAll("input[name=esp]:checked")).map(function (c) { return c.value; }); };
    if (btn) btn.disabled = true;
    try {
      if (kind === "otro") {
        state.cart.push({ custom: true, key: "x" + Date.now(), nombre: v("o-desc"), detalle: v("o-marca") + " " + v("o-modelo") + " " + v("o-anio"), qty: 1 });
        saveCart(); render(); toast("Agregado al pedido para cotizar");
      } else if (kind === "login") {
        if (await call(sb.auth.signInWithPassword({ email: v("a-email"), password: v("a-pass") }))) await afterAuth();
      } else if (kind === "registro") {
        var a = state.acc, pend = { rol: a.rol, nombre: v("r-nombre"), telefono: v("r-tel") };
        if (a.rol === "taller") {
          if (!checks().length) return toast("Elige al menos una especialidad.");
          pend.taller = { nombre: v("r-taller"), contacto: v("r-nombre"), telefono: v("r-tel"), whatsapp: v("r-tel"), direccion: v("r-dir"), sector: v("r-sector"), zona: v("r-zona"), especialidades: checks() };
        }
        store.set("pending", pend);
        var r = await call(sb.auth.signUp({ email: v("a-email"), password: v("a-pass") }));
        if (!r) return;
        if (r.session) await afterAuth();
        else { state.acc.tab = "login"; state.acc.msg = "Te enviamos un correo para confirmar tu cuenta. Ábrelo, confirma y luego inicia sesión aquí."; render(); }
      } else if (kind === "micuenta") {
        var p = await call(sb.rpc("mekachi_registrar", { p_rol: state.perfil && state.perfil.rol === "taller" ? "taller" : "conductor", p_nombre: v("c-nombre"), p_telefono: v("c-tel") }));
        if (p) { state.perfil = p; render(); toast("Datos guardados"); }
      } else if (kind === "perfil") {
        var row = { nombre: v("t-nombre"), contacto: v("t-contacto"), telefono: v("t-tel"), whatsapp: v("t-wa"), horario: v("t-horario"), direccion: v("t-dir"), sector: v("t-sector"), zona: v("t-zona"), especialidades: checks(), lat: v("t-lat") ? +v("t-lat") : null, lng: v("t-lng") ? +v("t-lng") : null };
        var t = state.miTaller
          ? await call(sb.from("mekachi_talleres").update(row).eq("id", state.miTaller.id).select().single())
          : await call(sb.from("mekachi_talleres").insert(Object.assign({ owner_id: state.user.id }, row)).select().single());
        if (t && t.id) { state.miTaller = t; await loadPublic(); render(); toast("Datos del taller guardados"); }
      } else if (kind === "vehiculo") {
        var veh = { marca: v("g-marca"), modelo: v("g-modelo"), anio: +v("g-anio") || null, placa: v("g-placa").toUpperCase(), km: +v("g-km") || 0, km_aceite: +v("g-kma") || 0, soat_vence: v("g-soat") || null, matricula_vence: v("g-mat") || null };
        if (state.user) await done(await call(sb.from("mekachi_vehiculos").insert(veh)), "Vehículo guardado");
        else { veh.id = "v" + Date.now(); state.garaje.push(veh); store.set("garaje", state.garaje); render(); toast("Vehículo guardado"); }
      } else if (kind === "solicitud") {
        var dr = { problema: v("s-prob"), tipo: v("s-tipo"), marca: v("s-marca"), modelo: v("s-modelo"), anio: v("s-anio"), nombre: v("s-nombre"), tel: v("s-tel"), dia: v("s-dia") };
        if (!state.user) { state.draft = dr; state.acc = { rol: "conductor", tab: "registro", after: "solicitar", msg: "Crea tu cuenta para enviar la solicitud y recibir los precios." }; state.view = "acceso"; render(); window.scrollTo(0, 0); return; }
        var g = vehSel(), mismo = g && g.marca === dr.marca && g.modelo === dr.modelo && /^[0-9a-f-]{36}$/.test(g.id);
        var sol = await call(sb.from("mekachi_solicitudes").insert({ vehiculo_id: mismo ? g.id : null, vehiculo_texto: dr.marca + " " + dr.modelo + " " + dr.anio, problema: dr.problema, sintoma_id: state.dsel, tipo: dr.tipo, dia: dr.dia, cliente_nombre: dr.nombre, cliente_tel: dr.tel }).select().single());
        if (!sol) return;
        if (!await call(sb.from("mekachi_cotizaciones").insert(state.tsel.map(function (id) { return { solicitud_id: sol.id, taller_id: id }; })))) return;
        if (state.perfil && !state.perfil.nombre) sb.rpc("mekachi_registrar", { p_rol: "conductor", p_nombre: dr.nombre, p_telefono: dr.tel }).then(function (x) { if (x.data) state.perfil = x.data; });
        state.dsel = null; state.tsel = []; state.draft = null; state.tipo = null;
        go("solicitudes", true); toast("Solicitud enviada");
      } else if (kind === "cotizar") {
        await done(await call(sb.rpc("mekachi_cotizar", { p_cotizacion: f.dataset.id, p_mano_obra: +f.elements.mano.value, p_repuestos: +f.elements.rep.value, p_nota: f.elements.nota.value.trim() })), "Precio enviado al cliente");
      } else if (kind === "cotizar-linea") {
        await done(await call(sb.rpc("mekachi_despacho_cotizar_item", { p_item: f.dataset.id, p_precio: +f.elements.precio.value })), "Pieza cotizada");
      } else if (kind === "pedido") {
        var items = state.cart.map(function (l) { return l.custom ? { nombre: l.nombre, detalle: l.detalle, cantidad: l.qty } : { producto_id: l.id, cantidad: l.qty }; });
        var ok = await call(sb.rpc("mekachi_crear_pedido", { p_items: items, p_pago: v("p-pago"), p_nota: v("p-nota"), p_direccion: v("p-dir"), p_zona: v("p-zona"), p_solicitud: state.sug ? state.sug.id : null }));
        if (!ok) return;
        state.cart = []; saveCart(); state.sug = null; state.q = "";
        go("pedidos", true); toast("Pedido enviado a despacho");
      }
    } finally { if (btn && btn.isConnected) btn.disabled = false; }
  });
  window.addEventListener("popstate", fromHash);

  // Refresco periódico de las pantallas con datos vivos, sin interrumpir a quien escribe.
  setInterval(async function () {
    if (document.hidden || !state.user || !LIVE[state.view]) return;
    var a = document.activeElement;
    if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return;
    var antes = JSON.stringify([state.solicitudes, state.trabajos, state.pedidos, state.dPedidos, state.dSolicitudes]);
    await loadMode();
    if (antes !== JSON.stringify([state.solicitudes, state.trabajos, state.pedidos, state.dPedidos, state.dSolicitudes])) render();
  }, 20000);

  (async function init() {
    state.loading = true;
    if (state.mode) { state.view = MODES[state.mode].tabs[0][0]; }
    render();
    await Promise.all([loadPublic(), loadAuth().catch(function () {})]);
    state.loading = false; state.ready = true;
    fromHash();
  })();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
