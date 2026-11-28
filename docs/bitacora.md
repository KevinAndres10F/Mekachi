# Bitácora de Mekachi

Registro de lo construido, lo que funciona hoy y lo que falta. Se actualiza cada vez que se agrega o cambia algo en la plataforma.

**Última actualización:** 28 de noviembre de 2026

No se guardan aquí claves, contraseñas ni teléfonos personales. Las claves viven solo en los secretos de Supabase.

---

## 1. Dónde está cada cosa

| Qué | Dónde |
|---|---|
| App (conductor, taller, repartidor, grúa, despacho, oficina) | Raíz del sitio: `index.html`, `app.js`, `datos.js`, `brand.css` |
| Plan de crecimiento | `/plan/` |
| Plan de negocios 2027–2036 | `/presentacion/` |
| Presentación de ventas para talleres | `/talleres/` |
| Asistente de WhatsApp | `supabase/functions/mekachi-whatsapp/` |
| Agentes de la Oficina | `supabase/functions/mekachi-oficina/` |
| Generador de imágenes y video de la app | `medios.js` |
| Video con Remotion y HyperFrames | `/video/` (instrucciones en `video/README.md`) |
| Fotos del demo y sus créditos | `/fotos/` |
| Proceso de WhatsApp | `docs/whatsapp-setup.md` |
| Base de datos | Supabase, tablas con prefijo `mekachi_` |
| Publicación | Netlify, desde la rama `main` |

---

## 2. Registro por fecha

### 23 de noviembre de 2026 — Idea, plan y primer demo

- Se aterrizó el modelo: la app trae al cliente y el ingreso sale de vender repuestos a los talleres.
- Página del plan de crecimiento (`/plan/`), con Quito como ciudad de arranque.
- Primer panel del taller para pedir repuestos.
- Sitio unificado con marca propia: azul marino, azul de acción, ámbar, tipografía Barlow y logo de tuerca con visto.
- Perfil de conductor: diagnóstico por 21 síntomas y mapa de talleres.
- App instalable en el teléfono (PWA) con navegación por pestañas.
- Primera presentación del modelo de negocio.

### 27 de noviembre de 2026 — Plataforma real

- **Base de datos y cuentas.** Conexión a Supabase, registro e inicio de sesión, seguridad por perfil en cada tabla.
- **Correcciones de cuenta.** La pantalla de cuenta ya no vuelve sola a "Iniciar sesión"; si el correo ya existe, la app lo dice.
- **Superadmin.** La cuenta del fundador quedó con rol de despacho.
- **Asistente de WhatsApp con IA.** Funciona en modo de pruebas con el número de prueba de Meta. Busca talleres y repuestos, agenda citas, pide grúa, informa el estado de un pedido, registra pedidos de talleres y pasa la conversación a una persona. Retoma solo si nadie atiende en 30 minutos.
- **Seguimiento de clientes.** Conductores y talleres en una lista, con historial, etapa, notas y próximo contacto.
- **Datos de demostración.** Talleres, repuestos, pedidos y solicitudes de ejemplo, marcados como demo.
- **Inventario.** Existencias, mínimos, costo promedio, margen, movimientos, órdenes de compra, conteo físico y devolución a bodega al cancelar.
- **Grúas.** Solicitud desde la app o WhatsApp y perfil propio para el proveedor de grúa.
- Presentación actualizada con el producto.

### 28 de noviembre de 2026 — Distribución, plan de negocios y Oficina

