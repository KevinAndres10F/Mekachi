// Mekachi · video con Remotion.
// Lee el mismo guion JSON que exporta la Oficina («Exportar guion») y lo convierte en MP4.
import React from "react";
import { AbsoluteFill, Composition, Img, Sequence, interpolate, registerRoot, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-semi-condensed/700.css";
import ejemplo from "../../guiones/como-pedir.json";

const C = { navy: "#0b2540", navy2: "#123a63", amber: "#ffb81c", soft: "#a9bdd6" };
const HEAD = '"Barlow Semi Condensed", Barlow, sans-serif';
const BODY = "Barlow, sans-serif";
const LEMA = "Mecánicas de confianza. Repuestos garantizados.";

const Logo = ({ size = 100 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.2 }}>
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M16 2l12.1 7v14L16 30 3.9 23V9z" fill={C.amber} />
      <path d="M10 16.5l4.2 4.2L22.5 12" fill="none" stroke={C.navy} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span style={{ font: `700 ${size * 0.62}px ${HEAD}`, color: "#fff" }}>Mekachi</span>
  </div>
);

// El titular pinta de ámbar su última línea, igual que en las imágenes.
const Titular = ({ children, size, align = "left" }) => {
  const palabras = String(children).split(" ");
  const corte = Math.max(1, Math.ceil(palabras.length * 0.6));
  return (
    <div style={{ font: `700 ${size}px/1.06 ${HEAD}`, color: "#fff", textAlign: align }}>
      {palabras.slice(0, corte).join(" ")} <span style={{ color: C.amber }}>{palabras.slice(corte).join(" ")}</span>
    </div>
  );
};

const Fondo = ({ foto, avance, credito }) =>
  foto ? (
    <AbsoluteFill>
      <Img src={staticFile(foto.split("/").pop())} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${1.04 + 0.08 * avance})` }} />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(11,37,64,.8) 0%, rgba(11,37,64,.1) 30%, rgba(11,37,64,.96) 100%)" }} />
      {credito ? <div style={{ position: "absolute", right: 40, bottom: 26, font: `500 22px ${BODY}`, color: "rgba(255,255,255,.6)" }}>Foto: {credito}</div> : null}
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{ background: `linear-gradient(155deg, ${C.navy} 55%, ${C.navy2})` }}>
      <div style={{ position: "absolute", right: -210, top: -170, width: 660, height: 660, borderRadius: "50%", background: "rgba(255,184,28,.10)" }} />
    </AbsoluteFill>
  );

const Escena = ({ escena, historia }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const entra = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.6) });
  const sale = escena.cierre ? 1 : interpolate(frame, [durationInFrames - fps * 0.35, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const base = { opacity: entra * sale, transform: `translateY(${(1 - entra) * 60}px)` };
  if (escena.cierre)
    return (
      <AbsoluteFill>
        <Fondo avance={0} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80, gap: 60, opacity: entra }}>
          <div style={{ transform: `scale(${0.85 + 0.15 * entra})` }}><Logo size={200} /></div>
          <Titular size={112} align="center">{escena.titular}</Titular>
          <div style={{ font: `500 44px/1.3 ${BODY}`, color: C.soft, textAlign: "center" }}>{escena.texto || LEMA}</div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill>
      <Fondo foto={escena.foto} credito={escena.credito} avance={frame / durationInFrames} />
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: `0 80px ${historia ? 250 : 120}px` }}>
        <div style={base}>
          <Titular size={124}>{escena.titular}</Titular>
          {escena.texto ? <div style={{ font: `500 50px/1.3 ${BODY}`, color: "#e6edf7", marginTop: 34 }}>{escena.texto}</div> : null}
          <div style={{ width: 120 * entra, height: 10, background: C.amber, marginTop: 44 }} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Avance = ({ escenas, inicios }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top: 44, display: "flex", gap: 12 }}>
      {escenas.map((e, i) => {
        const p = interpolate(frame, [inicios[i], inicios[i] + e.segundos * fps], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={i} style={{ flex: 1, height: 8, background: "rgba(255,255,255,.3)" }}><div style={{ width: p + "%", height: "100%", background: C.amber }} /></div>;
      })}
    </div>
  );
};

export const Guion = ({ escenas, formato }) => {
  const { fps } = useVideoConfig();
  let t = 0;
  const inicios = escenas.map((e) => { const d = t; t += Math.round(e.segundos * fps); return d; });
  return (
    <AbsoluteFill style={{ background: C.navy }}>
      {escenas.map((e, i) => (
        <Sequence key={i} from={inicios[i]} durationInFrames={Math.round(e.segundos * fps)}>
          <Escena escena={e} historia={formato === "historia"} />
        </Sequence>
      ))}
      <div style={{ position: "absolute", left: 80, top: 90 }}><Logo size={100} /></div>
      <Avance escenas={escenas} inicios={inicios} />
    </AbsoluteFill>
  );
};

const Root = () => (
  <Composition
    id="Guion"
    component={Guion}
    fps={30}
    width={1080}
    height={1920}
    durationInFrames={300}
    defaultProps={ejemplo}
    calculateMetadata={({ props }) => ({
      fps: props.fps || 30,
      width: props.ancho || 1080,
      height: props.alto || 1920,
      durationInFrames: props.escenas.reduce((n, e) => n + Math.round(e.segundos * (props.fps || 30)), 0),
    })}
  />
);

registerRoot(Root);
