# 客人问什么答什么（事实口径）

主手册是 `SKILL.md`。这里只放**事实和标准答法**；价格以 `config/pricing-rules.ts` 和 `desk price` 为准，这里的数字和它不一致时以代码为准，并回来改这里。客人**问了才答**，答完就停（SKILL §1 第 4 条）。

---

## 价格

| 项 | 周五–周日、节假日 | 周一–周四 Weekday Special |
|---|---|---|
| 成人 13+ | $59.90 | $54.90 |
| 小孩 5–12 | $29.90（半份） | $27.45 |
| 5 岁以下 | 免费，不带蛋白（多带炒饭蔬菜或 butter noodles）。不主动说"没有蛋白"，问起小的吃什么答 `rice, veggies and butter noodles if they like` | 同左 |
| 附赠 | 20 人以上送一份前菜 | 任何人数送一份前菜 |

- **送的前菜**：一份三选一（gyoza / edamame / spring rolls），**按人头给**（10-30 起）：到场的都算（大人、5–12 岁、5 岁以下免费的小孩），饺子、春卷每人 1 个，毛豆每 5 人一份（向上取整），不到一盘的小派对给满一盘。数量由发票引擎每次保存自动算，发票上按实际数量计价、优惠行等额抵消，总价不变，不用手动加盘。对客说 `a free appetizer of your choice (gyoza, edamame or spring rolls)`，不说 platter、不说值多少钱。20 人以上这份**不设截止日**（D-1021-01）。和周中那份不叠，都只算一份。订了全套桌椅 + 餐具也送一份（D-1007-06），不当卖点，客人订全套或犹豫时才说。
- **节假日按周末价**：Labor Day、感恩节那周、12/20–1/3、Memorial Day、7/3–7/5（`WEEKDAY_SPECIAL_BLACKOUTS`）。
- **最低消费 $599**：折后不低于 $599。付最低消费的小派对按 10 人的量做（`you're paying the 10-guest minimum, so I'll cook for 10`）；超过 10 人按人头加钱。
- **人数折扣：没有了**（老板 11-05，D-1105-01：「把人数阶梯取消吧，从今天开始」）。任何人数都是每人价 × 人头（+ 租赁、路费），$599 起订；61+ 照旧人工报价（`negotiation.md` §5）。对客不提 party-size discount，也不说"取消了"。**老单、老线索照旧**：11/05 上线（`PARTY_LADDER_CLOSED_AT`）前建的订单、或发票上已经有人数折扣那行的，引擎每次保存都按老阶梯走，人数变了跟着换档；上线前来的线索已经报过含人数折扣的价，`desk price` 会多一行老价，`desk link deposit --lead` 自动按老价，锁单时系统自动带上；客人问起差价不用解释。10–14 人 11/02 起就没有（D-1102-01），11/02 10:00 前的线索照 $30。老阶梯的数只在 `negotiation.md` §2.2 当隐藏让价用。
- **路费**：从基地（91744）驾车，前 50 英里免费，之后 $1/英里；`desk travel "<地址>"` 为准。报价后客人换了城市，路费按新地址收（D-1013-02）。报价按城市算、锁单地址更远（比如说的是 Palm Springs，实际在 Indio），也按实际收（老板 10-22，D-1022-01），改订单后马上一句话告诉客人新总价：`One quick note on travel: your address in Indio is a bit past Palm Springs, so travel comes to $62.80 instead of $43 - your total is $961.20.`
- **加菜**：第 3 种蛋白 +$10（整桌加一份用 `side_<蛋白>`）；升级 ribeye +$5（隐藏项，派对页不显示，客人问"能不能更好的牛肉"才说）、filet +$8、scallops +$6、lobster tail +$12，升级按份收、大人小孩同价。**升级是换掉每人 2 样里的一样，只收差价；在 2 样之外再加一份 = $10 + 差价（菲力 $18、扇贝 $16、龙虾尾 $22）**，带升级的总价过 `desk price --swap filet=N` / `--extra filet=N`（--off 50 是在最低消费前扣的致谢），不照 /quote 页那句 "on top of the 2 regular proteins" 算（11-08 Nicole：页面让客人以为鸡+虾+三样升级每人只加 $26，书面报了 $672.20，原价 $912.20，老板 11-11 收回；页面待修）。没升级时报的价，客人加了升级按原价报新数，不算事后涨价（老板 11-11）；Prime ribeye +$12（锁单后手加）；gyoza $15、spring rolls $15、edamame $10；noodles $5；炒饭加料（虾/鸡）$10、加蛋 $1；软饮 $5/位（Premium $12）；炒饭蔬菜加量免费（提前说）。
- **辣毛豆**（老板 11-03）：可以做，辣味用 sriracha 调。客人问能不能做辣的、或问怎么做辣的，就说 `Yes, we can make the edamame spicy. We season it with sriracha.`，再写进订单备注给师傅；客人不问不提。
- **炒饭加料**（老板 11-01）：鸡肉或虾 $10 一份，一份大约够 10 个人，全桌加不用按人头算（Irene 27 人，老板定两份 $20）。客人说要了 `desk order set <单号> --add-extra diy_rice_chicken=2`（虾是 `diy_rice_shrimp`），回一句确认，再 `desk order send`。
- **致敬 Appreciation $50**：当期职业（老兵 10/16–11/30；医护 12/1–1/15；消防/急救 1/16–2/28），$599 以上、一单一次、只按职业。默认只和周中价叠；老单上的人数折扣默认不叠（老板叠过两单属个案，以后要叠先问）。
- **回头客**（老板 10-29 定，D-1029-01）：客人自己提"上次订过"→ **一律减 $50**（隐形福利，不主动说），老单上的人数折扣照叠；只用在标准价（周一–四特价不叠）；不能把总价压到 $599 以下（$599 那档的小单不减）；回头客、派对客人名片、致敬计划这三个 $50 一单只给一个。签进链接：`desk link deposit ... --flat-off 50 --deal-note "Returning customer - $50 off"`。原来的"每 10 人 $60"是 08-31 还没有自动人数折扣时定的，叠在一起太多（Ashley 12/5 周六 20 位叠到人均 $50.9，老板：「周六的均价应该在 55 左右」）。$50 是客人压价时的底线，不是送福利的目标。

