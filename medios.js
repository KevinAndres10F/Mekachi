/* Mekachi · generador de imágenes y videos de marca.
   Dibuja en un canvas las plantillas que eligen los agentes de la Oficina.
   Un diseño es un objeto simple:
     imagen: { plantilla, formato, foto, titular, texto, etiqueta, precio, autor, cuadros: [{ titular, texto, foto }] }
     video:  { formato, escenas: [{ titular, texto, foto, segundos }], cierre }
   El mismo guion de video sirve para Remotion y HyperFrames (carpeta /video). */
(function () {
  "use strict";
  var C = { navy: "#0b2540", navy2: "#123a63", blue: "#1560d4", amber: "#ffb81c", bg: "#f2f5f9", ink: "#0f1b2a", muted: "#55637a", soft: "#a9bdd6", line: "#dce3ec" };
  var HEAD = '"Barlow Semi Condensed", Barlow, system-ui, sans-serif', BODY = "Barlow, system-ui, sans-serif";
  var FORMATOS = { cuadrado: [1080, 1080], vertical: [1080, 1350], historia: [1080, 1920] };
  var PLANTILLAS = ["titular", "foto", "oferta", "consejo", "testimonio", "carrusel"];
  var LEMA = "Mecánicas de confianza. Repuestos garantizados.";
  var fotos = {}, cache = {};

  function registrar(lista) { fotos = {}; (lista || []).forEach(function (f) { fotos[f.id] = f; }); }
  function cargar(id) {
    var f = fotos[id];
    if (!f) return Promise.resolve(null);
    if (cache[id]) return cache[id];
    cache[id] = new Promise(function (ok) { var im = new Image(); im.crossOrigin = "anonymous"; im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = f.src; });
    return cache[id];
  }
  function fuentes() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['700 80px "Barlow Semi Condensed"', "500 40px Barlow", "700 40px Barlow"].map(function (f) { return document.fonts.load(f).catch(function () {}); }));
  }

  // ---------- utilidades de dibujo
  function lineas(x, texto, ancho) {
    var out = [];
    String(texto || "").split(/\n/).forEach(function (par) {
      var l = "";
      par.split(/\s+/).forEach(function (w) { if (!w) return; var p = l ? l + " " + w : w; if (l && x.measureText(p).width > ancho) { out.push(l); l = w; } else l = p; });
      if (l) out.push(l);
    });
    return out;
  }
  // Escribe un bloque que cabe en ancho × alto bajando el tamaño si hace falta. Devuelve el alto usado.
  function bloque(x, texto, o) {
    var size = o.size, ls;
    for (;;) { x.font = (o.peso || 700) + " " + size + "px " + (o.fuente || HEAD); ls = lineas(x, texto, o.ancho); if (ls.length * size * (o.lh || 1.1) <= (o.alto || 1e9) || size <= (o.min || 34)) break; size -= 4; }
    var lh = size * (o.lh || 1.1), y = o.y + (o.base === "bottom" ? -(ls.length - 1) * lh : 0);
    x.textBaseline = o.base === "bottom" ? "alphabetic" : "top"; x.textAlign = o.align || "left";
    ls.forEach(function (l, i) { x.fillStyle = o.ultimo && i === ls.length - 1 && ls.length > 1 ? o.ultimo : o.color; x.fillText(l, o.x, y + i * lh); });
    return ls.length * lh;
  }
  function fondoNavy(x, W, H) {
    var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, C.navy); g.addColorStop(1, C.navy2); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(255,184,28,.10)"; x.beginPath(); x.arc(W - 120, 160, 330, 0, 7); x.fill();
  }
  function cubrir(x, im, dx, dy, dw, dh, zoom, px, py) {
    var z = zoom || 1, s = Math.max(dw / im.width, dh / im.height) * z, w = im.width * s, h = im.height * s;
    x.save(); x.beginPath(); x.rect(dx, dy, dw, dh); x.clip();
    x.drawImage(im, dx + (dw - w) * (px == null ? 0.5 : px), dy + (dh - h) * (py == null ? 0.5 : py), w, h); x.restore();
  }
  function velo(x, W, y0, y1, a0, a1) { var g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "rgba(11,37,64," + a0 + ")"); g.addColorStop(1, "rgba(11,37,64," + a1 + ")"); x.fillStyle = g; x.fillRect(0, y0, W, y1 - y0); }
  function logo(x, px, py, esc, color) {
    x.save(); x.translate(px, py); x.scale(esc, esc);
    x.fillStyle = C.amber; x.fill(new Path2D("M16 2l12.1 7v14L16 30 3.9 23V9z"));
    x.strokeStyle = C.navy; x.lineWidth = 3.4; x.lineCap = "round"; x.lineJoin = "round"; x.stroke(new Path2D("M10 16.5l4.2 4.2L22.5 12")); x.restore();
    x.fillStyle = color || "#fff"; x.font = "700 " + Math.round(esc * 19) + "px " + HEAD; x.textBaseline = "middle"; x.textAlign = "left"; x.fillText("Mekachi", px + esc * 38, py + esc * 16.5);
  }
  function pie(x, W, H, claro, texto) {
    x.fillStyle = C.amber; x.fillRect(90, H - 170, 120, 10);
    x.fillStyle = claro ? C.muted : C.soft; x.font = "500 38px " + BODY; x.textBaseline = "middle"; x.textAlign = "left"; x.fillText(texto || LEMA, 90, H - 105);
  }
  function chip(x, texto, px, py) {
    x.font = "700 34px " + BODY; var w = x.measureText(texto).width + 56;
    x.fillStyle = C.amber; x.beginPath(); x.roundRect(px, py, w, 64, 32); x.fill();
    x.fillStyle = C.navy; x.textBaseline = "middle"; x.textAlign = "left"; x.fillText(texto, px + 28, py + 34);
    return w;
  }
  function credito(x, W, H, id) {
    var f = fotos[id]; if (!f || !f.credito) return;
    x.font = "500 22px " + BODY; x.fillStyle = "rgba(255,255,255,.55)"; x.textAlign = "right"; x.textBaseline = "alphabetic"; x.fillText("Foto: " + f.credito, W - 40, H - 30); x.textAlign = "left";
  }

  // ---------- plantillas de imagen (una función por plantilla; im = foto ya cargada o null)
  var P = {
    titular: function (x, W, H, d) {
      fondoNavy(x, W, H); logo(x, 90, 90, 3.4);
      bloque(x, d.titular, { x: 90, y: H * 0.36, ancho: W - 180, alto: H * 0.36, size: 136, color: "#fff", ultimo: C.amber });
      if (d.texto) bloque(x, d.texto, { x: 90, y: H * 0.74, ancho: W - 180, alto: H * 0.1, size: 42, min: 30, peso: 500, fuente: BODY, color: C.soft, lh: 1.3 });
      pie(x, W, H);
    },
    foto: function (x, W, H, d, im) {
      if (!im) return P.titular(x, W, H, d);
      cubrir(x, im, 0, 0, W, H); velo(x, W, 0, H * 0.3, 0.75, 0); velo(x, W, H * 0.35, H, 0, 0.96);
      logo(x, 90, 90, 3.4);
      var y = H - 230;
      if (d.texto) { var h2 = bloque(x, d.texto, { x: 90, y: y, ancho: W - 180, alto: 170, size: 44, min: 32, peso: 500, fuente: BODY, color: "#e6edf7", lh: 1.3, base: "bottom" }); y -= h2 + 30; }
      bloque(x, d.titular, { x: 90, y: y, ancho: W - 180, alto: H * 0.34, size: 116, color: "#fff", ultimo: C.amber, base: "bottom" });
      x.fillStyle = C.amber; x.fillRect(90, H - 150, 120, 10);
      x.fillStyle = C.soft; x.font = "500 34px " + BODY; x.textBaseline = "middle"; x.fillText(LEMA, 90, H - 92);
      credito(x, W, H, d.foto);
    },
    oferta: function (x, W, H, d, im) {
      var top = im ? Math.round(H * 0.3) : 0, fin = H - 215;
      fondoNavy(x, W, H);
      if (im) { cubrir(x, im, 0, 0, W, top); velo(x, W, top - 200, top, 0, 1); velo(x, W, 0, 240, 0.7, 0); }
      logo(x, 90, 90, 3.4);
      var y = top + (im ? 26 : H * 0.24);
      chip(x, d.etiqueta || "Repuesto de la semana", 90, y); y += 96;
      y += bloque(x, d.titular, { x: 90, y: y, ancho: W - 180, alto: H * 0.19, size: im ? 92 : 104, color: "#fff" }) + 10;
      if (d.texto) y += bloque(x, d.texto, { x: 90, y: y, ancho: W - 180, alto: 110, size: 40, min: 30, peso: 500, fuente: BODY, color: C.soft, lh: 1.3 }) + 14;
      if (d.precio) {
        var ps = Math.max(90, Math.min(170, fin - y));
        x.font = "700 " + ps + "px " + HEAD; x.fillStyle = C.amber; x.textBaseline = "top"; x.textAlign = "left"; x.fillText(d.precio, 90, y);
        var pw = x.measureText(d.precio).width; x.font = "600 44px " + BODY; x.fillStyle = "#fff"; x.fillText("+ IVA", 90 + pw + 24, y + ps * 0.55);
      }
      pie(x, W, H, false, "Entrega en tu taller · Quito");
      if (im) credito(x, W, H, d.foto);
    },
    consejo: function (x, W, H, d) {
      x.fillStyle = C.bg; x.fillRect(0, 0, W, H);
      x.fillStyle = C.navy; x.fillRect(0, 0, W, 26);
      x.fillStyle = C.blue; x.font = "700 36px " + BODY; x.textBaseline = "top"; x.textAlign = "left";
      x.fillText((d.etiqueta || "Consejo Mekachi").toUpperCase().split("").join(" "), 90, 130);
      var y = 220; y += bloque(x, d.titular, { x: 90, y: y, ancho: W - 180, alto: H * 0.34, size: 112, color: C.navy }) + 40;
      x.fillStyle = C.amber; x.fillRect(90, y, 120, 10); y += 56;
      if (d.texto) bloque(x, d.texto, { x: 90, y: y, ancho: W - 180, alto: H - y - 240, size: 50, min: 34, peso: 500, fuente: BODY, color: C.muted, lh: 1.35 });
      logo(x, 90, H - 170, 3.0, C.navy);
    },
    testimonio: function (x, W, H, d, im) {
      fondoNavy(x, W, H); logo(x, 90, 90, 3.4);
      x.fillStyle = C.amber; x.font = "700 300px " + HEAD; x.textBaseline = "top"; x.fillText("“", 70, H * 0.2);
      var y = H * 0.2 + 230; y += bloque(x, d.titular, { x: 90, y: y, ancho: W - 180, alto: H * 0.3, size: 84, min: 44, color: "#fff", lh: 1.16 }) + 44; y = Math.min(y, H - 340);
      if (im) { x.save(); x.beginPath(); x.arc(150, y + 60, 60, 0, 7); x.clip(); cubrir(x, im, 90, y, 120, 120); x.restore(); }
      x.fillStyle = "#fff"; x.font = "700 46px " + BODY; x.textBaseline = "top"; x.fillText(d.autor || "", im ? 240 : 90, y + 10);
      if (d.texto) { x.fillStyle = C.soft; x.font = "500 38px " + BODY; x.fillText(d.texto, im ? 240 : 90, y + 68); }
      pie(x, W, H);
    }
  };
  // Carrusel: portada, cuadros numerados y cierre.
  function cuadroCarrusel(x, W, H, d, i, im) {
    var cs = d.cuadros || [], c = cs[i] || {}, n = cs.length;
    if (i === 0) P[im ? "foto" : "titular"](x, W, H, { titular: c.titular, texto: c.texto, foto: c.foto });
    else if (i === n - 1) {
      fondoNavy(x, W, H); logo(x, 90, 90, 3.4);
      var y = H * 0.36; y += bloque(x, c.titular, { x: 90, y: y, ancho: W - 180, alto: H * 0.32, size: 124, color: "#fff", ultimo: C.amber }) + 30;
      if (c.texto) bloque(x, c.texto, { x: 90, y: y, ancho: W - 180, alto: 220, size: 48, min: 34, peso: 500, fuente: BODY, color: C.soft, lh: 1.3 });
      pie(x, W, H);
    } else {
      x.fillStyle = C.bg; x.fillRect(0, 0, W, H); x.fillStyle = C.navy; x.fillRect(0, 0, W, 26);
      x.fillStyle = C.navy; x.beginPath(); x.roundRect(90, 120, 130, 130, 30); x.fill();
      x.fillStyle = C.amber; x.font = "700 92px " + HEAD; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(String(i), 155, 190); x.textAlign = "left";
      var y2 = 320; y2 += bloque(x, c.titular, { x: 90, y: y2, ancho: W - 180, alto: H * 0.3, size: 104, color: C.navy }) + 36;
      if (c.texto) bloque(x, c.texto, { x: 90, y: y2, ancho: W - 180, alto: H - y2 - 250, size: 50, min: 34, peso: 500, fuente: BODY, color: C.muted, lh: 1.35 });
      logo(x, 90, H - 170, 3.0, C.navy);
    }
    // puntos de página y aviso de deslizar
    var claro = i > 0 && i < n - 1, px = W - 90 - (n - 1) * 34;
    for (var k = 0; k < n; k++) { x.fillStyle = k === i ? C.amber : (claro ? C.line : "rgba(255,255,255,.35)"); x.beginPath(); x.arc(px + k * 34, H - 52, k === i ? 11 : 8, 0, 7); x.fill(); }
    if (i < n - 1) { x.fillStyle = claro ? C.muted : "#fff"; x.font = "600 32px " + BODY; x.textAlign = "right"; x.textBaseline = "middle"; x.fillText("Desliza →", W - 90, i === 0 ? 146 : 186); x.textAlign = "left"; }
  }

  function normalizar(p) {
    var d = Object.assign({}, p.diseno || {});
    if (PLANTILLAS.indexOf(d.plantilla) < 0) d.plantilla = d.foto ? "foto" : "titular";
    if (!FORMATOS[d.formato]) d.formato = "cuadrado";
    d.titular = d.titular || p.titular || p.titulo || "";
    if (d.plantilla === "carrusel" && !(d.cuadros && d.cuadros.length >= 2)) d.plantilla = "titular";
    return d;
  }
  function cuantos(p) { var d = normalizar(p); return d.plantilla === "carrusel" ? d.cuadros.length : 1; }
  // Devuelve un canvas con el cuadro i de la pieza.
  async function imagen(p, i) {
    var d = normalizar(p), f = FORMATOS[d.formato], c = document.createElement("canvas"); c.width = f[0]; c.height = f[1];
    var x = c.getContext("2d"); await fuentes();
    if (d.plantilla === "carrusel") cuadroCarrusel(x, f[0], f[1], d, i || 0, await cargar((d.cuadros[i || 0] || {}).foto));
    else P[d.plantilla](x, f[0], f[1], d, await cargar(d.foto));
    return c;
  }
  function bajar(blob, nombre) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 8000); }
  async function descargarImagenes(p) {
    var n = cuantos(p), base = "mekachi-" + String(p.red || "post").toLowerCase() + "-" + String(p.id || "x").slice(0, 6);
    for (var i = 0; i < n; i++) {
      var c = await imagen(p, i), b = await new Promise(function (ok) { c.toBlob(ok, "image/png"); });
      bajar(b, base + (n > 1 ? "-" + (i + 1) : "") + ".png");
      if (n > 1) await new Promise(function (ok) { setTimeout(ok, 450); });
    }
    return n;
  }

  // ---------- video: mismo guion que usan Remotion y HyperFrames
  var ease = function (t) { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); };
  function guion(p) {
    var d = p.diseno || {}, es = (d.escenas || []).filter(function (e) { return e && (e.titular || e.texto); }).slice(0, 10).map(function (e) { return { titular: e.titular || "", texto: e.texto || "", foto: e.foto || "", credito: e.foto && fotos[e.foto] ? fotos[e.foto].credito || "" : "", segundos: Math.max(2, Math.min(8, +e.segundos || 3.5)) }; });
    if (!es.length) es = [{ titular: p.titular || p.titulo || "Mekachi", texto: "", foto: "", segundos: 3.5 }];
    es.push({ cierre: true, titular: d.cierre || "Súmate a Mekachi", texto: LEMA, foto: "", segundos: 3.5 });
    var t = 0; es.forEach(function (e) { e.desde = t; t += e.segundos; });
    return { formato: FORMATOS[d.formato] && d.formato !== "vertical" ? d.formato : "historia", escenas: es, total: t };
  }
  // Dibuja el instante t (segundos) del guion g en un canvas de W × H. ims = fotos por índice de escena.
  function cuadroVideo(x, W, H, g, ims, t) {
    var k = W / 1080, i = g.escenas.length - 1;
    for (var j = 0; j < g.escenas.length; j++) if (t < g.escenas[j].desde + g.escenas[j].segundos) { i = j; break; }
    var e = g.escenas[i], lt = t - e.desde, im = ims[i], aIn = ease(lt / 0.6), aOut = e.cierre ? 1 : 1 - ease((lt - (e.segundos - 0.35)) / 0.35), a = aIn * aOut;
    x.save(); x.scale(k, k); var w = 1080, h = H / k;
    if (im) { cubrir(x, im, 0, 0, w, h, 1.04 + 0.08 * (lt / e.segundos)); velo(x, w, 0, h * 0.3, 0.8, 0.1); velo(x, w, h * 0.3, h, 0.1, 0.96); }
    else fondoNavy(x, w, h);
    logo(x, 80, 90, 3.2);
    x.globalAlpha = a;
    if (e.cierre) {
      var s = 5 + 1.2 * ease(lt / 0.8); logo(x, w / 2 - s * 62, h * 0.3, s);
      x.textAlign = "center"; bloque(x, e.titular, { x: w / 2, y: h * 0.47, ancho: w - 160, alto: h * 0.22, size: 112, color: "#fff", ultimo: C.amber, align: "center" });
      bloque(x, e.texto, { x: w / 2, y: h * 0.74, ancho: w - 160, size: 44, peso: 500, fuente: BODY, color: C.soft, lh: 1.3, align: "center" }); x.textAlign = "left";
    } else {
      var dy = (1 - aIn) * 60, y = h - (g.formato === "historia" ? 330 : 190) + dy;
      if (e.texto) { var hh = bloque(x, e.texto, { x: 80, y: y, ancho: w - 160, alto: 260, size: 50, min: 36, peso: 500, fuente: BODY, color: "#e6edf7", lh: 1.3, base: "bottom" }); y -= hh + 34; }
      bloque(x, e.titular, { x: 80, y: y, ancho: w - 160, alto: h * 0.32, size: 124, color: "#fff", ultimo: C.amber, base: "bottom" });
      x.fillStyle = C.amber; x.fillRect(80, h - (g.formato === "historia" ? 250 : 120) + dy, 120 * aIn, 10);
    }
    x.globalAlpha = 1;
    if (im && e.credito) { x.font = "500 22px " + BODY; x.fillStyle = "rgba(255,255,255,.6)"; x.textAlign = "right"; x.textBaseline = "alphabetic"; x.fillText("Foto: " + e.credito, w - 40, h - 30); x.textAlign = "left"; }
    // barra de avance por escena
    var n = g.escenas.length, bw = (w - 160 - (n - 1) * 12) / n;
    for (var q = 0; q < n; q++) { x.fillStyle = "rgba(255,255,255,.3)"; x.fillRect(80 + q * (bw + 12), 44, bw, 8); if (q <= i) { x.fillStyle = C.amber; x.fillRect(80 + q * (bw + 12), 44, q < i ? bw : bw * Math.min(1, lt / e.segundos), 8); } }
    x.restore();
  }
  async function prepararVideo(p) {
    var g = guion(p); await fuentes();
    var ims = await Promise.all(g.escenas.map(function (e) { return cargar(e.foto); }));
    return { g: g, ims: ims };
  }
  // Reproduce el video en un canvas visible. Devuelve una función para detenerlo.
  async function reproducir(p, canvas) {
    var v = await prepararVideo(p), f = FORMATOS[v.g.formato]; canvas.width = f[0] / 2; canvas.height = f[1] / 2;
    var x = canvas.getContext("2d"), t0 = performance.now(), vivo = true;
    (function paso() { if (!vivo || !canvas.isConnected) return; var t = ((performance.now() - t0) / 1000) % (v.g.total + 0.6); cuadroVideo(x, canvas.width, canvas.height, v.g, v.ims, Math.min(t, v.g.total - 0.01)); requestAnimationFrame(paso); })();
    return function () { vivo = false; };
  }
  function formatoGrabacion() {
    if (!window.MediaRecorder) return null;
    var op = [["video/mp4;codecs=avc1.42E01E", "mp4"], ["video/mp4", "mp4"], ["video/webm;codecs=vp9", "webm"], ["video/webm", "webm"]];
    for (var i = 0; i < op.length; i++) if (MediaRecorder.isTypeSupported(op[i][0])) return op[i];
    return null;
  }
  // Graba el video en tiempo real y lo descarga. avance(0..1) informa el progreso.
  async function descargarVideo(p, avance) {
    var fmt = formatoGrabacion(); if (!fmt) throw new Error("Este navegador no puede grabar video. Usa Chrome, Edge o Safari recientes.");
    var v = await prepararVideo(p), f = FORMATOS[v.g.formato], c = document.createElement("canvas"); c.width = f[0] * 2 / 3; c.height = f[1] * 2 / 3;
    var x = c.getContext("2d"); cuadroVideo(x, c.width, c.height, v.g, v.ims, 0);
    var rec = new MediaRecorder(c.captureStream(30), { mimeType: fmt[0], videoBitsPerSecond: 6e6 }), partes = [];
    rec.ondataavailable = function (e) { if (e.data && e.data.size) partes.push(e.data); };
    var fin = new Promise(function (ok) { rec.onstop = ok; });
    rec.start(250);
    await new Promise(function (ok) {
      var t0 = performance.now();
      (function paso() { var t = (performance.now() - t0) / 1000; cuadroVideo(x, c.width, c.height, v.g, v.ims, Math.min(t, v.g.total - 0.01)); if (avance) avance(Math.min(1, t / v.g.total)); if (t < v.g.total) requestAnimationFrame(paso); else ok(); })();
    });
    rec.stop(); await fin;
    var blob = new Blob(partes, { type: fmt[0].split(";")[0] });
    bajar(blob, "mekachi-video-" + String(p.id || "x").slice(0, 6) + "." + fmt[1]);
    return { segundos: v.g.total, tipo: fmt[1], bytes: blob.size };
  }
  // Guion en el formato que leen los proyectos de /video (Remotion y HyperFrames).
  function exportarGuion(p) {
    var g = guion(p);
    return { titulo: p.titulo || "", formato: g.formato, ancho: FORMATOS[g.formato][0], alto: FORMATOS[g.formato][1], fps: 30,
      escenas: g.escenas.map(function (e) { return { titular: e.titular, texto: e.texto, foto: e.foto && fotos[e.foto] ? fotos[e.foto].src : "", credito: e.credito || "", segundos: e.segundos, cierre: !!e.cierre }; }) };
  }

  window.MekachiMedios = { registrar: registrar, fotos: function () { return fotos; }, FORMATOS: FORMATOS, PLANTILLAS: PLANTILLAS, normalizar: normalizar, cuantos: cuantos, imagen: imagen, descargarImagenes: descargarImagenes, guion: guion, reproducir: reproducir, descargarVideo: descargarVideo, exportarGuion: exportarGuion, bajar: bajar };
})();
