// Mekachi · Oficina: agentes de IA para la administración de la empresa.
// Solo responde a cuentas con mekachi_perfiles.oficina = true.
//
// POST { agente, mensaje, chat_id? } con la sesión del usuario en Authorization.
// Responde de inmediato { chat_id } y trabaja en segundo plano: la app consulta
// mekachi_oficina_chats.estado hasta que pase de "pensando" a "listo".
//
// Secretos (Supabase → Edge Functions → Secrets): ANTHROPIC_API_KEY.
// Opcional: MEKACHI_MODELO_OFICINA para cambiar de modelo.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { betaTool } from "npm:@anthropic-ai/sdk/helpers/beta/json-schema";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const r2 = (n: number) => Math.round(n * 100) / 100;

type Agente = { nombre: string; rol: string; web: boolean };
const AGENTES: Record<string, Agente> = {
  direccion: {
    nombre: "Dirección", web: false,
    rol: "Eres la jefa de gabinete del fundador. Miras todas las áreas a la vez: ventas, inventario, red de talleres, atención, marketing y riesgos legales. Cuando te pidan el informe del día, consulta las tres herramientas de datos y entrega: qué pasó, qué preocupa y de tres a cinco recomendaciones ordenadas por impacto, cada una con el dato que la respalda. Guarda cada recomendación accionable con guardar_pieza (tipo Recomendación).",
  },
  marketing: {
    nombre: "Marketing", web: true,
    rol: "Eres la responsable de marketing. Creas publicidad para Instagram, Facebook, TikTok, WhatsApp y el perfil de Google: textos listos para publicar, ideas de video, calendarios y campañas para captar talleres (el cliente que paga) y conductores. Tono: cercano, claro, ecuatoriano, sin exagerar ni prometer lo que la empresa aún no cumple. Cada publicación que propongas guárdala con guardar_pieza (tipo Publicación) con la red, la fecha sugerida, el texto completo con hashtags y un titular de máximo 60 caracteres para la imagen. No puedes publicar tú: el fundador copia el texto y descarga la imagen desde la pestaña Contenido.",
  },
  ventas: {
    nombre: "Ventas", web: false,
    rol: "Eres la gerente comercial. Vigilas las ventas de repuestos a talleres: quién compra, quién dejó de comprar, qué se vende, ticket promedio, zonas débiles. Propones acciones concretas por taller (a quién llamar, qué ofrecer), guiones de visita y de WhatsApp, metas semanales y promociones que no destruyan el margen. Apóyate siempre en resumen_ventas y talleres_y_clientes antes de opinar.",
  },
  compras: {
    nombre: "Compras y proveedores", web: true,
    rol: "Eres la responsable de compras e inventario. Tu trabajo es mejorar el margen y evitar quiebres de stock: qué reponer y cuánto, qué no rota y ocupa capital, qué proveedor conviene por línea, cómo negociar descuento por volumen y plazo de pago, y qué líneas nuevas traer (por ejemplo repuestos de marcas chinas). Usa inventario_y_compras antes de recomendar. Puedes buscar en la web proveedores, importadores y distribuidores en Ecuador; da nombre y sitio, y aclara que precios y condiciones hay que confirmarlos con el proveedor. No puedes emitir órdenes de compra: eso se hace en Despacho → Inventario.",
  },
  legal: {
    nombre: "Legal y cumplimiento", web: true,
    rol: "Eres la asesora legal interna para Ecuador. Cubres constitución de la compañía, SRI y facturación electrónica, IVA, contratos con talleres, repartidores, proveedores y grúas, términos y condiciones, garantías y devoluciones (Ley Orgánica de Defensa del Consumidor), protección de datos personales (LOPDP), relación laboral de repartidores (Código del Trabajo, IESS) y registro de marca (SENADI). Das orientación práctica y borradores de documentos. Verifica en la web la norma vigente cuando cites plazos, porcentajes o artículos, y nombra la fuente. Di con claridad cuándo algo debe revisarlo un abogado o un contador antes de firmar o presentar: tus respuestas son orientación, no asesoría legal profesional. Los borradores guárdalos con guardar_pieza (tipo Documento).",
  },
  finanzas: {
    nombre: "Finanzas", web: false,
    rol: "Eres la responsable financiera. Analizas ventas, margen bruto, valor del inventario, capital inmovilizado, punto de equilibrio y flujo de caja a partir de los datos de la plataforma. Explicas los números en lenguaje simple y señalas qué supuestos estás haciendo. La plataforma no registra todavía gastos fijos, sueldos ni cuentas bancarias: cuando los necesites, pídelos en lugar de inventarlos.",
  },
};

