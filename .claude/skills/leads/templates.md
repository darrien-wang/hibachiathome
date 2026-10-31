# 句式库

主手册 `SKILL.md` 定规矩，英文怎么写才自然见 `voice.md`。这里的模板**原样填空就发**，不等审批；改了问句、加了事实、顺着他的话写的，按"聊"处理（SKILL §4，大多数情况也可以直接发，发完报）。`[ ]` 里换成真实信息；没有就删掉那半句，不要硬凑。

---

## 首条

**A · 只留联系方式**（机器在留资 15 分钟后发，人不手发；供核对）
```
Hi! Rowling from Real Hibachi - our system should've texted you a price and didn't, sorry about that. For 15 adults it's $838.50 Fri-Sun, or $763.50 Mon-Thu (2 proteins each + fried rice, veggies, salad and the chef show). What date are you thinking?
```

**B · 报价已发**（机器在报价 2 分钟后发，措辞在 `lib/first-response.ts`；供核对和手发时用。两周内的日期说 `Saturday the 18th`，更远的说 `Saturday, May 15`）
```
Hi, it's Rowling from Real Hibachi. [Saturday the 18th] is open for the [N] of you in [City]. What's the celebration?
Hi, it's Rowling from Real Hibachi. Saw your quote for [N] in [City]. What's the celebration?      ← 没日期（没像样的城市名就去掉 in [City]）
```

**C · 客人先问**：≤2 句答 + 一个问题。
```
Hi, it's Rowling from Real Hibachi. Yes, Temecula's in our area. Travel is usually $20-40 depending on the address. Roughly how many people are you thinking?
```

**电话之后的书面确认**（挂断几分钟内）
```
Hi, it's Rowling from Real Hibachi. Here's the link Bling mentioned on the phone. [Friday the 13th at 7 in Downey] for [13 adults and two 7-year-olds] comes to $[X][, no travel fee]. It just saves a card to hold the date, nothing is charged today: <link>
```

**未接、秒挂的陌生号**（只发一条）
```
Hi, it's Rowling from Real Hibachi. Sorry we missed your call. If you're planning a party, text me the date, how many people and the city, and I'll send you a price right here.
```

**61+ 大单**
```
Hi, it's Rowling from Real Hibachi. [70-80] guests on [Dec 5], that's a [3]-chef party. It's $59.90 per adult, $29.90 for kids 5-12, and under 5 eat free. I'll put an exact number together tonight. Is it an evening event, and roughly how many kids?
```

**邮件首条**（比短信长一点，仍然一屏）
```
Subject: Your hibachi party - [date or "the date you're thinking"]

Hi [Name or "there"],

Rowling here from Real Hibachi. [一句回应他写的]

• [15] adults, Fri-Sun: $[838.50]
• Same party Mon-Thu: $[763.50] (+ a free appetizer of your choice: gyoza, edamame or spring rolls)
• Includes 2 proteins per guest, fried rice, veggies, salad, and the chef show

[一个问题]

Rowling
Real Hibachi · (213) 770-7788
```

---

## 在聊

- **问场合**：`What's the celebration?` / `Who's the party for?`
- **报城市后给价 + 链接 + 问时间**：`Tustin is inside our free 50 miles, so 18 people on Saturday the 7th is $1,018.20. The headcount can change up to the day before. Here's the link to lock the date. It just saves a card, nothing is charged today: <link> What time are you thinking?`
- **人数在涨**：`Congrats on the bigger crowd! Hibachi scales well. The group discount grows with the headcount, 20+ gets a free appetizer, and past 28 we send a second chef so everyone eats at once. Roughly how many are you expecting now?`
- **改了时间地点、马上要锁**：`Yes to both. [Saturday the 24th at 3:30 at your place in Granada Hills] works, and it's still $[988.50]. Here's the link with [3:30] and [Granada Hills] filled in: <link>`
- **问桌椅**（照价答，D-1029-02）：`We do. Tables, chairs and linens are $10 a guest, and plates and silverware are $5.` 要总价就过 `desk price --tables N --utensils N` 报一个数。客人拿别家比价或说超预算时，桌椅才是最后一张牌（周五–日最多半价、周一–四最多免费、节假日不给）：`If it helps, lock the date and I'll do the tables at half price.`
- **模板 L · 他以为要等人数定了才能订**（10-01）：`You don't need the final number to lock [the 7th]. The link just saves a card to hold the date, nothing is charged today, and the headcount can change later: <link>` 发完挂 3–5 天，之后不追。
- **模板 S · 他要和家人商量**（10-30，D-1030-05）：`Here's a note you can forward: "Hibachi chef at our place on [Saturday, Nov 14]. $[1,138] for [20] of us covers the food, the chef and the fire show[, plus a free appetizer]. The headcount can change up to the day before." Text me once you've talked it over.` 不带链接；价格先过 `desk price`；有送的才写 free appetizer；小费、桌椅、税不问不提。
- **问预算**（10-30，D-1030-06，一条线索只问一次）：`Is there a budget you're trying to stay under?`
- **确认类，一句话**：`Done, 7:30.` / `Got it, 7:30 then.`（`X it is` 一个客人最多用一次）
- **客气收尾**：`You too, enjoy your night.` / `Anytime.` / `You got it.` / `Sounds good, talk soon.`（大多不带 emoji，见 `voice.md` §4）
- **他说要电话**：`Got it. We'll call you from 213-770-7788 shortly.`
- **他问是不是真人**：见 `answers.md` 末尾和 SKILL §2。

