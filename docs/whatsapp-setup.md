# Proceso de WhatsApp

Cómo está montado el asistente de WhatsApp con IA de Mekachi y cómo repetir o mantener la configuración. Este documento no contiene claves: los valores viven solo en los secretos de Supabase.

## Estado

Funcionando en **modo pruebas** desde el 27 de noviembre de 2026. Solo responde a los destinatarios agregados a mano en Meta (máximo 5).

## Datos de la configuración

Son identificadores, no claves. Sin el token no dan acceso a nada.

**Meta**

| Dato | Valor |
|---|---|
| App | Mekachi, tipo Negocios, caso de uso "Otro" |
| Identificador de la app | `2491382474720894` |
| Modo de la app | Activo |
| Portafolio comercial | Mekachi, `1359383679534091` (sin verificar) |
| Cuenta de WhatsApp Business | "Test WhatsApp Account", `2948859242173845` |
| Número | De prueba de Meta: +1 555 188 2110 |
| Identificador del número | `1517041161485607` |
| Destinatarios de prueba | Un número personal verificado; no se anota aquí |
| Usuario del sistema | `mekachi-bot` (`61597061188435`), rol Administrador, control total sobre la app y la cuenta de WhatsApp |
| Token | Permanente, sin caducidad, con `whatsapp_business_messaging` y `whatsapp_business_management` |
| Webhook | Campo `messages` suscrito, versión v27.0 |
| Política de privacidad | [Documento público de Google](https://docs.google.com/document/d/1PglimFYXW2j09Ky3p9juQsXgWDH4h95r_5v3OjdCHvw/edit?usp=sharing), categoría "Negocios y páginas" |

**Supabase**

| Dato | Valor |
|---|---|
| Proyecto | `hxhpgpvfjgurugnmdrbu` |
| Función | `mekachi-whatsapp`, versión 3, sin verificación de JWT (valida la firma de Meta) |
| Secretos | Los cinco de la tabla de más abajo, cargados |
| Clave de Claude | Se llama `mekachi-whatsapp` en la consola de Claude |

El código desplegado es idéntico al del repositorio (comprobado el 27 de noviembre de 2026).

## Cómo funciona

1. Una persona escribe al número de WhatsApp de Mekachi.
2. Meta envía el mensaje al webhook, que es una función de Supabase.
3. La función comprueba la firma de Meta, guarda el mensaje y descarta duplicados.
4. Claude responde usando datos reales: talleres verificados y catálogo de repuestos.
5. La respuesta se guarda y se envía por la API de WhatsApp.

| Pieza | Dónde está |
|---|---|
| Código | `supabase/functions/mekachi-whatsapp/index.ts` |
| Función desplegada | `mekachi-whatsapp`, proyecto de Supabase `hxhpgpvfjgurugnmdrbu` |
| Webhook | `https://hxhpgpvfjgurugnmdrbu.supabase.co/functions/v1/mekachi-whatsapp` |
| Conversaciones | Tabla `mekachi_wa_conversaciones` |
| Mensajes | Tabla `mekachi_wa_mensajes` |
| Modelo | Claude Opus 5.5 por defecto; configurable |
| Citas | Tabla `mekachi_citas` |
| Grúas | Tablas `mekachi_gruas_proveedores` y `mekachi_gruas_solicitudes` |
| Configuración | Tabla `mekachi_config` |

## Qué hace el asistente

- **Se presenta** en el primer mensaje como asistente automático.
- **Conductores:** pregunta por el síntoma y por el barrio, traduce el barrio a una zona de Quito, da una orientación inicial con nivel de urgencia y recomienda talleres.
- **Citas:** agenda una cita en un taller. Queda pendiente hasta que el taller la confirma en la app; el cliente recibe el aviso por WhatsApp.
- **Grúa:** la ofrece sola en casos de seguridad (frenos, temperatura, luz de aceite o batería, humo, olor a combustible). Pide ubicación, tipo de vehículo, destino y teléfono, y acepta la ubicación compartida de WhatsApp.
- **Talleres:** si el número que escribe coincide con el teléfono o WhatsApp de un taller registrado, busca repuestos, dice si están en bodega o son bajo pedido, registra pedidos y consulta el estado de un pedido por número.
- **Fotos:** las lee (tablero, pieza, fuga) y las usa para orientar.
- **Audios:** todavía no los escucha; pide que escriban. Falta contratar un servicio de transcripción.
- **Traspaso a una persona:** cuando lo piden, hay un reclamo o se agotaron las alternativas.

Límites que tiene puestos: no da precios de mano de obra, no da diagnósticos definitivos, no inventa talleres, precios ni grúas, y antes de escalar ofrece ampliar la zona, un taller de mantenimiento general o la app.

## Modo demostración

Con `modo_demo` en `true`, el asistente usa los talleres, repuestos, precios y grúas de demostración y lo dice en cada recomendación. Con `false` solo usa datos reales y verificados.

Datos de demostración cargados:

| Dato | Cantidad | Notas |
|---|---|---|
| Talleres | 15 | Todas las especialidades en las cuatro zonas, con horario, dirección y calificaciones inventadas |
| Taller del socio | 1 de los 15 | Usa el número del socio, para probar pedidos de repuestos por chat |
| Repuestos | 90 | Chevrolet, Kia, Hyundai, Toyota, Chery, Great Wall y JAC |
| Proveedores de grúa | 5 | Uno por zona más una plataforma |
| Pedidos | 3 | Del taller del socio: entregado, en camino y registrado |

Los talleres y grúas de demostración no tienen número de WhatsApp real, para que nadie escriba o llame a un desconocido.

## Atención de una persona

1. El asistente marca la conversación y **avisa al equipo por WhatsApp** a los números de `admin_wa`.
2. El equipo responde desde la app, en **Despacho > Atención**, donde se ve la conversación completa.
3. Mientras una persona atiende, el asistente guarda silencio en esa conversación.
4. Para devolverla al asistente: botón "Devolver al asistente" en la app, o el comando `#bot 1234` por WhatsApp, con los últimos cuatro dígitos del número.
5. Si nadie responde en el tiempo de `espera_humano_min` (30 minutos), el asistente retoma solo y se disculpa por la demora.

Comandos del equipo por WhatsApp, solo desde los números de `admin_wa`: `#pendientes`, `#bot 1234` y `#ayuda`.

Meta solo entrega mensajes libres a quien escribió al número en las últimas 24 horas. Por eso el aviso al equipo llega solo si ese número habló con el asistente en el último día; el panel de la app siempre lo muestra.

## Módulo de grúa

| Pieza | Dónde |
|---|---|
| Proveedores | Tabla `mekachi_gruas_proveedores` |
| Solicitudes | Tabla `mekachi_gruas_solicitudes`, numeradas GR-0001 |
| Estados | Solicitada, Asignada, En camino, Completada, Cancelada |
| Gestión | App, Despacho > Atención > Grúas |

El asistente asigna el proveedor de la zona, da un tiempo y un precio estimados, y avisa al equipo y al proveedor si tiene WhatsApp. En modo demostración avisa que no llegará una grúa real.

La grúa también se puede pedir desde la app, con o sin cuenta: en el perfil Conductor, botón "Pedir grúa" del inicio, o desde un diagnóstico marcado "No conduzcas". Esas solicitudes llegan al mismo panel y el equipo recibe el aviso por WhatsApp. Hay un tope de 3 solicitudes por hora por teléfono.

## Configuración sin redesplegar

Tabla `mekachi_config`, editable desde Supabase:

| Clave | Para qué |
|---|---|
| `modo_demo` | `true` o `false` |
| `admin_wa` | Números del equipo que reciben avisos, separados por coma, con código de país y sin `+` |
| `espera_humano_min` | Minutos antes de que el asistente retome una conversación sin atender |
| `datos_negocio` | Horario, cobertura, pagos y tiempos de entrega. Lo marcado PENDIENTE el asistente lo trata como no confirmado |
| `modelo` | Modelo de Claude, si no se define el secreto |
| `app_url` | Enlace de la app que el asistente puede compartir |
| `cron_secreto` | Uso interno; no tocar |

**Pendiente de Kevin:** completar `datos_negocio` con los valores reales.

## Tareas programadas

Cada 5 minutos la base llama a la función (tarea `mekachi-whatsapp-tareas`) para retomar conversaciones sin atender, avisar al cliente cuando un taller confirma o rechaza una cita, y enviar el seguimiento si la plantilla está configurada.

## Seguimiento para calificar al taller

El código está listo y apagado. Se activa creando en Meta una plantilla aprobada y guardando su nombre en el secreto `WA_PLANTILLA_SEGUIMIENTO`. Se envía a los 2 o 3 días de una cita confirmada.

Texto propuesto para la plantilla (categoría Utilidad, idioma español):

> Hola {{1}}, te escribe Mekachi. Hace unos días te atendieron en {{2}}. ¿Cómo te fue? Responde con una calificación del 1 al 5 y cuéntanos si algo se puede mejorar.

## Modelo de Claude

Por defecto usa Claude Opus 5.5. Para probar otro, crear el secreto `MEKACHI_MODELO`, por ejemplo con `claude-sonnet-5-5`, que cuesta la mitad por mensaje. Conviene comparar las mismas conversaciones con ambos antes de decidir.

## Secretos

Se guardan en Supabase, en Edge Functions > Secrets. Si falta alguno, la función responde "faltan secretos por configurar".

| Secreto | Qué es | De dónde sale |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clave de la API de Claude | Consola de Claude, sección API keys |
| `WA_TOKEN` | Token permanente de la API de WhatsApp | Meta Business, usuario del sistema |
| `WA_PHONE_NUMBER_ID` | Identificador del número (no es el número de teléfono) | App de Meta, WhatsApp > Configuración de la API |
| `WA_APP_SECRET` | Clave secreta de la app; valida la firma de cada mensaje | App de Meta, Configuración de la app > Básica |
| `WA_VERIFY_TOKEN` | Texto propio que se repite al registrar el webhook | Lo elige Mekachi |

Opcionales: `MEKACHI_MODO_DEMO`, `MEKACHI_MODELO`, `MEKACHI_APP_URL`, `WA_PLANTILLA_SEGUIMIENTO` y `WA_GRAPH_VERSION` (versión de la API de Meta; por defecto `v27.0`, igual que el webhook). Si existe el secreto, manda sobre la tabla de configuración.

## Pasos de configuración

1. **Crear la app en Meta.** En developers.facebook.com, app de tipo Negocios llamada Mekachi, asociada al portafolio comercial, con el producto WhatsApp agregado.
2. **Número.** En WhatsApp > Configuración de la API: usar el número de prueba y agregar destinatarios permitidos, o registrar un número propio con el código que llega por SMS. Copiar el identificador del número.
3. **Secreto de la app.** En Configuración de la app > Básica.
4. **Token permanente.** En business.facebook.com/settings: crear un usuario del sistema con rol Administrador, asignarle la app y la cuenta de WhatsApp Business con control total, y generar un token sin caducidad con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`. El token temporal de la página de API caduca en 24 horas y no sirve.
5. **Texto de verificación.** Un texto aleatorio de unos 30 caracteres.
6. **Clave de Claude.** Crear una clave en la consola y comprobar que la cuenta tiene saldo.
7. **Guardar los cinco secretos en Supabase.** Con los nombres exactos de la tabla anterior.
8. **Registrar el webhook en Meta.** En WhatsApp > Configuración: la URL del webhook, el mismo texto de verificación, "Verificar y guardar", y suscribirse al campo `messages`. Este paso solo funciona después del paso 7.
9. **Suscribir la app a la cuenta de WhatsApp Business.** Con el Explorador de la API Graph, `POST /{id-de-la-cuenta-de-WhatsApp}/subscribed_apps`. Se comprueba con un `GET` al mismo punto: debe aparecer Mekachi. Sin esto el webhook se verifica pero no llegan mensajes reales.
10. **Pasar la app a modo Activo.** En modo desarrollo Meta no entrega los webhooks reales. Pide una URL de política de privacidad.
11. **Probar.** Con un número de prueba de Meta, primero enviar la plantilla desde "Paso 1: Pruébalo" y responder en ese chat; el número no aparece como contacto hasta entonces. La respuesta debe llegar en menos de un minuto.

## Comprobaciones

| Qué revisar | Cómo | Resultado esperado |
|---|---|---|
| Secretos completos | Abrir la URL del webhook en el navegador | "Token de verificación incorrecto." |
| Faltan secretos | Igual | "Mekachi WhatsApp: faltan secretos por configurar." |
| Mensajes llegando | Tabla `mekachi_wa_mensajes` | Una fila `user` y una `assistant` por intercambio |
| Errores | Supabase, Edge Functions > mekachi-whatsapp > Logs | Sin errores |

## Problemas encontrados en la puesta en marcha

1. **El número de prueba no aparecía en WhatsApp como contacto.** Hay que enviar primero la plantilla desde "Paso 1: Pruébalo" y responder en ese chat.
2. **No llegaban mensajes reales aunque el webhook estaba verificado.** La cuenta de WhatsApp Business no tenía la app suscrita. Se resolvió con `POST /2948859242173845/subscribed_apps` en el Explorador de la API Graph.
3. **La app estaba en modo desarrollo.** Se pasó a modo Activo, porque en desarrollo Meta no entrega webhooks reales.

## Otros problemas posibles

- **Meta no acepta el webhook:** el texto de verificación no coincide con el secreto, o los secretos aún no están guardados.
- **Llega el mensaje pero no hay respuesta:** revisar los registros. Las causas habituales son el token de WhatsApp caducado, la clave de Claude sin saldo o un destinatario que no está en la lista permitida.
- **Respuestas "Firma no válida":** el secreto de la app guardado no es el de la app que envía los mensajes.
- **El asistente dejó de responder a una persona:** la conversación está marcada para atención humana. Se devuelve desde la app o con `#bot 1234`; si nadie la atiende, el asistente retoma a los 30 minutos.
- **Un taller no puede pedir repuestos:** su número de WhatsApp no coincide con el teléfono o WhatsApp guardado en su perfil de taller.

## Pendiente para producción

- Registrar el número real de Mekachi, que no puede estar activo en la app normal de WhatsApp, y actualizar `WA_PHONE_NUMBER_ID`.
- Verificar el negocio en Meta y agregar medio de pago en la cuenta de WhatsApp Business; hace falta para los mensajes que inicia la empresa.
- Reemplazar la política de privacidad por una página propia cuando haya sitio web.
- Agregar más destinatarios de prueba (el socio) desde "Paso 1 > Administrar lista de números".
- Opcional: secreto `MEKACHI_APP_URL` con el enlace de la app.
- Pasar `modo_demo` a `false` cuando haya talleres y proveedores de grúa reales.
- Servicio de transcripción para los audios.
- Aviso al equipo por correo, si se quiere además de WhatsApp.
- Plantillas aprobadas por Meta para escribir fuera de la ventana de 24 horas: seguimiento, avisos de estado de pedido y avisos al equipo.

## Mantenimiento

- **Cambiar una clave:** actualizar el secreto en Supabase; no hace falta volver a desplegar.
- **Cambiar el comportamiento del asistente:** editar las instrucciones en `index.ts` y volver a desplegar la función.
- **Cambiar de modelo:** la línea `model` en `index.ts`.
- **Si una clave se expone:** regenerarla en su origen (Meta o consola de Claude) y actualizar el secreto.
