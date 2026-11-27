// Mekachi · asistente de WhatsApp con IA.
// Recibe los mensajes de la API de WhatsApp Business (Meta), responde con Claude y
// consulta o registra datos reales: talleres, repuestos, pedidos, citas y grúas.
//
// Secretos obligatorios (Supabase → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY, WA_TOKEN, WA_PHONE_NUMBER_ID, WA_APP_SECRET, WA_VERIFY_TOKEN
// Secretos opcionales (si faltan se usa la tabla mekachi_config o el valor por defecto):
//   MEKACHI_MODO_DEMO (true/false), MEKACHI_MODELO, WA_GRAPH_VERSION, MEKACHI_APP_URL,
//   WA_PLANTILLA_SEGUIMIENTO (nombre de la plantilla aprobada por Meta para pedir calificación)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { betaTool } from "npm:@anthropic-ai/sdk/helpers/beta/json-schema";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const env = (k: string) => Deno.env.get(k) ?? "";
const CONFIGURADO = ["ANTHROPIC_API_KEY", "WA_TOKEN", "WA_PHONE_NUMBER_ID", "WA_APP_SECRET", "WA_VERIFY_TOKEN"].every((k) => env(k));
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const digitos = (t: string) => (t || "").replace(/\D/g, "");
const mismoTelefono = (a: string, b: string) => digitos(a).length >= 9 && digitos(a).slice(-9) === digitos(b).slice(-9);
const ZONAS = ["Norte", "Centro norte", "Sur", "Valles y periferia"];
const ESPECIALIDADES = ["Frenos", "Motor", "Eléctrico", "Suspensión", "Transmisión", "Aire acondicionado", "Mantenimiento"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Cfg = { demo: boolean; modelo: string; graph: string; admins: string[]; espera: number; cron: string; negocio: string; app: string; simular: boolean };
async function cargarCfg(): Promise<Cfg> {
  const { data } = await db.from("mekachi_config").select("clave,valor");
  const c: Record<string, string> = {};
  for (const r of data ?? []) c[r.clave] = r.valor;
  return {
    demo: (env("MEKACHI_MODO_DEMO") || c.modo_demo || "false").toLowerCase() === "true",
    modelo: env("MEKACHI_MODELO") || c.modelo || "claude-opus-5-5",
    graph: env("WA_GRAPH_VERSION") || c.graph_version || "v27.0",
    admins: (c.admin_wa || "").split(",").map((x) => digitos(x)).filter(Boolean),
    espera: Math.max(5, parseInt(c.espera_humano_min || "30") || 30),
    cron: c.cron_secreto || "",
    negocio: c.datos_negocio || "",
    app: env("MEKACHI_APP_URL") || c.app_url || "",
    simular: false,
  };
}

const SISTEMA = `Eres el asistente automático de Mekachi en WhatsApp. Mekachi conecta a conductores de Quito, Ecuador, con talleres mecánicos verificados y lleva a los talleres los repuestos que necesitan.

Con quién hablas: conductores con un problema en su auto y talleres que piden repuestos. Al final se indica si el número que escribe pertenece a un taller registrado.

Primer mensaje: si es el primer mensaje de la conversación, preséntate en una frase como el asistente automático de Mekachi y di en qué puedes ayudar. No vuelvas a presentarte después.

Cómo ayudas a un conductor:
1. Entiende el síntoma con las preguntas justas: qué pasa, cuándo, y marca, modelo y año.
2. Da una orientación inicial: causas probables, qué tan urgente es y qué tipo de taller necesita.
3. Pregunta en qué sector o barrio está y tradúcelo a una zona con la tabla de abajo. No le pidas a la persona que elija la zona.
4. Busca talleres con la herramienta y recomienda uno o dos, con su horario y calificación.
5. Si quiere, agenda una cita: confirma taller, día, hora y vehículo antes de registrarla. La cita queda pendiente hasta que el taller la confirme; dilo.

Zonas de Quito por barrio:
- Norte: Carcelén, Comité del Pueblo, La Kennedy, El Inca, Ponceano, Cotocollao, El Condado, La Bota, San Carlos, La Ofelia, Carretas.
- Centro norte: Iñaquito, La Carolina, La Mariscal, La Floresta, González Suárez, Bellavista, El Batán, La Pradera, Av. América, La Gasca, Miraflores, Centro Histórico, San Juan, La Tola.
- Sur: La Villaflora, La Magdalena, Chimbacalle, El Recreo, Solanda, San Bartolo, Chillogallo, Quitumbe, Guamaní, La Ecuatoriana, Turubamba.
- Valles y periferia: Cumbayá, Tumbaco, Puembo, Nayón, Los Chillos, Sangolquí, Conocoto, San Rafael, Calderón, Carapungo, Pomasqui, San Antonio.
Si el barrio no está en la tabla, pregunta por una referencia cercana y elige la zona más próxima.

Si no hay talleres para lo que busca: no escales todavía. Ofrece, en este orden, buscar en una zona vecina, buscar un taller de mantenimiento general o compartir la app para ver el mapa completo.

Seguridad: si el síntoma compromete la seguridad (frenos que fallan o pedal al fondo, temperatura muy alta, luz de aceite o de batería encendida en marcha, humo, olor a combustible), di con claridad que no conduzca y ofrece de inmediato pedir una grúa. Para la grúa necesitas: dónde está el auto (puede enviar su ubicación de WhatsApp o escribir la dirección), tipo de vehículo, a dónde llevarlo (por ejemplo el taller recomendado) y un teléfono de contacto. Confirma esos datos y regístrala con la herramienta.

Cómo ayudas a un taller registrado: busca los repuestos con la herramienta, confirma lista y cantidades y, solo cuando diga que sí, registra el pedido. También puedes decirle el estado de sus pedidos.

Reglas que no se rompen:
- Tu orientación es inicial. El diagnóstico definitivo lo hace el mecánico al revisar el auto; dilo cuando des causas probables.
- Nunca inventes talleres, repuestos, precios, grúas ni tiempos. Salen solo de las herramientas. No des precios de mano de obra: los cotiza cada taller.
- Los datos del negocio marcados PENDIENTE no están confirmados: si preguntan por ellos, di que aún no tienes ese dato confirmado.
- Pasa la conversación a una persona del equipo solo cuando lo pidan, haya un reclamo por un pedido o un cobro, o ya agotaste las alternativas. Avisa que le escribirán.
- Si escriben sobre algo ajeno a autos, talleres, repuestos o grúas, explica con amabilidad en qué sí puedes ayudar.

Fotos: si envían una foto (tablero, pieza, fuga), descríbela brevemente y úsala para orientar.

Estilo: es WhatsApp. Español de Ecuador, cercano y breve, texto simple sin formato Markdown. Una idea por mensaje y, como máximo, una pregunta a la vez.`;

type Taller = { id: string; nombre: string; direccion: string; zona: string };
type Contexto = { telefono: string; nombre: string; conversacion: string; taller: Taller | null; lat: number | null; lng: number | null };

async function enviar(cfg: Cfg, telefono: string, texto: string): Promise<boolean> {
  if (cfg.simular) return true;
  // WhatsApp admite hasta 4096 caracteres por mensaje: los textos largos se parten por párrafos.
  const partes: string[] = [];
  let resto = texto.trim();
  while (resto.length > 3500) {
    let corte = resto.lastIndexOf("\n", 3500);
    if (corte < 1000) corte = resto.lastIndexOf(" ", 3500);
    if (corte < 1000) corte = 3500;
    partes.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) partes.push(resto);
  let ok = true;
  for (const body of partes) {
    const r = await fetch(`https://graph.facebook.com/${cfg.graph}/${env("WA_PHONE_NUMBER_ID")}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("WA_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: digitos(telefono), type: "text", text: { body } }),
    });
    if (!r.ok) { ok = false; console.error("WhatsApp rechazó el envío", r.status, await r.text()); }
  }
  return ok;
}

async function enviarPlantilla(cfg: Cfg, telefono: string, plantilla: string, parametros: string[]): Promise<boolean> {
  if (cfg.simular) return true;
  const r = await fetch(`https://graph.facebook.com/${cfg.graph}/${env("WA_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WA_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: digitos(telefono), type: "template", template: { name: plantilla, language: { code: "es" }, components: [{ type: "body", parameters: parametros.map((text) => ({ type: "text", text })) }] } }),
  });
  if (!r.ok) console.error("WhatsApp rechazó la plantilla", r.status, await r.text());
  return r.ok;
}

// Aviso al equipo. Meta solo lo entrega si ese número escribió al asistente en las últimas 24 horas.
async function avisarEquipo(cfg: Cfg, texto: string) {
  for (const a of cfg.admins) await enviar(cfg, a, "Aviso Mekachi\n" + texto);
}

async function descargarImagen(cfg: Cfg, id: string): Promise<{ data: string; media_type: string } | null> {
  try {
    const meta = await (await fetch(`https://graph.facebook.com/${cfg.graph}/${id}`, { headers: { Authorization: `Bearer ${env("WA_TOKEN")}` } })).json();
    if (!meta.url || !["image/jpeg", "image/png", "image/webp"].includes(meta.mime_type)) return null;
    const bytes = new Uint8Array(await (await fetch(meta.url, { headers: { Authorization: `Bearer ${env("WA_TOKEN")}` } })).arrayBuffer());
    if (bytes.length > 4_500_000) return null;
    return { data: encodeBase64(bytes), media_type: meta.mime_type };
  } catch (e) { console.error("No se pudo descargar la imagen", e); return null; }
}

function herramientas(ctx: Contexto, cfg: Cfg) {
  const aviso = cfg.demo ? " (dato de demostración)" : "";
  // deno-lint-ignore no-explicit-any
  const lista: any[] = [
    betaTool({
      name: "buscar_talleres",
      description: "Busca talleres de la red Mekachi en Quito. Úsala antes de recomendar cualquier taller. Devuelve nombre, sector, zona, dirección, especialidades, horario, WhatsApp y calificación.",
      inputSchema: { type: "object", properties: { especialidad: { type: "string", enum: ESPECIALIDADES, description: "Tipo de trabajo que necesita el auto." }, zona: { type: "string", enum: ZONAS, description: "Zona deducida del barrio del conductor." } }, additionalProperties: false },
      run: async (i: { especialidad?: string; zona?: string }) => {
        let q = db.from("mekachi_talleres").select("nombre,sector,zona,direccion,especialidades,horario,whatsapp,rating_suma,rating_total,es_demo").eq("activo", true).eq("verificado", true);
        if (!cfg.demo) q = q.eq("es_demo", false);
        if (i.especialidad) q = q.contains("especialidades", [i.especialidad]);
        if (i.zona) q = q.eq("zona", i.zona);
        const { data, error } = await q.limit(6);
        if (error) return "No se pudo consultar la red de talleres en este momento.";
        if (!data.length) return "No hay talleres con ese filtro. Ofrece buscar en una zona vecina, un taller de mantenimiento general o la app.";
        return JSON.stringify({
          aviso: data.some((t) => t.es_demo) ? "Son talleres de DEMOSTRACIÓN: dilo claramente al recomendarlos; todavía no atienden clientes reales." : undefined,
          talleres: data.map((t) => ({ nombre: t.nombre, sector: t.sector, zona: t.zona, direccion: t.direccion, especialidades: t.especialidades, horario: t.horario, whatsapp: t.es_demo ? "sin número real (demostración)" : t.whatsapp, calificacion: t.rating_total ? (t.rating_suma / t.rating_total).toFixed(1) + " de 5 (" + t.rating_total + " opiniones)" : "sin calificaciones" })),
        });
      },
    }),
    betaTool({
      name: "buscar_repuestos",
      description: "Busca repuestos en el catálogo de Mekachi por nombre o vehículo. Devuelve código, nombre, compatibilidad y precio sin IVA. Úsala antes de mencionar cualquier repuesto o precio.",
      inputSchema: { type: "object", properties: { texto: { type: "string", description: "Una o dos palabras clave, por ejemplo: pastillas Hilux, filtro aceite Tiggo, batería." } }, required: ["texto"], additionalProperties: false },
      run: async (i: { texto: string }) => {
        const palabras = String(i.texto).toLowerCase().split(/\s+/).map((w) => w.replace(/[%,()]/g, "")).filter((w) => w.length > 2).slice(0, 3);
        let q = db.from("mekachi_productos").select("codigo,nombre,compatibilidad,precio").eq("activo", true);
        if (!cfg.demo) q = q.eq("es_demo", false);
        for (const w of palabras) q = q.or(`nombre.ilike.%${w}%,compatibilidad.ilike.%${w}%,categoria.ilike.%${w}%`);
        const { data, error } = await q.limit(8);
        if (error) return "No se pudo consultar el catálogo en este momento.";
        if (!data.length) return "No está en el catálogo. Un taller registrado puede pedirlo igual como pieza por cotizar.";
        return JSON.stringify({ aviso: cfg.demo ? "Precios de DEMOSTRACIÓN, sin IVA: dilo al mencionarlos." : "Precios sin IVA.", repuestos: data });
      },
    }),
    betaTool({
      name: "agendar_cita",
      description: "Registra una cita en un taller de la red. Llámala solo cuando la persona haya confirmado taller, día, hora y vehículo. La cita queda pendiente hasta que el taller la confirme.",
      inputSchema: {
        type: "object",
        properties: {
          taller: { type: "string", description: "Nombre exacto del taller, tal como lo devolvió buscar_talleres." },
          fecha: { type: "string", description: "Fecha en formato AAAA-MM-DD." },
          hora: { type: "string", description: "Hora aproximada, por ejemplo 10:00." },
          vehiculo: { type: "string", description: "Marca, modelo y año." },
          motivo: { type: "string", description: "Qué necesita el auto, en una frase." },
          nombre: { type: "string", description: "Nombre de la persona." },
        },
        required: ["taller", "fecha", "hora", "vehiculo", "motivo"], additionalProperties: false,
      },
      run: async (i: { taller: string; fecha: string; hora: string; vehiculo: string; motivo: string; nombre?: string }) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(i.fecha)) return "La fecha debe ir en formato AAAA-MM-DD.";
        const { data: t } = await db.from("mekachi_talleres").select("id,nombre,whatsapp,es_demo").eq("activo", true).ilike("nombre", String(i.taller).replace(/[%_]/g, "")).maybeSingle();
        if (!t || (t.es_demo && !cfg.demo)) return "No encontré ese taller. Vuelve a buscarlo y usa el nombre exacto.";
        const { data: c, error } = await db.from("mekachi_citas").insert({ taller_id: t.id, conversacion_id: ctx.conversacion, nombre: (i.nombre || ctx.nombre).slice(0, 80), telefono: ctx.telefono, vehiculo: i.vehiculo.slice(0, 80), motivo: i.motivo.slice(0, 200), fecha: i.fecha, hora: i.hora.slice(0, 20) }).select("num").single();
        if (error || !c) return "No se pudo registrar la cita. Ofrece intentarlo de nuevo o pasar a una persona.";
        const resumen = `Cita ${c.num} · ${t.nombre}\n${i.fecha} ${i.hora} · ${i.vehiculo}\n${i.motivo}\nCliente: ${i.nombre || ctx.nombre} · ${ctx.telefono}`;
        if (t.whatsapp && !mismoTelefono(t.whatsapp, ctx.telefono)) await enviar(cfg, t.whatsapp, "Nueva solicitud de cita en Mekachi\n" + resumen + "\nConfírmala o recházala en la app, en Trabajos.");
        await avisarEquipo(cfg, "Nueva cita pendiente\n" + resumen);
        return JSON.stringify({ cita: c.num, estado: "Pendiente de confirmación del taller", nota: "Avisa que le escribiremos cuando el taller confirme." + (t.es_demo ? " Es un taller de demostración." : "") });
      },
    }),
    betaTool({
      name: "solicitar_grua",
      description: "Registra una solicitud de grúa. Úsala en casos de seguridad o cuando el auto no puede moverse, después de confirmar ubicación, tipo de vehículo, destino y teléfono de contacto.",
      inputSchema: {
        type: "object",
        properties: {
          ubicacion: { type: "string", description: "Dónde está el auto: dirección o referencia. Si envió su ubicación de WhatsApp, descríbela aquí." },
          zona: { type: "string", enum: ZONAS, description: "Zona deducida de la ubicación." },
          tipo_vehiculo: { type: "string", enum: ["Auto", "SUV", "Camioneta", "Moto"] },
          destino: { type: "string", description: "A dónde llevar el auto, por ejemplo el taller recomendado." },
          telefono: { type: "string", description: "Teléfono de contacto; si no dio otro, el de este chat." },
        },
        required: ["ubicacion", "zona", "tipo_vehiculo", "destino"], additionalProperties: false,
      },
      run: async (i: { ubicacion: string; zona: string; tipo_vehiculo: string; destino: string; telefono?: string }) => {
        let q = db.from("mekachi_gruas_proveedores").select("id,nombre,whatsapp,tarifa_base,minutos_estimados,zona,es_demo").eq("activo", true).contains("tipos", [i.tipo_vehiculo]);
        if (!cfg.demo) q = q.eq("es_demo", false);
        const { data: provs } = await q;
        const p = (provs ?? []).find((x) => x.zona === i.zona) ?? (provs ?? [])[0];
        const { data: s, error } = await db.from("mekachi_gruas_solicitudes").insert({
          conversacion_id: ctx.conversacion, proveedor_id: p?.id ?? null, nombre: ctx.nombre, telefono: digitos(i.telefono || "") || ctx.telefono, ubicacion: i.ubicacion.slice(0, 300), lat: ctx.lat, lng: ctx.lng,
          tipo_vehiculo: i.tipo_vehiculo, destino: i.destino.slice(0, 200), estado: p ? "Asignada" : "Solicitada", estimado_min: p?.minutos_estimados ?? null, estimado_precio: p?.tarifa_base ?? null, es_demo: p?.es_demo ?? cfg.demo,
        }).select("num").single();
        if (error || !s) return "No se pudo registrar la grúa. Pasa la conversación a una persona de inmediato.";
        const mapa = ctx.lat != null ? `\nMapa: https://maps.google.com/?q=${ctx.lat},${ctx.lng}` : "";
        const resumen = `Grúa ${s.num} · ${i.tipo_vehiculo}\nRecoger en: ${i.ubicacion}${mapa}\nLlevar a: ${i.destino}\nContacto: ${ctx.nombre} · ${digitos(i.telefono || "") || ctx.telefono}`;
        if (p?.whatsapp) await enviar(cfg, p.whatsapp, "Solicitud de grúa de Mekachi\n" + resumen);
        await avisarEquipo(cfg, "Nueva solicitud de grúa" + (p ? ` (${p.nombre})` : " SIN PROVEEDOR") + "\n" + resumen);
        if (!p) return JSON.stringify({ solicitud: s.num, estado: "Registrada sin proveedor asignado", nota: "Di que el equipo de Mekachi la gestionará y le escribirá en breve." });
        return JSON.stringify({ solicitud: s.num, proveedor: p.nombre, llegada_estimada_min: p.minutos_estimados, precio_estimado_usd: p.tarifa_base, nota: p.es_demo ? "Proveedor, tiempo y precio son de DEMOSTRACIÓN: dilo claramente; no llegará una grúa real." : "Tiempo y precio son estimados; el proveedor los confirma." });
      },
    }),
    betaTool({
      name: "pasar_a_persona",
      description: "Marca la conversación para que la atienda una persona del equipo de Mekachi. Úsala cuando lo pidan, haya un reclamo o ya agotaste las alternativas.",
      inputSchema: { type: "object", properties: { motivo: { type: "string", description: "Resumen breve de lo que necesita la persona." } }, required: ["motivo"], additionalProperties: false },
      run: async (i: { motivo: string }) => {
        await db.from("mekachi_wa_conversaciones").update({ requiere_humano: true, motivo_humano: String(i.motivo).slice(0, 300), humano_desde: new Date().toISOString() }).eq("id", ctx.conversacion);
        await avisarEquipo(cfg, `${ctx.nombre || "Alguien"} (…${ctx.telefono.slice(-4)}) pide atención de una persona.\nMotivo: ${i.motivo}\nResponde desde la app, en Despacho > Atención, o devuélvela al asistente con: #bot ${ctx.telefono.slice(-4)}`);
        return `Listo: el equipo fue avisado. Di a la persona que le escribirán y que, si en ${cfg.espera} minutos nadie responde, tú retomas la conversación.`;
      },
    }),
  ];
  if (ctx.taller) {
    const taller = ctx.taller;
    lista.push(betaTool({
      name: "estado_pedido",
      description: "Consulta los pedidos de repuestos del taller que escribe. Con un número de pedido devuelve ese; sin número, los cinco más recientes.",
      inputSchema: { type: "object", properties: { numero: { type: "string", description: "Número de pedido, por ejemplo MK-0002." } }, additionalProperties: false },
      run: async (i: { numero?: string }) => {
        let q = db.from("mekachi_pedidos").select("num,estado,total,created_at,items:mekachi_pedido_items(nombre,detalle,cantidad,precio_unit)").eq("taller_id", taller.id).order("created_at", { ascending: false }).limit(5);
        const n = String(i.numero || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
        if (n) q = q.eq("num", /^MK-/.test(n) ? n : "MK-" + n.replace(/\D/g, "").padStart(4, "0"));
        const { data } = await q;
        if (!data?.length) return n ? "Ese número no corresponde a un pedido de este taller." : "Este taller todavía no tiene pedidos.";
        return JSON.stringify(data.map((p) => ({ pedido: p.num, estado: p.estado, total_con_iva: p.total, fecha: p.created_at.slice(0, 10), piezas: p.items })));
      },
    }));
    lista.push(betaTool({
      name: "registrar_pedido",
      description: "Registra un pedido de repuestos para el taller que escribe. Llámala solo después de que la persona confirme la lista completa y las cantidades. Usa el código del catálogo cuando exista; para piezas fuera de catálogo envía nombre y vehículo, y despacho las cotiza.",
      inputSchema: {
        type: "object",
        properties: {
          items: { type: "array", minItems: 1, items: { type: "object", properties: { codigo: { type: "string", description: "Código del catálogo devuelto por buscar_repuestos." }, nombre: { type: "string", description: "Nombre de la pieza, solo si no está en el catálogo." }, vehiculo: { type: "string", description: "Marca, modelo y año, solo para piezas fuera de catálogo." }, cantidad: { type: "integer", minimum: 1 } }, required: ["cantidad"], additionalProperties: false } },
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
          } else if (it.nombre) filas.push({ nombre: String(it.nombre).slice(0, 120), detalle: String(it.vehiculo || "").slice(0, 120), cantidad });
          else return "Cada pieza necesita un código del catálogo o un nombre.";
        }
        const { data: pedido, error } = await db.from("mekachi_pedidos").insert({ taller_id: taller.id, direccion: taller.direccion, zona: taller.zona, pago: "Por confirmar", nota: ("Pedido por WhatsApp. " + (i.nota || "")).slice(0, 300) }).select("id,num").single();
        if (error || !pedido) return "No se pudo registrar el pedido. Pasa la conversación a una persona.";
        const { error: e2 } = await db.from("mekachi_pedido_items").insert(filas.map((f) => ({ ...f, pedido_id: pedido.id })));
        if (e2) { await db.from("mekachi_pedidos").delete().eq("id", pedido.id); return "No se pudo registrar el pedido. Pasa la conversación a una persona."; }
        await db.rpc("mekachi_totales", { p_pedido: pedido.id });
        const { data: fin } = await db.from("mekachi_pedidos").select("num,total").eq("id", pedido.id).single();
        await avisarEquipo(cfg, `Nuevo pedido ${fin?.num} de ${taller.nombre} por WhatsApp. Total con IVA: $${fin?.total}`);
        return JSON.stringify({ pedido: fin?.num, total_con_iva: fin?.total, por_cotizar: filas.filter((f) => f.precio_unit == null).length, entrega: taller.direccion, nota: aviso ? "Pedido" + aviso + ": no se despachará mercadería real." : undefined });
      },
    }));
  }
  return lista;
}

