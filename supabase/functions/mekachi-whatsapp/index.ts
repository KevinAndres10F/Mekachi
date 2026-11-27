// Mekachi · asistente de WhatsApp con IA.
// Recibe los mensajes de la API de WhatsApp Business (Meta), responde con Claude
// y consulta talleres y repuestos reales en la base de datos.
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY    clave de la API de Claude
//   WA_TOKEN             token de acceso de la API de WhatsApp Business
//   WA_PHONE_NUMBER_ID   identificador del número de WhatsApp de Mekachi
//   WA_APP_SECRET        secreto de la app de Meta (valida la firma de cada mensaje)
//   WA_VERIFY_TOKEN      texto que eliges tú y repites al registrar el webhook en Meta
// Opcionales: MEKACHI_APP_URL (enlace a la app), WA_GRAPH_VERSION (por defecto v23.0)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { betaTool } from "npm:@anthropic-ai/sdk/helpers/beta/json-schema";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const CONFIGURADO = ["ANTHROPIC_API_KEY", "WA_TOKEN", "WA_PHONE_NUMBER_ID", "WA_APP_SECRET", "WA_VERIFY_TOKEN"].every((k) => env(k));
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const digitos = (t: string) => (t || "").replace(/\D/g, "");
const mismoTelefono = (a: string, b: string) => digitos(a).length >= 9 && digitos(a).slice(-9) === digitos(b).slice(-9);

const SISTEMA = `Eres el asistente de Mekachi en WhatsApp. Mekachi conecta a conductores de Quito, Ecuador, con talleres mecánicos verificados y lleva a los talleres los repuestos que necesitan.

Con quién hablas: conductores que tienen un problema con su auto y talleres que quieren pedir repuestos. Al final de estas instrucciones se indica si el número que escribe pertenece a un taller registrado.

Cómo ayudas:
- A un conductor: pregunta lo necesario para entender el síntoma (qué pasa, cuándo, marca, modelo y año) y da una orientación inicial: causas probables, qué tan urgente es y qué tipo de taller necesita. Luego busca talleres con la herramienta y recomienda uno o dos.
- A un taller: busca los repuestos con la herramienta, confirma la lista y las cantidades con la persona y, solo cuando diga que sí, registra el pedido.

Reglas que no se rompen:
- Tu orientación es inicial. El diagnóstico definitivo lo hace el mecánico al revisar el auto; dilo cuando des causas probables.
- Nunca inventes talleres, repuestos ni precios. Los talleres y los precios de repuestos salen solo de las herramientas. No des precios de mano de obra: eso lo cotiza cada taller en la app.
- Si el síntoma compromete la seguridad (frenos que fallan, temperatura muy alta, luz de aceite o de batería encendida en marcha, olor a combustible, humo), di con claridad que no conduzca y sugiere grúa o mecánico a domicilio.
- Si la persona pide hablar con alguien, está molesta, reclama por un pedido o un cobro, o no puedes resolver lo que necesita, usa la herramienta para pasar la conversación a una persona del equipo y avísale que le escribirán.
- Si escriben sobre algo ajeno a autos, talleres o repuestos, explica con amabilidad en qué sí puedes ayudar.

Estilo: es WhatsApp. Escribe en español de Ecuador, cercano y breve, en texto simple y sin formato Markdown. Una idea por mensaje y, como máximo, una pregunta a la vez.`;

type Contexto = { telefono: string; conversacion: string; taller: { id: string; nombre: string; direccion: string; zona: string } | null };