**常用价（无路费、无加购）**：

| 成人 / 5–12 | 周五–日 | 周一–四 |
|---|---|---|
| ≤10 / 0 | $599 | $599 |
| 12 / 0 | $718.80 | $658.80 |
| 15 / 0 | $898.50 | $823.50 |
| 18 / 0 | $1,078.20 | $988.20 |
| 20 / 0 | $1,198.00 | $1,098.00 |
| 25 / 0 | $1,497.50 | $1,372.50 |
| 30 / 0 | $1,797.00 | $1,647.00 |

## 税、付款、小费（D-1006-05、D-1006-07、D-1013-04）

- **标价 = 现金价，含税**。定下来之前一个字不提税和付款方式，只报标价。
- **两张账只列在发票上**，数字全由系统出：现金给师傅 = 标价；刷卡 = 标价 + 派对地址实际销售税 + Stripe 3%（借记卡不加）+ 可选 20% 小费。客人说要刷卡时问一句 `Would you like to add the 20% gratuity for your chef to the card, or tip them in person on the day?`
- **Zelle/Venmo**：客人不问不提。问了才说可以直接给师傅本人，金额 = 现金价 × 1.04（`desk price`、订单弹窗有这个数）。公司的 Zelle/Venmo 账号**永不对客**。
- **PayPal 也收**（老板 10-24）：和 Venmo/Zelle 一样直接给师傅本人，现金价 × 1.04。客人问到"现金价包不包括 PayPal/Venmo"这类问题时，把不付现金的价差一次说清：`Here's how it comes out. Cash is $X, PayPal, Venmo or Zelle to your chef is $Y, and card is $Z, since that one includes sales tax and card processing.`（三个数都从 `desk order show` 那行抄。）
- **公司客户**（要 W-9、公司付款）：标价 + 派对地址销售税；刷卡再加 3%。支票、ACH 收不收没定，问老板。W-9 和保险证明在 `D:\desktop\RealHibachi\company-docs`，客人要了才发。
- **小费**：不含；20–25% 惯例，100% 给厨师。不淡化，问了就直说 `Not included - 20-25% is customary, and 100% of it goes to the chefs.`
- **聊天不以尾款为中心，让客人自己看发票**（老板 10-31，D-1031-04）：客人只看到一个尾款数，就在上面随手加个固定金额，不按百分比给，师傅小费就低。发票链接默认是现金版，客人在顶部自己切到 Venmo / Zelle 或刷卡，每一版都有各档小费的总额（D-1031-05）。所以：对客不说 `your balance`（`desk send` 会拦）；派对前提醒发发票，不报数（`desk order remind`）；改人数、加东西回一句确认，再 `desk order send` 发新发票；客人问要付多少，也是 `desk order send`，再回 `It's all on your invoice, with your total at each gratuity level. You can pick how you're paying at the top.` 客人看过还要数字才报，报发票上的数。锁单前的报价照常报。
- **口径是 optional，展示里不说 optional**（老板 10-23，D-1023-01）：发票、派对前提醒、邮件、主动开口都不写这个词（发票小费栏 10-23 已删 "Optional —"，只留它是给什么的）。客人直接问"是不是必须给"才答 `It's optional - 20-25% is customary, and 100% of it goes to your chef.`
- **"是不是全包"**：`$X covers the food, the chef and the show, and that's the cash price with sales tax included. Gratuity isn't included - 20-25% is customary, and all of it goes to the chefs.` 客人提刷卡才补一句刷卡另加税和手续费，菜单定了给逐行明细。
- 不说 "no tax / tax-free"，不报 ×1.10 的整数。