async function responder(ctx: Contexto, cfg: Cfg, historial: { rol: string; texto: string }[], imagen: { data: string; media_type: string } | null): Promise<string> {
  // La API exige turnos alternados que empiecen por el usuario: se unen los mensajes seguidos del mismo lado.
  // deno-lint-ignore no-explicit-any
  const messages: { role: "user" | "assistant"; content: any }[] = [];
  for (const m of historial) {
    const role = m.rol === "assistant" ? "assistant" : "user";
    const ult = messages[messages.length - 1];
    if (ult && ult.role === role) ult.content += "\n" + m.texto;
    else if (messages.length || role === "user") messages.push({ role, content: m.texto });
  }
  const primero = !historial.some((m) => m.rol === "assistant");
  const ult = messages[messages.length - 1];
  if (imagen && ult?.role === "user") ult.content = [{ type: "image", source: { type: "base64", media_type: imagen.media_type, data: imagen.data } }, { type: "text", text: ult.content }];
  const hoy = new Date().toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const iso = new Date().toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
  const system = [
    SISTEMA,
    "Datos del negocio:\n" + (cfg.negocio || "PENDIENTE"),
    cfg.demo ? "MODO DEMOSTRACIÓN ACTIVO: Mekachi está en pruebas. Los talleres, repuestos, precios y grúas que devuelven las herramientas son de demostración. Úsalos con normalidad para mostrar cómo funciona el servicio, pero di con claridad que son de demostración cada vez que recomiendes un taller, des un precio o registres una grúa, una cita o un pedido." : "",
    `Hoy es ${hoy} (${iso}), hora de Quito.`,
    ctx.taller ? `Quien escribe es el taller registrado «${ctx.taller.nombre}» (${ctx.taller.zona}). Puede pedir repuestos y consultar sus pedidos por aquí.` : "Quien escribe no está registrado como taller: trátalo como conductor. Si dice ser un taller, invítalo a registrarse en la app para pedir repuestos.",
    ctx.lat != null ? "Esta persona ya compartió su ubicación de WhatsApp en esta conversación; se adjuntará sola a una solicitud de grúa." : "",
    primero ? "Este es el primer mensaje de la conversación: preséntate." : "Ya te presentaste antes en esta conversación.",
    cfg.app ? `La app de Mekachi está en ${cfg.app}; compártela cuando ayude (ver el mapa, pedir precio a un taller, registrarse).` : "",
  ].filter(Boolean).join("\n\n");

  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  const final = await client.beta.messages.toolRunner({
    model: cfg.modelo,
    max_tokens: 16000,
    output_config: { effort: "low" },
    // Si el modelo declina por una política de seguridad, la API reintenta sola con un modelo de respaldo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    tools: herramientas(ctx, cfg),
    messages,
    max_iterations: 8,
  });
  if (final.stop_reason === "refusal") return "Con eso no puedo ayudarte por aquí. ¿Te ayudo con tu auto, un taller, un repuesto o una grúa?";
  const texto = final.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  return texto || "Perdona, no pude completar la respuesta. ¿Me lo repites de otra forma?";
}