function herramientas(ctx: Contexto) {
  // deno-lint-ignore no-explicit-any
  const lista: any[] = [
    betaTool({
      name: "buscar_talleres",
      description: "Busca talleres verificados de la red Mekachi en Quito. Úsala antes de recomendar cualquier taller. Devuelve nombre, sector, zona, especialidades, horario, WhatsApp y calificación.",
      inputSchema: {
        type: "object",
        properties: {
          especialidad: { type: "string", enum: ["Frenos", "Motor", "Eléctrico", "Suspensión", "Transmisión", "Aire acondicionado", "Mantenimiento"], description: "Tipo de trabajo que necesita el auto." },
          zona: { type: "string", enum: ["Norte", "Centro norte", "Sur", "Valles y periferia"], description: "Zona de Quito donde está el conductor, si la dijo." },
        },
        additionalProperties: false,
      },
      run: async (i: { especialidad?: string; zona?: string }) => {
        let q = db.from("mekachi_talleres").select("nombre,sector,zona,especialidades,horario,whatsapp,rating_suma,rating_total").eq("activo", true).eq("verificado", true).eq("es_demo", false);
        if (i.especialidad) q = q.contains("especialidades", [i.especialidad]);
        if (i.zona) q = q.eq("zona", i.zona);
        const { data, error } = await q.limit(6);
        if (error) return "No se pudo consultar la red de talleres en este momento.";
        if (!data.length) return "No hay talleres verificados con ese filtro todavía. Sugiere ampliar la zona o usar la app para ver el mapa.";
        return JSON.stringify(data.map((t) => ({ nombre: t.nombre, sector: t.sector, zona: t.zona, especialidades: t.especialidades, horario: t.horario, whatsapp: t.whatsapp, calificacion: t.rating_total ? (t.rating_suma / t.rating_total).toFixed(1) + " de 5 (" + t.rating_total + ")" : "sin calificaciones" })));
      },
    }),
    betaTool({
      name: "buscar_repuestos",
      description: "Busca repuestos en el catálogo de Mekachi por nombre o vehículo. Devuelve código, nombre, compatibilidad y precio sin IVA. Úsala antes de mencionar cualquier repuesto o precio.",
      inputSchema: { type: "object", properties: { texto: { type: "string", description: "Una o dos palabras clave, por ejemplo: pastillas Sail, filtro aceite, batería." } }, required: ["texto"], additionalProperties: false },
      run: async (i: { texto: string }) => {
        const palabras = String(i.texto).toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 3);
        let q = db.from("mekachi_productos").select("codigo,nombre,compatibilidad,precio").eq("activo", true);
        for (const w of palabras) q = q.or(`nombre.ilike.%${w.replace(/[%,()]/g, "")}%,compatibilidad.ilike.%${w.replace(/[%,()]/g, "")}%`);
        const { data, error } = await q.limit(8);
        if (error) return "No se pudo consultar el catálogo en este momento.";
        if (!data.length) return "No está en el catálogo. Un taller registrado puede pedirlo igual como pieza por cotizar.";
        return JSON.stringify(data);
      },
    }),
    betaTool({
      name: "pasar_a_persona",
      description: "Marca la conversación para que la atienda una persona del equipo de Mekachi. Úsala cuando lo pidan, haya un reclamo o no puedas resolver la necesidad.",
      inputSchema: { type: "object", properties: { motivo: { type: "string", description: "Resumen breve de lo que necesita la persona." } }, required: ["motivo"], additionalProperties: false },
      run: async (i: { motivo: string }) => {
        await db.from("mekachi_wa_conversaciones").update({ requiere_humano: true, motivo_humano: String(i.motivo).slice(0, 300) }).eq("id", ctx.conversacion);
        return "Listo: el equipo de Mekachi verá esta conversación. Avisa a la persona que le escribirán pronto.";
      },
    }),
  ];
  if (ctx.taller) {
    const taller = ctx.taller;
    lista.push(betaTool({
      name: "registrar_pedido",
      description: "Registra un pedido de repuestos para el taller que escribe. Llámala solo después de que la persona confirme la lista completa y las cantidades. Usa el código del catálogo cuando exista; para piezas fuera de catálogo envía nombre y vehículo, y despacho las cotiza.",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array", minItems: 1,
            items: {
              type: "object",
              properties: {
                codigo: { type: "string", description: "Código del catálogo devuelto por buscar_repuestos." },
                nombre: { type: "string", description: "Nombre de la pieza, solo si no está en el catálogo." },
                vehiculo: { type: "string", description: "Marca, modelo y año, solo para piezas fuera de catálogo." },
                cantidad: { type: "integer", minimum: 1 },
              },
              required: ["cantidad"], additionalProperties: false,
            },
          },
          nota: { type: "string", description: "Indicaciones para el despacho, si las hay." },
        },
        required: ["items"], additionalProperties: false,
      },
      run: async (i: { items: { codigo?: string; nombre?: string; vehiculo?: string; cantidad: number }[]; nota?: string }) => {
        if (!Array.isArray(i.items) || !i.items.length) return "El pedido está vacío.";
        const filas: Record<string, unknown>[] = [];
        for (const it of i.items) {
          const cantidad = Math.max(1, Math.floor(Number(it.cantidad) || 1));
          if (it.codigo) {
            const { data: p } = await db.from("mekachi_productos").select("id,nombre,compatibilidad,precio").eq("codigo", it.codigo).eq("activo", true).maybeSingle();
            if (!p) return `El código ${it.codigo} no existe en el catálogo. Vuelve a buscar el repuesto.`;
            filas.push({ producto_id: p.id, nombre: p.nombre, detalle: p.compatibilidad, cantidad, precio_unit: p.precio });
          } else if (it.nombre) {
            filas.push({ nombre: String(it.nombre).slice(0, 120), detalle: String(it.vehiculo || "").slice(0, 120), cantidad });
          } else return "Cada pieza necesita un código del catálogo o un nombre.";
        }
        const { data: pedido, error } = await db.from("mekachi_pedidos").insert({ taller_id: taller.id, direccion: taller.direccion, zona: taller.zona, pago: "Por confirmar", nota: ("Pedido por WhatsApp. " + (i.nota || "")).slice(0, 300) }).select("id,num").single();
        if (error || !pedido) return "No se pudo registrar el pedido. Pasa la conversación a una persona.";
        const { error: e2 } = await db.from("mekachi_pedido_items").insert(filas.map((f) => ({ ...f, pedido_id: pedido.id })));
        if (e2) { await db.from("mekachi_pedidos").delete().eq("id", pedido.id); return "No se pudo registrar el pedido. Pasa la conversación a una persona."; }
        await db.rpc("mekachi_totales", { p_pedido: pedido.id });
        const { data: fin } = await db.from("mekachi_pedidos").select("num,total").eq("id", pedido.id).single();
        return JSON.stringify({ pedido: fin?.num, total_con_iva: fin?.total, por_cotizar: filas.filter((f) => f.precio_unit == null).length, entrega: taller.direccion });
      },
    }));
  }
  return lista;
}

