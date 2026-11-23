// Catálogo de demostración. Los precios son ejemplos: se reemplazan con la
// lista real de los distribuidores aliados.
window.MEKACHI_CONFIG = {
  // Número de WhatsApp de Mekachi en formato internacional sin "+", p. ej. "5939XXXXXXXX".
  // Si queda vacío, WhatsApp abre el pedido y el taller elige a quién enviarlo.
  whatsapp: "",
  iva: 0.15,
  zonas: ["Norte", "Centro norte", "Sur", "Valles y periferia"],
  pagos: ["Transferencia", "Deuna", "Efectivo contra entrega"]
};

window.MEKACHI_CATALOGO = [
  { id: "f01", cat: "Filtros", nombre: "Filtro de aceite", marca: "Genérico", compat: "Chevrolet Aveo, Sail, Spark", precio: 4.5 },
  { id: "f02", cat: "Filtros", nombre: "Filtro de aceite", marca: "Genérico", compat: "Kia Rio, Hyundai Accent", precio: 5 },
  { id: "f03", cat: "Filtros", nombre: "Filtro de aire", marca: "Genérico", compat: "Chevrolet Sail", precio: 9 },
  { id: "f04", cat: "Filtros", nombre: "Filtro de aire", marca: "Genérico", compat: "Kia Sportage", precio: 12 },
  { id: "f05", cat: "Filtros", nombre: "Filtro de combustible", marca: "Genérico", compat: "Chevrolet D-Max diésel", precio: 14 },
  { id: "f06", cat: "Filtros", nombre: "Filtro de cabina", marca: "Genérico", compat: "Varios modelos", precio: 8 },

  { id: "a01", cat: "Aceites y líquidos", nombre: "Aceite 20W-50 mineral, galón", marca: "Genérico", compat: "Motores a gasolina", precio: 22 },
  { id: "a02", cat: "Aceites y líquidos", nombre: "Aceite 10W-30 semisintético, galón", marca: "Genérico", compat: "Motores a gasolina", precio: 28 },
  { id: "a03", cat: "Aceites y líquidos", nombre: "Aceite 5W-30 sintético, galón", marca: "Genérico", compat: "Motores a gasolina", precio: 42 },
  { id: "a04", cat: "Aceites y líquidos", nombre: "Aceite de caja automática ATF, litro", marca: "Genérico", compat: "Cajas automáticas", precio: 9 },
  { id: "a05", cat: "Aceites y líquidos", nombre: "Refrigerante, galón", marca: "Genérico", compat: "Universal", precio: 10 },
  { id: "a06", cat: "Aceites y líquidos", nombre: "Líquido de frenos DOT 4, 500 ml", marca: "Genérico", compat: "Universal", precio: 6 },

  { id: "b01", cat: "Frenos", nombre: "Pastillas de freno delanteras", marca: "Genérico", compat: "Chevrolet Aveo", precio: 18 },
  { id: "b02", cat: "Frenos", nombre: "Pastillas de freno delanteras", marca: "Genérico", compat: "Chevrolet Sail", precio: 20 },
  { id: "b03", cat: "Frenos", nombre: "Pastillas de freno delanteras", marca: "Genérico", compat: "Kia Rio", precio: 22 },
  { id: "b04", cat: "Frenos", nombre: "Pastillas de freno delanteras", marca: "Genérico", compat: "Chevrolet D-Max", precio: 30 },
  { id: "b05", cat: "Frenos", nombre: "Zapatas traseras", marca: "Genérico", compat: "Chevrolet Aveo", precio: 19 },
  { id: "b06", cat: "Frenos", nombre: "Disco de freno delantero", marca: "Genérico", compat: "Chevrolet Sail", precio: 35 },

  { id: "e01", cat: "Encendido", nombre: "Bujía estándar", marca: "Genérico", compat: "Varios modelos", precio: 3 },
  { id: "e02", cat: "Encendido", nombre: "Bujía de iridio", marca: "Genérico", compat: "Varios modelos", precio: 11 },
  { id: "e03", cat: "Encendido", nombre: "Juego de cables de bujía", marca: "Genérico", compat: "Chevrolet Aveo", precio: 24 },
  { id: "e04", cat: "Encendido", nombre: "Bobina de encendido", marca: "Genérico", compat: "Chevrolet Sail", precio: 38 },

  { id: "t01", cat: "Baterías", nombre: "Batería 12 V 45 Ah", marca: "Genérico", compat: "Autos pequeños", precio: 75 },
  { id: "t02", cat: "Baterías", nombre: "Batería 12 V 60 Ah", marca: "Genérico", compat: "Autos medianos y SUV", precio: 95 },

  { id: "c01", cat: "Bandas", nombre: "Banda de distribución", marca: "Genérico", compat: "Chevrolet Aveo", precio: 22 },
  { id: "c02", cat: "Bandas", nombre: "Kit de distribución con templador", marca: "Genérico", compat: "Chevrolet Aveo", precio: 65 },
  { id: "c03", cat: "Bandas", nombre: "Banda de accesorios", marca: "Genérico", compat: "Varios modelos", precio: 15 },

  { id: "s01", cat: "Suspensión", nombre: "Amortiguador delantero", marca: "Genérico", compat: "Chevrolet Aveo", precio: 45 },
  { id: "s02", cat: "Suspensión", nombre: "Terminal de dirección", marca: "Genérico", compat: "Chevrolet Sail", precio: 12 },
  { id: "s03", cat: "Suspensión", nombre: "Rótula inferior", marca: "Genérico", compat: "Kia Rio", precio: 14 }
];