// Comandos del equipo por WhatsApp, solo desde los números de admin_wa.
async function comandoAdmin(cfg: Cfg, telefono: string, texto: string): Promise<boolean> {
  const [cmd, arg] = texto.trim().toLowerCase().split(/\s+/);
  if (cmd === "#pendientes") {
    const { data } = await db.from("mekachi_wa_conversaciones").select("telefono,nombre,motivo_humano,humano_desde").eq("requiere_humano", true).order("humano_desde");
    await enviar(cfg, telefono, data?.length ? "Conversaciones esperando a una persona:\n" + data.map((c) => `• …${c.telefono.slice(-4)} ${c.nombre}: ${c.motivo_humano}`).join("\n") + "\nPara devolver una al asistente: #bot 1234" : "No hay conversaciones esperando a una persona.");
    return true;
  }
  if (cmd === "#bot" && /^\d{4}$/.test(arg || "")) {
    const { data } = await db.from("mekachi_wa_conversaciones").update({ requiere_humano: false, motivo_humano: "", humano_desde: null }).like("telefono", "%" + arg).eq("requiere_humano", true).select("telefono");
    await enviar(cfg, telefono, data?.length ? `Listo: el asistente vuelve a atender a …${arg}.` : `No hay ninguna conversación pendiente que termine en ${arg}.`);
    return true;
  }
  if (cmd === "#ayuda" || cmd?.startsWith("#")) {
    await enviar(cfg, telefono, "Comandos del equipo:\n#pendientes: conversaciones que esperan a una persona\n#bot 1234: devuelve al asistente la conversación del número que termina en 1234");
    return true;
  }
  return false;
}