## 锁日期、改人数、取消

- **锁日期 = 留一张卡，当天 $0**（D-1006-04）；尾款派对当天付。61+ 也一样留卡，不收押金。
- **第一次递链接就说清这张卡唯一的用处**（老板 11-07，D-1107-01：「这个留卡的时候说明一下吧，这个卡的唯一作用」）：`It just saves a card, and nothing is charged today. The card would only be charged $99 if you cancel within 48 hours of the party.` 只说一次（`voice.md` 第 8 条）。尾款不从这张卡扣。
- **人数可以改到派对前一天，自由调整**，总价跟人数走，$599 最低消费不变。**说这句就要带上当天规则**（老板 11-02，D-1102-02）：`You can change the headcount freely up to the day before. On the day of the party we can add guests but not take any off, since the food's already prepped.`
- **派对当天只能加人，不能减人**（老板 10-31，D-1031-02：货已经备好了）。客人当天说少人，总价不减，一句话说清，并告诉师傅照原单收：`Sorry, your food is already prepped, so at this point we can only add guests, not remove them. Your total stays at $[1,001].`
- **取消、改期都要提前 48 小时说**（老板 11-07，D-1107-01：「取消要扣，改期不用」「取消和改期都要 48小时」「提前48小时」）：
  - 取消：提前 48 小时以上免费；48 小时内取消扣 $99，从留存卡扣。
  - 改期：不扣钱，但也要提前 48 小时说。48 小时内要改期，先回 `Date changes need at least 48 hours' notice.`
  - 客人坚持，就问原因（老板 11-07：「坚持 你看看原因吧 不可抗力因素可以改」）：`Sorry plans changed. Could I ask what came up?` 不先说有例外。
    - 不可抗力，可以免费改：官方天气预警（见下面「下雨、大风」）、山火或疏散令、地震、场地停电停水或出事没法用、政府命令，还有急病住院、家里有人去世（老板 11-07：「算,急病住院和家人去世都可以改」）。记 `[why]`。
      - 天灾这类回 `I'm sorry, that's out of your control. We'll move it at no charge. What date works for you?`
      - 住院、去世回 `I'm so sorry. Please don't worry about the party. We'll move it at no charge, and we can pick a new date whenever you're ready.`
    - 其他原因（改主意、人没约齐、想换日子）不改。客人还是要取消，就照 48 小时内取消扣 $99，扣之前先告诉老板。
  - 对客：`Moving the date is free with at least 48 hours' notice, and so is cancelling. A cancellation inside 48 hours is $99, charged to the card you saved.` 48 小时内要改期：`Date changes need at least 48 hours' notice.`
  - 天气另算，见下面「下雨、大风」。
