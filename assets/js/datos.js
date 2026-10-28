/* =========================================================
   Datos de ejemplo para la demo. Nombres y teléfonos ficticios.
   "hace" = minutos desde que se hizo el reporte (se convierte
   en fecha real al cargar, así la demo siempre parece reciente).
   ========================================================= */
window.EMERG = {
  centro: [-28.3555, -59.2600],
  telefonos: [
    { label: "Emergencias", num: "911", icon: "fa-phone-volume" },
    { label: "Defensa Civil", num: "103", icon: "fa-person-shelter" },
    { label: "Bomberos", num: "100", icon: "fa-fire-extinguisher" },
    { label: "SIES", num: "107", icon: "fa-truck-medical" }
  ],
  muni: { telefono: "(03482) 492-000", telefonoHref: "tel:03482492000" },
  ejemplos: [
    { id: "LT-0101", nivel: "urgente", nombre: "Marta G.", tel: "3482 000-101", dir: "Calle 3 y costanera", ref: "Casa de material sin revocar, frente al río", lat: -28.3532, lng: -59.2478, personas: 4, comentario: "Hay una persona mayor en silla de ruedas.", hace: 25, estado: "pendiente", verificado: true },
    { id: "LT-0102", nivel: "urgente", nombre: "Ramón A.", tel: "3482 000-102", dir: "Calle 1 N° 340", ref: "", lat: -28.3571, lng: -59.2491, personas: 3, comentario: "El agua llega a la rodilla adentro de la casa.", hace: 48, estado: "en-camino", verificado: true },
    { id: "LT-0103", nivel: "leve", nombre: "Silvia P.", tel: "3482 000-103", dir: "Calle 7 N° 615", ref: "Portón verde", lat: -28.3548, lng: -59.2526, personas: 2, comentario: "Entra agua por el patio cuando llueve fuerte.", hace: 70, estado: "pendiente" },
    { id: "LT-0104", nivel: "urgente", nombre: "Familia Benítez", tel: "3482 000-104", dir: "Camino al puerto, km 2", ref: "Después de la tranquera azul", lat: -28.3489, lng: -59.2335, personas: 6, comentario: "Quedamos aislados, el camino está cortado.", hace: 15, estado: "pendiente" },
    { id: "LT-0105", nivel: "leve", nombre: "Jorge L.", tel: "3482 000-105", dir: "Calle 12 N° 1020", ref: "", lat: -28.3560, lng: -59.2603, personas: 2, comentario: "", hace: 130, estado: "pendiente", verificado: true },
    { id: "LT-0106", nivel: "leve", nombre: "Norma V.", tel: "3482 000-106", dir: "Calle 16 N° 455", ref: "Al lado del almacén", lat: -28.3625, lng: -59.2588, personas: 1, comentario: "Vivo sola, no puedo levantar las bolsas.", hace: 95, estado: "pendiente" },
    { id: "LT-0107", nivel: "urgente", nombre: "Carlos M.", tel: "3482 000-107", dir: "Calle 18 y 9", ref: "Esquina, casa amarilla", lat: -28.3651, lng: -59.2560, personas: 5, comentario: "Hay un bebé y una persona con diabetes.", hace: 35, estado: "pendiente", verificado: true },
    { id: "LT-0108", nivel: "leve", nombre: "Ana R.", tel: "3482 000-108", dir: "Calle 5 N° 210", ref: "", lat: -28.3482, lng: -59.2617, personas: 3, comentario: "Patio y vereda anegados.", hace: 240, estado: "atendido", verificado: true },
    { id: "LT-0109", nivel: "leve", nombre: "Hugo S.", tel: "3482 000-109", dir: "Calle 14 N° 1530", ref: "", lat: -28.3577, lng: -59.2705, personas: 4, comentario: "", hace: 180, estado: "pendiente" },
    { id: "LT-0110", nivel: "urgente", nombre: "Rosa F.", tel: "3482 000-110", dir: "Pasaje sin nombre, frente al río", ref: "Atrás del club náutico", lat: -28.3605, lng: -59.2470, personas: 2, comentario: "Se nos mojó todo, perdimos los colchones.", hace: 60, estado: "pendiente" },
    { id: "LT-0111", nivel: "leve", nombre: "Luis C.", tel: "3482 000-111", dir: "Calle 10 N° 850", ref: "", lat: -28.3539, lng: -59.2580, personas: 3, comentario: "Desagüe tapado en la esquina.", hace: 300, estado: "atendido", verificado: true },
    { id: "LT-0112", nivel: "leve", nombre: "Graciela T.", tel: "3482 000-112", dir: "Calle 9 N° 410", ref: "Frente a la plaza", lat: -28.3592, lng: -59.2537, personas: 5, comentario: "", hace: 150, estado: "pendiente" },
    { id: "LT-0113", nivel: "urgente", nombre: "Pedro Z.", tel: "3482 000-113", dir: "Ruta 11, acceso norte", ref: "Chacra con molino, a 500 m de la ruta", lat: -28.3405, lng: -59.2655, personas: 3, comentario: "Tenemos animales y no podemos salir.", hace: 90, estado: "en-camino", verificado: true },
    { id: "LT-0114", nivel: "leve", nombre: "Mirta B.", tel: "3482 000-114", dir: "Calle 3 N° 905", ref: "", lat: -28.3466, lng: -59.2575, personas: 2, comentario: "No puedo salir a la farmacia, la calle está anegada.", hace: 55, estado: "pendiente" },
    { id: "LT-0115", nivel: "leve", nombre: "Daniel K.", tel: "3482 000-115", dir: "Calle 20 N° 1210", ref: "", lat: -28.3618, lng: -59.2680, personas: 4, comentario: "", hace: 400, estado: "atendido", verificado: true },
    { id: "LT-0116", nivel: "urgente", nombre: "Elena O.", tel: "3482 000-116", dir: "Calle 22 N° 330", ref: "Pasando la escuela, mano derecha", lat: -28.3676, lng: -59.2523, personas: 7, comentario: "Somos 7, entre ellos 4 chicos.", hace: 20, estado: "pendiente" },
    { id: "LT-0117", nivel: "leve", nombre: "Oscar D.", tel: "3482 000-117", dir: "Calle 8 N° 760", ref: "", lat: -28.3519, lng: -59.2554, personas: 2, comentario: "", hace: 210, estado: "pendiente" },
    { id: "LT-0118", nivel: "leve", nombre: "Teresa N.", tel: "3482 000-118", dir: "Calle 2 N° 120", ref: "Casa con rejas blancas", lat: -28.3505, lng: -59.2499, personas: 3, comentario: "El agua está llegando a la puerta.", hace: 75, estado: "pendiente" },
    { id: "LT-0119", nivel: "urgente", nombre: "Juan P.", tel: "3482 000-119", dir: "Calle 11 N° 220", ref: "", lat: -28.3570, lng: -59.2512, personas: 4, comentario: "Tengo dos nenes chiquitos y el agua sigue subiendo.", hace: 10, estado: "pendiente" },
    { id: "LT-0120", nivel: "leve", nombre: "Beatriz H.", tel: "3482 000-120", dir: "Calle 1 N° 1400", ref: "", lat: -28.3452, lng: -59.2640, personas: 1, comentario: "", hace: 360, estado: "pendiente" },
    { id: "LT-0121", nivel: "leve", nombre: "Raúl E.", tel: "3482 000-121", dir: "Calle principal del puerto", ref: "Al lado de la cooperativa de pescadores", lat: -28.3470, lng: -59.2360, personas: 3, comentario: "", hace: 260, estado: "pendiente" },
    { id: "LT-0122", nivel: "urgente", nombre: "Susana Q.", tel: "3482 000-122", dir: "Calle 4 y costanera", ref: "", lat: -28.3552, lng: -59.2464, personas: 4, comentario: "", hace: 140, estado: "atendido", verificado: true },
    { id: "LT-0123", nivel: "urgente", nombre: "Nico 123", tel: "3482 000-123", dir: "Calle Falsa 123", ref: "", lat: -28.3510, lng: -59.2650, personas: 40, comentario: "jajaja", hace: 30, estado: "pendiente", falsos: 4 }
  ]
};
