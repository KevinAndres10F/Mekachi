// Uso: npm run render -- ../guiones/como-pedir.json [salida.mp4]
// Convierte un guion JSON (el que exporta la Oficina) en un MP4 con Remotion.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";

const guion = resolve(process.argv[2] || "../guiones/como-pedir.json");
if (!existsSync(guion)) { console.error("No existe el guion: " + guion); process.exit(1); }
mkdirSync("out", { recursive: true });
const salida = resolve(process.argv[3] || "out/" + basename(guion, ".json") + ".mp4");
const args = ["remotion", "render", "src/index.jsx", "Guion", salida, "--props=" + guion, "--public-dir=../../fotos", "--codec=h264"];
// En servidores sin el navegador de Remotion se puede indicar uno propio.
if (process.env.REMOTION_CHROME) args.push("--browser-executable=" + process.env.REMOTION_CHROME, "--chrome-mode=chrome-for-testing");
const r = spawnSync("npx", args, { stdio: "inherit" });
process.exit(r.status ?? 1);
