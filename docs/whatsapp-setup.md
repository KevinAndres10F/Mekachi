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
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`) |

## Qué hace el asistente

- **Conductores:** pregunta por el síntoma, da una orientación inicial con nivel de urgencia y recomienda talleres verificados.
- **Talleres:** si el número que escribe coincide con el teléfono o WhatsApp de un taller registrado, busca repuestos y registra el pedido cuando la persona confirma la lista.
- **Traspaso a una persona:** cuando lo piden, hay un reclamo o no puede resolver. La conversación queda marcada con `requiere_humano` y el asistente deja de responder en ella.

Límites que tiene puestos: no da precios de mano de obra, no da diagnósticos definitivos, no inventa talleres ni precios, y solo lee mensajes de texto.

## Secretos

Se guardan en Supabase, en Edge Functions > Secrets. Si falta alguno, la función responde "faltan secretos por configurar".

| Secreto | Qué es | De dónde sale |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clave de la API de Claude | Consola de Claude, sección API keys |
| `WA_TOKEN` | Token permanente de la API de WhatsApp | Meta Business, usuario del sistema |
| `WA_PHONE_NUMBER_ID` | Identificador del número (no es el número de teléfono) | App de Meta, WhatsApp > Configuración de la API |
| `WA_APP_SECRET` | Clave secreta de la app; valida la firma de cada mensaje | App de Meta, Configuración de la app > Básica |
| `WA_VERIFY_TOKEN` | Texto propio que se repite al registrar el webhook | Lo elige Mekachi |

Opcionales: `MEKACHI_APP_URL` (enlace a la app que el asistente puede compartir) y `WA_GRAPH_VERSION` (versión de la API de Meta; por defecto `v23.0`).

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
- **El asistente dejó de responder a una persona:** la conversación quedó marcada para atención humana. Se reactiva poniendo `requiere_humano` en falso en `mekachi_wa_conversaciones`.
- **Un taller no puede pedir repuestos:** su número de WhatsApp no coincide con el teléfono o WhatsApp guardado en su perfil de taller.

## Pendiente para producción

- Registrar el número real de Mekachi, que no puede estar activo en la app normal de WhatsApp, y actualizar `WA_PHONE_NUMBER_ID`.
- Verificar el negocio en Meta y agregar medio de pago en la cuenta de WhatsApp Business; hace falta para los mensajes que inicia la empresa.
- Reemplazar la política de privacidad por una página propia cuando haya sitio web.
- Agregar más destinatarios de prueba (el socio) desde "Paso 1 > Administrar lista de números".
- Opcional: secreto `MEKACHI_APP_URL` con el enlace de la app.
- Opcional: secreto `WA_GRAPH_VERSION`. El código envía con v23.0 por defecto y el webhook está en v27.0; funciona así, pero conviene igualarlos.
- Una pantalla en el perfil de despacho para ver las conversaciones marcadas para atención humana.
- Avisos automáticos por WhatsApp al cambiar el estado de un pedido o una solicitud; requieren plantillas aprobadas por Meta.

## Mantenimiento

- **Cambiar una clave:** actualizar el secreto en Supabase; no hace falta volver a desplegar.
- **Cambiar el comportamiento del asistente:** editar las instrucciones en `index.ts` y volver a desplegar la función.
- **Cambiar de modelo:** la línea `model` en `index.ts`.
- **Si una clave se expone:** regenerarla en su origen (Meta o consola de Claude) y actualizar el secreto.
