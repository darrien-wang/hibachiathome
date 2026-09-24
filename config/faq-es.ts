import { pricing } from "@/config/pricing"

// Spanish FAQ — human-translated (Mexican Spanish) from config/faq.ts, not
// machine-mirrored: keep both files in sync when policies change. Rendered on
// /es/faq and emitted as FAQPage JSON-LD in Spanish.
export const faqItemsEs = [
  {
    question: "¿Cuánto cuesta la experiencia hibachi?",
    answer: `Tarifa base: $${pricing.packages.basic.perPerson} por invitado (mínimo $${pricing.packages.basic.minimum} en total)

Niños: $${pricing.children.basic} de 5 a 12 años, y los menores de 5 comen gratis

Propina: lo habitual es 20–25% de la cuenta final

Cargo por traslado: las primeras 50 millas son gratis, después $1 por milla — lo ves en tu cotización antes de pagar

Formas de pago:
- Efectivo (preferido, sin comisión)
- Tarjeta de crédito, Venmo o Zelle (4% de comisión)

Elijas lo que elijas, el saldo se paga el día de tu fiesta.`,
  },
  {
    question: "¿Tienen descuentos para militares, enfermeras, maestros o socorristas?",
    answer:
      "Sí — nuestro Programa de Agradecimiento honra a una comunidad de servicio diferente cada temporada: veteranos y militares activos, enfermeras y personal de salud, maestros y personal escolar, y bomberos, paramédicos y socorristas, cada uno con $50 de descuento en su fiesta mientras su periodo está activo. Consulta al homenajeado actual en la página de cotización, menciónalo al reservar y muestra tu credencial de trabajo o identificación de servicio a tu chef. Fiestas de $599 o más, uno por reservación; se combina con el Especial de Entre Semana pero no con otras ofertas de descuento en dólares.",
  },
  {
    question: "¿Pueden traer mesas y sillas?",
    answer:
      "¡Sí! Rentamos mesa, sillas y mantel por $10 por persona. Los cubiertos no vienen incluidos en ese paquete; si los necesitas, los agregamos por $5 adicionales por persona. Y si prefieres poner tus propias mesas, sillas y cubiertos, no hay problema — solo avísanos con anticipación.",
  },
  {
    question: "¿A qué hora llega el chef?",
    answer:
      "Tu chef llega entre 10 y 30 minutos antes de la hora que elegiste — más cerca de 30 si la fiesta es grande — descarga, coloca el tapete, monta la plancha y conecta el propano. A la hora de inicio la plancha ya está caliente y los ingredientes listos.",
  },
  {
    question: "¿Qué necesitan de nosotros ese día? ¿Necesitan un enchufe?",
    answer:
      "Solo el lugar. Tu chef llega 10–30 minutos antes de la hora de inicio, descarga, coloca un tapete impermeable y a prueba de grasa, monta la plancha teppanyaki y conecta el propano — sin enchufe, sin electricidad, sin toma de agua. Si reservaste mesas, sillas y cubiertos, también los montamos, y tú no haces nada más que recibir a tus invitados; cuando el chef esté listo, los traes a la mesa. Si usas tus propias mesas y vajilla, tenlas listas antes de que lleguemos y del resto nos encargamos nosotros. ¿Algo especial en mente — un plato de cumpleaños, una idea para los asientos, una sorpresa? Dínoslo al reservar y, si podemos hacerlo, lo haremos.",
  },
  {
    question: "¿Qué pasa si el chef no llega?",
    answer:
      "Esta es nuestra promesa de asistencia, por escrito: tu chef queda confirmado por nombre antes del evento, y nuestros chefs son parte de nuestro propio equipo — no repartidores de una app. Si Real Hibachi alguna vez tuviera que cancelarte, te devolvemos el doble de lo que hayas pagado y te damos prioridad para reagendar. En otras palabras: llegamos, o nos cuesta.",
  },
  {
    question: "¿Cuánta comida recibe cada invitado?",
    answer: `Cada adulto recibe 2 proteínas más todas las guarniciones — estas son las porciones exactas, por escrito:

- Pollo: 5 oz | Bistec: 4.5 oz | Salmón: 4 oz | Camarones: 5 jumbo, sin cola | Callos de hacha: 4 oz jumbo (10/20 ct) | Filete miñón: 4.5 oz | Cola de langosta: 6 oz
- Arroz frito: 8 oz por persona
- Verduras a la plancha: 4 oz por persona
- Ensalada con aderezo de jengibre: 1 por persona

Los niños de 5 a 12 años reciben media porción. ¿Quieren más? Las porciones extra de arroz frito y verduras son gratis — solo avísanos antes del evento para que el chef prepare y lleve suficiente. Nadie se va con hambre de una fiesta Real Hibachi.

¿Quieres el arroz frito con extras? Ingredientes al gusto — camarón o pollo — a $10 cada uno, y huevos extra a solo $1.`,
  },
  {
    question: "¿La plancha daña o ensucia mi patio?",
    answer:
      "No — proteger tu casa es parte del trabajo. En cada fiesta colocamos una lona protectora bajo la estación de la plancha para cuidar tu patio de la grasa y el calor, y antes de irnos recogemos el equipo y limpiamos el área de cocina. Tu patio queda como lo encontramos.",
  },
  {
    question: "¿Cocinan en interiores?",
    answer:
      "Toda la cocina se hace al aire libre — en patios, balcones, terrazas o bajo toldos y carpas. (Los invitados pueden sentarse adentro si gustan, pero la plancha se queda afuera.)",
  },
  {
    question: "¿Usan nueces o ajonjolí?",
    answer:
      "No podemos prometer una mesa 100% libre de nueces o ajonjolí, y preferimos decirlo a adivinar. Nuestras salsas y gyozas son productos comerciales: las gyozas contienen ajonjolí, y una de nuestras salsas se elabora en una planta que también procesa cacahuate. Ambas salsas contienen huevo. Avísale a tu agente de reservas sobre cualquier alergia y revisaremos las etiquetas de los productos de tu fecha para decirte con honestidad si podemos servirle a ese invitado de forma segura.",
  },
  {
    question: "¿Pueden atender a invitados sin gluten?",
    answer:
      "Claro que sí. Hemos servido a muchos comensales sin gluten. Avísanos al reservar y tu chef lleva salsa de soya y teriyaki sin gluten, y prepara ese plato en una estación aparte, sin costo extra. Necesitamos que nos avises con anticipación, porque nuestras salsas normales sí llevan gluten.",
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
      "Reservar es simple y directo:\n\n- Obtén una cotización al instante en www.realhibachi.com\n- Elige tu fecha y paquete\n- Indica el número de invitados y tus datos de contacto\n- Nosotros te confirmamos la reservación directamente\n\nPara fiestas de cualquier tamaño solo necesitas una reservación. Nosotros asignamos el número de chefs según tus invitados.",
  },
  {
    question: "¿Puedo cambiar el número de invitados después de reservar?",
    answer:
      "Sí. Tu depósito reserva la fecha, no un número — puedes cambiar la cantidad de invitados hasta el día antes de tu fiesta y el total se ajusta (el mínimo de $599 sigue aplicando). ¿Necesitas cancelar o reagendar? Avísanos con al menos 72 horas de anticipación y te devolvemos el depósito completo.",
  },
  {
    question: "¿Cuál es la política de cancelación?",
    answer:
      "Nuestra política de cancelación incluye estos términos:\n\n- Se requieren 72 horas de anticipación para cancelar o reagendar con reembolso completo\n- Dentro de las 72 horas es posible que no podamos reembolsar el total\n- Para días de lluvia, considera una carpa de 10'x10' sobre la estación del chef — la pones tú, nosotros no suministramos carpas\n- Si necesitas cancelar por clima, avísanos con al menos 72 horas de anticipación",
  },
]