async function responder(ctx: Contexto, historial: { rol: string; texto: string }[]): Promise<string> {
  // La API exige turnos alternados que empiecen por el usuario: se unen los mensajes seguidos del mismo lado.
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of historial) {
    const role = m.rol === "assistant" ? "assistant" : "user";
    const ult = messages[messages.length - 1];
    if (ult && ult.role === role) ult.content += "\n" + m.texto;
    else if (messages.length || role === "user") messages.push({ role, content: m.texto });
  }
  const app = env("MEKACHI_APP_URL");
  const system = SISTEMA + "\n\n" + (ctx.taller
    ? `Quien escribe es el taller registrado «${ctx.taller.nombre}» (${ctx.taller.zona}). Puede pedir repuestos por aquí.`
    : "Quien escribe no está registrado como taller: trátalo como conductor. Si dice ser un taller, invítalo a registrarse en la app para poder pedir repuestos.") +
    (app ? `\nLa app de Mekachi está en ${app}; compártela cuando ayude (ver el mapa, pedir precio a un taller, registrarse).` : "");

  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const final = await client.beta.messages.toolRunner({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low" },
    // Si el modelo declina por una política de seguridad, la API reintenta sola con un modelo de respaldo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    tools: herramientas(ctx),
    messages,
    max_iterations: 8,
  });
  if (final.stop_reason === "refusal") return "Con eso no puedo ayudarte por aquí. ¿Te ayudo con tu auto, un taller o un repuesto?";
  const texto = final.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  return texto || "Perdona, no pude completar la respuesta. ¿Me lo repites de otra forma?";
}