- **Bodegas y reparto propio.** Bodegas con existencias separadas, traslados, perfil de repartidor, entrega con código de 4 dígitos y devoluciones.
- **Rutas.** Orden sugerido de paradas (urgentes primero, luego menor distancia), enlace a Google Maps y recogida por lote.
- **Aviso de salida.** El taller ve la hora de salida y el repartidor; el asistente de WhatsApp avisa con el código de entrega.
- **Recargo por urgente.** $3 más IVA; la ruta programada va incluida.
- **Dos bodegas en Quito (demo).** Norte, en El Inca, y Sur, en El Recreo. Cada pedido se asigna solo a la bodega más cercana al taller.
- **Indicadores de distribución.** Margen bruto, margen sobre la venta, tiempo de bodega al taller, entregas en 24 horas y actividad por bodega.
- **Datos demo de reparto y grúas.** 18 pedidos nuevos, tres repartidores y nueve servicios de grúa.
- **Plan de negocios 2027–2036.** 27 láminas con mercado, economía por taller, expansión a todo Ecuador, proyecciones a 5 y 10 años, escenarios, inversión, equipo y riesgos.
- **Oficina.** Módulo solo para el fundador con seis agentes de IA (Dirección, Marketing, Ventas, Compras, Legal y Finanzas), informe del día, recomendaciones y contenido con imagen de marca descargable.
- **Bitácora** (este documento) y **presentación de ventas para talleres** (`/talleres/`).
- **Imágenes y videos desde la Oficina.** Seis plantillas de imagen (titular, foto, oferta, consejo, testimonio y carrusel) en tres formatos (cuadrado, vertical e historia). El agente de Marketing elige plantilla, formato y foto; la app dibuja la imagen y graba el video en el navegador.
- **Remotion y HyperFrames.** Proyectos en `/video` que convierten el mismo guion en MP4. Los dos se probaron y producen el mismo video.
- **Fotos de archivo.** Cinco fotos de Wikimedia Commons con licencia libre y crédito visible, usadas en plantillas, videos y en seis talleres del demo. Créditos en `fotos/CREDITOS.md`.
- **Video «Cómo pedir un repuesto»** (30 segundos), incluido en la presentación de ventas.
- **Render y Drive desde el chat.** `video/render-oficina.cjs` renderiza las piezas de la Oficina (PNG a resolución completa y MP4 con Remotion). Desde el chat de Claude Code se suben a la carpeta «Mekachi · Contenido» de Google Drive y el enlace queda en cada pieza. Primera tanda: 8 imágenes subidas; el video no, por el límite de tamaño del conector.

---

## 3. Qué funciona hoy

Probado en el navegador con cuentas de prueba, salvo donde se indica.

### Conductor
- Diagnóstico inicial por síntomas, con urgencia y causas probables.
- Mapa y lista de talleres con filtros.
- Solicitud de precio a varios talleres, aceptación, cierre y calificación.
- Garaje con vehículos, recordatorios e historial.
- Solicitud de grúa, con o sin cuenta.

### Taller
- Registro, perfil y ubicación.
- Trabajos recibidos con diagnóstico adjunto y precio cerrado.
- Catálogo de repuestos, carrito, piezas fuera de lista para cotizar.
- Pedido en ruta programada o urgente, con el recargo a la vista.
- Seguimiento del pedido, hora de salida de bodega, código de entrega y solicitud de devolución.
- Citas pedidas por WhatsApp.

### Repartidor
- Pedidos listos de su bodega, recogida uno a uno o por lote.
- Ruta sugerida y enlace a Google Maps.
- Entrega con el código que da el taller.
- Recogida de devoluciones.

### Grúa
- Registro y verificación, disponible o en pausa.
- Aceptar, devolver o completar solicitudes y registrar lo cobrado.

### Despacho
- Resumen con indicadores de repuestos, distribución, servicios y red.
- Pedidos: cotizar piezas, asignar bodega y repartidor, avanzar estados, cancelar.
- Inventario por bodega, compras, conteos y traslados.
- Atención: conversaciones de WhatsApp, grúas y citas.
- Clientes y verificación de talleres, repartidores y grúas.

### Oficina
- Seis agentes que consultan los datos de la plataforma. Probados: Ventas, Legal y Marketing. Dirección, Compras y Finanzas usan el mismo mecanismo y no se probaron en el navegador.
- Marketing, Compras y Legal buscan en la web y citan la fuente.
- Contenido con texto para copiar, imagen para descargar (seis plantillas, tres formatos, carrusel de varios cuadros) y video corto que se reproduce y se descarga en MP4.
- Probado de punta a punta: Marketing dejó una oferta, un carrusel, una historia y un video de 24 segundos en 47 segundos.

### WhatsApp
- Asistente activo en modo de pruebas (función en versión 6).
- **Sin probar:** el aviso real de salida de pedido a un taller. La tarea corre sin errores pero en las pruebas no envió ningún mensaje.

---

## 4. Pendientes

