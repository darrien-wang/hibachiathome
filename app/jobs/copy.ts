// Three languages because the three recruiting channels speak three languages:
// Chinese forums and WeChat groups, English Facebook/Indeed listings, and
// Spanish-language local groups. Same form, same fields — only the words change.

export type JobsLocale = "zh" | "en" | "es"

// The lines an applicant reads back in the voice memo. They are lifted verbatim
// from the chef manual's script sheet, so the test is the job: read the script
// clearly and be willing to speak up. It is not an English exam.
export const SCRIPT_LINES = [
  "Hi, I'm ___ from Real Hibachi — I'm your chef tonight.",
  "Who's having steak? Rare, medium rare, medium, medium well, or well done?",
  "Phones out — you're gonna want this one. Three… two… one—",
]

export const PHONE = "562-713-4832"
export const PHONE_HREF = "tel:+15627134832"
export const SMS_HREF = "sms:+15627134832"

type Copy = {
  langLabel: string
  metaTitle: string
  eyebrow: string
  h1: string
  lede: string
  points: { k: string; v: string }[]
  upfrontTitle: string
  upfront: string[]
  areaTitle: string
  area: string
  formTitle: string
  formLede: string
  f: {
    name: string
    phone: string
    email: string
    emailHint: string
    city: string
    cityHint: string
    hasCar: string
    carHint: string
    vehicle: string
    vehiclePlaceholder: string
    availability: string
    fri: string
    sat: string
    sun: string
    experience: string
    experienceHint: string
    experiencePlaceholder: string
    earliest: string
    earliestPlaceholder: string
    terms: string
    submit: string
    submitting: string
    required: string
    orText: string
  }
  doneTitle: string
  doneLede: string
  doneStepTitle: string
  doneStep: string
  doneHint: string
  errorGeneric: string
}