async function enviar(telefono: string, texto: string) {
  const r = await fetch(`https://graph.facebook.com/${env("WA_GRAPH_VERSION") || "v23.0"}/${env("WA_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WA_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: telefono, type: "text", text: { body: texto.slice(0, 4000) } }),
  });
  if (!r.ok) console.error("WhatsApp rechazó el envío", r.status, await r.text());
}

async function firmaValida(cuerpo: string, firma: string | null) {
  if (!firma || !firma.startsWith("sha256=")) return false;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(env("WA_APP_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(cuerpo)));
  const esperado = "sha256=" + [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  if (esperado.length !== firma.length) return false;
  let dif = 0;
  for (let i = 0; i < esperado.length; i++) dif |= esperado.charCodeAt(i) ^ firma.charCodeAt(i);
  return dif === 0;
}

// deno-lint-ignore no-explicit-any
async function procesar(msg: any, nombre: string) {
  const telefono = String(msg.from);
  const { data: conv } = await db.from("mekachi_wa_conversaciones").upsert({ telefono, nombre, updated_at: new Date().toISOString() }, { onConflict: "telefono" }).select("id,requiere_humano").single();
  if (!conv) return;
  const texto = msg.type === "text" ? String(msg.text?.body || "").slice(0, 2000) : "";
  // Meta reintenta entregas: el identificador único del mensaje evita responder dos veces.
  const { error: dup } = await db.from("mekachi_wa_mensajes").insert({ conversacion_id: conv.id, rol: "user", texto: texto || `[${msg.type}]`, wa_id: msg.id });
  if (dup) return;
  if (conv.requiere_humano) return; // ya la atiende una persona
  if (!texto) return enviar(telefono, "Por ahora solo puedo leer mensajes de texto. Cuéntame por escrito qué le pasa a tu auto o qué repuesto necesitas.");

  const [{ data: hist }, { data: talleres }] = await Promise.all([
    db.from("mekachi_wa_mensajes").select("rol,texto").eq("conversacion_id", conv.id).order("id", { ascending: false }).limit(24),
    db.from("mekachi_talleres").select("id,nombre,direccion,zona,telefono,whatsapp").eq("activo", true).eq("es_demo", false),
  ]);
  const t = (talleres || []).find((x) => mismoTelefono(x.whatsapp, telefono) || mismoTelefono(x.telefono, telefono));
  const ctx: Contexto = { telefono, conversacion: conv.id, taller: t ? { id: t.id, nombre: t.nombre, direccion: t.direccion, zona: t.zona } : null };
  let respuesta: string;
  try {
    respuesta = await responder(ctx, (hist || []).reverse());
  } catch (e) {
    console.error("Fallo al generar la respuesta", e);
    respuesta = "Tuve un problema para responderte. Inténtalo de nuevo en un momento, por favor.";
  }
  await db.from("mekachi_wa_mensajes").insert({ conversacion_id: conv.id, rol: "assistant", texto: respuesta });
  await enviar(telefono, respuesta);
}

Deno.serve(async (req: Request) => {
  if (!CONFIGURADO) return new Response("Mekachi WhatsApp: faltan secretos por configurar.", { status: 503 });
  const url = new URL(req.url);
  if (req.method === "GET") { // verificación del webhook al registrarlo en Meta
    const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env("WA_VERIFY_TOKEN");
    return new Response(ok ? url.searchParams.get("hub.challenge") ?? "" : "Token de verificación incorrecto.", { status: ok ? 200 : 403 });
  }
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const cuerpo = await req.text();
  if (!(await firmaValida(cuerpo, req.headers.get("x-hub-signature-256")))) return new Response("Firma no válida", { status: 401 });
  let datos;
  try { datos = JSON.parse(cuerpo); } catch { return new Response("Cuerpo no válido", { status: 400 }); }
  const tareas: Promise<unknown>[] = [];
  for (const entrada of datos.entry ?? []) for (const cambio of entrada.changes ?? []) {
    const v = cambio.value ?? {};
    if (v.metadata?.phone_number_id && v.metadata.phone_number_id !== env("WA_PHONE_NUMBER_ID")) continue;
    for (const msg of v.messages ?? []) tareas.push(procesar(msg, v.contacts?.[0]?.profile?.name ?? "").catch((e) => console.error("Fallo al procesar", e)));
  }
  // Se responde a Meta de inmediato y el trabajo sigue en segundo plano.
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(Promise.all(tareas));
  return new Response("ok", { status: 200 });
});
