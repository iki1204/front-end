import type { APIRoute } from 'astro';

const content = {
  'on-grid': {
    badge: 'Flujo On-Grid',
    title: 'Calculadora para sistemas conectados a la red',
    subtitle:
      'Este flujo puede pedir consumo mensual, tarifa eléctrica, área disponible y objetivo de ahorro para dimensionar paneles, inversores y retorno estimado.',
    metrics: [
      'Consumo energético mensual en kWh.',
      'Costo actual de la factura eléctrica.',
      'Espacio disponible para instalación solar.',
      'Objetivo de compensación o porcentaje de ahorro.',
    ],
    steps: [
      'Capturar consumo, tarifa y tipo de servicio eléctrico.',
      'Dimensionar potencia recomendada y producción esperada.',
      'Mostrar estimación de ahorro, retorno e implementación comercial.',
    ],
    cta: {
      label: 'Solicitar asesoría On-Grid',
      href: '/#ubicacion',
    },
  },
  'off-grid': {
    badge: 'Flujo Off-Grid',
    title: 'Calculadora para sistemas autónomos con baterías',
    subtitle:
      'Este flujo está orientado a levantar cargas críticas, horas de uso, autonomía requerida y banco de baterías para operar sin red pública.',
    metrics: [
      'Listado de equipos críticos y potencia de cada uno.',
      'Horas de uso diario por equipo o circuito.',
      'Días u horas de autonomía deseadas.',
      'Capacidad sugerida de baterías, paneles e inversor.',
    ],
    steps: [
      'Registrar equipos y ventanas de operación diaria.',
      'Calcular demanda total, autonomía y banco de baterías.',
      'Presentar recomendación técnica y siguiente paso comercial.',
    ],
    cta: {
      label: 'Solicitar asesoría Off-Grid',
      href: '/#ubicacion',
    },
  },
} as const;

export const GET: APIRoute = ({ params }) => {
  const mode = params.mode as keyof typeof content | undefined;
  const payload = mode ? content[mode] : undefined;

  if (!payload) {
    return new Response(JSON.stringify({ message: 'Modo no encontrado.' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};