- **"押金能退吗"**：没收押金，没有可退的；规则就是上一条。
- **卡在锁日期页被拒**：请他换一张卡；换卡也不行就不锁，不人工建单、不改收 Zelle/Venmo、不口头占位。
- **到场承诺**（客人担心会不会放鸽子时才说）：厨师开席前实名确认；是我们自己的团队，不是平台派单；我们这边出状况，优先给他补档。不说双倍退款（已撤）。

## 吃什么、份量、过敏

- **包含**：每位成人选 2 种蛋白（chicken / steak / shrimp / salmon / tofu）+ 炒饭 + 烤蔬菜 + 姜汁沙拉 + 现场表演；小孩半份。
- **份量**（报份量时必须带 "each guest picks 2"，否则客人以为三样都给）：`Each guest picks 2 - chicken 5 oz, steak 4.5 oz, shrimp 5 jumbo (tail-off), salmon 4 oz.` scallops 4 oz、filet 4.5 oz、lobster 6 oz。
- **牛肉**：标准牛排是 Costco 的 USDA Choice top sirloin，不冷冻、前一天买；问产地答 `Costco's beef in California comes mostly from Harris Ranch in the Central Valley.` 虾是冷冻袋装的（问了照实说）。
- **鸡肉**（老板 11-06，D-1106-01）：鸡胸和鸡腿混着买，看价格和货源。对客不说 chicken breast；客人问是什么鸡肉就答 `Boneless, skinless chicken, breast and thigh.` 鸡腿是不是美国产还没确认，问产地先别说 USA，问老板。
- **同一种选两次**可以（只吃鸡就两份鸡）；只选豆腐的默认双份豆腐。
- **白米饭**：客人要可以带，替代炒饭（老板 10-22）；写进订单备注让师傅知道。
- **12–14 岁**：一般按大人订 `Kids that age usually eat like adults. Our kids' plates have half the protein, so I'd book them as adults.`
- **5–12 岁有的单要问大概几岁**（10-05）：`Quick one on the kids: roughly how old are they? Kids' plates are half portions. That's plenty for little ones, but if any are big eaters I'd count them as adults so nobody leaves hungry.`
- **素/纯素**：豆腐 + 蔬菜，同价。
- **无麸质**（老板 11-02，D-1102-03）：可以。对客只说这句：`Yes. Gluten-free plates are cooked first and seasoned with salt and gluten-free soy sauce.` 问清是谁，写进订单备注让师傅知道。**不主动提酱料**（姜汁酱、yum yum、照烧），客人主动问了才答，问到就如实说：姜汁酱含麸质，无麸质客人的沙拉不放；姜汁酱和 yum yum 不单做无麸质版；照烧不是无麸质，不承诺；春卷和饺子含麸质。师傅的无麸质酱油是大瓶分装，瓶上没标签，客人问就这么说。
- **当天正在进行的派对出了任何问题，desk 不处理，也不回客人**（老板 11-02：「你不要处理，也不要回复，而是总结一下给我，然后给我打电话报警，让我看问题是什么 我再来处理」「只针对当天正在进行的party问题」）：过敏、食材、师傅、上菜快慢、几点到、缺东西都算投诉。只做两件事：① 把客人原话和中文意思总结给老板；② `desk callback <线索> --why "现场：一句话说什么事"` 响老板电话（现场报警 7–24 点都响，电话里说"派对现场有情况，请看 Claude 的消息"）。之后这单所有对客消息等老板原话。派对前、派对后的普通问题照常处理。11-02 Jenna：我叫客人看酱油标签，分装小瓶本来没标签，我又说"当作不是无麸质"，其实无麸质酱油带了，客诉就是这么来的。
- **鸡蛋过敏**：两种自制酱（yum yum、姜汁）都含蛋，不放。
- **坚果/芝麻**：不承诺（饺子含芝麻和小麦）。答法：`Could you tell me the exact allergy? I'll check the labels for that day and tell you honestly whether we can serve them safely.`
- **坚果（老板 10-24 确认）**：我们的用料里**没有任何坚果**——油、yum yum、姜汁酱、饺子、炒饭调料都不含花生和树坚果。客人问坚果可以直接答没有，再加一句过敏的客人师傅先在擦干净的铁板上做：`No peanuts or tree nuts in any of it, including the oil, the sauces, the gyoza and the fried rice. Your chef will also cook their plates first on a clean grill, just to be safe.` 写进订单备注让师傅知道。芝麻照旧：饺子含芝麻，问到照实说；整个场地无过敏原仍不承诺。
- **酱料**（10-11 起都自制）：yum yum = 美乃滋、橙汁、菠萝汁、柠檬汁、糖、蒜粉、红椒粉、黑胡椒；姜汁酱含酱油、蛋、大豆、小麦。师傅把酱直接挤在盘子上，不用备碗（问了才说）。另外带 sriracha 辣酱。没有 Benihana 那种芥末酱（mustard sauce），客人问了照实说没有、提 sriracha（老板 10-21）。客人要蒜香黄油当蘸料：可以把姜汁酱换成蒜香黄油，不加钱，直接答应（老板 10-26；师傅本来就带蒜香黄油，每人 0.5 oz），锁单后订单备注写"蘸酱：蒜香黄油代替姜汁酱"。
- **Kosher**：能做"买 kosher 认证的肉，不加价"。铁板餐具没有拉比监督——客人问到才说。
- **春卷**：炸的、像小号 egg roll、全素，一盘 10 个，**师傅现场做，不是提前炸好带去的**（老板 10-26；客人问 "pre fried?" 答 `They're cooked right there at your party, so they come off the grill hot and crispy.`）。**饺子**是鸡肉馅。
- **自带蛋白**：不行。

