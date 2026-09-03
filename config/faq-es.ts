import { pricing } from "@/config/pricing"

// Spanish FAQ — human-translated (Mexican Spanish) from config/faq.ts, not
// machine-mirrored: keep both files in sync when policies change. Rendered on
// /es/faq and emitted as FAQPage JSON-LD in Spanish.
export const faqItemsEs = [
  {
    question: "¿Cuánto cuesta la experiencia hibachi?",
    answer: `Tarifa base: $${pricing.packages.basic.perPerson} por invitado (mínimo $${pricing.packages.basic.minimum} en total)

Propina: recomendamos el 20% de la cuenta final

Cargo por traslado: puede aplicar según tu ubicación; el monto exacto se informa al reservar

Formas de pago:
- Efectivo (preferido)
- Tarjeta de crédito (4% de comisión)
- Venmo/Zelle (sin comisión)

Si pagas con tarjeta, el pago debe liquidarse al menos 72 horas antes de tu evento.`,
  },
  {
    question: "¿Pueden traer mesas y sillas?",
    answer:
      "¡Sí! Rentamos mesa, sillas y mantel por $10 por persona. Los cubiertos no vienen incluidos en ese paquete; si los necesitas, los agregamos por $5 adicionales por persona. Y si prefieres poner tus propias mesas, sillas y cubiertos, no hay problema — solo avísanos con anticipación.",
  },
  {
    question: "¿A qué hora llega el chef?",
    answer:
      "Tu chef llega unos 10 minutos antes de la hora que elegiste. El montaje es muy rápido, así que la plancha y los ingredientes estarán listos en cuestión de minutos.",
  },
  {
    question: "¿Qué pasa si el chef no llega?",
    answer:
      "Esta es nuestra promesa de asistencia, por escrito: tu chef queda confirmado por nombre 48 horas antes del evento, y nuestros chefs son parte de nuestro propio equipo — no repartidores de una app. Si Real Hibachi alguna vez tuviera que cancelarte, te devolvemos el doble de tu depósito y te damos prioridad para reagendar. En otras palabras: llegamos, o nos cuesta.",
  },
  {
    question: "¿Cuánta comida recibe cada invitado?",
    answer: `Cada adulto recibe 2 proteínas más todas las guarniciones — estas son las porciones exactas, por escrito:

- Pollo: 5 oz | Bistec: 4.5 oz | Salmón: 4 oz | Camarones: 5 colosales (16/22 ct) | Callos de hacha: 4 oz jumbo (10/20 ct) | Filete miñón: 4.5 oz | Cola de langosta: 6 oz
- Arroz frito: 8 oz por persona
- Verduras a la plancha: 4 oz por persona
- Ensalada con aderezo de jengibre: 1 por persona

Los niños de 5 a 12 años reciben media porción. Y si alguien se queda con hambre: el refill de arroz frito y verduras es gratis. Nadie se va con hambre de una fiesta Real Hibachi.

¿Quieres el arroz frito con extras? Ingredientes al gusto — SPAM, tocino, camarón o pollo — a $10 cada uno, y huevos extra a solo $1.`,
  },
  {
    question: "¿La plancha daña o ensucia mi patio?",
    answer:
      "No — proteger tu casa es parte del trabajo. En cada fiesta colocamos una lona protectora bajo la estación de la plancha para cuidar tu patio de la grasa y el calor, y antes de irnos recogemos el equipo y limpiamos el área de cocina. Tu patio queda como lo encontramos.",
  },
  {
    question: "¿Cocinan en interiores?",
    answer:
      "Toda la cocina se hace al aire libre — en patios, balcones, terrazas o bajo toldos y carpas. (Los invitados pueden sentarse adentro si gustan, pero la plancha se queda afuera.) Contamos con licencia y seguro.",
  },
  {
    question: "¿Usan nueces o ajonjolí?",
    answer:
      "No podemos prometer una mesa 100% libre de nueces o ajonjolí, y preferimos decirlo a adivinar. Nuestras salsas y gyozas son productos comerciales: las gyozas contienen ajonjolí, y una de nuestras salsas se elabora en una planta que también procesa cacahuate. Ambas salsas contienen huevo. Avísale a tu agente de reservas sobre cualquier alergia y revisaremos las etiquetas de los productos de tu fecha para decirte con honestidad si podemos servirle a ese invitado de forma segura.",
  },
  {
    question: "¿Pueden atender a invitados sin gluten?",
    answer:
      "Claro que sí. Hemos servido a muchos comensales sin gluten. Solo trae tus salsas de soya y teriyaki sin gluten preferidas, y prepararemos su comida en una estación aparte.",
  },
  {
    question: "¿Y los vegetarianos o veganos?",
    answer:
      "Con gusto atendemos necesidades especiales:\n\n- Las opciones vegetarianas incluyen tofu y verduras extra\n- Los platillos veganos se preparan con ingredientes de origen vegetal\n- Todos los platillos especiales tienen la misma tarifa por persona\n\nAvísanos de cualquier requerimiento al reservar.",
  },
  {
    question: "¿Los invitados pueden traer su propia proteína?",
    answer:
      "Por seguridad y consistencia de precios, pedimos que todas las proteínas las pongamos nosotros. ¡Gracias por comprender!",
  },
  {
    question: "¿Cómo hago una reservación?",
    answer:
      "Reservar es simple y directo:\n\n- Obtén una cotización al instante en www.realhibachi.com\n- Elige tu fecha y paquete\n- Indica el número de invitados y tus datos de contacto\n- Confirma tu reservación con un depósito\n\nPara fiestas de cualquier tamaño solo necesitas una reservación. Nosotros asignamos el número de chefs según tus invitados.",
  },
  {
    question: "¿Cuál es la política de cancelación?",
    answer:
      "Nuestra política de cancelación incluye estos términos:\n\n- Se requieren 72 horas de anticipación para cancelar o reagendar con reembolso completo del depósito\n- Cambios dentro de las 72 horas pueden hacer el depósito no reembolsable\n- Para días de lluvia, considera una carpa de 10'x10' sobre la estación del chef — la pones tú, nosotros no suministramos carpas\n- Si necesitas cancelar por clima, avísanos con al menos 72 horas de anticipación",
  },
]