---

## 跟进（沉默的人，3 条封顶，SKILL §5.3）

**f_one**：台阶 + 一个真理由 + 一个好答的问题，≤200 字符，不带链接、不重复价格。
```
Hi, it's Rowling from Real Hibachi. Figured you've got a lot going on. Is [the 7th] still the plan, or is it moving?          ← 有日期
Hi, it's Rowling. Has the group landed on a weekend yet?                  ← 没日期
Hi, it's Rowling. Something I didn't mention: with [20] guests you also get a free appetizer, gyoza, edamame or spring rolls. Is [Saturday the 14th] still the plan?   ← 有新的真事实
Hi, it's Rowling. [April 24] is a ways off, so no rush. The link holds the date with just a card whenever you're ready. Want me to check back in the new year?   ← 远期
```
不用 "Last note from me" / "last check-in so I don't crowd your texts"。这几句是骨架，不是成品：从他最后说的那句话写起，连着给几个人发时开头要换，不要每条都是 `figured you're still...`（`voice.md` §2）。

**B 桶 · 他定过回话时间**（到点接着他的话）：`Hi [Yvonne], it's Rowling. Did your daughter give Saturday the 7th the thumbs up?`

**f_deadline · 派对 7 天内、有新信息**（一条为限）：`Hi, it's Rowling. Saturday's coming up fast. If you lock it in by Thursday, we shop fresh on Friday and you're all set. What city is the party in?`

---

## 不订、选了别家、预算不合

- **问原因**（SKILL §0）：`That makes sense. If you don't mind me asking, what tipped it? It helps us get better.`
- **祝福收尾**：`Sounds like a good plan. Hope everyone has a blast!`
- 原因是别家更便宜：`negotiation.md` §7 挽留一次。
- **送 $50 下次用**（老板 10-26）：客人明说不订、**而且说了清楚真实的原因**（钱改买了礼物、家里出事、换了安排、选了别家并说了为什么），收尾之后单发一条；敷衍的不算（"no thanks"、"maybe later"、不说原因、已读不回）。`One more thing. Thanks for being so honest with us. Here's $50 off your next hibachi party whenever you're ready. Just text this number and mention it, and we'll take it off. 🎁` 线索记 `[credit] $50 off next booking`；客人回来时报价用 `desk link deposit ... --flat-off 50 --deal-note "goodwill credit <日期>" --est <减完的总价>`。一次一用，和别的让价叠加时仍守让价底线。

---

## 锁单之后

- **派对页 + 二选一**：`Here's your party page for everyone to pick their proteins: <link> Or just text me the list and I'll fill it in, whichever's easier.`
- **锁单后接一句**：`You're all set for [Saturday at 3:30], thank you! [Shrimp is already on everyone's plate as the third protein, so] just add each guest's 2 on the party page, or text me the list and I'll fill it in.`
- **问地址**：`Could you send me the street address when you have a minute?`
- **问小孩年龄**：见 `answers.md` §吃什么。
- **免费小孩确认**：`Quick check for tomorrow: are [three] of the kids 3-4 (those eat free), or are all [8] between 5 and 12?`
- **师傅名字（前一天）**：`Your chef is [Blu]. [He]'ll be there around [5] to set up. I'm still your contact, so text me anytime.`
- **请已锁单的客人挪一下时间**（同一位师傅两场接不上，老板 10-22）：问法中性、可选，不提另一场、不提排班；客人说不行就照旧。`Quick question for Saturday. Would [3:00] work just as well for your group as [3:30]? If [3:30] is better, we'll keep it, no problem at all.` 客人问为什么，照实说"多一点时间把布置做好"这类对他有用的真话，不编理由。
- **发票**（`desk order send` 自带）：`Here's your invoice for [Friday]: <link> Please look it over and reply "confirm" here if it's all right. A PDF copy is in your email too.`
- **问来源**（只问系统归不了因的、锁单后一次，搭在客气话后）：`Got it, thanks! Just curious, how did you find us?`

---

## 西语（客人写西语才用，数字口径一样）

```
B: ¡Hola! Soy Rowling de Real Hibachi 👋 [El sábado 18 de octubre] está disponible para tus [N] invitados en [Ciudad]. ¿Qué celebran?
precio + link: [Tustin] está dentro de nuestras 50 millas gratis: son $[1,018.20] para [18] el [sábado 7 de noviembre], y el número de invitados puede cambiar hasta el día anterior. Aquí puedes asegurar la fecha. Solo se guarda una tarjeta, hoy no se cobra nada: <link>
f_one: Hola, soy Rowling. Me imagino que andas con muchas cosas. ¿Ya quedó firme el [7 de noviembre] o todavía se está moviendo?
cierre: ¡Claro! Que disfruten mucho. Aquí estoy para lo que necesites.
```
工作台的 `ES_SCRIPTS` 里还有更多西语模板，用前对一遍这里的口径（不说押金、不提税、不写"setup & cleanup included"）。