### Del fundador
- [ ] Completar los datos del negocio en `mekachi_config` (hoy dicen PENDIENTE): horario, cobertura, formas de pago, garantía.
- [ ] Número propio de WhatsApp y verificación del negocio en Meta.
- [ ] Plantillas de WhatsApp aprobadas, para avisar fuera de la ventana de 24 horas.
- [ ] Agregar la dirección del sitio de Netlify a las URL permitidas de Supabase Auth.
- [ ] Número de WhatsApp de contacto en `datos.js`.
- [ ] Acuerdos con 2 o 3 distribuidores: lista de precios, descuento y plazo.
- [ ] Catálogo, costos y precios reales.
- [ ] Locales reales para las bodegas Norte y Sur; las direcciones actuales son de referencia.
- [ ] Primeros 10 talleres piloto y primeros proveedores de grúa.
- [ ] Constituir la compañía, RUC y facturación electrónica.
- [ ] Confirmar las condiciones para talleres que aparecen en la presentación de ventas.
- [ ] Aprobar el borrado de los datos de prueba (ver 4.3).

### De producto
- [ ] Informe automático de la Oficina cada mañana.
- [ ] Conectar Instagram, Facebook y el perfil de Google para publicar desde la Oficina.
- [ ] Subir fotos propias de talleres, bodega y reparto, y reemplazar las de archivo.
- [ ] Música o voz en los videos; hoy salen sin sonido.
- [ ] Servicio de render para que la Oficina entregue el MP4 de Remotion o HyperFrames sin usar la línea de comandos.
- [ ] Registrar gastos fijos, sueldos y caja, para que Finanzas trabaje con datos completos.
- [ ] Pagos en línea y factura electrónica.
- [ ] Transcripción de audios en WhatsApp.
- [ ] Rutas por calles y tráfico; hoy el orden usa distancia en línea recta.
- [ ] Base de datos propia para Mekachi; hoy comparte proyecto con otras aplicaciones.
- [ ] Salir del modo demostración cuando haya datos reales.

### Datos de prueba por borrar
Quedaron en la base y requieren aprobación del fundador en Supabase:
- Tres usuarios `prueba-*@mekachi-prueba.invalid`.
- "Taller Prueba Reparto" y sus pedidos MK-0007 a MK-0009.
- Repartidora "Rita Prueba" y "Bodega Prueba Sur" (cerrada, con 2 unidades por devolver a la Bodega Norte).
- Chats de prueba en la Oficina y las publicaciones y el video de ejemplo de Marketing (sirven de muestra; se pueden descartar desde la app).

---

## 5. Supuestos que hay que confirmar

- **Recargo por urgente:** $3 más IVA. Se cambia en `mekachi_config` (`recargo_urgente`) y en `datos.js`.
- **Cortes de ruta:** 09:00, 12:00 y 15:00.
- **Formas de pago:** transferencia, Deuna y efectivo contra entrega.
- **Proyecciones del plan de negocios:** son supuestos del escenario base, no resultados.
- **Todas las cifras de la app son de demostración** hasta cargar datos reales.
- **Las fotos son de archivo**, no de talleres afiliados. Varias tienen licencia CC BY-SA, que obliga a dar crédito y a compartir las obras derivadas con la misma licencia; para publicidad real conviene usar fotos propias.
- **Remotion** pide licencia de pago a empresas a partir de cierto tamaño; hay que revisar sus condiciones antes de usarlo comercialmente.

---

## 6. Cómo pedir render y Drive desde el chat

En una sesión de Claude Code con este repositorio y los conectores de Supabase y Google Drive:

1. Pide: «renderiza lo pendiente de la Oficina y guárdalo en Drive».
2. El asistente lee las publicaciones y videos sin archivo, los renderiza con `video/render-oficina.cjs` y los sube a «Mekachi · Contenido».
3. Guarda el enlace en cada pieza; la app lo muestra en Contenido como «En Drive».

Límites: el conector de Drive acepta unos 3 MB por archivo desde el chat, así que un video más pesado hay que comprimirlo o bajarlo desde la app. La app no sube a Drive por sí sola: eso requeriría conectar una cuenta de Google con permisos propios.

## 7. Cómo mantener esta bitácora

Agregar una entrada en la sección 2 con la fecha, mover a la sección 3 lo que quedó funcionando y marcar o quitar lo que salga de la sección 4.