## 现场

- **厨师人数**：每位厨师 28 人以内，刚过一点也一位（老板 10-13），客人自己要求加人再问老板。**60 人左右两位师傅 + 一位助手、两台灶就够**，不一定要三台（老板 10-26，Temecula 婚礼场地放不下三台时这么答的）。**短信里写了 "two chefs / each chef / two stations" 就是承诺**，系统会记到派工计划里，没打算派两位就别写复数。
- **到达**：开席前 10–30 分钟（人多早到）；订了桌椅的提前 1 小时摆台。
- **多久**：表演加吃饭约 90 分钟，师傅边做边上（网站城市页同口径），客人之后可以接着聚。**最早开场**：做过中午 12 点的；网站写 10 月到 5 月适合办午饭场。比中午更早的，老板还没定口径。 **最晚开场**（老板 11-09，D-1109-01：「可以没问题 最晚12点 12点以后我们需要和师傅确认一下」）：午夜 12 点前开始都可以，直接答；锁单页的时间下拉只到 8 PM，晚场用 `desk link deposit ... --time 21:30` 发预填时间的链接（带了时间页面就不再问）。12 点以后开始，先问老板、跟师傅确认，不先答应。
- **"当天要准备什么 / 要不要插座"**：这是在担心，答一个轻松具体的场景（09-19），分两条发：`Here's the day: your chef arrives 10-30 min before start, lays a waterproof mat, sets the grill and hooks up the propane. No outlet or power needed.` / `If you booked tables and dishes, we set them and you just host. If you're using your own, please have them set before we arrive.`
- **场地**：只在户外做（patio、deck、balcony、车道、帐篷下），座位可以在室内。用比喻不报尺寸：`A flat spot about the size of a king-size bed, outdoors, with nothing low right over the grill. If you're not sure, you're welcome to send me a photo.` 铺防水防油垫，走前清理。不用插座、不用电，用丙烷。**草地只要平也可以放灶**；客人坐自己的圆桌、不围着灶坐也可以（婚礼这种摆法）——老板 10-26 确认（Temecula 婚礼 60 人发平面图问三台灶放哪）。
- **师傅说不说西语**（老板 11-02）：**我们没有会说西语的师傅**，也没有双语主持。被问才答，直说，不保证，也不说"尽量派说得多的"：`Our chefs speak English, so I can't promise Spanish at the grill. The cooking is easy to follow, and I can send the menu in Spanish so everyone can choose ahead of time.`
- **灯**：我们不带灯，师傅戴头灯；客人那边太暗要自己备串灯。被问才答。
- **下雨、大风**（D-1019-03，老板待最终确认，现在照此答）：下雨在带顶的露台或客人备的 10×10 帐篷下做（我们不带帐篷）；大风或红旗预警不安全时，免费改期或取消，48 小时内也不收 $99（以官方 NWS 预警为准）。
- **最晚几点开场**：不报"最晚"，问他打算几点 `What time do you have in mind? Later starts usually work.` 半夜 12 点以后要先问师傅（这一层不对客说）。
- **接食游戏和小游戏**（老板 10-30，D-1030-11）：**客人不问不提**，Heather 10-11 的投诉就是我们先说了 shrimp toss，到场没有，赔了 $50。问了照实答，扔西葫芦，不扔虾 `Yes, the chef does the catch game with your guests. We toss zucchini, so everyone can play whatever's on the menu.` **提过就要落单**：没锁单记 `[promised] <说了什么>`；锁单后写进订单备注；发备料单时在 note 里再跟师傅强调一次。
- **酒**：`We bring sake for the adults, it's included.` 只在客人问饮料时说（或比价时当差异讲，见 `negotiation.md` §4）；带足 2 加仑，很少有派对喝得完（老板 10-21），不说 unlimited。喷酒枪客人提了可以认，不主动对带小孩的派对提。**公共场合（公共沙滩、公园）不带 sake**（老板 11-12，D-1112-02：「公共场合是不能喝sake的，所以提供不了」）：问到饮料照实说 `Sake isn't allowed on public beaches, so we can't bring it there.`（公园就把 beaches 换成 parks）；不写 alcohol / beer / wine 这类泛称，运营商会拦（SKILL「酒」）。私人沙滩、私人场地照常带。公共场合的单子，订单备注写 `No sake (public beach).`，备货备注写「公共沙滩，不带 sake」，师傅照单不带。
- **沙滩派对**（老板 11-12，D-1112-02）：客人说在沙滩办，先问一句 `Is it a private beach, or a public one?`，答案记进线索备注，锁单后写进订单备注和备货备注。
  - **私人沙滩**、海边房子自己的院子和露台：和平常一样，sake 照带（还是只在问饮料时说）。
  - **公共沙滩**（公园等公共场所同理）：不带 sake，见上一条。公共场所不能做商业经营，这件事老板自己跟师傅交代；desk 对客不提，短信和邮件里不写任何"朋友""不是买的服务""被问到怎么说"之类的话。客人问许可、问被查怎么办、问能不能挂横幅搭棚子 → `desk callback --why "沙滩：…"` 转老板，不答。
  - 场地照「场地」那条：沙滩上也要一块平地放灶。
