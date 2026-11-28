// Uso: node generar.mjs ../guiones/como-pedir.json
// Convierte un guion JSON (el que exporta la Oficina) en una composición de HyperFrames (index.html).
// Después: npx hyperframes check   y   npx hyperframes render -o out/video.mp4
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const ruta = resolve(process.argv[2] || resolve(aqui, "../guiones/como-pedir.json"));
const g = JSON.parse(readFileSync(ruta, "utf8"));
const W = g.ancho || 1080, H = g.alto || 1920, historia = H > W;
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
mkdirSync(resolve(aqui, "assets"), { recursive: true });

// Las fotos se copian a assets/ para que la composición no dependa de rutas externas.
const foto = (src) => {
  if (!src) return "";
  const origen = resolve(aqui, "../..", src), nombre = basename(src);
  if (!existsSync(origen)) return "";
  copyFileSync(origen, resolve(aqui, "assets", nombre));
  return "assets/" + nombre;
};
// El titular pinta de ámbar su tramo final, igual que en las imágenes de la app.
const titular = (t) => { const p = String(t).split(" "), c = Math.max(1, Math.ceil(p.length * 0.6)); return esc(p.slice(0, c).join(" ")) + " <em>" + esc(p.slice(c).join(" ")) + "</em>"; };

let t = 0;
const escenas = g.escenas.map((e, i) => { const x = { ...e, i, desde: t, img: foto(e.foto) }; t += e.segundos; return x; });
const total = t;
const logo = (px) => `<span class="logo" style="font-size:${px}px"><svg viewBox="0 0 32 32"><path d="M16 2l12.1 7v14L16 30 3.9 23V9z" fill="#ffb81c"/><path d="M10 16.5l4.2 4.2L22.5 12" fill="none" stroke="#0b2540" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Mekachi</span>`;

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face { font-family: "Barlow"; font-weight: 500; src: url("assets/barlow-500.woff2") format("woff2"); }
      @font-face { font-family: "Barlow"; font-weight: 700; src: url("assets/barlow-700.woff2") format("woff2"); }
      @font-face { font-family: "Barlow Semi Condensed"; font-weight: 700; src: url("assets/barlow-semi-condensed-700.woff2") format("woff2"); }
      :root { --navy: #0b2540; --navy2: #123a63; --amber: #ffb81c; --soft: #a9bdd6; --head: "Barlow Semi Condensed", Barlow, sans-serif; --body: Barlow, sans-serif; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: var(--navy); }
      #root { position: relative; width: 100%; height: 100%; font-family: var(--body); color: #fff; }
      .clip { position: absolute; inset: 0; }
      .fondo { position: absolute; inset: 0; background: linear-gradient(155deg, var(--navy) 55%, var(--navy2)); overflow: hidden; }
      .fondo::after { content: ""; position: absolute; right: -210px; top: -170px; width: 660px; height: 660px; border-radius: 50%; background: rgba(255,184,28,.10); }
      .fondo.foto::after { display: none; }
      .fondo img { width: 100%; height: 100%; object-fit: cover; }
      .velo { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11,37,64,.8) 0%, rgba(11,37,64,.1) 30%, rgba(11,37,64,.96) 100%); }
      .credito { position: absolute; right: 40px; bottom: 26px; font: 500 22px var(--body); color: rgba(255,255,255,.6); }
      .texto { position: absolute; left: 80px; right: 80px; bottom: ${historia ? 250 : 120}px; }
      h2 { font: 700 124px/1.06 var(--head); }
      h2 em, h1 em { font-style: normal; color: var(--amber); }
      .texto p { font: 500 50px/1.3 var(--body); color: #e6edf7; margin-top: 34px; }
      .barra { width: 120px; height: 10px; background: var(--amber); margin-top: 44px; transform-origin: left center; }
      .cierre { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 60px; padding: 80px; text-align: center; }
      h1 { font: 700 112px/1.06 var(--head); }
      .cierre p { font: 500 44px/1.3 var(--body); color: var(--soft); }
      .logo { display: inline-flex; align-items: center; gap: .2em; font-family: var(--head); font-weight: 700; color: #fff; line-height: 1; }
      .logo svg { width: 1.6em; height: 1.6em; }
      #avance { display: flex; gap: 12px; }
      #avance div { flex: 1; height: 8px; background: rgba(255,255,255,.3); }
      #avance i { display: block; width: 100%; height: 100%; background: var(--amber); transform-origin: left center; transform: scaleX(0); }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}" data-fps="${g.fps || 30}">
${escenas.map((e) => e.cierre
  ? `      <section id="e${e.i}" class="clip" data-start="${e.desde}" data-duration="${e.segundos}" data-track-index="0"><div class="fondo"></div><div class="clip cierre"><div id="e${e.i}-logo">${logo(124)}</div><h1 id="e${e.i}-t">${titular(e.titular)}</h1><p id="e${e.i}-p">${esc(e.texto)}</p></div></section>`
  : `      <section id="e${e.i}" class="clip" data-start="${e.desde}" data-duration="${e.segundos}" data-track-index="0"><div class="fondo${e.img ? " foto" : ""}">${e.img ? `<img id="e${e.i}-img" src="${e.img}" alt="" />` : ""}</div>${e.img ? '<div class="velo"></div>' + (e.credito ? `<div class="credito">Foto: ${esc(e.credito)}</div>` : "") : ""}<div class="texto" id="e${e.i}-x"><h2>${titular(e.titular)}</h2>${e.texto ? `<p>${esc(e.texto)}</p>` : ""}<div class="barra" id="e${e.i}-b"></div></div></section>`).join("\n")}
      <div id="marca" class="clip" style="inset:90px auto auto 80px" data-start="0" data-duration="${total}" data-track-index="1">${logo(62)}</div>
      <div id="avance" class="clip" style="inset:44px 80px auto 80px" data-start="0" data-duration="${total}" data-track-index="2">${escenas.map((e) => `<div><i id="a${e.i}"></i></div>`).join("")}</div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
${escenas.map((e) => e.cierre
  ? `      tl.fromTo("#e${e.i}-logo", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.7, ease: "power3.out" }, ${e.desde});
      tl.fromTo("#e${e.i}-t", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${e.desde + 0.15});
      tl.fromTo("#e${e.i}-p", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, ${e.desde + 0.4});
      tl.fromTo("#a${e.i}", { scaleX: 0 }, { scaleX: 1, duration: ${e.segundos}, ease: "none" }, ${e.desde});`
  : `      tl.fromTo("#e${e.i}-x", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${e.desde});
      tl.fromTo("#e${e.i}-b", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.out" }, ${e.desde});
      tl.to("#e${e.i}-x", { opacity: 0, duration: 0.35, ease: "power2.in" }, ${+(e.desde + e.segundos - 0.35).toFixed(3)});
      tl.fromTo("#a${e.i}", { scaleX: 0 }, { scaleX: 1, duration: ${e.segundos}, ease: "none" }, ${e.desde});${e.img ? `
      tl.fromTo("#e${e.i}-img", { scale: 1.04 }, { scale: 1.12, duration: ${e.segundos}, ease: "none" }, ${e.desde});` : ""}`).join("\n")}
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
writeFileSync(resolve(aqui, "index.html"), html);
console.log("Composición lista: " + escenas.length + " escenas, " + total + " s, " + W + "×" + H);
