
// ==========================================
// DATOS DEL DASHBOARD
// ==========================================

export const dashboardStats = [
  {
    title: "Pedidos totales",
    value: "128",
    description: "+12% respecto a la semana anterior"
  },
  {
    title: "Ingresos",
    value: "24.580 €",
    description: "+8% respecto a la semana anterior"
  },
  {
    title: "Incidencias abiertas",
    value: "7",
    description: "3 pendientes de revisión"
  },
  {
    title: "Integraciones correctas",
    value: "96,8%",
    description: "Últimas ejecuciones"
  }
];

// Evolución semanal de pedidos
export const ordersChartData = [
  { day: "Lun", orders: 12 },
  { day: "Mar", orders: 18 },
  { day: "Mié", orders: 15 },
  { day: "Jue", orders: 24 },
  { day: "Vie", orders: 20 },
  { day: "Sáb", orders: 29 },
  { day: "Dom", orders: 21 }
];

// Pedidos recientes del Dashboard
export const recentOrders = [
  {
    id: "UC-2026-01001",
    customer: "Cliente de prueba 1",
    total: "349 €",
    status: "Completado"
  },
  {
    id: "UC-2026-01002",
    customer: "Cliente de prueba 2",
    total: "249 €",
    status: "Pendiente"
  },
  {
    id: "UC-2026-01003",
    customer: "Cliente de prueba 3",
    total: "599 €",
    status: "En preparación"
  },
  {
    id: "UC-2026-01004",
    customer: "Cliente de prueba 4",
    total: "149 €",
    status: "Cancelado"
  }
];

// Actividad reciente del Dashboard
export const recentActivity = [
  {
    title: "Nuevo pedido recibido",
    description: "Pedido UC-2026-01005 registrado",
    time: "Hace 10 minutos",
    type: "order"
  },
  {
    title: "Integración completada",
    description: "Sincronización de pedidos correcta",
    time: "Hace 25 minutos",
    type: "success"
  },
  {
    title: "Nueva incidencia",
    description: "Incidencia pendiente de revisión",
    time: "Hace 40 minutos",
    type: "warning"
  }
];


// ==========================================
// DATOS DE INCIDENCIAS
// ==========================================

export const incidentsData = [
  {
    id: "INC-001",
    orderId: "UC-2026-01005",
    customer: "Carlos Martínez",
    type: "Retraso en la entrega",
    description: "El cliente indica que el pedido todavía no ha llegado.",
    priority: "Alta",
    status: "Abierta",
    date: "02/11/2026"
  },
  {
    id: "INC-002",
    orderId: "UC-2026-01006",
    customer: "Laura Sánchez",
    type: "Problema de pago",
    description: "El pago del pedido aparece como pendiente.",
    priority: "Media",
    status: "En revisión",
    date: "02/11/2026"
  },
  {
    id: "INC-003",
    orderId: "UC-2026-01007",
    customer: "Javier López",
    type: "Producto defectuoso",
    description: "El cliente comunica un problema con el producto recibido.",
    priority: "Alta",
    status: "Abierta",
    date: "01/11/2026"
  },
  {
    id: "INC-004",
    orderId: "UC-2026-01008",
    customer: "Ana García",
    type: "Solicitud de devolución",
    description: "El cliente solicita la devolución del importe.",
    priority: "Baja",
    status: "Resuelta",
    date: "01/11/2026"
  },
  {
    id: "INC-005",
    orderId: "UC-2026-01009",
    customer: "David Fernández",
    type: "Consulta sobre pedido",
    description: "El cliente solicita información sobre el estado del pedido.",
    priority: "Media",
    status: "En revisión",
    date: "31/10/2026"
  }
];
