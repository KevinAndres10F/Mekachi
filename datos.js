// Datos de demostración. Los precios son ejemplos: se reemplazan con la
// lista real de los distribuidores aliados.
window.MEKACHI_CONFIG = {
  // Número de WhatsApp de Mekachi en formato internacional sin "+", p. ej. "5939XXXXXXXX".
  // Si queda vacío, WhatsApp abre el pedido y el taller elige a quién enviarlo.
  whatsapp: "",
  // Conexión a Supabase. La clave publicable es segura en el navegador: los datos los protege la seguridad por filas.
  supabaseUrl: "https://hxhpgpvfjgurugnmdrbu.supabase.co",
  supabaseKey: "sb_publishable_Xm-B7xgUS6oTJ-bxU1Fuhg_DcZH7UUW",
  tipos: { taller: "Llevo el auto al taller", recogida: "Recogida y entrega del auto", domicilio: "Mecánico a domicilio", grua: "Necesito grúa" },
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

// ---------- Diagnóstico inicial (reglas de orientación, no reemplaza la revisión del mecánico)
window.MEKACHI_ESPECIALIDADES = ["Frenos", "Motor", "Eléctrico", "Suspensión", "Transmisión", "Aire acondicionado", "Mantenimiento"];
window.MEKACHI_URGENCIA = {
  alta: { titulo: "No conduzcas", texto: "Detén el auto y pide revisión hoy." },
  media: { titulo: "Revisa esta semana", texto: "Puedes circular con cuidado, pero no lo dejes pasar." },
  baja: { titulo: "Sin urgencia", texto: "Puedes circular; agenda la visita con calma." }
};
window.MEKACHI_SINTOMAS = [
  { id: "fr1", cat: "Frenos", esp: "Frenos", urgencia: "media", titulo: "Chirrido o rechinido al frenar",
    claves: ["chilla", "chillido", "rechina", "suena", "ruido", "frenar", "freno", "pastillas"],
    causas: ["Pastillas de freno gastadas", "Discos cristalizados o rayados", "Polvo o suciedad entre pastilla y disco"],
    servicio: "Revisión de frenos y cambio de pastillas", repuestos: ["Pastillas de freno", "Discos de freno (si están rayados)"], buscar: "pastillas" },
  { id: "fr2", cat: "Frenos", esp: "Frenos", urgencia: "alta", titulo: "El pedal de freno está esponjoso o se va al fondo",
    claves: ["pedal", "esponjoso", "fondo", "hunde", "frena", "freno", "blando", "largo"],
    causas: ["Fuga de líquido de frenos", "Aire en el sistema", "Bomba de freno defectuosa"],
    servicio: "Revisión urgente del sistema de frenos y purga", repuestos: ["Líquido de frenos", "Bomba de freno (según revisión)"], buscar: "líquido de frenos" },
  { id: "fr3", cat: "Frenos", esp: "Frenos", urgencia: "media", titulo: "El volante vibra al frenar",
    claves: ["vibra", "vibración", "tiembla", "volante", "frenar", "freno"],
    causas: ["Discos de freno alabeados", "Pastillas con desgaste irregular"],
    servicio: "Rectificación o cambio de discos", repuestos: ["Discos de freno", "Pastillas de freno"], buscar: "disco" },

  { id: "mo1", cat: "Motor", esp: "Motor", urgencia: "media", titulo: "Se encendió la luz de check engine",
    claves: ["check", "engine", "luz", "tablero", "testigo", "amarilla", "foco"],
    causas: ["Sensor de oxígeno u otro sensor con falla", "Bujías o bobina en mal estado", "Tapa de combustible mal cerrada"],
    nota: "Si la luz parpadea, deja de conducir: indica fallo de encendido que puede dañar el catalizador.",
    servicio: "Escaneo electrónico y diagnóstico", repuestos: ["Bujías", "Bobina de encendido (según escaneo)"], buscar: "bujía" },
  { id: "mo2", cat: "Motor", esp: "Motor", urgencia: "media", titulo: "El motor tiembla, cascabelea o pierde fuerza",
    claves: ["tiembla", "temblor", "fuerza", "potencia", "jalonea", "cascabelea", "falla", "ahoga", "tironea"],
    causas: ["Bujías gastadas", "Bobina o cables de encendido defectuosos", "Filtro de aire o de combustible tapado", "Inyectores sucios"],
    servicio: "Afinación del motor (ABC)", repuestos: ["Bujías", "Filtro de aire", "Filtro de combustible"], buscar: "bujía" },
  { id: "mo3", cat: "Motor", esp: "Motor", urgencia: "media", titulo: "Sale humo por el escape",
    claves: ["humo", "escape", "azul", "blanco", "negro", "quema", "aceite"],
    causas: ["Humo azul: el motor quema aceite", "Humo blanco espeso: refrigerante entrando al motor", "Humo negro: exceso de combustible"],
    nota: "Con humo blanco espeso y temperatura alta, no sigas conduciendo.",
    servicio: "Diagnóstico de motor", repuestos: ["Depende de la revisión"], buscar: "" },
  { id: "mo4", cat: "Motor", esp: "Mantenimiento", urgencia: "baja", titulo: "Consume más combustible que antes",
    claves: ["consume", "consumo", "gasolina", "combustible", "gasta", "rinde"],
    causas: ["Filtro de aire sucio", "Bujías gastadas", "Llantas con poca presión", "Sensor de oxígeno con falla"],
    servicio: "Mantenimiento preventivo y revisión de sensores", repuestos: ["Filtro de aire", "Bujías"], buscar: "filtro de aire" },

  { id: "el1", cat: "Arranque y batería", esp: "Eléctrico", urgencia: "media", titulo: "No enciende: solo suena clic o no hace nada",
    claves: ["enciende", "prende", "arranca", "clic", "click", "muerto", "batería", "bateria"],
    causas: ["Batería descargada o agotada", "Bornes flojos o sulfatados", "Motor de arranque defectuoso"],
    servicio: "Prueba de batería y sistema de arranque", repuestos: ["Batería"], buscar: "batería" },
  { id: "el2", cat: "Arranque y batería", esp: "Eléctrico", urgencia: "baja", titulo: "Le cuesta arrancar en las mañanas",
    claves: ["cuesta", "arrancar", "arranca", "mañana", "frío", "frio", "demora", "tarda", "prender"],
    causas: ["Batería débil", "Bujías gastadas", "Bomba o filtro de combustible"],
    servicio: "Prueba de batería y revisión de encendido", repuestos: ["Batería", "Bujías"], buscar: "batería" },
  { id: "el3", cat: "Arranque y batería", esp: "Eléctrico", urgencia: "alta", titulo: "Luz de batería encendida mientras conduzco",
    claves: ["luz", "batería", "bateria", "tablero", "alternador", "roja", "carga"],
    causas: ["Alternador que no carga", "Banda de accesorios rota o floja"],
    nota: "El auto funcionará solo hasta que se agote la batería. Apaga lo que no necesites y ve directo al taller.",
    servicio: "Revisión del sistema de carga", repuestos: ["Banda de accesorios", "Alternador (según revisión)"], buscar: "banda de accesorios" },

  { id: "te1", cat: "Temperatura y fugas", esp: "Motor", urgencia: "alta", titulo: "Sube la temperatura o recalienta",
    claves: ["temperatura", "calienta", "recalienta", "hierve", "vapor", "aguja", "caliente"],
    causas: ["Falta de refrigerante por fuga", "Termostato trabado", "Ventilador que no enciende", "Bomba de agua o radiador dañados"],
    nota: "Detente en un lugar seguro y apaga el motor. No abras la tapa del radiador en caliente.",
    servicio: "Revisión del sistema de enfriamiento", repuestos: ["Refrigerante", "Termostato o bomba de agua (según revisión)"], buscar: "refrigerante" },
  { id: "te2", cat: "Temperatura y fugas", esp: "Motor", urgencia: "media", titulo: "Hay una mancha o goteo bajo el auto",
    claves: ["fuga", "gotea", "goteo", "mancha", "líquido", "liquido", "charco", "bota", "aceite"],
    causas: ["Verde o rosado: refrigerante", "Café o negro: aceite de motor", "Rojo: aceite de caja o de dirección", "Agua transparente bajo el tablero: normal del aire acondicionado"],
    servicio: "Ubicación y corrección de la fuga", repuestos: ["Depende del líquido que se esté perdiendo"], buscar: "" },

  { id: "su1", cat: "Suspensión y dirección", esp: "Suspensión", urgencia: "media", titulo: "Golpeteo al pasar baches o rompevelocidades",
    claves: ["golpe", "golpeteo", "suena", "ruido", "bache", "hueco", "suspensión", "suspension", "amortiguador", "traquetea"],
    causas: ["Amortiguadores gastados", "Rótulas o terminales con juego", "Bujes o bieletas dañados"],
    servicio: "Revisión de suspensión", repuestos: ["Amortiguadores", "Rótulas", "Terminales de dirección"], buscar: "amortiguador" },
  { id: "su2", cat: "Suspensión y dirección", esp: "Suspensión", urgencia: "baja", titulo: "El auto se va hacia un lado",
    claves: ["jala", "lado", "desvía", "desvia", "alineación", "alineacion", "chueco", "derecha", "izquierda"],
    causas: ["Falta de alineación", "Presión desigual en las llantas", "Terminal de dirección con juego"],
    servicio: "Alineación y balanceo", repuestos: ["Terminal de dirección (si tiene juego)"], buscar: "terminal" },
  { id: "su3", cat: "Suspensión y dirección", esp: "Suspensión", urgencia: "media", titulo: "El volante está duro",
    claves: ["volante", "duro", "dirección", "direccion", "pesado", "girar"],
    causas: ["Bajo nivel de aceite de dirección", "Banda de accesorios floja", "Bomba de dirección defectuosa"],
    servicio: "Revisión de la dirección hidráulica", repuestos: ["Aceite ATF", "Banda de accesorios"], buscar: "ATF" },

  { id: "su4", cat: "Suspensión y dirección", esp: "Suspensión", urgencia: "media", titulo: "Suena tac-tac al girar el volante o en curvas",
    claves: ["tac", "tac-tac", "clac", "girar", "giro", "curva", "volante", "suena", "homocinética", "homocinetica", "punta", "eje", "traquetea"],
    causas: ["Junta homocinética gastada", "Guardapolvo roto que dejó escapar la grasa"],
    servicio: "Revisión y cambio de junta homocinética", repuestos: ["Junta homocinética", "Guardapolvo"], buscar: "" },
  { id: "su5", cat: "Suspensión y dirección", esp: "Suspensión", urgencia: "media", titulo: "Zumbido que aumenta con la velocidad",
    claves: ["zumbido", "zumba", "ronroneo", "ronca", "velocidad", "rueda", "rodamiento", "rulimán", "ruliman", "llanta"],
    causas: ["Rodamiento de rueda gastado", "Llantas con desgaste irregular"],
    servicio: "Revisión de rodamientos y llantas", repuestos: ["Rodamiento de rueda"], buscar: "" },

  { id: "tr1", cat: "Caja y embrague", esp: "Transmisión", urgencia: "media", titulo: "El embrague patina o los cambios entran duros",
    claves: ["embrague", "patina", "cambios", "marcha", "caja", "duro", "raspa", "clutch"],
    causas: ["Disco de embrague gastado", "Aceite de caja bajo o viejo", "Cable o bomba de embrague"],
    servicio: "Revisión de embrague y caja", repuestos: ["Kit de embrague (según revisión)", "Aceite de caja"], buscar: "" },

  { id: "ac1", cat: "Aire acondicionado", esp: "Aire acondicionado", urgencia: "baja", titulo: "El aire acondicionado no enfría",
    claves: ["aire", "acondicionado", "enfría", "enfria", "caliente", "a/c", "huele", "olor"],
    causas: ["Falta de gas refrigerante", "Filtro de cabina tapado", "Compresor o embrague del compresor"],
    servicio: "Revisión y recarga de aire acondicionado", repuestos: ["Filtro de cabina"], buscar: "filtro de cabina" },

  { id: "ma1", cat: "Mantenimiento", esp: "Mantenimiento", urgencia: "baja", titulo: "Le toca cambio de aceite",
    claves: ["aceite", "cambio", "mantenimiento", "kilometraje", "km", "toca"],
    causas: ["Mantenimiento periódico según el kilometraje"],
    servicio: "Cambio de aceite y filtro", repuestos: ["Aceite de motor", "Filtro de aceite"], buscar: "aceite" },
  { id: "ma2", cat: "Mantenimiento", esp: "Mantenimiento", urgencia: "baja", titulo: "Quiero dejarlo listo para la revisión técnica",
    claves: ["revisión", "revision", "técnica", "tecnica", "matrícula", "matricula", "rtv", "amt"],
    causas: ["Chequeo previo de luces, frenos, llantas, suspensión y emisiones"],
    servicio: "Chequeo previo a la revisión técnica vehicular", repuestos: ["Según lo que encuentre el chequeo"], buscar: "" }
];

// ---------- Talleres de ejemplo. Nombres y ubicaciones ficticios para la demo.
window.MEKACHI_TALLERES = [
  { id: "t1", nombre: "Taller demo Kennedy", sector: "La Kennedy", zona: "Norte", lat: -0.1345, lng: -78.4790, esp: ["Frenos", "Suspensión", "Mantenimiento"] },
  { id: "t2", nombre: "Taller demo El Inca", sector: "El Inca", zona: "Norte", lat: -0.1560, lng: -78.4690, esp: ["Motor", "Eléctrico", "Mantenimiento"] },
  { id: "t3", nombre: "Taller demo Carcelén", sector: "Carcelén", zona: "Norte", lat: -0.0890, lng: -78.4700, esp: ["Frenos", "Motor", "Transmisión"] },
  { id: "t4", nombre: "Taller demo Comité", sector: "Comité del Pueblo", zona: "Norte", lat: -0.1220, lng: -78.4630, esp: ["Suspensión", "Frenos", "Mantenimiento"] },
  { id: "t5", nombre: "Taller demo Iñaquito", sector: "Iñaquito", zona: "Centro norte", lat: -0.1830, lng: -78.4840, esp: ["Eléctrico", "Aire acondicionado", "Motor"] },
  { id: "t6", nombre: "Taller demo Mariscal", sector: "La Mariscal", zona: "Centro norte", lat: -0.2030, lng: -78.4920, esp: ["Mantenimiento", "Frenos", "Aire acondicionado"] },
  { id: "t7", nombre: "Taller demo América", sector: "Av. América", zona: "Centro norte", lat: -0.1930, lng: -78.4980, esp: ["Motor", "Transmisión", "Eléctrico"] },
  { id: "t8", nombre: "Taller demo Villaflora", sector: "La Villaflora", zona: "Sur", lat: -0.2450, lng: -78.5200, esp: ["Frenos", "Suspensión", "Mantenimiento"] },
  { id: "t9", nombre: "Taller demo Solanda", sector: "Solanda", zona: "Sur", lat: -0.2720, lng: -78.5400, esp: ["Motor", "Mantenimiento", "Eléctrico"] },
  { id: "t10", nombre: "Taller demo Chillogallo", sector: "Chillogallo", zona: "Sur", lat: -0.2800, lng: -78.5560, esp: ["Transmisión", "Motor", "Suspensión"] },
  { id: "t11", nombre: "Taller demo Quitumbe", sector: "Quitumbe", zona: "Sur", lat: -0.2950, lng: -78.5550, esp: ["Frenos", "Eléctrico", "Mantenimiento"] },
  { id: "t12", nombre: "Taller demo Cumbayá", sector: "Cumbayá", zona: "Valles y periferia", lat: -0.2000, lng: -78.4300, esp: ["Mantenimiento", "Aire acondicionado", "Frenos"] },
  { id: "t13", nombre: "Taller demo Los Chillos", sector: "Sangolquí", zona: "Valles y periferia", lat: -0.3300, lng: -78.4480, esp: ["Motor", "Suspensión", "Transmisión"] },
  { id: "t14", nombre: "Taller demo Calderón", sector: "Calderón", zona: "Valles y periferia", lat: -0.0990, lng: -78.4230, esp: ["Frenos", "Motor", "Mantenimiento"] }
];
