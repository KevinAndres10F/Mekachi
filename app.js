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
    chat: "M4 5h16v11H10l-5 4v-4H4z",
    shop: "M4 10v10h16V10M2 10l2-6h16l2 6a3 3 0 0 1-5 1 3 3 0 0 1-5 0 3 3 0 0 1-5 0 3 3 0 0 1-5-1zM9 20v-6h6v6"
  };
  var ico = function (n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + ICONS[n] + '"/></svg>'; };

  var MODES = {
    conductor: { label: "Conductor", tabs: [["c-inicio", "Inicio", "home"], ["diag", "Diagnóstico", "pulse"], ["talleres", "Talleres", "pin"], ["solicitudes", "Solicitudes", "list"], ["garaje", "Garaje", "car"]] },
    taller: { label: "Taller", tabs: [["t-inicio", "Inicio", "home"], ["trabajos", "Trabajos", "wrench"], ["catalogo", "Repuestos", "box"], ["pedidos", "Pedidos", "truck"], ["perfil", "Mi taller", "shop"]] },
    repartidor: { label: "Reparto", tabs: [["r-entregas", "Entregas", "truck"], ["r-perfil", "Mi perfil", "user"]] },
    grua: { label: "Grúa", tabs: [["g-inicio", "Inicio", "home"], ["g-servicios", "Servicios", "truck"], ["g-perfil", "Mi grúa", "shop"]] },
    despacho: { label: "Despacho", tabs: [["d-resumen", "Resumen", "chart"], ["d-pedidos", "Pedidos", "truck"], ["d-inventario", "Inventario", "box"], ["d-atencion", "Atención", "chat"], ["d-clientes", "Clientes", "user"], ["d-red", "Red", "shop"]] }
  };
  var PARENT = { solicitar: "talleres", carrito: "catalogo", grua: "c-inicio" };
  var VIEWMODE = { solicitar: "conductor", carrito: "taller", grua: "conductor" };
  Object.keys(MODES).forEach(function (m) { MODES[m].tabs.forEach(function (t) { VIEWMODE[t[0]] = m; }); });
  var ESTADOS = ["Registrado", "Confirmado", "Listo", "En camino", "Entregado"];
  var LIVE = { solicitudes: 1, trabajos: 1, pedidos: 1, "t-inicio": 1, "c-inicio": 1, "d-resumen": 1, "d-pedidos": 1, "d-servicios": 1, "d-atencion": 1, "d-clientes": 1, "g-inicio": 1, "g-servicios": 1, "r-entregas": 1 };

  var state = {
    mode: store.get("rol", null), view: null, loading: false,
    user: null, perfil: null, miTaller: null, miGrua: null, gSol: [], dProv: [], miRep: null, rPed: [], dBod: [], dRep: [], ibod: "todas", cbod: null, acc: { rol: "conductor", tab: "login", after: null, msg: "" },
    talleres: [], productos: [],
    dq: "", dcat: "Todos", dsel: null, fesp: "Todas", fzona: "Todas", pos: null, tsel: [], vsel: null, draft: null,
    garaje: store.get("garaje", []), solicitudes: [], historial: [],
    q: "", cat: "Todas", sug: null, cart: store.get("cart", []), trabajos: [], pedidos: [],
    dPedidos: [], dSolicitudes: [], dTalleres: [], dConvs: [], dMsgs: [], dGruas: [], dCitas: [], dsub: "conv", dconv: null, tCitas: [], dClientes: [], dcli: null, dCliDet: null, cfil: "todos", cq: "", dInv: [], iprod: null, iMovs: [], ifil: "todos", iq: "", inuevo: false, rsub: "talleres", isub: "stock", dCompras: [], oc: null, ccat: null, misGruas: [], gruaOk: null
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
      state.productos = r[1].data.map(function (p) { return { id: p.id, cat: p.categoria, nombre: p.nombre, compat: p.compatibilidad, precio: +p.precio, disp: !!p.disponible }; });
    } catch (e) { local(); }
  }
  async function loadAuth() {
    state.user = null; state.perfil = null; state.miTaller = null; state.miGrua = null; state.miRep = null;
    if (!sb) return;
    var s = await sb.auth.getSession();
    state.user = s.data && s.data.session ? s.data.session.user : null;
    if (!state.user) return;
    var pend = store.get("pending", null);
    var p = (await sb.from("mekachi_perfiles").select("*").eq("id", state.user.id).maybeSingle()).data;
    if (!p || (pend && pend.rol !== "conductor" && p.rol === "conductor")) {
      var r = pend || { rol: "conductor", nombre: "", telefono: "" };
      p = await call(sb.rpc("mekachi_registrar", { p_rol: r.rol, p_nombre: r.nombre, p_telefono: r.telefono }));
    }
    state.perfil = p && p.id ? p : null;
    var t = (await sb.from("mekachi_talleres").select("*").eq("owner_id", state.user.id).maybeSingle()).data;
    if (!t && pend && pend.taller) t = await call(sb.from("mekachi_talleres").insert(Object.assign({ owner_id: state.user.id }, pend.taller)).select().single());
    state.miTaller = t && t.id ? t : null;
    var gr = (await sb.from("mekachi_gruas_proveedores").select("*").eq("owner_id", state.user.id).maybeSingle()).data;
    if (!gr && pend && pend.grua) gr = await call(sb.from("mekachi_gruas_proveedores").insert(Object.assign({ owner_id: state.user.id }, pend.grua)).select().single());
    state.miGrua = gr && gr.id ? gr : null;
    var rp = (await sb.from("mekachi_repartidores").select("*").eq("owner_id", state.user.id).maybeSingle()).data;
    if (!rp && pend && pend.repartidor) rp = await call(sb.from("mekachi_repartidores").insert(Object.assign({ owner_id: state.user.id }, pend.repartidor)).select().single());
    state.miRep = rp && rp.id ? rp : null;
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
      var mg = await sb.from("mekachi_gruas_solicitudes").select("*, proveedor:mekachi_gruas_proveedores(nombre)").eq("conductor_id", u.id).order("created_at", { ascending: false });
      if (!mg.error) state.misGruas = mg.data;
    } else if (state.mode === "taller" && state.miTaller) {
      r = await Promise.all([
        sb.from("mekachi_cotizaciones").select("*, solicitud:mekachi_solicitudes(*)").eq("taller_id", state.miTaller.id).order("created_at", { ascending: false }),
        sb.from("mekachi_pedidos").select("*, items:mekachi_pedido_items(*), cod:mekachi_pedido_codigos(codigo)").eq("taller_id", state.miTaller.id).order("created_at", { ascending: false })
      ]);
      if (!r[0].error) state.trabajos = r[0].data.filter(function (c) { return c.solicitud; });
      if (!r[1].error) state.pedidos = r[1].data;
      var ct = await sb.from("mekachi_citas").select("*").eq("taller_id", state.miTaller.id).order("created_at", { ascending: false });
      if (!ct.error) state.tCitas = ct.data;
    } else if (state.mode === "repartidor" && state.miRep) {
      var me2 = await sb.from("mekachi_repartidores").select("*, bodega:mekachi_bodegas(nombre,direccion)").eq("id", state.miRep.id).maybeSingle();
      if (me2.data) state.miRep = me2.data;
      var rq = await sb.from("mekachi_pedidos").select("*, items:mekachi_pedido_items(nombre,detalle,cantidad), taller:mekachi_talleres(nombre,direccion,sector,zona,telefono,whatsapp,lat,lng), bodega:mekachi_bodegas(nombre,direccion,lat,lng)").or("estado.in.(Listo,En camino),devolucion_estado.in.(Solicitada,Recogida),entregado_at.gte." + new Date(Date.now() - 864e5).toISOString()).order("created_at");
      // Despacho ve todo por su rol: aquí solo cuenta lo que le toca a este repartidor.
      if (!rq.error) state.rPed = rq.data.filter(function (o) { var mb = state.miRep.bodega_id, aqui = !mb || !o.bodega_id || o.bodega_id === mb; return o.repartidor_id === state.miRep.id || (aqui && ((o.estado === "Listo" && !o.repartidor_id) || o.devolucion_estado === "Solicitada")); });
    } else if (state.mode === "grua" && state.miGrua) {
      var gs = await sb.from("mekachi_gruas_solicitudes").select("*").eq("proveedor_id", state.miGrua.id).order("created_at", { ascending: false }).limit(60);
      if (!gs.error) state.gSol = gs.data;
      var me = await sb.from("mekachi_gruas_proveedores").select("*").eq("id", state.miGrua.id).maybeSingle();
      if (me.data) state.miGrua = me.data;
    } else if (state.mode === "despacho" && esDespacho()) {
      r = await Promise.all([
        sb.from("mekachi_pedidos").select("*, items:mekachi_pedido_items(*), taller:mekachi_talleres(nombre,direccion,zona,telefono), cod:mekachi_pedido_codigos(codigo)").order("created_at", { ascending: false }),
        sb.from("mekachi_solicitudes").select("*, taller:mekachi_talleres(nombre)").order("created_at", { ascending: false }),
        sb.from("mekachi_talleres").select("*").order("created_at", { ascending: false })
      ]);
      if (!r[0].error) state.dPedidos = r[0].data;
      if (!r[1].error) state.dSolicitudes = r[1].data;
      if (!r[2].error) state.dTalleres = r[2].data;
      var a = await Promise.all([
        sb.from("mekachi_wa_conversaciones").select("*").order("updated_at", { ascending: false }).limit(60),
        sb.from("mekachi_gruas_solicitudes").select("*, proveedor:mekachi_gruas_proveedores(nombre)").order("created_at", { ascending: false }).limit(60),
        sb.from("mekachi_citas").select("*, taller:mekachi_talleres(nombre)").order("created_at", { ascending: false }).limit(60)
      ]);
      if (!a[0].error) state.dConvs = a[0].data;
      if (!a[1].error) state.dGruas = a[1].data;
      if (!a[2].error) state.dCitas = a[2].data;
      if (state.dconv) await loadMsgs();
      var iv = await sb.from("mekachi_productos").select("*, inv:mekachi_inventario(*)").order("categoria").order("nombre");
      var bq = await Promise.all([sb.from("mekachi_bodegas").select("*").order("created_at"), sb.from("mekachi_repartidores").select("*").order("created_at"), sb.from("mekachi_stock_bodega").select("*")]);
      if (!bq[0].error) state.dBod = bq[0].data;
      if (!bq[1].error) state.dRep = bq[1].data;
      var porBod = {}; (bq[2].data || []).forEach(function (r) { (porBod[r.producto_id] = porBod[r.producto_id] || {})[r.bodega_id] = r.stock; });
      if (!iv.error) state.dInv = iv.data.map(function (x) { var i = x.inv || {}; return { sb: porBod[x.id] || {}, total: i.stock || 0, id: x.id, codigo: x.codigo, cat: x.categoria, nombre: x.nombre, compat: x.compatibilidad, precio: +x.precio, activo: x.activo, demo: x.es_demo, stock: i.stock || 0, minimo: i.stock_minimo || 0, costo: +(i.costo || 0), proveedor: i.proveedor || "", ubicacion: i.ubicacion || "" }; });
      aplicarBodega();
      var pv = await sb.from("mekachi_gruas_proveedores").select("*").order("es_demo").order("nombre");
      if (!pv.error) state.dProv = pv.data;
      var oc = await sb.from("mekachi_compras").select("*, items:mekachi_compra_items(cantidad,costo_unit,producto:mekachi_productos(nombre,compatibilidad))").order("created_at", { ascending: false }).limit(40);
      if (!oc.error) state.dCompras = oc.data;
      var cl = await sb.rpc("mekachi_clientes");
      if (!cl.error) state.dClientes = cl.data || [];
    }
  }
  // Las existencias que se muestran dependen de la bodega elegida en Inventario.
  function aplicarBodega() {
    if (state.ibod !== "todas" && !byId(state.dBod, state.ibod)) state.ibod = "todas";
    state.dInv.forEach(function (x) { x.stock = state.ibod === "todas" ? x.total : (x.sb[state.ibod] || 0); });
  }
  var bodNombre = function (id) { var b = byId(state.dBod, id); return b ? b.nombre : "Sin bodega"; };
  var bodSelect = function (id, sel) { return '<select id="' + id + '" name="bodega" aria-label="Bodega">' + state.dBod.filter(function (b) { return b.activa; }).map(function (b) { return '<option value="' + b.id + '"' + (b.id === sel ? " selected" : "") + ">" + esc(b.nombre) + "</option>"; }).join("") + "</select>"; };
  var bodActual = function () { return state.ibod !== "todas" ? state.ibod : (state.dBod[0] || {}).id; };
  var bodForm = function (f) { var el = f.querySelector("[name=bodega]"); return el ? el.value : bodActual(); };
  function proximaRuta() {
    var ahora = new Date(), hm = ("0" + ahora.getHours()).slice(-2) + ":" + ("0" + ahora.getMinutes()).slice(-2), c = (CFG.cortes || []).filter(function (h) { return h > hm; })[0];
    return c ? "hoy a las " + c : "mañana a las " + (CFG.cortes || ["09:00"])[0];
  }
  async function loadMsgs() {
    var m = await sb.from("mekachi_wa_mensajes").select("id,rol,autor,texto,created_at").eq("conversacion_id", state.dconv).order("id", { ascending: false }).limit(80);
    if (!m.error) state.dMsgs = m.data.reverse();
  }
  var gruaActiva = function (g) { return g.estado !== "Completada" && g.estado !== "Cancelada"; };
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
    if (v === "d-atencion") return count(state.dConvs, function (c) { return c.requiere_humano; }) + count(state.dGruas, gruaActiva) + count(state.dCitas, function (c) { return c.estado === "Pendiente"; });
    if (v === "d-clientes") return count(state.dClientes, porSeguir);
    if (v === "r-entregas") return count(state.rPed, function (o) { return o.estado === "Listo" || o.estado === "En camino" || o.devolucion_estado === "Solicitada"; });
    if (v === "g-servicios") return count(state.gSol, function (g) { return g.estado === "Asignada"; });
    if (v === "d-inventario") return count(state.dInv, bajoMinimo);
    if (v === "d-red") return count(state.dTalleres, function (t) { return !t.verificado && !t.es_demo; });
    return 0;
  }
  function nav() {
    document.body.classList.toggle("welcome", !state.mode);
    if (!state.mode) return;
    var modes = Object.keys(MODES).map(function (m) { return '<button data-mode="' + m + '" aria-pressed="' + (state.mode === m) + '">' + MODES[m].label + "</button>"; }).join("");
    $$(".modes").forEach(function (el) { el.innerHTML = modes; });
    $("#modesel").innerHTML = Object.keys(MODES).map(function (m) { return '<option value="' + m + '"' + (state.mode === m ? " selected" : "") + ">" + MODES[m].label + "</option>"; }).join("");
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
    if (m === "repartidor" && !(state.user && (state.miRep || v === "r-perfil"))) return "repartidor";
    if (m === "grua" && !(state.user && (state.miGrua || v === "g-perfil"))) return "grua";
    if (m === "despacho" && !esDespacho()) return "despacho";
    return null;
  }
  function go(v, replace) {
    if (VIEWMODE[v]) state.mode = VIEWMODE[v];
    var need = guard(v);
    if (need === "taller" && state.user) { v = "perfil"; need = null; toast("Completa los datos de tu taller para continuar."); }
    if (need === "repartidor" && state.user) { v = "r-perfil"; need = null; toast("Completa tus datos de repartidor para continuar."); }
    if (need === "grua" && state.user) { v = "g-perfil"; need = null; toast("Completa los datos de tu servicio de grúa para continuar."); }
    if (need) { state.acc = { rol: need, tab: state.user ? "login" : (need === "despacho" ? "login" : "registro"), after: v, msg: "" }; v = "acceso"; }
    if (v === "cuenta" && !state.user && state.view !== "cuenta") state.acc = { rol: "conductor", tab: "registro", after: MODES[state.mode].tabs[0][0], msg: "" };
    state.view = v; render(); window.scrollTo(0, 0);
    var h = "#/" + v;
    if (location.hash !== h) { if (replace) history.replaceState(null, "", h); else history.pushState(null, "", h); }
    if (LIVE[v] || v === "garaje" || v === "d-red" || v === "d-inventario") reload();
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
      role("repartidor", "box", "Soy repartidor", "Entrega repuestos de Mekachi a los talleres") +
      role("grua", "truck", "Tengo una grúa", "Recibe solicitudes de auxilio en tu zona") +
      role("despacho", "chart", "Soy Mekachi", "Despacho: pedidos, inventario, atención y clientes") +
      '</div><p class="foot">Puedes cambiar de perfil en cualquier momento.</p></div></div>';
  }
  function viewAcceso() {
    var a = state.acc, reg = a.tab === "registro" && a.rol !== "despacho";
    var titulo = a.rol === "repartidor" ? (reg ? "Regístrate como repartidor" : "Entra como repartidor") : a.rol === "grua" ? (reg ? "Registra tu servicio de grúa" : "Entra a tu cuenta de grúa") : a.rol === "taller" ? (reg ? "Registra tu taller" : "Entra a tu taller") : a.rol === "despacho" ? "Acceso de despacho" : (reg ? "Crea tu cuenta" : "Inicia sesión");
    var intro = a.msg || (a.rol === "repartidor" ? "Para repartidores del equipo Mekachi. Verás los pedidos listos y confirmarás cada entrega." : a.rol === "grua" ? "Con tu cuenta recibes solicitudes de grúa de conductores y talleres de tu zona." : a.rol === "taller" ? "Con tu cuenta recibes solicitudes de conductores y pides repuestos." : a.rol === "despacho" ? "Solo para el equipo de Mekachi." : "Con tu cuenta guardas tus autos, tus solicitudes y el historial de servicios.");
    if (state.user && a.rol === "despacho") return "<h1>Acceso de despacho</h1><div class='notice'>Tu cuenta no tiene permiso de despacho. Pide al administrador de Mekachi que la habilite.</div><button class='btn' data-logout='1'>Cerrar sesión</button>";
    var extra = "";
    if (reg && a.rol === "conductor") extra = field("r-nombre", "Tu nombre", "required autocomplete=name", "") + field("r-tel", "Teléfono", TEL + " required", "");
    if (reg && a.rol === "repartidor") extra = '<div class="row">' + field("r-nombre", "Tu nombre", "required", "") + field("r-tel", "Teléfono", TEL + " required", "") + "</div>" +
      '<div class="row"><div class="field"><label for="r-veh">Vehículo</label><select id="r-veh">' + opts(["Moto", "Auto", "Camioneta"]) + "</select></div>" + field("r-placa", "Placa", 'required style="text-transform:uppercase"', "") + "</div>";
    if (reg && a.rol === "grua") extra = field("r-grua", "Nombre del servicio o empresa", "required", "") +
      '<div class="row">' + field("r-nombre", "Persona de contacto", "required", "") + field("r-tel", "Teléfono o WhatsApp", TEL + " required", "") + "</div>" +
      '<div class="row"><div class="field"><label for="r-zona">Zona principal</label><select id="r-zona">' + opts(CFG.zonas) + "</select></div>" + field("r-tarifa", "Tarifa base $", 'type="number" min="1" step="0.5" required', "") + "</div>" +
      '<div class="field"><label>Vehículos que puedes llevar</label><div class="checks">' + ["Auto", "SUV", "Camioneta", "Moto"].map(function (e) { return '<label><input type="checkbox" name="esp" value="' + e + '"' + (e === "Auto" ? " checked" : "") + "> " + e + "</label>"; }).join("") + "</div></div>";
    if (reg && a.rol === "taller") extra = field("r-taller", "Nombre del taller", "required", "") +
      '<div class="row">' + field("r-nombre", "Persona de contacto", "required", "") + field("r-tel", "Teléfono o WhatsApp", TEL + " required", "") + "</div>" +
      field("r-dir", "Dirección", 'required placeholder="Calle, número y referencia"', "") +
      '<div class="row">' + field("r-sector", "Sector o barrio", 'required placeholder="El Inca"', "") +
      '<div class="field"><label for="r-zona">Zona de Quito</label><select id="r-zona">' + opts(CFG.zonas) + "</select></div></div>" +
      '<div class="field"><label>Especialidades</label><div class="checks">' + ESP.map(function (e) { return '<label><input type="checkbox" name="esp" value="' + esc(e) + '"> ' + esc(e) + "</label>"; }).join("") + "</div></div>";
    return "<h1>" + titulo + "</h1><p class='muted'>" + esc(intro) + "</p>" +
      (a.rol !== "despacho" ? '<div class="chips"><button data-acctab="login" aria-pressed="' + !reg + '">Ya tengo cuenta</button><button data-acctab="registro" aria-pressed="' + reg + '">' + (a.rol === "taller" ? "Registrar taller" : a.rol === "grua" ? "Registrar grúa" : a.rol === "repartidor" ? "Registrarme" : "Crear cuenta") + "</button></div>" : "") +
      '<form class="card" data-form="' + (reg ? "registro" : "login") + '">' + extra +
      field("a-email", "Correo", 'type="email" required autocomplete="email" data-msg="Escribe un correo válido"', "") +
      field("a-pass", "Contraseña", 'type="password" required minlength="6" autocomplete="' + (reg ? "new-password" : "current-password") + '" data-msg="Mínimo 6 caracteres"', "") +
      '<button class="btn primary block">' + (reg ? (a.rol === "taller" ? "Registrar taller" : a.rol === "grua" ? "Registrar grúa" : a.rol === "repartidor" ? "Registrarme" : "Crear cuenta") : "Entrar") + "</button></form>" +
      (a.rol === "conductor" ? '<button class="back" data-go="c-inicio">Seguir sin cuenta</button>' : "");
  }
  function viewCuenta() {
    if (!state.user) return viewAcceso() + acercaHtml();
    var p = state.perfil || {};
    return "<h1>Mi cuenta</h1>" +
      '<div class="card"><h2>' + esc(p.nombre || "Sin nombre") + '</h2><p class="muted small">' + esc(state.user.email || "") + " · " + esc(p.rol === "repartidor" ? "Repartidor" : p.rol === "grua" ? "Grúa" : p.rol === "taller" ? "Taller" : p.rol === "despacho" ? "Despacho Mekachi" : "Conductor") + "</p>" +
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
      q("garaje", "car", "Mi garaje", "Recordatorios e historial") + q("grua", "truck", "Pedir grúa", "Si el auto no puede moverse") + "</div>" +
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
      (s.urgencia === "alta" ? '<button class="btn primary block" data-go="grua">Pedir una grúa</button><button class="btn block" style="margin-top:8px" data-buscartaller="' + esc(s.esp) + '">Ver talleres de ' + esc(s.esp.toLowerCase()) + "</button>"
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
    var h = viewSolicitudesBase();
    if (!state.misGruas.length) return h;
    return h.replace("<h1>Mis solicitudes</h1>", '<h1>Mis solicitudes</h1><div class="section-title">Grúas</div>' + state.misGruas.map(function (g) {
      return '<div class="card"><div class="head"><div><h2>' + esc(g.num) + " · " + esc(g.tipo_vehiculo) + '</h2><div class="muted small">' + fecha(g.created_at) + (g.es_demo ? " · demostración" : "") + "</div></div>" + chip(g.estado) + "</div>" +
        '<p class="small"><b>Recoger en:</b> ' + esc(g.ubicacion) + "<br><b>Llevar a:</b> " + esc(g.destino || "por definir") + "<br><b>Proveedor:</b> " + esc(g.proveedor ? g.proveedor.nombre : "por asignar") + (g.estimado_min ? " · " + g.estimado_min + " min · " + usd(g.estimado_precio) : "") + "</p></div>";
    }).join("") + '<div class="section-title">Servicios</div>');
  }
  // ---------- Grúa desde la app
  function viewGrua() {
    var g = state.gruaOk, p = state.perfil || {}, t = byId(state.talleres, state.tsel[0]);
    if (g) return "<h1>Grúa solicitada</h1><div class='urg baja'><b>" + esc(g.num) + " · " + esc(g.estado) + "</b><span>" + (g.proveedor ? esc(g.proveedor) + " · llegada estimada " + g.minutos + " min · " + usd(g.precio) + " aprox." : "El equipo de Mekachi asignará un proveedor y te llamará.") + "</span></div>" +
      (g.demo ? '<div class="notice"><b>Mekachi está en pruebas:</b> esta solicitud es de demostración y no llegará una grúa real. Si es una emergencia, llama a tu seguro o al 911.</div>' : '<div class="notice">Te contactaremos al teléfono que dejaste para confirmar la llegada.</div>') +
      '<p class="muted small">Quédate fuera del auto, en un lugar seguro y con las luces de emergencia encendidas.</p><div class="actions"><button class="btn primary" data-gruafin="1">Entendido</button>' + (state.user ? '<button class="btn" data-go="solicitudes">Ver mis solicitudes</button>' : "") + "</div>";
    return '<button class="back" data-go="c-inicio">← Volver</button><h1>Pedir una grúa</h1><p class="muted small">Si estás en peligro en la vía, llama primero al 911.</p><form class="card" data-form="grua">' +
      field("g-ubi", "¿Dónde está el auto?", 'required minlength="5" placeholder="Calle, número y una referencia"', "") +
      '<div class="field"><div class="actions"><button type="button" class="btn sm" data-geo="1">Adjuntar mi ubicación actual</button><span class="muted small" id="geo-txt">Opcional, ayuda a la grúa a encontrarte</span></div><input type="hidden" id="t-lat"><input type="hidden" id="t-lng"></div>' +
      '<div class="row"><div class="field"><label for="g-zona">Zona de Quito</label><select id="g-zona">' + opts(CFG.zonas) + '</select></div><div class="field"><label for="g-tipo">Tipo de vehículo</label><select id="g-tipo">' + opts(["Auto", "SUV", "Camioneta", "Moto"]) + "</select></div></div>" +
      field("g-dest", "¿A dónde lo llevamos?", 'placeholder="Un taller o una dirección"', t ? t.nombre : "") +
      '<div class="row">' + field("g-nombre", "Tu nombre", "required", p.nombre) + field("g-tel", "Teléfono de contacto", TEL + " required", p.telefono) + "</div>" +
      '<button class="btn primary block">Pedir grúa</button></form>';
  }
  function viewSolicitudesBase() {
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
    var citas = state.tCitas.length ? '<div class="section-title">Citas pedidas por WhatsApp</div>' + state.tCitas.map(function (c) {
      return '<div class="card"><div class="head"><div><h2>' + esc(c.fecha) + " · " + esc(c.hora) + '</h2><div class="muted small">' + esc(c.num) + " · " + esc(c.nombre) + " · " + esc(c.vehiculo) + "</div></div>" + chip(c.estado) + "</div><p>" + esc(c.motivo) + "</p>" +
        (c.estado === "Pendiente" ? '<div class="actions"><button class="btn sm primary" data-cita="' + c.id + '" data-acc="confirmar">Confirmar cita</button><button class="btn sm" data-cita="' + c.id + '" data-acc="rechazar">No puedo ese día</button></div>' : "") + "</div>";
    }).join("") + '<div class="section-title">Solicitudes de precio</div>' : "";
    if (!state.trabajos.length) return "<h1>Trabajos</h1>" + citas + "<div class='empty'>" + (state.loading ? "Cargando…" : "Aquí llegan las solicitudes de los conductores que elijan tu taller.") + "</div>";
    return "<h1>Trabajos</h1><p class='muted small'>Responde con un precio cerrado. El cliente lo acepta antes de traer el auto.</p>" + citas +
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
      return '<div class="item"><div><div class="name">' + esc(p.nombre) + '</div><div class="meta">' + esc(p.compat) + '</div><div class="price">' + usd(p.precio) + ' <span class="meta">+ IVA · ' + (p.disp ? "en bodega" : "bajo pedido") + '</span></div></div>' +
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
      '<div class="field"><label for="p-tipo">Entrega (el envío va incluido)</label><select id="p-tipo"><option value="Ruta">Ruta programada: sale ' + proximaRuta() + '</option><option value="Urgente">Urgente: sale apenas esté listo · recargo de ' + usd(CFG.recargoUrgente) + ' + IVA</option></select><p class="small muted" id="p-rec" style="margin:6px 0 0"></p></div>' +
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
  var orderTotal = function (o) { return (+o.recargo ? '<p class="small muted" style="margin:0 0 4px">Incluye recargo por entrega urgente: ' + usd(o.recargo) + " + IVA</p>" : "") + "<div class='totals' style='margin-bottom:12px'><div class='total' style='border:0;padding:0;font-size:1.05rem'><span>Total con IVA" + (pendientes(o) ? " (parcial)" : "") + "</span><span>" + usd(o.total) + "</span></div></div>"; };
  function viewPedidos() {
    if (!state.pedidos.length) return "<h1>Pedidos</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Aquí aparecerán tus pedidos.<br><br><button class='btn primary' data-go='catalogo'>Pedir repuestos</button>") + "</div>";
    return "<h1>Pedidos</h1>" + state.pedidos.map(function (o) {
      var cod = o.cod && o.cod.codigo, ent = o.estado === "Entregado";
      return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + '</h2><div class="muted small">' + fecha(o.created_at) + " · " + esc(o.pago) + " · " + (o.tipo_entrega === "Urgente" ? "entrega urgente" : "ruta programada") + "</div></div>" + chip(o.estado) + "</div>" +
        track(o) + orderLines(o) + orderTotal(o) +
        (o.estado === "En camino" && o.salida_at ? '<p class="small"><b>Salió de bodega a las ' + new Date(o.salida_at).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) + "</b>" + (o.repartidor_nombre ? " con " + esc(o.repartidor_nombre) : "") + ".</p>" : "") +
        (o.estado === "Listo" ? '<p class="small">Tu pedido está alistado y sale ' + (o.tipo_entrega === "Urgente" ? "en cuanto lo recoja un repartidor" : "en la próxima ruta, " + proximaRuta()) + ".</p>" : "") +
        (o.estado === "Entregado" && o.entregado_at ? '<p class="small muted">Entregado el ' + fecha(o.entregado_at) + ".</p>" : "") +
        (cod && (o.estado === "Listo" || o.estado === "En camino") ? '<div class="notice"><b>Código de entrega: ' + esc(cod) + "</b><br>Dáselo al repartidor solo cuando recibas el pedido completo.</div>" : "") +
        (o.devolucion_estado ? '<p class="small"><b>Devolución ' + esc(o.devolucion_estado.toLowerCase()) + ".</b> " + esc(o.devolucion_motivo) + "</p>" : "") +
        '<div class="actions"><button class="btn sm" data-repeat="' + o.id + '">Repetir pedido</button>' + (ent && !o.devolucion_estado ? '<button class="btn sm" data-devolver-ped="' + o.id + '">Pedir devolución</button>' : "") + "</div></div>";
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
    // Margen: precio de venta menos costo promedio, solo en piezas de catálogo de pedidos no cancelados.
    var vivos = o.filter(function (x) { return x.estado !== "Cancelado"; }), margen = 0, vendido = 0;
    vivos.forEach(function (x) { (x.items || []).forEach(function (l) { var p = l.producto_id && byId(state.dInv, l.producto_id); if (p && l.precio_unit != null) { vendido += l.cantidad * l.precio_unit; margen += l.cantidad * (l.precio_unit - p.costo); } }); margen += +(x.recargo || 0); vendido += +(x.recargo || 0); });
    var tiempos = o.filter(function (x) { return x.salida_at && x.entregado_at; }).map(function (x) { return (new Date(x.entregado_at) - new Date(x.salida_at)) / 6e4; });
    return "<h1>Despacho Mekachi</h1><p class='muted small'>Lo que entra por la app, visto desde la operación.</p>" +
      '<div class="section-title">Repuestos</div><div class="kpis">' + k(count(o, function (x) { return x.estado === "Registrado"; }), "Pedidos por atender") +
      k(count(o, function (x) { return pendientes(x) > 0; }), "Con piezas por cotizar") + k(count(o, function (x) { return x.estado === "En camino"; }), "En camino") + k(usd(ventas), "Venta de repuestos") + "</div>" +
      '<div class="section-title">Distribución</div><div class="kpis">' + k(usd(margen), "Margen bruto de repuestos") + k(vendido ? Math.round(margen / vendido * 100) + " %" : "—", "Margen sobre la venta") + k(tiempos.length ? Math.round(tiempos.reduce(function (n, x) { return n + x; }, 0) / tiempos.length) + " min" : "—", "De bodega al taller, promedio") + k(count(o, function (x) { return x.entregado_at && Date.now() - new Date(x.entregado_at) < 864e5; }), "Entregas en 24 horas") + "</div>" +
      state.dBod.filter(function (b) { return b.activa; }).map(function (b) { var po = vivos.filter(function (x) { return x.bodega_id === b.id; }); return '<p class="small"><b>' + esc(b.nombre) + ":</b> " + count(po, function (x) { return x.estado === "Listo"; }) + " listos · " + count(po, function (x) { return x.estado === "En camino"; }) + " en camino · " + count(po, function (x) { return x.estado === "Entregado"; }) + " entregados · " + usd(po.reduce(function (n, x) { return n + +x.subtotal; }, 0)) + " sin IVA</p>"; }).join("") +
      '<div class="section-title">Servicios</div><div class="kpis">' + k(s.length, "Solicitudes") + k(count(s, function (x) { return x.estado === "Aceptada"; }), "En curso") +
      k(count(s, function (x) { return x.estado === "Terminada"; }), "Terminados") + k(usd(servicios), "Cobrado por talleres") + "</div>" +
      '<div class="section-title">Red</div><div class="kpis">' + k(count(state.dTalleres, function (t) { return t.verificado; }), "Talleres verificados") + k(count(state.dTalleres, function (t) { return !t.verificado && !t.es_demo; }), "Por verificar") + "</div>" +
      '<div class="actions"><button class="btn primary" data-go="d-pedidos">Atender pedidos</button><button class="btn" data-go="d-red">Verificar talleres</button></div>';
  }
  function viewDPedidos() {
    if (!state.dPedidos.length) return "<h1>Pedidos de talleres</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Todavía no hay pedidos.") + "</div>";
    return "<h1>Pedidos de talleres</h1><p class='muted small'>Cotiza las piezas fuera de lista y avanza el estado de cada pedido.</p>" +
      state.dPedidos.map(function (o) {
        var i = ESTADOS.indexOf(o.estado), sig = o.estado === "Cancelado" ? null : ESTADOS[i + 1], t = o.taller || {}, bloq = pendientes(o) > 0 && i === 0;
        var cot = (o.items || []).filter(function (l) { return l.precio_unit == null; }).map(function (l) {
          return '<form class="inline" data-form="cotizar-linea" data-id="' + l.id + '" style="margin-bottom:8px"><span class="small" style="flex:1">' + esc(l.nombre) + " · " + esc(l.detalle) +
            '</span><input name="precio" type="number" min="0.01" step="0.01" required placeholder="Precio $" aria-label="Precio unitario"><button class="btn sm">Cotizar</button></form>';
        }).join("");
        return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + " · " + esc(t.nombre) + '</h2><div class="muted small">' + fecha(o.created_at) + " · " + esc(o.direccion) + " (" + esc(o.zona) + ") · " + esc(o.pago) + (t.telefono ? " · " + esc(t.telefono) : "") + "</div></div>" + chip(o.estado) + "</div>" +
          track(o) + orderLines(o) + cot + (i >= 0 && i < 3 ? faltantes(o) : "") + orderTotal(o) +
          '<p class="small"><b>Bodega:</b> ' + esc(o.bodega_id ? bodNombre(o.bodega_id) : "se asigna al confirmar") + " · <b>Entrega:</b> " + (o.tipo_entrega === "Urgente" ? chip("Urgente") : "ruta programada") + " · <b>Repartidor:</b> " + esc((byId(state.dRep, o.repartidor_id) || {}).nombre || "sin asignar") + (o.cod && i >= 2 && i < 4 ? " · <b>Código:</b> " + esc(o.cod.codigo) : "") + "</p>" +
          (o.devolucion_estado ? '<div class="notice"><b>Devolución ' + esc(o.devolucion_estado.toLowerCase()) + ":</b> " + esc(o.devolucion_motivo || "sin motivo") + "</div>" : "") +
          (i >= 0 && i < 3 ? '<form class="inline" data-form="asignar-ped" data-id="' + o.id + '" style="margin-bottom:8px;flex-wrap:wrap">' + bodSelect("", o.bodega_id) + '<select name="rep" aria-label="Repartidor"><option value="">Cualquier repartidor</option>' + state.dRep.filter(function (r) { return r.verificado; }).map(function (r) { return '<option value="' + r.id + '"' + (r.id === o.repartidor_id ? " selected" : "") + ">" + esc(r.nombre) + "</option>"; }).join("") + '</select><button class="btn sm">Asignar</button></form>' : "") + (o.nota ? '<p class="muted small">Nota: ' + esc(o.nota) + "</p>" : "") +
          (sig ? '<div class="actions"><button class="btn sm primary" data-avanzar="' + o.id + '"' + (bloq ? " disabled" : "") + ">" + ({ Confirmado: "Confirmar pedido", Listo: "Marcar alistado", "En camino": "Despachar: sale de bodega", Entregado: "Marcar entregado" })[sig] + "</button>" + (bloq ? '<span class="muted small">Cotiza primero las piezas pendientes.</span>' : "") + "</div>" : "") +
          (o.estado !== "Cancelado" ? '<div class="actions" style="margin-top:8px"><button class="btn sm danger" data-cancelarped="' + o.id + '" data-sale="' + (i >= 3 ? "1" : "") + '">' + (o.devolucion_estado ? "Procesar devolución: vuelve a bodega" : i >= 3 ? "Cancelar y devolver a bodega" : "Cancelar pedido") + "</button></div>" : "") + "</div>";
      }).join("");
  }
  function viewDServicios() {
    if (!state.dSolicitudes.length) return "<h1>Servicios</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Todavía no hay solicitudes de conductores.") + "</div>";
    return "<h1>Servicios</h1><p class='muted small'>Solicitudes entre conductores y talleres.</p>" + state.dSolicitudes.map(function (o) {
      return '<div class="card"><div class="head"><div><h2>' + esc(o.num) + " · " + esc(o.vehiculo_texto) + '</h2><div class="muted small">' + esc(o.cliente_nombre) + " · " + esc(o.dia || "") + (o.taller ? " · " + esc(o.taller.nombre) : "") + "</div></div>" + chip(o.estado) + "</div>" +
        "<p>" + esc(o.problema) + "</p>" + (o.precio_final ? '<p class="small"><b>' + usd(o.precio_final) + "</b>" + (o.rating ? " · " + estrellas(o.rating) : "") + "</p>" : "") + "</div>";
    }).join("");
  }
  // ---------- Atención: conversaciones de WhatsApp, grúas y citas
  var GRUA_SIG = { Solicitada: "Asignada", Asignada: "En camino", "En camino": "Completada" };
  statusCls.Solicitada = "warn"; statusCls.Asignada = "info"; statusCls.Completada = "ok"; statusCls.Confirmada = "ok"; statusCls.Cancelada = ""; statusCls["Espera a una persona"] = "warn"; statusCls["Con el asistente"] = "ok"; statusCls.Demo = "";
  function viewDAtencion() {
    var pend = count(state.dConvs, function (c) { return c.requiere_humano; });
    var subs = [["conv", "Conversaciones", pend], ["gruas", "Grúas", count(state.dGruas, gruaActiva)], ["citas", "Citas", count(state.dCitas, function (c) { return c.estado === "Pendiente"; })]];
    var head = "<h1>Atención</h1><p class='muted small'>Lo que entra por WhatsApp: conversaciones, grúas y citas.</p>" +
      '<div class="chips">' + subs.map(function (x) { return '<button data-dsub="' + x[0] + '" aria-pressed="' + (state.dsub === x[0]) + '">' + x[1] + (x[2] ? " · " + x[2] : "") + "</button>"; }).join("") + "</div>";
    if (state.dsub === "gruas") return head + (state.dGruas.length ? state.dGruas.map(function (g) {
      var sig = GRUA_SIG[g.estado];
      return '<div class="card"><div class="head"><div><h2>' + esc(g.num) + " · " + esc(g.tipo_vehiculo) + '</h2><div class="muted small">' + fecha(g.created_at) + " · " + esc(g.nombre) + " · " + esc(g.telefono) + "</div></div><span>" + (g.es_demo ? chip("Demo") + " " : "") + chip(g.estado) + "</span></div>" +
        '<p class="small"><b>Recoger en:</b> ' + esc(g.ubicacion) + (g.lat != null ? ' · <a target="_blank" rel="noopener" href="https://maps.google.com/?q=' + g.lat + "," + g.lng + '">Ver en el mapa</a>' : "") + "<br><b>Llevar a:</b> " + esc(g.destino) +
        "<br><b>Proveedor:</b> " + esc(g.proveedor ? g.proveedor.nombre : "Sin asignar") + (g.estimado_min ? " · " + g.estimado_min + " min · " + usd(g.estimado_precio) : "") + "</p>" +
        (g.estado === "Solicitada" || g.estado === "Asignada" ? '<form class="inline" data-form="asignar-grua" data-id="' + g.id + '" style="margin-bottom:8px"><select name="prov" aria-label="Proveedor">' + state.dProv.filter(function (x) { return x.activo; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === g.proveedor_id ? " selected" : "") + ">" + esc(x.nombre + " · " + x.zona) + "</option>"; }).join("") + '</select><button class="btn sm">' + (g.proveedor_id ? "Reasignar" : "Asignar") + "</button></form>" : "") +
        (sig ? '<div class="actions"><button class="btn sm primary" data-grua="' + g.id + '" data-e="' + sig + '">Marcar como ' + sig.toLowerCase() + '</button><button class="btn sm" data-grua="' + g.id + '" data-e="Cancelada">Cancelar</button></div>' : "") + "</div>";
    }).join("") : "<div class='empty'>Todavía no hay solicitudes de grúa.</div>");
    if (state.dsub === "citas") return head + (state.dCitas.length ? state.dCitas.map(function (c) {
      return '<div class="card"><div class="head"><div><h2>' + esc(c.fecha) + " · " + esc(c.hora) + " · " + esc(c.taller ? c.taller.nombre : "") + '</h2><div class="muted small">' + esc(c.num) + " · " + esc(c.nombre) + " · " + esc(c.telefono) + " · " + esc(c.vehiculo) + "</div></div>" + chip(c.estado) + "</div><p>" + esc(c.motivo) + "</p>" +
        (c.estado === "Pendiente" ? '<div class="actions"><button class="btn sm primary" data-cita="' + c.id + '" data-acc="confirmar">Confirmar por el taller</button><button class="btn sm" data-cita="' + c.id + '" data-acc="rechazar">Rechazar</button></div>' : "") + "</div>";
    }).join("") : "<div class='empty'>Todavía no hay citas.</div>");
    var cv = byId(state.dConvs, state.dconv);
    if (cv) return '<button class="back" data-conv="">← Todas las conversaciones</button><h1>' + esc(cv.nombre || "Sin nombre") + " " + chip(cv.requiere_humano ? "Espera a una persona" : "Con el asistente") + '</h1><p class="muted small">' + esc(cv.telefono) + (cv.motivo_humano ? " · Motivo: " + esc(cv.motivo_humano) : "") + "</p>" +
      '<div class="chat">' + state.dMsgs.map(function (m) {
        return '<div class="bubble ' + (m.rol === "user" ? "in" : m.autor === "humano" ? "out human" : "out") + '"><small>' + (m.rol === "user" ? "Cliente" : m.autor === "humano" ? "Equipo" : "Asistente") + " · " + fecha(m.created_at) + "</small>" + esc(m.texto) + "</div>";
      }).join("") + "</div>" +
      '<form class="card" data-form="wa-responder"><div class="field"><label for="wa-txt">Responder como equipo</label><textarea id="wa-txt" rows="2" required placeholder="Tu mensaje llega al WhatsApp de la persona"></textarea></div>' +
      '<div class="actions"><button class="btn primary">Enviar</button>' + (cv.requiere_humano ? '<button type="button" class="btn" data-devolver="' + cv.id + '">Devolver al asistente</button>' : "") + "</div>" +
      '<p class="muted small" style="margin-top:8px">Al responder, el asistente se queda en silencio en esta conversación hasta que la devuelvas. Meta solo permite escribir dentro de las 24 horas posteriores al último mensaje de la persona.</p></form>';
    return head + (state.dConvs.length ? state.dConvs.map(function (c) {
      return '<button class="sint" data-conv="' + c.id + '"><span><b>' + esc(c.nombre || "Sin nombre") + " · …" + esc(c.telefono.slice(-4)) + "</b><small>" + fecha(c.updated_at) + (c.motivo_humano ? " · " + esc(c.motivo_humano) : "") + "</small></span>" + chip(c.requiere_humano ? "Espera a una persona" : "Con el asistente") + "</button>";
    }).join("") : "<div class='empty'>Todavía no hay conversaciones.</div>");
  }
  // ---------- Inventario
  var bajoMinimo = function (x) { return x.activo && x.stock <= x.minimo; };
  var IFILTROS = [["todos", "Todos", function () { return true; }], ["bajo", "Bajo mínimo", function (x) { return x.activo && x.stock > 0 && x.stock <= x.minimo; }],
    ["cero", "Sin existencias", function (x) { return x.stock === 0; }], ["con", "Con existencias", function (x) { return x.stock > 0; }]];
  statusCls["Sin existencias"] = "warn"; statusCls["Bajo mínimo"] = "warn"; statusCls["En bodega"] = "ok"; statusCls.Entrada = "ok"; statusCls.Salida = "info"; statusCls.Ajuste = "warn"; statusCls["Devolución"] = "ok";
  var margen = function (x) { return x.precio > 0 && x.costo > 0 ? Math.round((x.precio - x.costo) / x.precio * 100) + " %" : "—"; };
  function invFiltrado() {
    var f = IFILTROS.filter(function (x) { return x[0] === state.ifil; })[0][2], q = norm(state.iq.trim());
    return state.dInv.filter(function (x) { return f(x) && (!q || q.split(/\s+/).every(function (w) { return norm(x.nombre + " " + x.compat + " " + x.cat + " " + (x.codigo || "")).indexOf(w) >= 0; })); });
  }
  function invListHtml() {
    var list = invFiltrado();
    if (!list.length) return "<div class='empty'>" + (state.loading ? "Cargando…" : "No hay repuestos con ese filtro.") + "</div>";
    return list.map(function (x) {
      return '<button class="sint" data-inv="' + x.id + '"><span><b>' + esc(x.nombre) + "</b><small>" + esc(x.compat) + " · " + esc(x.codigo || "sin código") + "<br>Costo " + usd(x.costo) + " · Precio " + usd(x.precio) + " · Margen " + margen(x) + "</small></span>" +
        '<span style="text-align:right;flex:none"><b style="font-size:1.25rem">' + x.stock + "</b><br>" + chip(x.stock === 0 ? "Sin existencias" : x.stock <= x.minimo ? "Bajo mínimo" : "En bodega") + "</span></button>";
    }).join("");
  }
  // Lo que falta en bodega para un pedido que aún no sale.
  function faltantes(o) {
    var f = (o.items || []).filter(function (l) { return l.producto_id; }).map(function (l) { var x = byId(state.dInv, l.producto_id), hay = !x ? 0 : o.bodega_id ? (x.sb[o.bodega_id] || 0) : x.total; return { l: l, falta: Math.max(l.cantidad - hay, 0) }; }).filter(function (y) { return y.falta > 0; });
    if (!(o.items || []).some(function (l) { return l.producto_id; })) return "";
    return f.length ? '<div class="notice"><b>Falta en bodega.</b> Registra la compra con su costo real antes de despachar; si no, entra al costo promedio.' + f.map(function (y) {
      return '<form class="inline" data-form="compra-pedido" data-bod="' + (o.bodega_id || "") + '" data-pid="' + y.l.producto_id + '" data-num="' + esc(o.num) + '" style="margin-top:8px;flex-wrap:wrap"><span class="small" style="flex:1 1 140px">' + esc(y.l.nombre) + '</span><input name="cant" type="number" min="1" step="1" required value="' + y.falta + '" aria-label="Cantidad" style="max-width:76px"><input name="costo" type="number" min="0.01" step="0.01" required placeholder="Costo $" aria-label="Costo unitario" style="max-width:104px"><button class="btn sm">Registrar compra</button></form>';
    }).join("") + "</div>" : '<p class="muted small">Todo lo de catálogo está en bodega.</p>';
  }
  function viewDInventario() {
    var all = state.dInv, x = state.iprod ? byId(all, state.iprod) : null;
    if (x) return viewProducto(x);
    var pedidas = count(state.dCompras, function (c) { return c.estado === "Pedida"; });
    var bods = state.dBod.length > 1 ? '<div class="field" style="margin:8px 0 0"><label for="ibod">Bodega</label><select id="ibod"><option value="todas">Todas las bodegas</option>' + state.dBod.map(function (b) { return '<option value="' + b.id + '"' + (state.ibod === b.id ? " selected" : "") + ">" + esc(b.nombre) + "</option>"; }).join("") + "</select></div>" : "";
    var sub = bods + '<div class="chips">' + [["stock", "Existencias"], ["compras", "Compras" + (pedidas ? " · " + pedidas : "")], ["conteo", "Conteo físico"]].map(function (c) { return '<button data-isub="' + c[0] + '" aria-pressed="' + (state.isub === c[0]) + '">' + c[1] + "</button>"; }).join("") + "</div>";
    if (state.isub === "compras") return "<h1>Inventario</h1>" + sub + comprasHtml();
    if (state.isub === "conteo") return "<h1>Inventario</h1>" + sub + conteoHtml();
    var k = function (v, l) { return '<div class="kpi"><b>' + v + "</b><span>" + l + "</span></div>"; };
    var valor = all.reduce(function (n, y) { return n + y.stock * y.costo; }, 0), venta = all.reduce(function (n, y) { return n + y.stock * y.precio; }, 0);
    return "<h1>Inventario</h1>" + sub + "<p class='muted small'>Existencias en bodega. Al despachar un pedido, la mercadería sale sola del inventario.</p>" +
      '<div class="kpis">' + k(all.length, "Repuestos") + k(all.reduce(function (n, y) { return n + y.stock; }, 0), "Unidades en bodega") + k(usd(valor), "Valor al costo") + k(usd(venta), "Valor a precio de venta") +
      k(count(all, IFILTROS[1][2]), "Bajo mínimo") + k(count(all, IFILTROS[2][2]), "Sin existencias") + "</div>" +
      '<input type="search" id="iq" placeholder="Buscar por nombre, vehículo o código" value="' + esc(state.iq) + '" aria-label="Buscar repuesto">' +
      '<div class="chips">' + IFILTROS.map(function (f) { return '<button data-ifil="' + f[0] + '" aria-pressed="' + (state.ifil === f[0]) + '">' + f[1] + " · " + count(all, f[2]) + "</button>"; }).join("") + "</div>" +
      '<div class="list" id="ilist">' + invListHtml() + "</div>" +
      '<div class="actions" style="margin:14px 0"><button class="btn sm primary" data-inuevo="1">' + (state.inuevo ? "Cancelar" : "Nuevo repuesto") + '</button><button class="btn sm" data-icsv="1">Descargar inventario (CSV)</button></div>' +
      (state.inuevo ? '<form class="card" data-form="inv-nuevo"><h2>Nuevo repuesto</h2><div class="row">' + field("n-nombre", "Nombre", 'required placeholder="Pastillas de freno delanteras"', "") + field("n-compat", "Vehículos compatibles", 'required placeholder="Chevrolet Sail"', "") + "</div>" +
        '<div class="row">' + field("n-cat", "Categoría", 'required list="cats" placeholder="Frenos"', "") + field("n-codigo", "Código", 'required placeholder="b30"', "") + "</div>" +
        '<datalist id="cats">' + all.map(function (y) { return y.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; }).map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>" +
        '<div class="row">' + field("n-costo", "Costo de compra $", 'type="number" min="0" step="0.01" required', "") + field("n-precio", "Precio de venta $ (sin IVA)", 'type="number" min="0" step="0.01" required', "") + "</div>" +
        '<div class="row">' + field("n-stock", "Existencias iniciales", 'type="number" min="0" step="1" required', "0") + field("n-min", "Mínimo para alerta", 'type="number" min="0" step="1" required', "2") + "</div>" +
        '<button class="btn primary block">Crear repuesto</button></form>' : "");
  }
  // Órdenes de compra a proveedores
  function syncOc() {
    if (!state.oc || !$("#oc-prov")) return;
    state.oc.proveedor = $("#oc-prov").value; state.oc.nota = $("#oc-nota").value;
    state.oc.items.forEach(function (it) { var q = $('[data-ocq="' + it.id + '"]'), c = $('[data-occ="' + it.id + '"]'); if (q) it.cantidad = parseInt(q.value, 10) || 0; if (c) it.costo = +c.value || 0; });
  }
  function comprasHtml() {
    var o = state.oc;
    if (o) {
      var tot = o.items.reduce(function (n, it) { return n + it.cantidad * it.costo; }, 0), libres = state.dInv.filter(function (x) { return !o.items.some(function (it) { return it.id === x.id; }); });
      return '<form class="card" data-form="oc"><h2>Nueva orden de compra</h2><div class="row">' + field("oc-prov", "Proveedor", 'required placeholder="Nombre del distribuidor"', o.proveedor) + field("oc-nota", "Nota (opcional)", 'maxlength="160"', o.nota) + "</div>" + '<div class="field"><label>Bodega que recibe</label>' + bodSelect("oc-bod", bodActual()) + "</div>" +
        (o.items.length ? o.items.map(function (it) {
          var x = byId(state.dInv, it.id) || {};
          return '<div class="ocrow"><span><b>' + esc(x.nombre) + '</b><small class="muted"> ' + esc(x.compat) + " · hay " + x.stock + ", mínimo " + x.minimo + '</small></span><input type="number" min="1" step="1" required data-ocq="' + it.id + '" value="' + it.cantidad + '" aria-label="Cantidad"><input type="number" min="0" step="0.01" required data-occ="' + it.id + '" value="' + it.costo + '" aria-label="Costo unitario"><button type="button" class="btn sm" data-ocdel="' + it.id + '" aria-label="Quitar">✕</button></div>';
        }).join("") : '<p class="muted small">Agrega al menos un repuesto.</p>') +
        '<div class="inline" style="margin:10px 0"><select id="oc-add" aria-label="Repuesto a agregar">' + libres.map(function (x) { return '<option value="' + x.id + '">' + esc(x.nombre + " · " + x.compat) + "</option>"; }).join("") + '</select><button type="button" class="btn sm" data-ocadd="1">Agregar</button></div>' +
        '<p class="small"><b>Total estimado: ' + usd(tot) + '</b> · columnas: cantidad y costo unitario</p><div class="actions"><button class="btn primary">Crear orden de compra</button><button type="button" class="btn" data-occancel="1">Descartar</button></div></form>';
    }
    return "<p class='muted small'>Pide mercadería a tus proveedores. Al recibirla entra a bodega con su costo real.</p>" +
      '<div class="actions" style="margin-bottom:14px"><button class="btn sm primary" data-ocsug="1">Sugerir compra con lo que está bajo mínimo</button><button class="btn sm" data-ocnew="1">Orden vacía</button></div>' +
      (state.dCompras.length ? state.dCompras.map(function (c) {
        return '<div class="card"><div class="head"><div><h2>' + esc(c.num) + " · " + esc(c.proveedor || "Sin proveedor") + '</h2><div class="muted small">' + fecha(c.created_at) + (c.nota ? " · " + esc(c.nota) : "") + "</div></div>" + chip(c.estado) + "</div>" +
          '<ul class="lines">' + (c.items || []).map(function (it) { return "<li><span>" + it.cantidad + " × " + esc(it.producto ? it.producto.nombre : "") + ' <span class="muted">· ' + esc(it.producto ? it.producto.compatibilidad : "") + "</span></span><span>" + usd(it.cantidad * it.costo_unit) + "</span></li>"; }).join("") + "</ul>" +
          '<p class="small"><b>Total: ' + usd(c.total) + "</b></p>" +
          (c.estado === "Pedida" ? '<div class="actions"><button class="btn sm primary" data-recibir="' + c.id + '">Recibir en bodega</button><button class="btn sm" data-cancelaroc="' + c.id + '">Cancelar orden</button></div>' : "") + "</div>";
      }).join("") : "<div class='empty'>Todavía no hay órdenes de compra.</div>");
  }
  statusCls.Pedida = "warn"; statusCls.Recibida = "ok";
  // Conteo físico por categoría
  function conteoHtml() {
    var cats = state.dInv.map(function (x) { return x.cat; }).filter(function (c, i, a) { return a.indexOf(c) === i; });
    if (cats.indexOf(state.ccat) < 0) state.ccat = cats[0];
    if (!byId(state.dBod, state.cbod)) state.cbod = bodActual();
    var list = state.dInv.filter(function (x) { return x.cat === state.ccat; }), sis = function (x) { return x.sb[state.cbod] || 0; };
    return "<p class='muted small'>Cuenta lo que hay en la percha y escribe la cantidad real. Solo se ajusta lo que sea distinto.</p>" +
      '<div class="chips">' + cats.map(function (c) { return '<button data-ccat="' + esc(c) + '" aria-pressed="' + (state.ccat === c) + '">' + esc(c) + "</button>"; }).join("") + "</div>" +
      (state.dBod.length > 1 ? '<div class="field"><label for="cbod">Bodega que se cuenta</label>' + bodSelect("cbod", state.cbod) + "</div>" : "") +
      '<form class="card" data-form="conteo">' + list.map(function (x) {
        return '<div class="ocrow two"><span><b>' + esc(x.nombre) + '</b><small class="muted"> ' + esc(x.compat) + (x.ubicacion ? " · " + esc(x.ubicacion) : "") + " · sistema: " + sis(x) + '</small></span><input type="number" min="0" step="1" required data-conteo="' + x.id + '" data-sis="' + sis(x) + '" value="' + sis(x) + '" aria-label="Unidades contadas"></div>';
      }).join("") + field("ct-motivo", "Referencia del conteo (opcional)", 'maxlength="80" placeholder="Conteo mensual de noviembre"', "") + '<button class="btn primary block">Guardar conteo de ' + esc(state.ccat) + "</button></form>";
  }
  function viewProducto(x) {
    return '<button class="back" data-inv="">← Todo el inventario</button><h1>' + esc(x.nombre) + " " + chip(x.stock === 0 ? "Sin existencias" : x.stock <= x.minimo ? "Bajo mínimo" : "En bodega") + "</h1>" +
      '<p class="muted small">' + esc(x.compat) + " · " + esc(x.cat) + " · " + esc(x.codigo || "sin código") + (x.demo ? " · demostración" : "") + (x.activo ? "" : " · oculto del catálogo") + "</p>" +
      '<div class="kpis"><div class="kpi"><b>' + x.stock + '</b><span>En bodega</span></div><div class="kpi"><b>' + usd(x.costo) + '</b><span>Costo promedio</span></div><div class="kpi"><b>' + usd(x.precio) + '</b><span>Precio sin IVA</span></div><div class="kpi"><b>' + margen(x) + "</b><span>Margen</span></div></div>" +
      '<form class="card" data-form="inv-mover"><h2>Registrar movimiento</h2>' + (state.dBod.length > 1 ? '<div class="field"><label>Bodega</label>' + bodSelect("m-bod", bodActual()) + "</div>" : "") + '<div class="row"><div class="field"><label for="m-tipo">Tipo</label><select id="m-tipo"><option value="Entrada">Entrada (compra)</option><option value="Salida">Salida (venta directa, daño, pérdida)</option><option value="Devolución">Devolución de un taller</option><option value="Ajuste">Ajuste por conteo físico</option></select></div>' +
      field("m-cant", "Cantidad (en ajuste: unidades contadas)", 'type="number" min="0" step="1" required', "") + "</div>" +
      '<div class="row">' + field("m-costo", "Costo unitario $ (solo entradas)", 'type="number" min="0" step="0.01"', "") + field("m-motivo", "Motivo o referencia", 'maxlength="120" placeholder="Factura 001-123, proveedor…"', "") + "</div>" +
      '<button class="btn primary">Registrar</button></form>' +
      '<form class="card" data-form="inv-datos"><h2>Datos del repuesto</h2><div class="row">' + field("d-precio", "Precio de venta $ (sin IVA)", 'type="number" min="0" step="0.01" required', x.precio) + field("d-costo", "Costo $", 'type="number" min="0" step="0.01" required', x.costo) + "</div>" +
      '<div class="row">' + field("d-min", "Mínimo para alerta", 'type="number" min="0" step="1" required', x.minimo) + field("d-prov", "Proveedor habitual", "", x.proveedor) + "</div>" +
      field("d-ubi", "Ubicación en bodega", 'placeholder="Estante A3"', x.ubicacion) +
      '<div class="checks" style="margin-bottom:12px"><label><input type="checkbox" id="d-activo"' + (x.activo ? " checked" : "") + "> Visible en el catálogo de talleres</label></div>" +
      '<button class="btn primary">Guardar datos</button></form>' +
      (state.dBod.length > 1 ? '<form class="card" data-form="inv-traslado"><h2>Trasladar entre bodegas</h2><p class="muted small">' + state.dBod.map(function (b) { return esc(b.nombre) + ": " + (x.sb[b.id] || 0); }).join(" · ") + '</p><div class="row"><div class="field"><label>Desde</label>' + bodSelect("tr-de", bodActual()).replace('name="bodega"', 'name="de"') + '</div><div class="field"><label>Hacia</label>' + bodSelect("tr-a", (state.dBod.filter(function (b) { return b.id !== bodActual(); })[0] || {}).id).replace('name="bodega"', 'name="a"') + "</div></div>" + field("tr-cant", "Cantidad", 'type="number" min="1" step="1" required', "") + '<button class="btn primary">Trasladar</button></form>' : "") +
      '<div class="section-title">Movimientos</div>' + (state.iMovs.length ? '<ul class="lines card">' + state.iMovs.map(function (m) {
        return "<li><span>" + chip(m.tipo) + " " + esc(m.motivo) + '<br><span class="muted">' + fecha(m.created_at) + (state.dBod.length > 1 ? " · " + esc(bodNombre(m.bodega_id)) : "") + (m.costo_unit != null ? " · costo " + usd(m.costo_unit) : "") + "</span></span><span style=\"text-align:right;white-space:nowrap\"><b>" + (m.cantidad > 0 ? "+" : "") + m.cantidad + '</b><br><span class="muted">saldo ' + m.saldo + "</span></span></li>";
      }).join("") + "</ul>" : "<div class='empty'>Sin movimientos todavía.</div>");
  }
  async function abrirProducto(id) {
    state.iprod = id || null; state.iMovs = []; render(); window.scrollTo(0, 0);
    if (!id) return;
    var r = await sb.from("mekachi_inventario_movimientos").select("*").eq("producto_id", id).order("id", { ascending: false }).limit(40);
    if (!r.error && state.iprod === id) { state.iMovs = r.data; render(); }
  }
  function csvDescarga(nombre, cols, filas) {
    var cel = function (v) { v = v === true ? "sí" : v === false ? "no" : v == null ? "" : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
    var csv = "\ufeff" + cols.map(function (c) { return cel(c[0]); }).join(",") + "\n" + filas.map(function (r) { return cols.map(function (c) { return cel(r[c[1]]); }).join(","); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = nombre + "-" + hoyIso() + ".csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  // ---------- Perfil de proveedor de grúa
  function viewGInicio() {
    var g = state.miGrua, s = state.gSol;
    var k = function (v, l) { return '<div class="kpi"><b>' + v + "</b><span>" + l + "</span></div>"; };
    var cobrado = s.filter(function (x) { return x.estado === "Completada"; }).reduce(function (n, x) { return n + +(x.precio_final || x.estimado_precio || 0); }, 0);
    return "<h1>" + esc(g.nombre) + " " + chip(g.verificado ? "Verificado" : "Por verificar") + "</h1><p class='muted small'>" + esc(g.zona) + " · tarifa base " + usd(g.tarifa_base) + (g.es_demo ? " · proveedor de demostración" : "") + "</p>" +
      (g.verificado ? '<div class="card"><div class="head"><div><h2>' + (g.activo ? "Estás disponible" : "No estás recibiendo solicitudes") + '</h2><p class="muted small" style="margin:0">' + (g.activo ? "Mekachi te asigna las solicitudes de tu zona." : "Actívate cuando puedas atender.") + '</p></div><button class="btn sm ' + (g.activo ? "" : "primary") + '" data-gdisp="' + (g.activo ? "0" : "1") + '">' + (g.activo ? "Pausar" : "Activarme") + "</button></div></div>"
        : '<div class="notice">Tu servicio está registrado. Empezarás a recibir solicitudes cuando Mekachi lo verifique.</div>') +
      '<div class="kpis">' + k(count(s, function (x) { return x.estado === "Asignada"; }), "Por aceptar") + k(count(s, function (x) { return x.estado === "En camino"; }), "En curso") + k(count(s, function (x) { return x.estado === "Completada"; }), "Completadas") + k(usd(cobrado), "Cobrado") + "</div>" +
      '<button class="btn primary" data-go="g-servicios">Ver solicitudes</button>';
  }
  function viewGServicios() {
    if (!state.gSol.length) return "<h1>Servicios</h1><div class='empty'>" + (state.loading ? "Cargando…" : "Aquí llegan las solicitudes de grúa que Mekachi te asigne.") + "</div>";
    return "<h1>Servicios</h1><p class='muted small'>Acepta la solicitud antes de salir y márcala completada al entregar el vehículo.</p>" + state.gSol.map(function (g) {
      var act = "";
      if (g.estado === "Asignada") act = '<div class="actions"><button class="btn sm primary" data-gresp="' + g.id + '" data-acc="aceptar">Aceptar y salir</button><button class="btn sm" data-gresp="' + g.id + '" data-acc="rechazar">No puedo atenderla</button></div>';
      if (g.estado === "En camino") act = '<form class="inline" data-form="grua-completar" data-id="' + g.id + '"><input name="precio" type="number" min="0" step="0.5" placeholder="Cobrado $" aria-label="Valor cobrado" value="' + (g.estimado_precio || "") + '"><button class="btn sm primary">Marcar completada</button></form>';
      if (g.estado === "Completada") act = '<p class="small">Cobrado: <b>' + usd(g.precio_final || g.estimado_precio) + "</b></p>";
      return '<div class="card"><div class="head"><div><h2>' + esc(g.num) + " · " + esc(g.tipo_vehiculo) + '</h2><div class="muted small">' + fecha(g.created_at) + (g.es_demo ? " · demostración" : "") + "</div></div>" + chip(g.estado) + "</div>" +
        '<p class="small"><b>Recoger en:</b> ' + esc(g.ubicacion) + (g.lat != null ? ' · <a target="_blank" rel="noopener" href="https://maps.google.com/?q=' + g.lat + "," + g.lng + '">Abrir en el mapa</a>' : "") + "<br><b>Llevar a:</b> " + esc(g.destino || "por definir") +
        "<br><b>Contacto:</b> " + esc(g.nombre) + (g.telefono ? " · " + esc(g.telefono) + ' · <a target="_blank" rel="noopener" href="https://wa.me/' + esc(waNum(g.telefono)) + '">WhatsApp</a>' : "") + "</p>" + act + "</div>";
    }).join("");
  }
  function viewGPerfil() {
    var g = state.miGrua || {}, p = state.perfil || {};
    return "<h1>Mi grúa</h1><p class='muted small'>Con estos datos Mekachi decide qué solicitudes asignarte.</p><form class='card' data-form='g-perfil'>" +
      field("gp-nombre", "Nombre del servicio o empresa", "required", g.nombre) +
      '<div class="row">' + field("gp-contacto", "Persona de contacto", "", g.contacto || p.nombre) + field("gp-tel", "Teléfono", TEL + " required", g.telefono || p.telefono) + "</div>" +
      '<div class="row">' + field("gp-wa", "WhatsApp para avisos", TEL, g.whatsapp) + '<div class="field"><label for="gp-zona">Zona principal</label><select id="gp-zona">' + opts(CFG.zonas, g.zona) + "</select></div></div>" +
      '<div class="row">' + field("gp-tarifa", "Tarifa base $", 'type="number" min="1" step="0.5" required', g.tarifa_base) + field("gp-min", "Minutos habituales de llegada", 'type="number" min="5" step="5" required', g.minutos_estimados || 30) + "</div>" +
      '<div class="field"><label>Vehículos que puedes llevar</label><div class="checks">' + ["Auto", "SUV", "Camioneta", "Moto"].map(function (e) { return '<label><input type="checkbox" name="esp" value="' + e + '"' + ((g.tipos || ["Auto"]).indexOf(e) >= 0 ? " checked" : "") + "> " + e + "</label>"; }).join("") + "</div></div>" +
      '<button class="btn primary block">Guardar</button></form>';
  }
  function viewDProveedores() {
    return "<h1>Proveedores de grúa</h1><p class='muted small'>Solo los verificados y disponibles reciben solicitudes.</p>" + (state.dProv.length ? state.dProv.map(function (x) {
      return '<div class="card"><div class="head"><div><h2>' + esc(x.nombre) + '</h2><div class="muted small">' + esc(x.zona) + " · " + esc((x.tipos || []).join(", ")) + " · tarifa " + usd(x.tarifa_base) + " · " + x.minutos_estimados + " min<br>" + esc([x.contacto, x.telefono || x.whatsapp].filter(Boolean).join(" · ")) + "</div></div><span>" + (x.es_demo ? chip("Demo") + " " : "") + chip(x.verificado ? (x.activo ? "Verificado" : "En pausa") : "Por verificar") + "</span></div>" +
        (x.es_demo ? "" : '<div class="actions"><button class="btn sm ' + (x.verificado ? "" : "primary") + '" data-verifgrua="' + x.id + '" data-v="' + (x.verificado ? "0" : "1") + '">' + (x.verificado ? "Quitar verificación" : "Verificar proveedor") + "</button></div>") + "</div>";
    }).join("") : "<div class='empty'>Todavía no hay proveedores de grúa.</div>");
  }
  statusCls["En pausa"] = "";

  // ---------- Reparto: bodegas, repartidores y entregas
  function viewDBodegas() {
    return "<h1>Bodegas</h1><p class='muted small'>Cada pedido sale de una bodega. Al confirmar se elige sola la más cercana al taller, para que la ruta sea corta y la entrega rápida.</p>" + state.dBod.map(function (b) {
      var uds = state.dInv.reduce(function (n, x) { return n + (x.sb[b.id] || 0); }, 0);
      return '<div class="card"><div class="head"><div><h2>' + esc(b.nombre) + '</h2><div class="muted small">' + esc(b.zona) + " · " + esc(b.direccion) + "<br>" + uds + " unidades · " + count(state.dRep, function (r) { return r.bodega_id === b.id; }) + " repartidores</div></div><span>" + (b.es_demo ? chip("Demo") + " " : "") + chip(b.activa ? "Activa" : "Cerrada") + "</span></div>" +
        '<div class="actions"><button class="btn sm" data-bodact="' + b.id + '" data-v="' + (b.activa ? "0" : "1") + '">' + (b.activa ? "Cerrar bodega" : "Reabrir bodega") + "</button></div></div>";
    }).join("") +
      '<form class="card" data-form="bodega"><h2>Nueva bodega</h2><div class="row">' + field("b-nombre", "Nombre", 'required placeholder="Bodega sur"', "") + '<div class="field"><label for="b-zona">Zona</label><select id="b-zona">' + opts(CFG.zonas) + "</select></div></div>" + field("b-dir", "Dirección", "required", "") + '<button class="btn primary">Crear bodega</button></form>';
  }
  statusCls.Activa = "ok"; statusCls.Cerrada = ""; statusCls.Listo = "info"; statusCls.Urgente = "warn";
  function viewDRepartidores() {
    return "<h1>Repartidores</h1><p class='muted small'>Solo los verificados ven pedidos. Asígnale a cada uno su bodega.</p>" + (state.dRep.length ? state.dRep.map(function (r) {
      return '<div class="card"><div class="head"><div><h2>' + esc(r.nombre) + '</h2><div class="muted small">' + esc(r.vehiculo) + " " + esc(r.placa) + (r.telefono ? " · " + esc(r.telefono) : "") + " · " + esc(r.bodega_id ? bodNombre(r.bodega_id) : "sin bodega") + "</div></div><span>" + (r.es_demo ? chip("Demo") + " " : "") + chip(r.verificado ? (r.activo ? "Verificado" : "En pausa") : "Por verificar") + "</span></div>" +
        '<form class="inline" data-form="rep-bodega" data-id="' + r.id + '">' + bodSelect("", r.bodega_id) + '<button class="btn sm">Asignar bodega</button>' + (r.es_demo ? "" : '<button type="button" class="btn sm ' + (r.verificado ? "" : "primary") + '" data-verifrep="' + r.id + '" data-v="' + (r.verificado ? "0" : "1") + '">' + (r.verificado ? "Quitar verificación" : "Verificar") + "</button>") + "</form></div>";
    }).join("") : "<div class='empty'>Todavía no hay repartidores registrados.</div>");
  }
  // Orden de paradas: primero las urgentes; dentro de cada grupo, la más cercana a la anterior y luego
  // se prueban inversiones de tramos (2-opt) para acortar el recorrido. Las que no tienen ubicación van al final.
  function ordenarRuta(origen, pedidos) {
    var pt = function (o) { var t = o.taller || {}; return t.lat != null ? { lat: t.lat, lng: t.lng } : null; };
    var largo = function (r) { var d = 0, a = origen; r.forEach(function (o) { if (a) d += dist(a, pt(o)); a = pt(o); }); return d; };
    var optimo = function (lista, desde) {
      var falta = lista.slice(), r = [], a = desde;
      while (falta.length) {
        var k = 0, mejor = Infinity;
        falta.forEach(function (o, i) { var d = a ? dist(a, pt(o)) : 0; if (d < mejor) { mejor = d; k = i; } });
        a = pt(falta[k]); r.push(falta.splice(k, 1)[0]);
      }
      var medir = function (x) { var d = 0, q = desde; x.forEach(function (o) { if (q) d += dist(q, pt(o)); q = pt(o); }); return d; };
      for (var mejora = true, vueltas = 0; mejora && vueltas < 20; vueltas++) {
        mejora = false;
        for (var i = 0; i < r.length - 1; i++) for (var j = i + 1; j < r.length; j++) {
          var alt = r.slice(0, i).concat(r.slice(i, j + 1).reverse(), r.slice(j + 1));
          if (medir(alt) + 1e-9 < medir(r)) { r = alt; mejora = true; }
        }
      }
      return r;
    };
    var con = pedidos.filter(pt), sin = pedidos.filter(function (o) { return !pt(o); });
    var urg = optimo(con.filter(function (o) { return o.tipo_entrega === "Urgente"; }), origen);
    var resto = optimo(con.filter(function (o) { return o.tipo_entrega !== "Urgente"; }), urg.length ? pt(urg[urg.length - 1]) : origen);
    var ruta = urg.concat(resto);
    return { paradas: ruta.concat(sin), km: origen && ruta.length ? largo(ruta) : 0, sinUbicacion: sin.length, ruta: ruta };
  }
  function enlaceRuta(origen, ruta) {
    if (!ruta.length) return "";
    var p = function (o) { return o.taller.lat + "," + o.taller.lng; }, fin = ruta[ruta.length - 1], medio = ruta.slice(0, -1).slice(0, 9);
    return "https://www.google.com/maps/dir/?api=1&travelmode=driving" + (origen ? "&origin=" + origen.lat + "," + origen.lng : "") + "&destination=" + p(fin) + (medio.length ? "&waypoints=" + encodeURIComponent(medio.map(p).join("|")) : "");
  }
  function viewREntregas() {
    var r = state.miRep, mias = state.rPed.filter(function (o) { return o.estado === "En camino" && o.repartidor_id === r.id; }), listos = state.rPed.filter(function (o) { return o.estado === "Listo"; }),
      dev = state.rPed.filter(function (o) { return o.devolucion_estado === "Solicitada"; }), hechas = count(state.rPed, function (o) { return o.estado === "Entregado" && o.repartidor_id === r.id; });
    var destino = function (o) { var t = o.taller || {}; return '<p class="small"><b>' + esc(t.nombre) + "</b><br>" + esc(o.direccion || t.direccion) + " · " + esc(o.zona || t.zona) + (t.lat != null ? ' · <a target="_blank" rel="noopener" href="https://maps.google.com/?q=' + t.lat + "," + t.lng + '">Abrir en el mapa</a>' : "") + (t.telefono || t.whatsapp ? ' · <a target="_blank" rel="noopener" href="https://wa.me/' + esc(waNum(t.whatsapp || t.telefono)) + '">WhatsApp</a>' : "") + "</p>"; };
    var piezas = function (o) { return '<ul class="lines">' + (o.items || []).map(function (l) { return "<li><span>" + l.cantidad + " × " + esc(l.nombre) + ' <span class="muted">· ' + esc(l.detalle) + "</span></span></li>"; }).join("") + "</ul>"; };
    var bod = (mias[0] || listos[0] || {}).bodega || {}, origen = state.pos || (bod.lat != null ? { lat: bod.lat, lng: bod.lng } : null);
    var plan = ordenarRuta(origen, mias); mias = plan.paradas;
    var planL = ordenarRuta(bod.lat != null ? { lat: bod.lat, lng: bod.lng } : null, listos); listos = planL.paradas;
    var rutaHtml = plan.ruta.length ? '<div class="card"><h2>Ruta sugerida</h2><p class="small">' + plan.ruta.length + (plan.ruta.length === 1 ? " parada" : " paradas") + " · " + plan.km.toFixed(1).replace(".", ",") + " km en línea recta desde " + (state.pos ? "tu ubicación" : "la bodega") + (plan.ruta.some(function (o) { return o.tipo_entrega === "Urgente"; }) ? " · las urgentes van primero" : "") + (plan.sinUbicacion ? " · " + plan.sinUbicacion + " sin ubicación, al final" : "") + '.</p><div class="actions"><a class="btn sm primary" target="_blank" rel="noopener" href="' + esc(enlaceRuta(origen, plan.ruta)) + '">Abrir la ruta en Google Maps</a><button class="btn sm" data-ubicar="1">' + (state.pos ? "Actualizar mi ubicación" : "Ordenar desde mi ubicación") + "</button></div></div>" : "";
    if (!r.verificado) return "<h1>Entregas</h1><div class='notice'>Tu registro está completo. Verás los pedidos cuando Mekachi verifique tu cuenta.</div>";
    return "<h1>Entregas</h1><p class='muted small'>" + esc(r.nombre) + " · " + esc(r.bodega ? r.bodega.nombre : "sin bodega asignada") + " · " + hechas + " entregadas en las últimas 24 horas</p>" +
      '<div class="section-title">En camino (' + mias.length + ")</div>" + rutaHtml + (mias.length ? mias.map(function (o, n) {
        return '<div class="card"><div class="head"><h2>Parada ' + (n + 1) + " · " + esc(o.num) + "</h2>" + (o.tipo_entrega === "Urgente" ? chip("Urgente") : chip("En camino")) + "</div>" + destino(o) + piezas(o) + (o.nota ? '<p class="muted small">Nota: ' + esc(o.nota) + "</p>" : "") +
          '<form class="inline" data-form="entregar" data-id="' + o.id + '"><input name="codigo" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required placeholder="Código" aria-label="Código de entrega" data-msg="Son 4 dígitos; te los da el taller"><button class="btn sm primary">Confirmar entrega</button></form></div>';
      }).join("") : '<p class="muted small">No llevas pedidos en este momento.</p>') +
      '<div class="section-title">Listos para recoger (' + listos.length + ")</div>" + (listos.length > 1 ? '<div class="actions" style="margin-bottom:10px"><button class="btn sm primary" data-tomartodos="1">Recoger los ' + listos.length + " pedidos</button></div>" : "") + (listos.length ? listos.map(function (o) {
        return '<div class="card"><div class="head"><h2>' + esc(o.num) + "</h2>" + (o.tipo_entrega === "Urgente" ? chip("Urgente") : chip("Listo")) + '</div><p class="small"><b>Recoger en:</b> ' + esc(o.bodega ? o.bodega.nombre + " · " + o.bodega.direccion : "bodega por asignar") + "</p>" + destino(o) + piezas(o) +
          '<div class="actions"><button class="btn sm primary" data-tomar="' + o.id + '">Recoger en bodega</button></div></div>';
      }).join("") : '<p class="muted small">No hay pedidos listos.</p>') +
      (dev.length ? '<div class="section-title">Devoluciones por recoger (' + dev.length + ")</div>" + dev.map(function (o) {
        return '<div class="card"><div class="head"><h2>' + esc(o.num) + "</h2>" + chip("Devolución") + "</div>" + destino(o) + '<p class="small">Motivo: ' + esc(o.devolucion_motivo || "sin detalle") + "</p>" + piezas(o) + '<div class="actions"><button class="btn sm primary" data-recogerdev="' + o.id + '">Marcar recogida</button></div></div>';
      }).join("") : "");
  }
  statusCls["Devolución"] = "warn";
  function viewRPerfil() {
    var r = state.miRep || {}, p = state.perfil || {};
    return "<h1>Mi perfil</h1>" + (r.verificado ? '<div class="card"><div class="head"><div><h2>' + (r.activo ? "Estás disponible" : "Estás en pausa") + '</h2><p class="muted small" style="margin:0">' + (r.activo ? "Ves los pedidos listos para recoger." : "No verás pedidos nuevos hasta activarte.") + '</p></div><button class="btn sm ' + (r.activo ? "" : "primary") + '" data-rdisp="' + (r.activo ? "0" : "1") + '">' + (r.activo ? "Pausar" : "Activarme") + "</button></div></div>" : (r.id ? '<div class="notice">Mekachi todavía no verifica tu cuenta.</div>' : "")) +
      "<form class='card' data-form='r-perfil'><div class='row'>" + field("rp-nombre", "Tu nombre", "required", r.nombre || p.nombre) + field("rp-tel", "Teléfono", TEL + " required", r.telefono || p.telefono) + "</div>" +
      '<div class="row"><div class="field"><label for="rp-veh">Vehículo</label><select id="rp-veh">' + opts(["Moto", "Auto", "Camioneta"], r.vehiculo) + "</select></div>" + field("rp-placa", "Placa", 'required style="text-transform:uppercase"', r.placa) + "</div>" +
      '<button class="btn primary block">Guardar</button></form>';
  }

  // ---------- Red: talleres y servicios
  function viewDRed() {
    return '<div class="chips"><button data-rsub="talleres" aria-pressed="' + (state.rsub === "talleres") + '">Talleres</button><button data-rsub="servicios" aria-pressed="' + (state.rsub === "servicios") + '">Servicios</button><button data-rsub="bodegas" aria-pressed="' + (state.rsub === "bodegas") + '">Bodegas</button><button data-rsub="reparto" aria-pressed="' + (state.rsub === "reparto") + '">Repartidores' + (count(state.dRep, function (x) { return !x.verificado; }) ? " · " + count(state.dRep, function (x) { return !x.verificado; }) : "") + '</button><button data-rsub="gruas" aria-pressed="' + (state.rsub === "gruas") + '">Grúas' + (count(state.dProv, function (x) { return !x.verificado; }) ? " · " + count(state.dProv, function (x) { return !x.verificado; }) : "") + "</button></div>" +
      (state.rsub === "servicios" ? viewDServicios() : state.rsub === "gruas" ? viewDProveedores() : state.rsub === "bodegas" ? viewDBodegas() : state.rsub === "reparto" ? viewDRepartidores() : viewDTalleres());
  }

  // ---------- Clientes: seguimiento de quienes usan la app y de quienes escriben por WhatsApp
  var ETAPAS = ["Nuevo", "En conversación", "Con solicitud", "Atendido", "Inactivo", "No contactar"];
  statusCls["En conversación"] = "info"; statusCls["Con solicitud"] = "warn"; statusCls.Atendido = "ok"; statusCls.Inactivo = ""; statusCls["No contactar"] = ""; statusCls.Taller = "info"; statusCls.Conductor = "";
  var hoyIso = function () { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  var porSeguir = function (c) { return c.proximo_contacto && c.proximo_contacto <= hoyIso() && c.etapa !== "No contactar"; };
  var canales = function (c) { return [c.en_app || /^u:/.test(c.k) ? "App" : "", c.en_whatsapp ? "WhatsApp" : ""].filter(Boolean).join(" y ") || "Sin canal"; };
  var CFILTROS = [["todos", "Todos", function () { return true; }], ["seguir", "Seguimiento hoy", porSeguir], ["conductor", "Conductores", function (c) { return c.tipo === "conductor"; }],
    ["taller", "Talleres", function (c) { return c.tipo === "taller"; }], ["wa", "Solo WhatsApp", function (c) { return c.en_whatsapp && !c.en_app; }], ["inactivo", "Inactivos", function (c) { return c.etapa === "Inactivo"; }]];
  function clientesFiltrados() {
    var f = CFILTROS.filter(function (x) { return x[0] === state.cfil; })[0][2], q = norm(state.cq.trim());
    return state.dClientes.filter(function (c) { return f(c) && (!q || norm(c.nombre + " " + (c.contacto || "") + " " + c.telefono + " " + (c.email || "")).indexOf(q) >= 0); });
  }
  function resumenCliente(c) {
    var r = [];
    if (c.pedidos) r.push(c.pedidos + (c.pedidos === 1 ? " pedido" : " pedidos") + " · " + usd(c.total_pedidos));
    if (c.solicitudes) r.push(c.solicitudes + (c.solicitudes === 1 ? " solicitud" : " solicitudes"));
    if (c.citas) r.push(c.citas + (c.citas === 1 ? " cita" : " citas"));
    if (c.gruas) r.push(c.gruas + (c.gruas === 1 ? " grúa" : " grúas"));
    if (c.mensajes) r.push(c.mensajes + " mensajes");
    return r.join(" · ") || "Sin actividad todavía";
  }
  function clientesListHtml() {
    var list = clientesFiltrados();
    if (!list.length) return "<div class='empty'>" + (state.loading ? "Cargando…" : "No hay clientes con ese filtro.") + "</div>";
    return list.map(function (c) {
      return '<button class="sint" data-cli="' + esc(c.k) + '"><span><b>' + esc(c.nombre) + (c.demo ? " (demo)" : "") + "</b><small>" + (c.tipo === "taller" ? "Taller" : "Conductor") + " · " + canales(c) + " · " + esc(resumenCliente(c)) +
        (c.ultima ? "<br>Última actividad: " + fecha(c.ultima) : "") + (c.proximo_contacto ? " · Próximo contacto: " + esc(c.proximo_contacto) : "") + "</small></span>" + chip(c.etapa) + "</button>";
    }).join("");
  }
  function viewDClientes() {
    var all = state.dClientes, c = state.dcli ? all.filter(function (x) { return x.k === state.dcli; })[0] : null;
    if (c) return viewCliente(c);
    var semana = new Date(Date.now() - 7 * 864e5).toISOString();
    var k = function (v, l) { return '<div class="kpi"><b>' + v + "</b><span>" + l + "</span></div>"; };
    return "<h1>Clientes</h1><p class='muted small'>Conductores y talleres, lleguen por la app o por WhatsApp. Una ficha por teléfono.</p>" +
      '<div class="kpis">' + k(all.length, "Clientes") + k(count(all, function (x) { return x.alta && x.alta > semana; }), "Nuevos esta semana") +
      k(count(all, function (x) { return x.en_whatsapp; }), "Por WhatsApp") + k(count(all, function (x) { return x.en_app; }), "En la app") + k(count(all, porSeguir), "Seguimiento hoy") + "</div>" +
      '<input type="search" id="cq" placeholder="Buscar por nombre, teléfono o correo" value="' + esc(state.cq) + '" aria-label="Buscar cliente">' +
      '<div class="chips">' + CFILTROS.map(function (x) { var n = count(all, x[2]); return '<button data-cfil="' + x[0] + '" aria-pressed="' + (state.cfil === x[0]) + '">' + x[1] + " · " + n + "</button>"; }).join("") + "</div>" +
      '<div class="list" id="clist">' + clientesListHtml() + "</div>" +
      (all.length ? '<div class="actions" style="margin-top:14px"><button class="btn sm" data-csv="1">Descargar lista (CSV)</button></div>' : "");
  }
  function viewCliente(c) {
    var d = state.dCliDet || { eventos: [], vehiculos: [] }, tel = waNum(c.telefono);
    return '<button class="back" data-cli="">← Todos los clientes</button><h1>' + esc(c.nombre) + " " + chip(c.tipo === "taller" ? "Taller" : "Conductor") + " " + chip(c.etapa) + "</h1>" +
      '<p class="muted small">' + [c.contacto, c.telefono, c.email, canales(c), c.zona, c.demo ? "taller de demostración" : ""].filter(Boolean).map(esc).join(" · ") + "</p>" +
      '<div class="kpis">' + [[c.pedidos, "Pedidos"], [usd(c.total_pedidos), "Compras"], [c.solicitudes, "Solicitudes"], [c.citas, "Citas"], [c.gruas, "Grúas"], [c.mensajes, "Mensajes"]].filter(function (x) { return x[0] && x[0] !== "$0,00"; }).map(function (x) { return '<div class="kpi"><b>' + x[0] + "</b><span>" + x[1] + "</span></div>"; }).join("") + "</div>" +
      '<div class="actions" style="margin-bottom:12px">' + (tel ? '<a class="btn sm primary" target="_blank" rel="noopener" href="https://wa.me/' + esc(tel) + '">Escribir por WhatsApp</a>' : "") +
      (c.conversacion_id ? '<button class="btn sm" data-abrirconv="' + c.conversacion_id + '">Ver conversación con el asistente</button>' : "") + "</div>" +
      '<form class="card" data-form="seguimiento"><h2>Seguimiento</h2><div class="row"><div class="field"><label for="sg-etapa">Etapa</label><select id="sg-etapa"><option value="">Automática</option>' +
      ETAPAS.map(function (e) { return "<option" + (c.etapa_manual === e ? " selected" : "") + ">" + e + "</option>"; }).join("") + "</select></div>" +
      field("sg-prox", "Próximo contacto", 'type="date"', c.proximo_contacto || "") + "</div>" +
      '<div class="field"><label for="sg-notas">Notas internas</label><textarea id="sg-notas" rows="3" placeholder="Qué se habló, qué quedó pendiente…">' + esc(c.notas) + "</textarea></div>" +
      '<button class="btn primary">Guardar seguimiento</button></form>' +
      (d.vehiculos.length ? '<div class="card"><h2>Vehículos</h2><ul class="lines">' + d.vehiculos.map(function (v) { return "<li><span>" + esc(v.nombre) + '</span><span class="plate">' + esc(v.placa) + "</span></li>"; }).join("") + "</ul></div>" : "") +
      '<div class="section-title">Historial</div>' + (d.eventos.length ? '<div class="timeline">' + d.eventos.map(function (e) {
        return '<div class="tl"><small>' + fecha(e.fecha) + " · " + esc(e.tipo) + "</small>" + esc(e.texto) + "</div>";
      }).join("") + "</div>" : "<div class='empty'>" + (state.dCliDet ? "Sin actividad registrada." : "Cargando…") + "</div>");
  }
  async function abrirCliente(k) {
    state.dcli = k || null; state.dCliDet = null; render(); window.scrollTo(0, 0);
    if (!k) return;
    var r = await sb.rpc("mekachi_cliente_detalle", { p_clave: k });
    if (!r.error && state.dcli === k) { state.dCliDet = r.data; render(); }
  }
  function descargarCsv() {
    csvDescarga("mekachi-clientes", [["Nombre", "nombre"], ["Contacto", "contacto"], ["Tipo", "tipo"], ["Teléfono", "telefono"], ["Correo", "email"], ["En la app", "en_app"], ["En WhatsApp", "en_whatsapp"], ["Etapa", "etapa"], ["Pedidos", "pedidos"], ["Compras", "total_pedidos"], ["Solicitudes", "solicitudes"], ["Citas", "citas"], ["Grúas", "gruas"], ["Última actividad", "ultima"], ["Próximo contacto", "proximo_contacto"], ["Notas", "notas"]], clientesFiltrados());
  }
  function viewDTalleres() {
    // Primero los talleres reales; los de demostración van después, marcados.
    var reales = state.dTalleres.slice().sort(function (a, b) { return (a.es_demo - b.es_demo) || a.nombre.localeCompare(b.nombre); });
    return "<h1>Talleres</h1><p class='muted small'>Los talleres verificados aparecen en el mapa de los conductores.</p>" +
      (reales.length ? reales.map(function (t) {
        return '<div class="card"><div class="head"><div><h2>' + esc(t.nombre) + '</h2><div class="muted small">' + esc(t.sector) + " · " + esc(t.zona) + " · " + esc(t.direccion) + "<br>" + esc(t.contacto) + " · " + esc(t.telefono || t.whatsapp) + (t.lat == null ? " · sin ubicación" : "") + (t.horario ? "<br>" + esc(t.horario) : "") + (t.rating_total ? " · " + (t.rating_suma / t.rating_total).toFixed(1).replace(".", ",") + " ★ (" + t.rating_total + ")" : "") + "</div></div><span>" + (t.es_demo ? chip("Demo") + " " : "") + chip(t.verificado ? "Verificado" : "Por verificar") + "</span></div>" +
          '<div class="tags" style="margin-bottom:10px">' + (t.especialidades || []).map(function (e) { return "<span>" + esc(e) + "</span>"; }).join("") + "</div>" +
          (t.es_demo ? "" : '<div class="actions"><button class="btn sm ' + (t.verificado ? "" : "primary") + '" data-verif="' + t.id + '" data-v="' + (t.verificado ? "0" : "1") + '">' + (t.verificado ? "Quitar verificación" : "Verificar taller") + "</button></div>") + "</div>";
      }).join("") : "<div class='empty'>Todavía no hay talleres.</div>") +
      '<p class="muted small">' + count(state.dTalleres, function (t) { return !t.es_demo; }) + " talleres reales y " + count(state.dTalleres, function (t) { return t.es_demo; }) + " de demostración.</p>";
  }

  // =====================================================================
  var VIEW = { "c-inicio": viewCInicio, diag: viewDiag, talleres: viewTalleres, solicitar: viewSolicitar, solicitudes: viewSolicitudes, garaje: viewGaraje,
    "t-inicio": viewTInicio, trabajos: viewTrabajos, catalogo: viewCatalogo, carrito: viewCarrito, pedidos: viewPedidos, perfil: viewPerfil,
    "d-resumen": viewDResumen, "d-pedidos": viewDPedidos, "d-red": viewDRed, "d-inventario": viewDInventario, grua: viewGrua, "g-inicio": viewGInicio, "g-servicios": viewGServicios, "g-perfil": viewGPerfil, "r-entregas": viewREntregas, "r-perfil": viewRPerfil, "d-atencion": viewDAtencion, "d-clientes": viewDClientes, acceso: viewAcceso, cuenta: viewCuenta };
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
    if (a.rol === "grua" && state.user && !state.miGrua) dest = "g-perfil";
    if (a.rol === "repartidor" && state.user && !state.miRep) dest = "r-perfil";
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
    else if (d.go) { state.iprod = null; state.dcli = null; go(d.go); } // la pestaña siempre abre la lista, no la última ficha
    else if (d.acctab) { state.acc.tab = d.acctab; render(); }
    else if (d.logout) { await sb.auth.signOut(); state.solicitudes = []; state.trabajos = []; state.pedidos = []; state.historial = []; state.gSol = []; state.misGruas = []; await loadAuth(); state.garaje = store.get("garaje", []); toast("Sesión cerrada"); go(MODES[state.mode].tabs[0][0], true); }
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
    else if (d.tomartodos) {
      var ids = state.rPed.filter(function (o) { return o.estado === "Listo"; }).map(function (o) { return o.id; }), okn = 0;
      for (var qi = 0; qi < ids.length; qi++) if (await call(sb.rpc("mekachi_reparto_tomar", { p_pedido: ids[qi] }))) okn++;
      await reload(); toast(okn + (okn === 1 ? " pedido recogido." : " pedidos recogidos.") + " La ruta ya está ordenada.");
    }
    else if (d.tomar) await done(await call(sb.rpc("mekachi_reparto_tomar", { p_pedido: d.tomar })), "Pedido recogido. Va en camino.");
    else if (d.recogerdev) await done(await call(sb.rpc("mekachi_reparto_recoger_devolucion", { p_pedido: d.recogerdev })), "Devolución recogida. Entrégala en bodega.");
    else if (d.rdisp) await done(await call(sb.from("mekachi_repartidores").update({ activo: d.rdisp === "1" }).eq("id", state.miRep.id)), d.rdisp === "1" ? "Estás disponible." : "Quedaste en pausa.");
    else if (d.verifrep) await done(await call(sb.from("mekachi_repartidores").update({ verificado: d.v === "1", activo: d.v === "1" }).eq("id", d.verifrep)), d.v === "1" ? "Repartidor verificado." : "Verificación retirada.");
    else if (d.bodact) await done(await call(sb.from("mekachi_bodegas").update({ activa: d.v === "1" }).eq("id", d.bodact)), "Bodega actualizada.");
    else if (d.devolverPed) { var mot = window.prompt("¿Por qué devuelves el pedido? (pieza equivocada, defecto…)"); if (mot !== null) await done(await call(sb.rpc("mekachi_pedir_devolucion", { p_pedido: d.devolverPed, p_motivo: mot })), "Devolución solicitada. Un repartidor la recogerá."); }
    else if (d.gresp) { if (d.acc !== "rechazar" || window.confirm("¿Devolver esta solicitud a Mekachi para que la reasigne?")) await done(await call(sb.rpc("mekachi_grua_responder", { p_solicitud: d.gresp, p_accion: d.acc })), d.acc === "aceptar" ? "Solicitud aceptada. Buen viaje." : "Solicitud devuelta a Mekachi."); }
    else if (d.gdisp) await done(await call(sb.from("mekachi_gruas_proveedores").update({ activo: d.gdisp === "1" }).eq("id", state.miGrua.id)), d.gdisp === "1" ? "Estás disponible." : "Quedaste en pausa.");
    else if (d.verifgrua) await done(await call(sb.from("mekachi_gruas_proveedores").update({ verificado: d.v === "1", activo: d.v === "1" }).eq("id", d.verifgrua)), d.v === "1" ? "Proveedor verificado." : "Verificación retirada.");
    else if (d.isub) { state.isub = d.isub; state.oc = null; render(); }
    else if (d.ocsug) { state.oc = { proveedor: "", nota: "Reposición de mínimos", items: state.dInv.filter(function (x) { return x.activo && x.stock <= x.minimo; }).map(function (x) { return { id: x.id, cantidad: Math.max(x.minimo * 2 - x.stock, 1), costo: x.costo }; }) }; render(); }
    else if (d.ocnew) { state.oc = { proveedor: "", nota: "", items: [] }; render(); }
    else if (d.occancel) { state.oc = null; render(); }
    else if (d.ocdel) { syncOc(); state.oc.items = state.oc.items.filter(function (it) { return it.id !== d.ocdel; }); render(); }
    else if (d.ocadd) { syncOc(); var nx = byId(state.dInv, $("#oc-add").value); if (nx) state.oc.items.push({ id: nx.id, cantidad: Math.max(nx.minimo * 2 - nx.stock, 1), costo: nx.costo }); render(); }
    else if (d.ccat) { state.ccat = d.ccat; render(); }
    else if (d.recibir) { if (window.confirm("¿Recibir esta orden? La mercadería entra a bodega.")) await done(await call(sb.rpc("mekachi_compra_recibir", { p_compra: d.recibir })), "Mercadería recibida en bodega."); }
    else if (d.cancelaroc) await done(await call(sb.rpc("mekachi_compra_cancelar", { p_compra: d.cancelaroc })), "Orden cancelada.");
    else if (d.cancelarped) { if (window.confirm(d.sale ? "¿Cancelar el pedido? Sus repuestos vuelven a bodega." : "¿Cancelar este pedido?")) await done(await call(sb.rpc("mekachi_despacho_cancelar", { p_pedido: d.cancelarped })), d.sale ? "Pedido cancelado y mercadería devuelta a bodega." : "Pedido cancelado."); }
    else if (d.gruafin) { state.gruaOk = null; go("c-inicio"); }
    else if ("inv" in d) await abrirProducto(d.inv);
    else if (d.ifil) { state.ifil = d.ifil; render(); }
    else if (d.rsub) { state.rsub = d.rsub; render(); }
    else if (d.inuevo) { state.inuevo = !state.inuevo; render(); }
    else if (d.icsv) csvDescarga("mekachi-inventario", [["Código", "codigo"], ["Categoría", "cat"], ["Nombre", "nombre"], ["Compatibilidad", "compat"], ["Existencias", "stock"], ["Mínimo", "minimo"], ["Costo", "costo"], ["Precio", "precio"], ["Proveedor", "proveedor"], ["Ubicación", "ubicacion"], ["Activo", "activo"]], invFiltrado());
    else if ("cli" in d) await abrirCliente(d.cli);
    else if (d.cfil) { state.cfil = d.cfil; render(); }
    else if (d.csv) descargarCsv();
    else if (d.abrirconv) { state.dsub = "conv"; state.dconv = d.abrirconv; state.dMsgs = []; go("d-atencion"); await loadMsgs(); render(); }
    else if (d.dsub) { state.dsub = d.dsub; state.dconv = null; render(); }
    else if ("conv" in d) { state.dconv = d.conv || null; state.dMsgs = []; if (state.dconv) await loadMsgs(); render(); window.scrollTo(0, document.body.scrollHeight); }
    else if (d.devolver) await done(await call(sb.from("mekachi_wa_conversaciones").update({ requiere_humano: false, motivo_humano: "", humano_desde: null }).eq("id", d.devolver)), "El asistente vuelve a atender esta conversación.");
    else if (d.grua) await done(await call(sb.from("mekachi_gruas_solicitudes").update({ estado: d.e }).eq("id", d.grua)), "Grúa actualizada.");
    else if (d.cita) await done(await call(sb.rpc("mekachi_responder_cita", { p_cita: d.cita, p_accion: d.acc })), d.acc === "confirmar" ? "Cita confirmada. Se avisa al cliente por WhatsApp." : "Cita rechazada. Se avisa al cliente por WhatsApp.");
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
        if (state.view === "talleres" || state.view === "r-entregas") render();
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
    else if (e.target.id === "iq") { state.iq = e.target.value; $("#ilist").innerHTML = invListHtml(); }
    else if (e.target.id === "cq") { state.cq = e.target.value; $("#clist").innerHTML = clientesListHtml(); }
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
    else if (e.target.id === "modesel") setMode(e.target.value);
    else if (e.target.id === "p-tipo") {
      var tt2 = totals(cartLines()), rec = CFG.recargoUrgente * (1 + CFG.iva);
      $("#p-rec").textContent = e.target.value === "Urgente" ? "Con entrega urgente el total sube a " + usd(tt2.total + rec) + " (recargo " + usd(CFG.recargoUrgente) + " + IVA)." : "";
    }
    else if (e.target.id === "ibod") { state.ibod = e.target.value; aplicarBodega(); render(); }
    else if (e.target.id === "cbod") { state.cbod = e.target.value; render(); }
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
        if (a.rol === "repartidor") pend.repartidor = { nombre: v("r-nombre"), telefono: v("r-tel"), vehiculo: v("r-veh"), placa: v("r-placa").toUpperCase() };
        if (a.rol === "grua") {
          if (!checks().length) return toast("Elige al menos un tipo de vehículo.");
          pend.grua = { nombre: v("r-grua"), contacto: v("r-nombre"), telefono: v("r-tel"), whatsapp: v("r-tel"), zona: v("r-zona"), tipos: checks(), tarifa_base: +v("r-tarifa") || 0 };
        }
        if (a.rol === "taller") {
          if (!checks().length) return toast("Elige al menos una especialidad.");
          pend.taller = { nombre: v("r-taller"), contacto: v("r-nombre"), telefono: v("r-tel"), whatsapp: v("r-tel"), direccion: v("r-dir"), sector: v("r-sector"), zona: v("r-zona"), especialidades: checks() };
        }
        store.set("pending", pend);
        var r = await call(sb.auth.signUp({ email: v("a-email"), password: v("a-pass"), options: { emailRedirectTo: location.origin + location.pathname } }));
        if (!r) return;
        // Supabase no avisa con un error cuando el correo ya existe: devuelve un usuario sin identidades.
        if (r.user && r.user.identities && !r.user.identities.length) {
          state.acc.tab = "login"; state.acc.msg = "Ese correo ya tiene una cuenta. Entra con la contraseña que ya usas con ese correo, o regístrate con otro correo."; render(); window.scrollTo(0, 0);
          return;
        }
        if (r.session) await afterAuth();
        else { state.acc.tab = "login"; state.acc.msg = "Te enviamos un correo para confirmar tu cuenta. Ábrelo, confirma y luego inicia sesión aquí."; render(); }
      } else if (kind === "micuenta") {
        var p = await call(sb.rpc("mekachi_registrar", { p_rol: state.perfil && (state.perfil.rol === "taller" || state.perfil.rol === "grua" || state.perfil.rol === "repartidor") ? state.perfil.rol : "conductor", p_nombre: v("c-nombre"), p_telefono: v("c-tel") }));
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
      } else if (kind === "entregar") {
        await done(await call(sb.rpc("mekachi_reparto_entregar", { p_pedido: f.dataset.id, p_codigo: f.elements.codigo.value })), "Entrega confirmada.");
      } else if (kind === "asignar-ped") {
        await done(await call(sb.rpc("mekachi_despacho_asignar", { p_pedido: f.dataset.id, p_bodega: f.elements.bodega.value || null, p_repartidor: f.elements.rep.value || null })), "Pedido asignado.");
      } else if (kind === "rep-bodega") {
        await done(await call(sb.from("mekachi_repartidores").update({ bodega_id: f.elements.bodega.value }).eq("id", f.dataset.id)), "Bodega asignada.");
      } else if (kind === "bodega") {
        if (await done(await call(sb.from("mekachi_bodegas").insert({ nombre: v("b-nombre"), zona: v("b-zona"), direccion: v("b-dir") })), "Bodega creada.")) f.reset();
      } else if (kind === "inv-traslado") {
        if (await call(sb.rpc("mekachi_inventario_trasladar", { p_producto: state.iprod, p_origen: f.elements.de.value, p_destino: f.elements.a.value, p_cantidad: parseInt(v("tr-cant"), 10) }))) { await loadMode(); await abrirProducto(state.iprod); toast("Traslado registrado"); }
      } else if (kind === "r-perfil") {
        var rrow = { nombre: v("rp-nombre"), telefono: v("rp-tel"), vehiculo: v("rp-veh"), placa: v("rp-placa").toUpperCase() };
        var rsv = state.miRep ? await call(sb.from("mekachi_repartidores").update(rrow).eq("id", state.miRep.id).select().single()) : await call(sb.from("mekachi_repartidores").insert(Object.assign({ owner_id: state.user.id }, rrow)).select().single());
        if (rsv && rsv.id) { state.miRep = rsv; render(); toast("Datos guardados"); }
      } else if (kind === "grua-completar") {
        await done(await call(sb.rpc("mekachi_grua_responder", { p_solicitud: f.dataset.id, p_accion: "completar", p_precio: +f.elements.precio.value || null })), "Servicio completado.");
      } else if (kind === "asignar-grua") {
        var pr = byId(state.dProv, f.elements.prov.value);
        if (pr) await done(await call(sb.from("mekachi_gruas_solicitudes").update({ proveedor_id: pr.id, estado: "Asignada", estimado_min: pr.minutos_estimados, estimado_precio: pr.tarifa_base }).eq("id", f.dataset.id)), "Grúa asignada a " + pr.nombre + ".");
      } else if (kind === "g-perfil") {
        if (!checks().length) return toast("Elige al menos un tipo de vehículo.");
        var grow = { nombre: v("gp-nombre"), contacto: v("gp-contacto"), telefono: v("gp-tel"), whatsapp: v("gp-wa"), zona: v("gp-zona"), tarifa_base: +v("gp-tarifa") || 0, minutos_estimados: parseInt(v("gp-min"), 10) || 30, tipos: checks() };
        var gsv = state.miGrua
          ? await call(sb.from("mekachi_gruas_proveedores").update(grow).eq("id", state.miGrua.id).select().single())
          : await call(sb.from("mekachi_gruas_proveedores").insert(Object.assign({ owner_id: state.user.id }, grow)).select().single());
        if (gsv && gsv.id) { state.miGrua = gsv; render(); toast("Datos guardados"); }
      } else if (kind === "oc") {
        var bodActualOc = v("oc-bod") || bodActual();
        syncOc();
        if (!state.oc.items.length) return toast("Agrega al menos un repuesto.");
        var idoc = await call(sb.rpc("mekachi_compra_crear_b", { p_bodega: bodActualOc, p_proveedor: state.oc.proveedor, p_nota: state.oc.nota, p_items: state.oc.items.map(function (it) { return { producto_id: it.id, cantidad: it.cantidad, costo: it.costo }; }) }));
        if (idoc) { state.oc = null; await reload(); toast("Orden de compra creada"); }
      } else if (kind === "conteo") {
        var difs = $$("[data-conteo]").filter(function (el) { return el.value !== el.dataset.sis; }).map(function (el) { return { producto_id: el.dataset.conteo, contado: parseInt(el.value, 10) }; });
        if (!difs.length) return toast("No hay diferencias que ajustar.");
        var nn = await call(sb.rpc("mekachi_inventario_conteo_b", { p_items: difs, p_motivo: v("ct-motivo"), p_bodega: state.cbod }));
        if (nn !== null) { await loadMode(); await loadPublic(); render(); toast("Conteo guardado: " + difs.length + (difs.length === 1 ? " ajuste" : " ajustes")); }
      } else if (kind === "compra-pedido") {
        if (await call(sb.rpc("mekachi_inventario_mover_b", { p_bodega: f.dataset.bod || bodActual(), p_producto: f.dataset.pid, p_tipo: "Entrada", p_cantidad: parseInt(f.elements.cant.value, 10), p_costo: +f.elements.costo.value, p_motivo: "Compra para el pedido " + f.dataset.num }))) { await loadMode(); await loadPublic(); render(); toast("Compra registrada en bodega"); }
      } else if (kind === "grua") {
        var gr = await call(sb.rpc("mekachi_pedir_grua", { p_nombre: v("g-nombre"), p_telefono: v("g-tel"), p_ubicacion: v("g-ubi"), p_zona: v("g-zona"), p_tipo: v("g-tipo"), p_destino: v("g-dest"), p_lat: v("t-lat") ? +v("t-lat") : null, p_lng: v("t-lng") ? +v("t-lng") : null }));
        if (gr) { state.gruaOk = gr; await loadMode(); render(); window.scrollTo(0, 0); }
      } else if (kind === "inv-mover") {
        var mt = v("m-tipo");
        if (await call(sb.rpc("mekachi_inventario_mover_b", { p_bodega: bodForm(f), p_producto: state.iprod, p_tipo: mt, p_cantidad: parseInt(v("m-cant"), 10), p_costo: mt === "Entrada" && v("m-costo") ? +v("m-costo") : null, p_motivo: v("m-motivo") }))) { await loadMode(); await loadPublic(); await abrirProducto(state.iprod); toast("Movimiento registrado"); }
      } else if (kind === "inv-datos") {
        var okp = await call(sb.from("mekachi_productos").update({ precio: +v("d-precio"), activo: $("#d-activo").checked }).eq("id", state.iprod));
        var oki = okp && await call(sb.from("mekachi_inventario").upsert({ producto_id: state.iprod, stock_minimo: parseInt(v("d-min"), 10) || 0, costo: +v("d-costo"), proveedor: v("d-prov"), ubicacion: v("d-ubi") }, { onConflict: "producto_id" }));
        if (oki) { await loadMode(); await loadPublic(); render(); toast("Datos guardados"); }
      } else if (kind === "inv-nuevo") {
        var np = await call(sb.from("mekachi_productos").insert({ codigo: v("n-codigo"), categoria: v("n-cat"), nombre: v("n-nombre"), compatibilidad: v("n-compat"), precio: +v("n-precio") }).select().single());
        if (!np) return;
        await call(sb.from("mekachi_inventario").upsert({ producto_id: np.id, stock_minimo: parseInt(v("n-min"), 10) || 0, costo: +v("n-costo") }, { onConflict: "producto_id" }));
        if (parseInt(v("n-stock"), 10) > 0) await call(sb.rpc("mekachi_inventario_mover_b", { p_bodega: bodActual(), p_producto: np.id, p_tipo: "Entrada", p_cantidad: parseInt(v("n-stock"), 10), p_costo: +v("n-costo"), p_motivo: "Existencias iniciales" }));
        state.inuevo = false; await loadMode(); await loadPublic(); render(); toast("Repuesto creado");
      } else if (kind === "seguimiento") {
        if (await call(sb.rpc("mekachi_guardar_seguimiento", { p_clave: state.dcli, p_etapa: v("sg-etapa"), p_notas: v("sg-notas"), p_proximo: v("sg-prox") || null }))) { await loadMode(); render(); toast("Seguimiento guardado"); }
      } else if (kind === "wa-responder") {
        var ses = await sb.auth.getSession();
        var resp = await fetch(CFG.supabaseUrl + "/functions/v1/mekachi-whatsapp?accion=responder", { method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey, Authorization: "Bearer " + ses.data.session.access_token }, body: JSON.stringify({ conversacion_id: state.dconv, texto: v("wa-txt") }) });
        var out = await resp.json().catch(function () { return {}; });
        if (!resp.ok) return toast(out.error || "No se pudo enviar el mensaje.");
        await reload(); toast("Mensaje enviado por WhatsApp");
      } else if (kind === "pedido") {
        var items = state.cart.map(function (l) { return l.custom ? { nombre: l.nombre, detalle: l.detalle, cantidad: l.qty } : { producto_id: l.id, cantidad: l.qty }; });
        var ok = await call(sb.rpc("mekachi_crear_pedido_v2", { p_tipo: v("p-tipo") || "Ruta", p_items: items, p_pago: v("p-pago"), p_nota: v("p-nota"), p_direccion: v("p-dir"), p_zona: v("p-zona"), p_solicitud: state.sug ? state.sug.id : null }));
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
    var est = {}; state.pedidos.forEach(function (o) { est[o.id] = o.estado; });
    await loadMode();
    if (state.mode === "taller") state.pedidos.forEach(function (o) {
      if (est[o.id] && est[o.id] !== o.estado && o.estado === "En camino") toast("Tu pedido " + o.num + " ya salió de bodega" + (o.repartidor_nombre ? " con " + o.repartidor_nombre : "") + ".");
      else if (est[o.id] && est[o.id] !== o.estado && o.estado === "Listo") toast("Tu pedido " + o.num + " está alistado.");
    });
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