export const COPY: Record<JobsLocale, Copy> = {
  zh: {
    langLabel: "中文",
    metaTitle: "招聘周末上门铁板烧师傅／学徒",
    eyebrow: "南加州 · 周五六日",
    h1: "周末做上门铁板烧",
    lede: "开车到客人后院支起铁板，边做边表演，一场 90 分钟。不是餐厅后厨。只做周五、周六、周日，平时完全不占用。",
    points: [
      { k: "铁板炉公司提供", v: "不用自己先买炉子。这行别家都要。" },
      { k: "零基础，两三周出师", v: "前面跟 1–3 台在旁边学（不给钱），上手炒的那台起 $10／位。" },
      { k: "英语不用很好", v: "全场就那几句固定的话，我们给一整张话术表，背熟就行。" },
      { k: "10 人的场约 $220", v: "工钱＋小费。出师后 $11–13／位，客人点名 $15–20／位。" },
      { k: "小费 100% 归你", v: "公司一分不碰。每场保底 $100，每周六结账。" },
    ],
    upfrontTitle: "三件事先说在前面",
    upfront: [
      "大件公司都出：铁板炉、食材、酱料、工服。你自备丙烷，和一套自己用顺手的刀铲。",
      "独立承包（1099），不是 W-2。",
      "Food Handler Card：加州要求，网上考，$15、一小时。",
    ],
    areaTitle: "在哪接单",
    area: "洛杉矶、橙县、内陆帝国、圣地亚哥、棕榈泉。食材统一在罗兰岗取货，每场先过来拿料再出发——所以住罗兰岗、核桃、钻石吧、哈仙达岗、工业市、西科维纳、波莫纳、奇诺岗一带的最合适。",
    formTitle: "填个表，五分钟",
    formLede: "填完我们会短信联系你，约你来跟第一台。",
    f: {
      name: "你的名字",
      phone: "手机号",
      email: "邮箱",
      emailHint: "可不填",
      city: "你住哪个城市／邮编",
      cityHint: "决定你离取货点多远",
      hasCar: "我有车",
      carHint: "普通四座车就行——SUV、轿车、敞篷都可以，不挑车型",
      vehicle: "什么车",
      vehiclePlaceholder: "可不填，例如 Camry / CR-V",
      availability: "周末哪几天能出台",
      fri: "周五",
      sat: "周六",
      sun: "周日",
      experience: "有没有相关经验",
      experienceHint: "没有也完全可以，这一栏不影响录取",
      experiencePlaceholder: "餐饮、铁板、表演、带小孩、当过服务生……随便写两句",
      earliest: "最快哪个周末能来跟第一台",
      earliestPlaceholder: "例如 这周六 / 下周日",
      terms: "我知道这是 1099 独立承包，丙烷和自己的刀铲要自备。",
      submit: "提交申请",
      submitting: "提交中……",
      required: "名字、手机号、所在城市要填一下。",
      orText: "不想填表？直接发短信到",
    },
    doneTitle: "收到了",
    doneLede: "我们会尽快短信联系你。",
    doneStepTitle: "还有最后一步，一分钟",
    doneStep: "用手机录一段语音，把下面这三句念一遍，发短信到 562-713-4832。念得磕巴没关系——我们只想听你敢不敢开口。这三句就是你上场真会说的原话。",
    doneHint: "录完发过来，我们看到了就约你跟场。",
    errorGeneric: "提交没成功。直接发短信到 562-713-4832 也一样。",
  },

  en: {
    langLabel: "English",
    metaTitle: "Weekend Hibachi Chef & Apprentice Jobs",
    eyebrow: "Southern California · Fri–Sun",
    h1: "Cook hibachi in backyards on weekends",
    lede: "You drive to the customer's backyard, set up the griddle, and run a 90-minute show. Not a restaurant kitchen. Fridays, Saturdays and Sundays only.",
    points: [
      { k: "We supply the griddle", v: "You don't buy a grill to start. Everyone else in this business makes you." },
      { k: "Zero experience, solo in 2–3 weeks", v: "First 1–3 events you ride along unpaid, then $10/guest from your first hands-on event." },
      { k: "Your English doesn't need to be great", v: "The night runs on a short, fixed set of lines. We give you the whole script." },
      { k: "About $220 for a 10-guest party", v: "Pay plus tips. After you're cleared: $11–13/guest, $15–20 when requested by name." },
      { k: "100% of tips are yours", v: "We never touch them. $100 minimum per event, paid every Saturday." },
    ],
    upfrontTitle: "Three things up front",
    upfront: [
      "We supply the big stuff — griddle, all food, sauces, uniform. You bring propane and your own knives and spatulas.",
      "1099 contractor, not W-2.",
      "California Food Handler Card — online, about $15, one hour.",
    ],
    areaTitle: "Where you'd work",
    area: "LA, Orange County, the Inland Empire, San Diego and Palm Springs. Ingredients are picked up in Rowland Heights before every event, so chefs living nearby — Rowland Heights, Walnut, Diamond Bar, Hacienda Heights, City of Industry, West Covina, Pomona, Chino Hills — have the easiest run.",
    formTitle: "Apply in five minutes",
    formLede: "We'll text you and set up your first ride-along.",
    f: {
      name: "Your name",
      phone: "Mobile number",
      email: "Email",
      emailHint: "optional",
      city: "Your city or ZIP",
      cityHint: "Tells us how far you are from the pickup point",
      hasCar: "I have a car",
      carHint: "Any normal four-seater works — SUV, sedan, convertible, we don't care",
      vehicle: "What do you drive",
      vehiclePlaceholder: "optional, e.g. Camry / CR-V",
      availability: "Which weekend days can you work",
      fri: "Friday",
      sat: "Saturday",
      sun: "Sunday",
      experience: "Any related experience",
      experienceHint: "None is fine — this does not decide anything",
      experiencePlaceholder: "Restaurant, griddle, performing, working with kids, serving… a line or two is plenty",
      earliest: "Earliest weekend you could ride along",
      earliestPlaceholder: "e.g. this Saturday / next Sunday",
      terms: "I understand this is 1099 contract work and that I bring my own propane and hand tools.",
      submit: "Send application",
      submitting: "Sending…",
      required: "We need your name, phone, and city.",
      orText: "Rather not fill a form? Text",
    },
    doneTitle: "Got it",
    doneLede: "We'll text you shortly.",
    doneStepTitle: "One last step, about a minute",
    doneStep: "Record a voice memo on your phone reading the three lines below, and text it to 562-713-4832. Stumbling is fine — we only want to hear that you'll speak up. These are the actual lines you'd say on the job.",
    doneHint: "Send it over and we'll book your first ride-along.",
    errorGeneric: "That didn't go through. Texting 562-713-4832 works just as well.",
  },

  es: {
    langLabel: "Español",
    metaTitle: "Trabajo de fin de semana: chef de hibachi a domicilio",
    eyebrow: "Sur de California · Vie–Dom",
    h1: "Cocina hibachi en patios los fines de semana",
    lede: "Manejas al patio del cliente, montas la plancha y haces un show de 90 minutos. No es cocina de restaurante. Solo viernes, sábado y domingo.",
    points: [
      { k: "La plancha la ponemos nosotros", v: "No compras el equipo para empezar. Los demás en este negocio te obligan." },
      { k: "De cero a trabajar solo en 2–3 semanas", v: "Los primeros 1–3 eventos acompañas sin pago; desde el primero que cocinas, $10 por invitado." },
      { k: "No necesitas un inglés perfecto", v: "La noche corre sobre unas pocas frases fijas. Te damos el guion completo." },
      { k: "Unos $220 en una fiesta de 10", v: "Pago más propinas. Ya aprobado: $11–13 por invitado, $15–20 si te piden por nombre." },
      { k: "Las propinas son 100% tuyas", v: "No tocamos nada. Mínimo $100 por evento, pago cada sábado." },
    ],
    upfrontTitle: "Tres cosas por adelantado",
    upfront: [
      "Lo grande lo ponemos nosotros: plancha, comida, salsas, uniforme. Tú pones el propano y tus propios cuchillos y espátulas.",
      "Contratista 1099, no W-2.",
      "Food Handler Card de California — en línea, unos $15, una hora.",
    ],
    areaTitle: "Dónde trabajarías",
    area: "Los Ángeles, Orange County, Inland Empire, San Diego y Palm Springs. La comida se recoge en Rowland Heights antes de cada evento, así que a quienes viven cerca — Rowland Heights, Walnut, Diamond Bar, Hacienda Heights, City of Industry, West Covina, Pomona, Chino Hills — les queda mucho mejor.",
    formTitle: "Aplica en cinco minutos",
    formLede: "Te mandamos un mensaje y agendamos tu primer evento de acompañamiento.",
    f: {
      name: "Tu nombre",
      phone: "Número de celular",
      email: "Correo",
      emailHint: "opcional",
      city: "Tu ciudad o código postal",
      cityHint: "Nos dice qué tan lejos estás del punto de recogida",
      hasCar: "Tengo carro",
      carHint: "Cualquier carro normal de cuatro asientos sirve — SUV, sedán o convertible",
      vehicle: "Qué manejas",
      vehiclePlaceholder: "opcional, ej. Camry / CR-V",
      availability: "Qué días del fin de semana puedes trabajar",
      fri: "Viernes",
      sat: "Sábado",
      sun: "Domingo",
      experience: "Experiencia relacionada",
      experienceHint: "Ninguna está bien — esto no decide nada",
      experiencePlaceholder: "Restaurante, plancha, actuar, trabajar con niños, mesero… con dos líneas basta",
      earliest: "El fin de semana más pronto que podrías acompañar",
      earliestPlaceholder: "ej. este sábado / el próximo domingo",
      terms: "Entiendo que es trabajo por contrato 1099 y que yo pongo mi propano y mis herramientas.",
      submit: "Enviar solicitud",
      submitting: "Enviando…",
      required: "Necesitamos tu nombre, teléfono y ciudad.",
      orText: "¿Prefieres no llenar el formulario? Manda un mensaje al",
    },
    doneTitle: "Recibido",
    doneLede: "Te escribimos pronto.",
    doneStepTitle: "Un último paso, como un minuto",
    doneStep: "Graba una nota de voz en tu celular leyendo las tres frases de abajo y mándala por mensaje al 562-713-4832. Está bien si te trabas — solo queremos oír que te animas a hablar. Son las frases reales que dirías en el trabajo.",
    doneHint: "Mándala y agendamos tu primer evento de acompañamiento.",
    errorGeneric: "No se pudo enviar. Mandar un mensaje al 562-713-4832 funciona igual.",
  },
}
