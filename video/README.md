# Videos de Mekachi

Tres formas de producir el mismo video a partir de un **guion**: una lista de escenas con titular, texto, foto y duración.

| Dónde | Para qué | Qué necesita |
|---|---|---|
| **La app (Oficina → Contenido → Videos)** | Video al instante desde el navegador | Nada. Graba en MP4 o WebM según el navegador |
| **Remotion** (`video/remotion`) | MP4 de calidad final, repetible, desde la línea de comandos | Node.js |
| **HyperFrames** (`video/hyperframes`) | Lo mismo, con una composición HTML que también se puede editar en HyperFrames Studio | Node.js y FFmpeg |

Los tres dibujan lo mismo: fondo azul o foto con zoom lento, titular con el tramo final en ámbar, texto, logo, barra de avance y una escena de cierre.

## El guion

El agente de Marketing escribe el guion cuando le pides un video. En la Oficina, **Exportar guion** descarga un archivo como `guiones/como-pedir.json`:

```json
{
  "titulo": "Cómo pedir un repuesto en Mekachi",
  "formato": "historia",
  "ancho": 1080, "alto": 1920, "fps": 30,
  "escenas": [
    { "titular": "Busca el repuesto en la app", "texto": "Por pieza o por modelo.", "foto": "fotos/taller-1.jpg", "segundos": 4.5, "cierre": false },
    { "titular": "Registra tu taller hoy", "texto": "Mecánicas de confianza. Repuestos garantizados.", "foto": "", "segundos": 4, "cierre": true }
  ]
}
```

`foto` es una ruta dentro de la carpeta `fotos/` del sitio, o vacío para el fondo azul.

## Remotion

```bash
cd video/remotion
npm install
npm run render -- ../guiones/como-pedir.json        # deja el MP4 en out/
npm run studio                                      # vista previa interactiva
```

En un servidor sin el navegador que descarga Remotion, indica uno propio: `REMOTION_CHROME=/ruta/a/chrome-headless-shell npm run render -- ...`.

Remotion es gratuito para personas y empresas pequeñas; las empresas más grandes necesitan licencia. Revisa las condiciones vigentes en remotion.dev antes de usarlo comercialmente.

## HyperFrames

```bash
cd video/hyperframes
node generar.mjs ../guiones/como-pedir.json         # escribe index.html y copia las fotos a assets/
npm run check                                       # revisión de la composición
npm run render                                      # deja el MP4 en out/video.mp4
```

`index.html` es una composición normal de HyperFrames (HTML, CSS y una línea de tiempo de GSAP), así que también se puede abrir y retocar en HyperFrames Studio con `npm run dev`.

## Límites actuales

- Los videos no llevan música ni voz.
- La app graba en tiempo real: un video de 30 segundos tarda 30 segundos en descargarse.
- Las funciones de Supabase no pueden renderizar video. Para que la Oficina entregue el MP4 de Remotion o HyperFrames sin pasar por la línea de comandos hace falta un servicio de render aparte.