- **软饮**：$5/位，或客人自备。

## 桌椅、餐具

- **价格**：桌椅 + 黑桌布 $10/人；盘子餐具 $5/人；全套 $15/人。租桌椅换白桌布每张 +$5（一桌一张，4 人一桌）。只要桌布、不租桌椅（客人自己的桌子，适合 6 英尺桌）：一张用一场 $5，白的 $8（老板 11-03）；进订单 `--add-extra white_linen=N`（黑，$5）或 `white_tablecloth=N`（白，$8）。筷子跟餐具包走，要就带、不加钱。餐巾纸也跟餐具包走（老板 11-04「带的」），含在 $5/人里，客人问就说 `Napkins come with the plates and utensils.`；没订餐具的客人只要餐巾纸，先问老板。带租赁的总价用 `desk price --tables N --utensils N`：租赁算在 $599 最低消费之内（10 位大人全套 = $749），不在引擎价上手加。
- **长什么样**：发 `/rentals` 实拍（已订的客人带 `?lead_id=`，在页面上选了直接进订单）。椅子是铝框 + 黑色塑料靠背；桌子是 6 英尺折叠桌；4 人一桌；没有白椅子（户外难保持干净）；白桌布是弹力布贴合桌套、带褶裙，不是塑料。
- **材质**（客人问"塑料还是布""是不是一次性"）：黑白桌布都是布的，用完我们带走；盘子餐具是好一点的硬塑料一次性款（银边白盘、金色刀叉），用完不用洗、不用还。`The tablecloths are fabric, and the plates and utensils are the nicer hard-plastic kind. They're disposable, so there's nothing to wash.`（10-23 按库存——盘具全是消耗品、桌布是周转品——和实拍照片 hard-plastic-plates 写的，等老板确认。）
- **主题盘具**（黑金边、蓝白瓷、红黑）：派对在 7 天以外直接答可以（D-1007-07）；7 天以内先问老板。不对客说"要去网上订"。
- **问桌椅**：照价答（D-1029-02）。桌椅让步只在客人比价或说超预算时考虑，最多周五–日半价、周一–四免费，节假日不给，见 SKILL §5.6；以前答应过的照给。
- **桌椅只随派对租，不单租**；每天同价（周中不免费）。
- **桌椅只有"要"或"不要"，锁单前定好**（老板 11-06 D-1106-03；11-12 D-1112-02 加严）：
  - **为什么**：桌椅现在向第三方租，每场都有额外成本（老板 11-12：「我们需要向第三方服务商租赁桌椅，我们也有额外的成本，所以需要提前确定好到底需不需要桌椅，临时添加可能会提供不了」）。对客不说是租的，只说每场提前给他留好。
  - **锁单前问清**要不要、要几位，写进订单，师傅照单带：`Could you let me know if you'd like our tables and chairs, and for how many? We reserve them for each party ahead of time, so we can't always add them at the last minute.`
  - **不答应**"先带着备用、现场看够不够、用多少收多少"，也不让客人到现场再决定（老板 11-12：「也不能先带过去，看看要不要用」）。起因：Esme 11/6 约定"先用你们的、不够再用我们的、备到 16 人"，现场师傅没带，一半客人没桌子，老板给了 $100 off。
  - **拿不准几位**：请他按最可能的最多人数订。不再说"桌数到前一天都能改"（那是 11-12 以前的话术）。
  - **锁单以后才加**（短信说的、派对页勾的、自助改单进来的）：先问老板能不能租到，老板说行再改订单、再回客人；不先答应，也不写"加好了"。离派对越近越可能租不到。
  - **要减或不要了**：退不退、退多少，先问老板。
