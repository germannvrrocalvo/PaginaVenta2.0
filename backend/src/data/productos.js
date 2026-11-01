const productos = [
    {

    id: "p001",
    slug: "audio-technica-at-lp120xusb",
    sku: "AT-LP120XUSB",
    category: "tocadiscos",
    brand: "Audio-Technica",
    name: "AT-LP120XUSB",
    price: 349,
    rating: 4.8,
    reviews: 126,
    badge: "Más vendido",
    stock: 14,
    featured: true,
    finish: "Negro mate",
    variants: [
        {
            id: "aluminio-cepillado",
            finish: "Aluminio cepillado",
            stock: 7,
            sku: "AT-LP120XUSB-S",
            image: "/img/productos/at-lp120xusb-aluminio-cepillado.png"
        }
    ],
    image: "/img/referencia/foto-0.webp",

    description:
        "Tocadiscos de tracción directa con salida USB para digitalizar tu colección.",
    features: [
        "Digitaliza tu colección a través de la salida USB.",
        "Selecciona entre tres velocidades de reproducción.",
        "Conecta por RCA gracias al preamplificador integrado."
    ],
    specs: {
        "Tracción": "Directa",
        "Velocidades": "33 1/3, 45 y 78 rpm",
        "Preamplificador": "Phono/Line integrado",
        "Conexión": "RCA + USB",
        "Peso": "10,8 kg"
    },
    compatibility: "Compatible con amplificadores y altavoces activos con entrada RCA o línea."
    },

   {
    id: "p002",
    features: [
        "Inicia la reproducción con el funcionamiento automático.",
        "Escucha sin cables con altavoces o auriculares Bluetooth.",
        "Alterna entre 33 1/3 y 45 rpm según el disco."
    ],
    slug: "sony-ps-lx310bt",
    sku: "PS-LX310BT",
    category: "tocadiscos",
    brand: "Sony",
    name: "PS-LX310BT",
    price: 249,
    rating: 4,
    reviews: 189,
    badge: null,
    stock: 22,
    featured: true,
    finish: "Negro satinado",
    variants: [
        {
            id: "aluminio-cepillado",
            finish: "Aluminio cepillado",
            stock: 11,
            sku: "PS-LX310BT-S",
            image: "/img/productos/ps-lx310bt-aluminio-cepillado.jpg"
        }
    ],
    image: "/img/productos/ps-lx310bt-aluminio-cepillado.jpg",
    description:
        "Tocadiscos automático de correa con Bluetooth para enviar el sonido a auriculares o altavoces inalámbricos.",
    specs: {
        Tracción: "Correa",
        Velocidades: "33 1/3 y 45 rpm",
        Preamplificador: "Integrado",
        Conexión: "RCA + Bluetooth",
        Peso: "4,1 kg"
    },
    compatibility:
        "Compatible con altavoces y auriculares Bluetooth."
},

   {
    id: "p003",
    features: [
        "Brazo de carbono y cápsula premontada.",
        "Cambio electrónico de velocidad.",
        "Comprueba si tu amplificador dispone de entrada phono."
    ],
    slug: "pro-ject-debut-carbon-evo",
    sku: "DEBUT-CARBON-EVO",
    category: "tocadiscos",
    brand: "Pro-Ject",
    name: "Debut Carbon EVO",
    price: 599,
    rating: 5,
    reviews: 97,
    badge: "Premium",
    stock: 6,
    featured: true,
    finish: "Lacado negro",
    variants: [
        {
            id: "nogal-natural",
            finish: "Nogal natural",
            stock: 3,
            sku: "DEBUT-CARBON-EVO-W",
            image: "/img/productos/debut-carbon-evo-nogal-natural.jpg"
        }
    ],
    image: "/img/referencia/foto-1.jpg",
    description:
        "Brazo de carbono de una pieza, plato de 8 mm con alta inercia y cápsula Sumiko Rainier premontada. Cambio de velocidad electrónico.",
    specs: {
        Tracción: "Correa",
        Velocidades: "33 1/3 y 45 rpm",
        Cápsula: "Sumiko Rainier",
        Brazo: 'Carbono 8,6"',
        Peso: "5,5 kg"
    },
    compatibility:
        "Requiere preamplificador phono si el amplificador no lo incluye."
},

   {
    id: "p004",
    features: [
        "Amplificación integrada para una instalación sencilla.",
        "Varias entradas para conectar fuentes digitales y analógicas.",
        "Control a distancia y acabado en madera."
    ],
    slug: "edifier-r1280db",
    sku: "R1280DB",
    category: "altavoces",
    brand: "Edifier",
    name: "R1280DB",
    price: 149,
    rating: 5,
    reviews: 312,
    badge: null,
    stock: 40,
    featured: true,
    finish: "Nogal clásico",
    variants: [
        {
            id: "fresno-negro",
            finish: "Fresno negro",
            stock: 17,
            sku: "R1280DB-BK",
            image: "/img/productos/r1280db-fresno-negro.jpg"
        }
    ],
    image: "/img/referencia/foto-2.webp",
    description:
        "Monitores activos de estantería con entradas ópticas, coaxiales, RCA y Bluetooth. Acabado en madera y mando a distancia.",
    specs: {
        Potencia: "42 W RMS",
        Respuesta: "55 Hz - 20 kHz",
        Conexión: "Óptica, coaxial, RCA, Bluetooth 5.0",
        Tipo: "Activos 2.0",
        Peso: "6,0 kg (par)"
    },
    compatibility:
        "Compatible con cualquier tocadiscos con preamplificador integrado."
},

   {
    id: "p005",
    features: [
        "Entrada phono para conectar directamente un tocadiscos.",
        "Amplificación integrada y conexión Bluetooth.",
        "Bocina Tractrix y woofer de cobre de 4 pulgadas."
    ],
    slug: "klipsch-r-41pm",
    sku: "R-41PM",
    category: "altavoces",
    brand: "Klipsch",
    name: "R-41PM",
    price: 279,
    rating: 5,
    reviews: 141,
    badge: "Últimas 2",
    stock: 2,
    featured: true,
    finish: "Fresno negro",
    variants: [
        {
            id: "nogal-oscuro",
            finish: "Nogal oscuro",
            stock: 5,
            sku: "R-41PM-W",
            image: "/img/productos/r-41pm-nogal-oscuro.jpg"
        }
    ],
    image: "/img/productos/r-41pm-fresno-negro.jpg",
    description:
        'Altavoces amplificados con bocina Tractrix y woofer de cobre de 4". Entrada phono integrada para conectar el tocadiscos directamente.',
    specs: {
        Potencia: "70 W RMS",
        Respuesta: "54 Hz - 21 kHz",
        Conexión: "Phono, RCA, USB, Bluetooth",
        Tipo: "Activos 2.0",
        Peso: "10,4 kg (par)"
    },
    compatibility:
        "Entrada phono: conecta tocadiscos sin preamplificador."
},

{
    id: "p006",
    features: [
        "Diseño cerrado para una escucha personal.",
        "Copas de nogal y cable desmontable.",
        "Conexión mediante jack de 3,5 o 6,3 mm."
    ],
    slug: "meze-99-classics",
    sku: "99-CLASSICS",
    category: "auriculares",
    brand: "Meze Audio",
    name: "99 Classics",
    price: 309,
    rating: 5,
    reviews: 88,
    badge: "Premium",
    stock: 9,
    featured: true,
    color: "Nogal y dorado",
    variants: [
        {
            id: "nogal-plata",
            color: "Nogal y plata",
            stock: 4,
            sku: "99-CLASSICS-S",
            image: "/img/productos/99-classics-nogal-plata.jpg"
        }
    ],
    image: "/img/referencia/foto-5.webp",
    description:
        "Auriculares cerrados con almohadillas de piel y estructura de nogal. Cable desmontable, sonido cálido y musical.",
    specs: {
        Tipo: "Circumaurales cerrados",
        Impedancia: "32 Ω",
        Respuesta: "10 Hz - 25 kHz",
        Conexión: "Jack 3,5 mm / 6,3 mm",
        Peso: "260 g"
    },
    compatibility:
        "Compatible con amplificadores de auriculares y salidas de 3,5 mm."
},

{
    id: "p007",
    features: [
        "Diseño abierto para una escena sonora amplia.",
        "Pensados para sesiones largas de escucha en casa.",
        "Conexión por cable a tu amplificador o salida de auriculares."
    ],
    slug: "sennheiser-hd-599",
    sku: "HD-599",
    category: "auriculares",
    brand: "Sennheiser",
    name: "HD 599",
    price: 129,
    rating: 4,
    reviews: 203,
    badge: null,
    stock: 25,
    featured: false,
    color: "Marfil y marrón",
    variants: [
        {
            id: "negro",
            color: "Negro",
            stock: 13,
            sku: "HD-599-BK",
            image: "/img/productos/hd-599-negro.jpg"
        }
    ],
    image: "/img/productos/hd-599-marfil-marron.jpg",
    description:
        "Auriculares abiertos de referencia para escucha larga y cómoda. Sonido amplio y natural.",
    specs: {
        Tipo: "Circumaurales abiertos",
        Impedancia: "50 Ω",
        Respuesta: "12 Hz - 38,5 kHz",
        Conexión: "Jack 3,5 mm / 6,3 mm",
        Peso: "250 g"
    },
    compatibility:
        "Compatible con cualquier amplificador o salida de auriculares."
},

{
    id: "p008",
    features: [
        "Reedición del álbum de 1973.",
        "Vinilo de 180 gramos con póster y pegatinas.",
        "Reproducción a 33 1/3 rpm."
    ],
    slug: "dark-side-of-the-moon-50-aniversario",
    sku: "VIN-DSOTM-50",
    category: "vinilos",
    brand: "Pink Floyd",
    name: "The Dark Side of the Moon (50 Aniversario)",
    price: 44.99,
    rating: 5,
    reviews: 176,
    badge: "Edición limitada",
    stock: 12,
    featured: true,
    color: "Negro",
    variants: [
        {
            id: "transparente",
            color: "Transparente",
            stock: 6,
            sku: "VIN-DSOTM-50-CL",
            image: "/img/productos/dark-side-of-the-moon-transparente.jpg"
        }
    ],
    image: "/img/productos/dark-side-of-the-moon-negro.jpg",
    description:
        "Reedición en vinilo de 180 g del álbum de 1973 en vinilo de colores, con póster y pegatinas.",
    specs: {
        Formato: 'LP 12"',
        Peso: "180 g",
        Año: "1973 (reedición 2023)",
        Género: "Rock progresivo",
        Discos: "1"
    },
    compatibility:
        "Reproducible a 33 1/3 rpm en cualquier tocadiscos."
},

{
    id: "p009",
    features: [
        "Álbum clásico del jazz modal de Miles Davis.",
        "Edición en vinilo de 180 gramos.",
        "Reproducción a 33 1/3 rpm."
    ],
    slug: "kind-of-blue-vinilo",
    sku: "VIN-KOB-180",
    category: "vinilos",
    brand: "Miles Davis",
    name: "Kind of Blue",
    price: 27.99,
    rating: 5,
    reviews: 121,
    badge: "Vintage",
    stock: 18,
    featured: false,
    color: "Negro",
    variants: [
        {
            id: "azul-cobalto",
            color: "Azul cobalto",
            stock: 8,
            sku: "VIN-KOB-180-BL",
            image: "/img/productos/kind-of-blue-azul-cobalto.jpg"
        }
    ],
    image: "/img/productos/kind-of-blue-negro.jpg",
    description:
        "Clásico del jazz modal en vinilo de 180 g con prensado de alta fidelidad.",
    specs: {
        Formato: 'LP 12"',
        Peso: "180 g",
        Año: "1959",
        Género: "Jazz",
        Discos: "1"
    },
    compatibility:
        "Reproducible a 33 1/3 rpm en cualquier tocadiscos."
},

{
    id: "p010",
    features: [
        "Cepillo de fibra de carbono para retirar polvo superficial.",
        "Incluye líquido limpiador y paño de microfibra.",
        "Compatible con discos de 7, 10 y 12 pulgadas."
    ],
    slug: "kit-limpieza-vinilos",
    sku: "ACC-CLEAN-01",
    category: "vinilos",
    brand: "UCAM Stereo",
    name: "Kit de limpieza para vinilos",
    price: 24.9,
    rating: 4,
    reviews: 54,
    badge: null,
    stock: 60,
    featured: false,
    color: "Negro",
    variants: [
        {
            id: "azul",
            color: "Azul",
            stock: 24,
            sku: "ACC-CLEAN-01-BL",
            image: "/img/productos/kit-limpieza-vinilos-azul.jpg"
        }
    ],
    image: "/img/productos/kit-limpieza-vinilos-negro.jpg",
    description:
        "Cepillo de fibra de carbono, líquido limpiador de 250 ml y paño de microfibra.",
    specs: {
        Contenido: "Cepillo + líquido 250 ml + paño",
        Uso: 'Discos de 7", 10" y 12"'
    },
    compatibility:
        "Apto para vinilos y cápsulas."
},
];

module.exports = productos;
