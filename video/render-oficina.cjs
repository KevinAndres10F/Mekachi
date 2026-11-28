// Renderiza las piezas de la Oficina fuera de la app: imágenes en PNG y videos en MP4 con Remotion.
// Uso: node video/render-oficina.cjs piezas.json carpeta-de-salida
// piezas.json = { piezas: [{ id, tipo, titulo, titular, red, fecha, diseno }], fotos: [{ id, src, credito }] }
// Las imágenes se dibujan con el mismo medios.js de la app, así que salen idénticas.
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");
const { spawnSync } = require("child_process");

const raiz = path.resolve(__dirname, ".."), entrada = process.argv[2], salida = path.resolve(process.argv[3] || "salida");
if (!entrada || !fs.existsSync(entrada)) { console.error("Falta el archivo de piezas"); process.exit(1); }
const datos = JSON.parse(fs.readFileSync(entrada, "utf8"));
fs.mkdirSync(salida, { recursive: true });
const tipos = { ".js": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".html": "text/html; charset=utf-8" };
const nombre = (p) => (p.fecha || "sin-fecha") + " " + String(p.titulo || p.id).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).toLowerCase();

// Página en blanco del mismo origen, con la tipografía de marca, para que fotos y fuentes carguen.
const A = "/video/hyperframes/assets/";
const LIENZO = `<!doctype html><html><head><meta charset="utf-8"><style>@font-face{font-family:"Barlow";font-weight:500;src:url(${A}barlow-500.woff2)}@font-face{font-family:"Barlow";font-weight:700;src:url(${A}barlow-700.woff2)}@font-face{font-family:"Barlow Semi Condensed";font-weight:700;src:url(${A}barlow-semi-condensed-700.woff2)}</style></head><body></body></html>`;

(async () => {
  const srv = http.createServer((q, r) => {
    if (q.url === "/__lienzo") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(LIENZO); }
    const f = path.join(raiz, decodeURIComponent(q.url.split("?")[0]));
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" }); r.end(d); } });
  }).listen(0);
  const base = "http://localhost:" + srv.address().port;
  const b = await chromium.launch(), pg = await b.newPage();
  await pg.goto(base + "/__lienzo");
  await pg.addScriptTag({ url: base + "/medios.js" });
  await pg.evaluate((fotos) => window.MekachiMedios.registrar(fotos.map((f) => Object.assign({}, f, { src: "/" + f.src }))), datos.fotos || []);
  const faltan = await pg.evaluate(async (fotos) => { const r = []; for (const f of fotos) { const ok = await new Promise((y) => { const i = new Image(); i.onload = () => y(true); i.onerror = () => y(false); i.src = "/" + f.src; }); if (!ok) r.push(f.id); } await document.fonts.load('700 80px "Barlow Semi Condensed"'); if (!document.fonts.check('700 80px "Barlow Semi Condensed"')) r.push("tipografía Barlow"); return r; }, datos.fotos || []);
  if (faltan.length) { console.error("No cargaron: " + faltan.join(", ")); process.exit(1); }
  const hechos = [];
  for (const p of datos.piezas) {
    const n = nombre(p);
    if (p.tipo === "Video") {
      const g = await pg.evaluate((p) => window.MekachiMedios.exportarGuion(p), p);
      g.escenas.forEach((e) => { e.foto = e.foto.replace(/^\//, ""); });
      const gj = path.join(salida, n + ".guion.json"), crudo = path.join(salida, n + ".crudo.mp4"), mp4 = path.join(salida, n + ".mp4");
      fs.writeFileSync(gj, JSON.stringify(g, null, 2));
      const r = spawnSync("node", ["render.mjs", gj, crudo], { cwd: path.join(raiz, "video/remotion"), stdio: ["ignore", "ignore", "inherit"], env: process.env });
      if (r.status !== 0) { console.error("No se pudo renderizar " + p.titulo); continue; }
      // Remotion deja un archivo pesado; se recodifica para redes sin perder resolución.
      spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", crudo, "-c:v", "libx264", "-crf", "23", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
      fs.rmSync(crudo, { force: true }); fs.rmSync(gj, { force: true });
      hechos.push({ id: p.id, archivos: [mp4] });
    } else {
      const total = await pg.evaluate((p) => window.MekachiMedios.cuantos(p), p), archivos = [];
      for (let i = 0; i < total; i++) {
        const url = await pg.evaluate(async ({ p, i }) => (await window.MekachiMedios.imagen(p, i)).toDataURL("image/png"), { p, i });
        const f = path.join(salida, n + (total > 1 ? "-" + (i + 1) : "") + ".png");
        fs.writeFileSync(f, Buffer.from(url.split(",")[1], "base64")); archivos.push(f);
      }
      hechos.push({ id: p.id, archivos });
    }
    console.log("✓ " + p.tipo + ": " + p.titulo);
  }
  fs.writeFileSync(path.join(salida, "resultado.json"), JSON.stringify(hechos, null, 2));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