async function config(): Promise<Record<string, string>> {
  const { data } = await db.from("mekachi_config").select("clave,valor");
  const c: Record<string, string> = {};
  for (const f of data ?? []) c[f.clave] = typeof f.valor === "string" ? f.valor : JSON.stringify(f.valor);
  return c;
}

function herramientas(agente: string, creadas: string[]) {
  // deno-lint-ignore no-explicit-any
  const lista: any[] = [
    betaTool({
      name: "resumen_ventas",
      description: "Ventas de repuestos a talleres en los últimos N días: total, margen estimado, pedidos por estado, por bodega, por taller, por día, productos más vendidos y tiempos de entrega. Úsala antes de afirmar cualquier cifra de ventas.",
      inputSchema: { type: "object", properties: { dias: { type: "integer", description: "Días hacia atrás, entre 1 y 365. Por defecto 30." } }, additionalProperties: false },
      run: async (i: { dias?: number }) => {
        const dias = Math.min(Math.max(i.dias ?? 30, 1), 365), desde = new Date(Date.now() - dias * 864e5).toISOString();
        const [{ data: ped }, { data: inv }, { data: bod }] = await Promise.all([
          db.from("mekachi_pedidos").select("num,estado,subtotal,recargo,tipo_entrega,created_at,salida_at,entregado_at,bodega_id,es_demo,devolucion_estado,taller:mekachi_talleres(nombre,zona),items:mekachi_pedido_items(producto_id,nombre,cantidad,precio_unit)").gte("created_at", desde).limit(2000),
          db.from("mekachi_inventario").select("producto_id,costo"),
          db.from("mekachi_bodegas").select("id,nombre"),
        ]);
        const costo = new Map((inv ?? []).map((x) => [x.producto_id, +x.costo || 0]));
        const nb = new Map((bod ?? []).map((b) => [b.id, b.nombre]));
        const vivos = (ped ?? []).filter((p) => p.estado !== "Cancelado");
        let venta = 0, margen = 0; const porEstado: Record<string, number> = {}, porBodega: Record<string, number> = {}, porTaller: Record<string, { venta: number; pedidos: number; zona: string }> = {}, porDia: Record<string, number> = {}, porProd: Record<string, { unidades: number; venta: number }> = {};
        const minutos: number[] = [];
        for (const p of ped ?? []) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;
        for (const p of vivos) {
          const sub = +p.subtotal || 0; venta += sub + (+p.recargo || 0); margen += +p.recargo || 0;
          // deno-lint-ignore no-explicit-any
          const t = p.taller as any; const tn = t?.nombre ?? "Sin taller";
          porTaller[tn] = porTaller[tn] ?? { venta: 0, pedidos: 0, zona: t?.zona ?? "" }; porTaller[tn].venta += sub; porTaller[tn].pedidos++;
          const b = nb.get(p.bodega_id) ?? "Sin bodega"; porBodega[b] = (porBodega[b] ?? 0) + sub;
          const d = p.created_at.slice(0, 10); porDia[d] = (porDia[d] ?? 0) + sub;
          if (p.salida_at && p.entregado_at) minutos.push((+new Date(p.entregado_at) - +new Date(p.salida_at)) / 6e4);
          for (const l of p.items ?? []) {
            if (l.precio_unit == null) continue;
            porProd[l.nombre] = porProd[l.nombre] ?? { unidades: 0, venta: 0 }; porProd[l.nombre].unidades += l.cantidad; porProd[l.nombre].venta += l.cantidad * +l.precio_unit;
            if (l.producto_id && costo.has(l.producto_id)) margen += l.cantidad * (+l.precio_unit - (costo.get(l.producto_id) ?? 0));
          }
        }
        return JSON.stringify({
          periodo_dias: dias, incluye_datos_demo: vivos.some((p) => p.es_demo), pedidos: vivos.length, venta_sin_iva: r2(venta), margen_bruto_estimado: r2(margen), margen_pct: venta ? r2(margen / venta * 100) : null,
          ticket_promedio: vivos.length ? r2(venta / vivos.length) : null, urgentes: vivos.filter((p) => p.tipo_entrega === "Urgente").length, devoluciones: vivos.filter((p) => p.devolucion_estado).length,
          minutos_bodega_a_taller_promedio: minutos.length ? Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length) : null,
          por_estado: porEstado, por_bodega: porBodega, por_dia: porDia,
          por_taller: Object.entries(porTaller).sort((a, b) => b[1].venta - a[1].venta).slice(0, 25).map(([n, v]) => ({ taller: n, zona: v.zona, venta: r2(v.venta), pedidos: v.pedidos })),
          productos_mas_vendidos: Object.entries(porProd).sort((a, b) => b[1].venta - a[1].venta).slice(0, 20).map(([n, v]) => ({ producto: n, unidades: v.unidades, venta: r2(v.venta) })),
          nota: "El margen usa el costo promedio del inventario; las piezas fuera de catálogo no entran en el margen.",
        });
      },
    }),
    betaTool({
      name: "inventario_y_compras",
      description: "Estado del inventario y de las compras: valor al costo, productos bajo mínimo o sin existencias, productos sin rotación en 30 días, margen por producto, existencias por bodega, proveedores registrados y órdenes de compra recientes.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const desde = new Date(Date.now() - 30 * 864e5).toISOString();
        const [{ data: prod }, { data: sb }, { data: bod }, { data: oc }, { data: it }] = await Promise.all([
          db.from("mekachi_productos").select("id,codigo,categoria,nombre,marca,compatibilidad,precio,activo,es_demo,inv:mekachi_inventario(stock,stock_minimo,costo,proveedor)").eq("activo", true).limit(1000),
          db.from("mekachi_stock_bodega").select("bodega_id,producto_id,stock"),
          db.from("mekachi_bodegas").select("id,nombre,activa"),
          db.from("mekachi_compras").select("num,proveedor,estado,total,created_at,recibida_at").order("created_at", { ascending: false }).limit(30),
          db.from("mekachi_pedido_items").select("producto_id,cantidad,pedido:mekachi_pedidos!inner(estado,created_at)").gte("pedido.created_at", desde).neq("pedido.estado", "Cancelado").limit(5000),
        ]);
        const vend = new Map<string, number>(); for (const l of it ?? []) if (l.producto_id) vend.set(l.producto_id, (vend.get(l.producto_id) ?? 0) + l.cantidad);
        const filas = (prod ?? []).map((p) => {
          // deno-lint-ignore no-explicit-any
          const i = (Array.isArray(p.inv) ? p.inv[0] : p.inv) as any ?? {}; const costo = +i.costo || 0, precio = +p.precio || 0, stock = i.stock ?? 0;
          return { id: p.id, producto: p.nombre + " · " + p.compatibilidad, categoria: p.categoria, marca: p.marca, stock, minimo: i.stock_minimo ?? 0, costo, precio, margen_pct: precio ? r2((precio - costo) / precio * 100) : null, proveedor: i.proveedor || "sin proveedor", vendidas_30d: vend.get(p.id) ?? 0, demo: p.es_demo };
        });
        const porProv: Record<string, { productos: number; valor: number }> = {};
        for (const f of filas) { porProv[f.proveedor] = porProv[f.proveedor] ?? { productos: 0, valor: 0 }; porProv[f.proveedor].productos++; porProv[f.proveedor].valor += f.stock * f.costo; }
        const porBod: Record<string, number> = {}; const nb = new Map((bod ?? []).map((b) => [b.id, b.nombre]));
        for (const s of sb ?? []) { const n = nb.get(s.bodega_id) ?? "?"; porBod[n] = (porBod[n] ?? 0) + s.stock; }
        const sin = (f: typeof filas[number]) => ({ producto: f.producto, stock: f.stock, minimo: f.minimo, vendidas_30d: f.vendidas_30d, proveedor: f.proveedor, costo: f.costo, margen_pct: f.margen_pct });
        return JSON.stringify({
          incluye_datos_demo: filas.some((f) => f.demo), productos: filas.length, unidades: filas.reduce((n, f) => n + f.stock, 0), valor_al_costo: r2(filas.reduce((n, f) => n + f.stock * f.costo, 0)), valor_a_precio_venta: r2(filas.reduce((n, f) => n + f.stock * f.precio, 0)),
          unidades_por_bodega: porBod,
          sin_existencias: filas.filter((f) => f.stock === 0).map(sin), bajo_minimo: filas.filter((f) => f.stock > 0 && f.stock <= f.minimo).map(sin),
          sin_rotacion_30d_con_stock: filas.filter((f) => f.vendidas_30d === 0 && f.stock > 0).sort((a, b) => b.stock * b.costo - a.stock * a.costo).slice(0, 25).map((f) => ({ ...sin(f), capital_inmovilizado: r2(f.stock * f.costo) })),
          mas_vendidos_30d: filas.filter((f) => f.vendidas_30d > 0).sort((a, b) => b.vendidas_30d - a.vendidas_30d).slice(0, 20).map(sin),
          menor_margen: [...filas].sort((a, b) => (a.margen_pct ?? 0) - (b.margen_pct ?? 0)).slice(0, 10).map(sin),
          margen_por_categoria: Object.fromEntries([...new Set(filas.map((f) => f.categoria))].map((c) => { const fs = filas.filter((f) => f.categoria === c); return [c, r2(fs.reduce((n, f) => n + (f.margen_pct ?? 0), 0) / fs.length)]; })),
          proveedores: Object.entries(porProv).map(([n, v]) => ({ proveedor: n, productos: v.productos, valor_en_bodega: r2(v.valor) })),
          ordenes_de_compra_recientes: oc ?? [],
        });
      },
    }),
    betaTool({
      name: "talleres_y_clientes",
      description: "Estado de la red y de los clientes: talleres con su última compra y total comprado, talleres inactivos, talleres por verificar, conductores registrados, solicitudes de servicio, citas, grúas, repartidores y conversaciones de WhatsApp que esperan a una persona.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
        const [{ data: tal }, { data: ped }, { data: per }, { data: sol }, { data: conv }, { data: gr }, { data: rep }, { data: prov }] = await Promise.all([
          db.from("mekachi_talleres").select("id,nombre,zona,sector,especialidades,verificado,activo,es_demo,rating_suma,rating_total,created_at").limit(2000),
          db.from("mekachi_pedidos").select("taller_id,subtotal,estado,created_at").neq("estado", "Cancelado").limit(5000),
          db.from("mekachi_perfiles").select("rol"),
          db.from("mekachi_solicitudes").select("estado,precio_final,created_at").limit(3000),
          db.from("mekachi_wa_conversaciones").select("requiere_humano,motivo_humano,updated_at").order("updated_at", { ascending: false }).limit(300),
          db.from("mekachi_gruas_solicitudes").select("estado,precio_final").limit(2000),
          db.from("mekachi_repartidores").select("nombre,verificado,activo,es_demo"),
          db.from("mekachi_gruas_proveedores").select("nombre,zona,verificado,activo,es_demo"),
        ]);
        const hoy = Date.now(); const cuenta = <T,>(a: T[] | null, k: (x: T) => string) => (a ?? []).reduce((o: Record<string, number>, x) => { o[k(x)] = (o[k(x)] ?? 0) + 1; return o; }, {});
        const talleres = (tal ?? []).map((t) => {
          const ps = (ped ?? []).filter((p) => p.taller_id === t.id); const ult = ps.map((p) => p.created_at).sort().pop();
          return { taller: t.nombre, zona: t.zona, sector: t.sector, verificado: t.verificado, activo: t.activo, demo: t.es_demo, pedidos: ps.length, comprado: r2(ps.reduce((n, p) => n + (+p.subtotal || 0), 0)), dias_desde_ultima_compra: ult ? Math.floor((hoy - +new Date(ult)) / 864e5) : null, calificacion: t.rating_total ? r2(t.rating_suma / t.rating_total) : null };
        });
        return JSON.stringify({
          incluye_datos_demo: talleres.some((t) => t.demo), talleres_total: talleres.length, talleres_verificados: talleres.filter((t) => t.verificado).length, talleres_por_verificar: talleres.filter((t) => !t.verificado).map((t) => t.taller),
          talleres_que_nunca_compraron: talleres.filter((t) => t.activo && t.pedidos === 0).map((t) => ({ taller: t.taller, zona: t.zona })),
          talleres_sin_comprar_hace_mas_de_14_dias: talleres.filter((t) => (t.dias_desde_ultima_compra ?? 0) > 14).map((t) => ({ taller: t.taller, zona: t.zona, dias: t.dias_desde_ultima_compra, comprado: t.comprado })),
          talleres: talleres.sort((a, b) => b.comprado - a.comprado).slice(0, 60), talleres_por_zona: cuenta(tal, (t) => t.zona),
          cuentas_por_rol: cuenta(per, (p) => p.rol), solicitudes_de_servicio_por_estado: cuenta(sol, (s) => s.estado), cobrado_por_talleres: r2((sol ?? []).reduce((n, s) => n + (+s.precio_final || 0), 0)),
          gruas_por_estado: cuenta(gr, (g) => g.estado), proveedores_de_grua: (prov ?? []).length, repartidores: (rep ?? []).map((x) => ({ nombre: x.nombre, verificado: x.verificado, activo: x.activo })),
          whatsapp_conversaciones: (conv ?? []).length, whatsapp_esperando_a_una_persona: (conv ?? []).filter((c) => c.requiere_humano).map((c) => c.motivo_humano),
        });
      },
    }),
    betaTool({
      name: "guardar_pieza",
      description: "Guarda un entregable en la pestaña Contenido de la Oficina para que el fundador lo revise: una Publicación para redes, una Recomendación accionable o un Documento (contrato, política, guion, plan). Úsala cada vez que produzcas algo que deba conservarse; en el chat basta un resumen.",
      inputSchema: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: ["Publicación", "Recomendación", "Documento"] },
          titulo: { type: "string", description: "Título corto que identifique la pieza." },
          contenido: { type: "string", description: "Texto completo y listo para usar, en texto plano." },
          red: { type: "string", enum: ["Instagram", "Facebook", "TikTok", "WhatsApp", "Google", ""], description: "Solo para Publicación: la red de destino." },
          titular: { type: "string", description: "Solo para Publicación: frase de hasta 60 caracteres que irá sobre la imagen." },
          fecha: { type: "string", description: "Fecha sugerida AAAA-MM-DD para publicar o ejecutar. Opcional." },
        },
        required: ["tipo", "titulo", "contenido"], additionalProperties: false,
      },
      run: async (i: { tipo: string; titulo: string; contenido: string; red?: string; titular?: string; fecha?: string }) => {
        const { error } = await db.from("mekachi_oficina_piezas").insert({ agente, tipo: i.tipo, titulo: i.titulo.slice(0, 160), contenido: i.contenido, red: i.red ?? "", titular: (i.titular ?? "").slice(0, 90), fecha: /^\d{4}-\d{2}-\d{2}$/.test(i.fecha ?? "") ? i.fecha : null });
        if (error) return "No se pudo guardar: " + error.message;
        creadas.push(i.titulo);
        return "Guardado en Contenido como " + i.tipo + ".";
      },
    }),
    betaTool({
      name: "leer_piezas",
      description: "Lista lo que ya está guardado en Contenido (publicaciones, recomendaciones y documentos) con su estado, para no repetir y para dar seguimiento a recomendaciones abiertas.",
      inputSchema: { type: "object", properties: { tipo: { type: "string", enum: ["Publicación", "Recomendación", "Documento"] } }, additionalProperties: false },
      run: async (i: { tipo?: string }) => {
        let q = db.from("mekachi_oficina_piezas").select("agente,tipo,titulo,red,estado,fecha,created_at").order("created_at", { ascending: false }).limit(40);
        if (i.tipo) q = q.eq("tipo", i.tipo);
        const { data } = await q;
        return JSON.stringify(data ?? []);
      },
    }),
  ];
  if (AGENTES[agente].web) lista.push({ type: "web_search_20260209", name: "web_search", max_uses: 4 });
  return lista;
}