// deno-lint-ignore no-explicit-any
async function procesar(cfg: Cfg, msg: any, nombre: string): Promise<string | null> {
  const telefono = String(msg.from);
  const ahora = new Date().toISOString();
  const cambios: Record<string, unknown> = { telefono, nombre, updated_at: ahora, ultimo_usuario_at: ahora };
  let texto = "", imagenId = "";
  if (msg.type === "text") texto = String(msg.text?.body || "");
  else if (msg.type === "location") {
    const l = msg.location ?? {};
    texto = `[Ubicación compartida] ${[l.name, l.address].filter(Boolean).join(", ") || "sin dirección"} (${l.latitude}, ${l.longitude})`;
    Object.assign(cambios, { ult_lat: l.latitude, ult_lng: l.longitude, ult_ubicacion: [l.name, l.address].filter(Boolean).join(", ") });
  } else if (msg.type === "image") { imagenId = msg.image?.id || ""; texto = "[Foto] " + (msg.image?.caption || "sin descripción"); }
  else if (msg.type === "button") texto = String(msg.button?.text || "");
  else if (msg.type === "interactive") texto = String(msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "");
  texto = texto.slice(0, 2000);

  const { data: conv } = await db.from("mekachi_wa_conversaciones").upsert(cambios, { onConflict: "telefono" }).select("id,requiere_humano,humano_desde,ult_lat,ult_lng").single();
  if (!conv) return null;
  // Meta reintenta entregas: el identificador único del mensaje evita responder dos veces.
  const { error: dup } = await db.from("mekachi_wa_mensajes").insert({ conversacion_id: conv.id, rol: "user", autor: "usuario", texto: texto || `[${msg.type}]`, wa_id: msg.id });
  if (dup) return null;

  if (texto.startsWith("#") && cfg.admins.some((a) => mismoTelefono(a, telefono)) && await comandoAdmin(cfg, telefono, texto)) return null;

  if (conv.requiere_humano) {
    // Si el equipo no respondió en el plazo, el asistente retoma; si no, espera a la persona.
    const vencida = conv.humano_desde && Date.now() - new Date(conv.humano_desde).getTime() > cfg.espera * 60000;
    const { count } = await db.from("mekachi_wa_mensajes").select("id", { count: "exact", head: true }).eq("conversacion_id", conv.id).eq("autor", "humano").gte("created_at", conv.humano_desde ?? ahora);
    if (!vencida || (count ?? 0) > 0) return null;
    await db.from("mekachi_wa_conversaciones").update({ requiere_humano: false, motivo_humano: "", humano_desde: null }).eq("id", conv.id);
  }
  if (!texto) {
    const r = msg.type === "audio" ? "Todavía no puedo escuchar audios. Escríbeme qué le pasa a tu auto o qué necesitas, por favor." : "Por ahora leo texto, fotos y ubicaciones. Cuéntame por escrito qué necesitas, por favor.";
    await db.from("mekachi_wa_mensajes").insert({ conversacion_id: conv.id, rol: "assistant", texto: r });
    await enviar(cfg, telefono, r);
    return r;
  }

  let tq = db.from("mekachi_talleres").select("id,nombre,direccion,zona,telefono,whatsapp").eq("activo", true);
  if (!cfg.demo) tq = tq.eq("es_demo", false);
  const [{ data: hist }, { data: talleres }, imagen] = await Promise.all([
    db.from("mekachi_wa_mensajes").select("rol,texto").eq("conversacion_id", conv.id).order("id", { ascending: false }).limit(24),
    tq,
    imagenId && !cfg.simular ? descargarImagen(cfg, imagenId) : Promise.resolve(null),
  ]);
  const t = (talleres || []).find((x) => mismoTelefono(x.whatsapp, telefono) || mismoTelefono(x.telefono, telefono));
  const ctx: Contexto = { telefono, nombre, conversacion: conv.id, taller: t ? { id: t.id, nombre: t.nombre, direccion: t.direccion, zona: t.zona } : null, lat: conv.ult_lat, lng: conv.ult_lng };
  let respuesta: string;
  try {
    respuesta = await responder(ctx, cfg, (hist || []).reverse(), imagen);
  } catch (e) {
    console.error("Fallo al generar la respuesta", e);
    respuesta = "Tuve un problema para responderte. Inténtalo de nuevo en un momento, por favor.";
  }
  await db.from("mekachi_wa_mensajes").insert({ conversacion_id: conv.id, rol: "assistant", texto: respuesta });
  await enviar(cfg, telefono, respuesta);
  return respuesta;
}