- **只要椅子 / 只要桌子**（椅子老板 11-01 定，桌子 11-06 定）：客人自己有桌子桌布的，椅子 $5 一把；自己有椅子的，6 英尺桌 $10 一张，不带桌布（要布另算，黑 $5、白 $8）。也只随派对租，同样锁单前定好（D-1112-02）。`Yes, we can do chairs only at $5 each, so $130 for 26.` 进订单按件记：`--add-extra folding_chairs=26`，桌子 `folding_tables=N`。不要再用 `tables_chairs` 加 `chairs_only` 让价去凑，那样备料单会按套餐配出桌子和桌布：Lawrence 11/7 的单就成了 7 桌 7 布 28 椅（D-1106-03）。

## 档期、范围

- **"X 号有空吗"**：一律按开着回 `open on our end`，直接接，不问老板（D-1009-01）；临时单照样要时间、地址、菜单。
- **"你们去 X 吗"**：南加州单程 2.5 小时内都去；报路费前先 `desk travel`。**驾车超过 150 英里的**（Lompoc 这种）也去，但路费之外加 call out fee，每位师傅 $50，这笔全给师傅（老板 10-30，D-1030-02），报价时就算进总价并说清楚：`Lompoc is over 150 miles from us, so on top of travel there's a $50 call-out fee for your chef.` 引擎和锁单链接还不会自动加：链接用 `--est` 写含这笔的总价，锁单后 `order set --travel-fee <路费+50×师傅数>` 并进路费。
- **点名要 Bling**：那天 Bling 已有安排，派另一位招牌师傅（D-1013-02）。点名别的师傅照常查档期。
- **只要邮件联系、别打电话**：照办，备注写 email only。