async function trabajar(chat: string, agente: string) {
  const creadas: string[] = [];
  try {
    const [{ data: hist }, cfg] = await Promise.all([db.from("mekachi_oficina_mensajes").select("rol,texto").eq("chat_id", chat).order("id", { ascending: false }).limit(30), config()]);
    const messages = (hist ?? []).reverse().map((m) => ({ role: m.rol as "user" | "assistant", content: m.texto }));
    while (messages.length && messages[0].role !== "user") messages.shift();
    const a = AGENTES[agente];
    const system = [
      "Trabajas en la Oficina de Mekachi, el espacio de administración que solo usa el fundador. " + a.rol,
      "Sobre Mekachi: plataforma de Quito, Ecuador, que conecta conductores con talleres mecánicos verificados y gana vendiendo repuestos a esos talleres, con entrega desde bodegas propias y repartidores propios. También coordina grúas y atiende por un asistente de WhatsApp. Está en etapa de piloto. Moneda: dólares. IVA: 15 %. Plan: Quito primero, luego Guayaquil y el resto del país.",
      cfg.modo_demo === "true" || cfg.modo_demo === "\"true\"" ? "La plataforma está en MODO DEMOSTRACIÓN: talleres, repuestos, precios, pedidos y grúas son de ejemplo. Cuando des cifras sacadas de las herramientas, di una vez que provienen de datos de demostración y no de ventas reales." : "",
      cfg.datos_negocio ? "Datos del negocio registrados por el fundador (los que digan PENDIENTE aún no están definidos; no los inventes): " + cfg.datos_negocio : "",
      "Cómo trabajar: consulta las herramientas de datos antes de afirmar cifras y nunca inventes números, nombres de clientes, leyes ni proveedores. Si falta un dato, dilo y pide lo mínimo necesario. Da recomendaciones concretas, con el dato que las respalda y el siguiente paso. Lo que no puedes hacer: publicar en redes, enviar mensajes a clientes, mover dinero, firmar ni emitir compras; preparas todo y el fundador decide y ejecuta.",
      "Formato: español de Ecuador, directo y sin relleno. Escribe en texto plano, sin Markdown: nada de asteriscos, almohadillas ni tablas. Usa párrafos cortos y listas con guion cuando ayuden. Las piezas largas van en guardar_pieza; en el chat deja el resumen y di dónde quedó guardado.",
      "Fecha de hoy: " + new Date().toLocaleDateString("es-EC", { timeZone: "America/Guayaquil", weekday: "long", year: "numeric", month: "long", day: "numeric" }) + ".",
    ].filter(Boolean).join("\n\n");
    const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
    const final = await client.beta.messages.toolRunner({
      model: env("MEKACHI_MODELO_OFICINA") || "claude-opus-5-5",
      max_tokens: 12000,
      output_config: { effort: "medium" },
      // Si el modelo declina por una política de seguridad, la API reintenta sola con un modelo de respaldo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      tools: herramientas(agente, creadas),
      messages,
      max_iterations: 10,
    });
    let texto = final.stop_reason === "refusal" ? "Con eso no puedo ayudarte. Dime qué necesitas para la empresa y lo vemos."
      : final.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("").trim();
    if (!texto) texto = creadas.length ? "Listo. Guardé en Contenido: " + creadas.join("; ") + "." : "No pude completar la respuesta. Inténtalo de nuevo con una pregunta más corta.";
    await db.from("mekachi_oficina_mensajes").insert({ chat_id: chat, rol: "assistant", texto });
    await db.from("mekachi_oficina_chats").update({ estado: "listo", error: "", updated_at: new Date().toISOString() }).eq("id", chat);
  } catch (e) {
    console.error("Oficina", e);
    const msg = e instanceof Anthropic.APIError ? "El servicio de IA respondió con un error (" + (e.status ?? "sin código") + "). Inténtalo de nuevo en un momento." : "No se pudo completar la respuesta.";
    await db.from("mekachi_oficina_chats").update({ estado: "error", error: msg, updated_at: new Date().toISOString() }).eq("id", chat);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!env("ANTHROPIC_API_KEY")) return json({ error: "Falta configurar ANTHROPIC_API_KEY" }, 503);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return json({ error: "Sesión no válida" }, 401);
  const { data: perfil } = await db.from("mekachi_perfiles").select("oficina").eq("id", u.user.id).maybeSingle();
  if (!perfil?.oficina) return json({ error: "La Oficina solo está disponible para la administración de Mekachi" }, 403);
  let b: { agente?: string; mensaje?: string; chat_id?: string };
  try { b = await req.json(); } catch { return json({ error: "Cuerpo no válido" }, 400); }
  const agente = String(b.agente || ""), mensaje = String(b.mensaje || "").trim().slice(0, 8000);
  if (!AGENTES[agente] || !mensaje) return json({ error: "Faltan datos" }, 400);
  let chat = b.chat_id || "";
  if (chat) {
    const { data: c } = await db.from("mekachi_oficina_chats").select("id,agente,estado").eq("id", chat).maybeSingle();
    if (!c || c.agente !== agente) return json({ error: "Conversación no encontrada" }, 404);
    if (c.estado === "pensando") return json({ error: "El agente todavía está respondiendo" }, 409);
  } else {
    const { data: c, error } = await db.from("mekachi_oficina_chats").insert({ agente, titulo: mensaje.slice(0, 70) }).select("id").single();
    if (error || !c) return json({ error: "No se pudo abrir la conversación" }, 500);
    chat = c.id;
  }
  await db.from("mekachi_oficina_mensajes").insert({ chat_id: chat, rol: "user", texto: mensaje });
  await db.from("mekachi_oficina_chats").update({ estado: "pensando", error: "", updated_at: new Date().toISOString() }).eq("id", chat);
  // deno-lint-ignore no-explicit-any
  (globalThis as any).EdgeRuntime?.waitUntil(trabajar(chat, agente));
  return json({ chat_id: chat });
});