// Tareas programadas: retomar conversaciones sin atender, avisar citas respondidas y pedir calificación.
async function tareas(cfg: Cfg) {
  const r = { retomadas: 0, citas_avisadas: 0, seguimientos: 0 };
  const limite = new Date(Date.now() - cfg.espera * 60000).toISOString();
  const { data: esperando } = await db.from("mekachi_wa_conversaciones").select("id,telefono,humano_desde").eq("requiere_humano", true).lt("humano_desde", limite);
  for (const c of esperando ?? []) {
    const { count } = await db.from("mekachi_wa_mensajes").select("id", { count: "exact", head: true }).eq("conversacion_id", c.id).eq("autor", "humano").gte("created_at", c.humano_desde);
    if ((count ?? 0) > 0) continue; // una persona ya la está atendiendo
    const txt = "Nuestro equipo todavía no ha podido escribirte, disculpa la demora. Sigo aquí: cuéntame en qué más te ayudo mientras tanto.";
    await db.from("mekachi_wa_conversaciones").update({ requiere_humano: false, motivo_humano: "", humano_desde: null }).eq("id", c.id);
    await db.from("mekachi_wa_mensajes").insert({ conversacion_id: c.id, rol: "assistant", texto: txt });
    await enviar(cfg, c.telefono, txt);
    r.retomadas++;
  }
  const { data: citas } = await db.from("mekachi_citas").select("id,num,telefono,fecha,hora,estado,conversacion_id,taller:mekachi_talleres(nombre,direccion)").in("estado", ["Confirmada", "Rechazada"]).eq("aviso_enviado", false);
  for (const c of citas ?? []) {
    // deno-lint-ignore no-explicit-any
    const t = c.taller as any;
    const txt = c.estado === "Confirmada"
      ? `Tu cita ${c.num} quedó confirmada: ${t?.nombre}, ${c.fecha} a las ${c.hora}. Dirección: ${t?.direccion}.`
      : `${t?.nombre} no puede atenderte el ${c.fecha} a las ${c.hora} (cita ${c.num}). Si quieres, te busco otro horario u otro taller.`;
    await db.from("mekachi_citas").update({ aviso_enviado: true }).eq("id", c.id);
    if (c.conversacion_id) await db.from("mekachi_wa_mensajes").insert({ conversacion_id: c.conversacion_id, rol: "assistant", texto: txt });
    if (c.telefono) await enviar(cfg, c.telefono, txt);
    r.citas_avisadas++;
  }
  // Seguimiento a los 2 o 3 días de la cita. Va fuera de la ventana de 24 horas, así que exige plantilla aprobada.
  const plantilla = env("WA_PLANTILLA_SEGUIMIENTO");
  if (plantilla) {
    const dia = (n: number) => new Date(Date.now() - n * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });
    const { data: seg } = await db.from("mekachi_citas").select("id,nombre,telefono,taller:mekachi_talleres(nombre)").eq("estado", "Confirmada").eq("seguimiento_enviado", false).gte("fecha", dia(3)).lte("fecha", dia(2));
    for (const c of seg ?? []) {
      // deno-lint-ignore no-explicit-any
      const ok = await enviarPlantilla(cfg, c.telefono, plantilla, [c.nombre || "Hola", (c.taller as any)?.nombre || "el taller"]);
      await db.from("mekachi_citas").update({ seguimiento_enviado: true }).eq("id", c.id);
      if (ok) r.seguimientos++;
    }
  }
  return r;
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!CONFIGURADO) return new Response("Mekachi WhatsApp: faltan secretos por configurar.", { status: 503 });
  const url = new URL(req.url);
  const accion = url.searchParams.get("accion");

  if (req.method === "GET") { // verificación del webhook al registrarlo en Meta
    const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env("WA_VERIFY_TOKEN");
    return new Response(ok ? url.searchParams.get("hub.challenge") ?? "" : "Token de verificación incorrecto.", { status: ok ? 200 : 403 });
  }
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const cfg = await cargarCfg();

  // Tareas programadas y simulación de prueba: solo con el secreto interno.
  if (accion === "tareas" || accion === "simular") {
    if (!cfg.cron || req.headers.get("x-mekachi-cron") !== cfg.cron) return json({ error: "No autorizado" }, 401);
    if (accion === "tareas") return json(await tareas(cfg));
    const b = await req.json();
    cfg.simular = true; cfg.admins = [];
    const respuesta = await procesar(cfg, { from: String(b.telefono), id: "sim-" + crypto.randomUUID(), type: b.tipo || "text", text: { body: b.texto }, location: b.location }, b.nombre || "Simulación");
    return json({ respuesta });
  }

  // Respuesta de una persona del equipo desde la app: exige sesión con rol despacho.
  if (accion === "responder") {
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Sesión no válida" }, 401);
    const { data: perfil } = await db.from("mekachi_perfiles").select("rol").eq("id", u.user.id).maybeSingle();
    if (perfil?.rol !== "despacho") return json({ error: "Solo despacho" }, 403);
    const b = await req.json();
    const texto = String(b.texto || "").trim().slice(0, 3500);
    const { data: conv } = await db.from("mekachi_wa_conversaciones").select("id,telefono,humano_desde").eq("id", b.conversacion_id).maybeSingle();
    if (!conv || !texto) return json({ error: "Faltan datos" }, 400);
    const ok = await enviar(cfg, conv.telefono, texto);
    if (!ok) return json({ error: "WhatsApp no aceptó el mensaje. Pasadas 24 horas desde el último mensaje de la persona solo se pueden enviar plantillas." }, 502);
    await db.from("mekachi_wa_mensajes").insert({ conversacion_id: conv.id, rol: "assistant", autor: "humano", texto });
    await db.from("mekachi_wa_conversaciones").update({ requiere_humano: true, humano_desde: conv.humano_desde ?? new Date().toISOString() }).eq("id", conv.id);
    return json({ ok: true });
  }

  // Mensajes de Meta: siempre con firma válida.
  const cuerpo = await req.text();
  if (!(await firmaValida(cuerpo, req.headers.get("x-hub-signature-256")))) return new Response("Firma no válida", { status: 401 });
  let datos;
  try { datos = JSON.parse(cuerpo); } catch { return new Response("Cuerpo no válido", { status: 400 }); }
  const pendientes: Promise<unknown>[] = [];
  for (const entrada of datos.entry ?? []) for (const cambio of entrada.changes ?? []) {
    const v = cambio.value ?? {};
    if (v.metadata?.phone_number_id && v.metadata.phone_number_id !== env("WA_PHONE_NUMBER_ID")) continue;
    for (const msg of v.messages ?? []) pendientes.push(procesar(cfg, msg, v.contacts?.[0]?.profile?.name ?? "").catch((e) => console.error("Fallo al procesar", e)));
  }
  // Se responde a Meta de inmediato y el trabajo sigue en segundo plano.
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(Promise.all(pendientes));
  return new Response("ok", { status: 200 });
});
