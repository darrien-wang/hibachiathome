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

- **送的前菜**：一份三选一（gyoza / edamame / spring rolls），一盘全桌分，按每 10 位付费客人一盘；对客说 `a free appetizer of your choice (gyoza, edamame or spring rolls)`，不说 platter、不说值多少钱。20 人以上这份**不设截止日**（D-1021-01）。和周中那份不叠，都只算一份。订了全套桌椅 + 餐具也送一份（D-1007-06），不当卖点，客人订全套或犹豫时才说。
- **节假日按周末价**：Labor Day、感恩节那周、12/20–1/3、Memorial Day、7/3–7/5（`WEEKDAY_SPECIAL_BLACKOUTS`）。
- **最低消费 $599**：折后不低于 $599。付最低消费的小派对按 10 人的量做（`you're paying the 10-guest minimum, so I'll cook for 10`）；超过 10 人按人头加钱。
- **人数折扣**（自动，任何一天）：付费人头（成人 1、5–12 岁 0.5）10–14 −$30 · 15–24 −$60 · 25–30 −$90 · 31–40 −$120 · 41–50 −$150 · 51–60 −$180 · 61+ 定制（`negotiation.md`）。
- **路费**：从基地（91744）驾车，前 50 英里免费，之后 $1/英里；`desk travel "<地址>"` 为准。报价后客人换了城市，路费按新地址收（D-1013-02）。报价按城市算、锁单地址更远（比如说的是 Palm Springs，实际在 Indio），也按实际收（老板 10-22，D-1022-01），改订单后马上一句话告诉客人新总价：`One quick note on travel: your address in Indio is a bit past Palm Springs, so travel comes to $62.80 instead of $43 - your total is $961.20.`
- **加菜**：第 3 种蛋白 +$10（整桌加一份用 `side_<蛋白>`）；升级 ribeye +$5（隐藏项，派对页不显示，客人问"能不能更好的牛肉"才说）、filet +$8、scallops +$6、lobster tail +$12，升级按份收、大人小孩同价；Prime ribeye +$12（锁单后手加）；gyoza $15、spring rolls $15、edamame $10；noodles $5；炒饭加料（虾/鸡）$10、加蛋 $1；软饮 $5/位（Premium $12）；炒饭蔬菜加量免费（提前说）。
- **致敬 Appreciation $50**：当期职业（老兵 10/16–11/30；医护 12/1–1/15；消防/急救 1/16–2/28），$599 以上、一单一次、只按职业。默认只和周中价叠、不和人数折扣叠（老板叠过两单属个案，以后要叠先问）。
- **回头客**（老板 10-29 定，D-1029-01）：客人自己提"上次订过"→ **一律减 $50**（隐形福利，不主动说），可以和人数折扣一起用；只用在标准价（周一–四特价不叠）；不能把总价压到 $599 以下（$599 那档的小单不减）；回头客、派对客人名片、致敬计划这三个 $50 一单只给一个。签进链接：`desk link deposit ... --flat-off 50 --deal-note "Returning customer - $50 off"`。原来的"每 10 人 $60"是 08-31 还没有自动人数折扣时定的，叠在一起太多（Ashley 12/5 周六 20 位叠到人均 $50.9，老板：「周六的均价应该在 55 左右」）。$50 是客人压价时的底线，不是送福利的目标。

**常用价（无路费、无加购）**：

| 成人 / 5–12 | 周五–日 | 周一–四 |
|---|---|---|
| ≤10 / 0 | $599 | $599 |
| 12 / 0 | $688.80 | $628.80 |
| 15 / 0 | $838.50 | $763.50 |
| 18 / 0 | $1,018.20 | $928.20 |
| 20 / 0 | $1,138.00 | $1,038.00 |
| 25 / 0 | $1,407.50 | $1,282.50 |
| 30 / 0 | $1,707.00 | $1,557.00 |

## 税、付款、小费（D-1006-05、D-1006-07、D-1013-04）

- **标价 = 现金价，含税**。定下来之前一个字不提税和付款方式，只报标价。
- **算总账时**（发票、派对前提醒）才列两张账，数字全由系统出：现金给师傅 = 标价；刷卡 = 标价 + 派对地址实际销售税 + Stripe 3%（借记卡不加）+ 可选 20% 小费。固定问一句 `Would you like to add the 20% gratuity for your chef to the card, or tip them in person on the day?`
- **Zelle/Venmo**：客人不问不提。问了才说可以直接给师傅本人，金额 = 现金价 × 1.04（`desk price`、订单弹窗有这个数）。公司的 Zelle/Venmo 账号**永不对客**。
- **PayPal 也收**（老板 10-24）：和 Venmo/Zelle 一样直接给师傅本人，现金价 × 1.04。客人问到"现金价包不包括 PayPal/Venmo"这类问题时，把不付现金的价差一次说清：`Here's how it comes out. Cash is $X, PayPal, Venmo or Zelle to your chef is $Y, and card is $Z, since that one includes sales tax and card processing.`（三个数都从 `desk order show` 那行抄。）
- **公司客户**（要 W-9、公司付款）：标价 + 派对地址销售税；刷卡再加 3%。支票、ACH 收不收没定，问老板。W-9 和保险证明在 `D:\desktop\RealHibachi\company-docs`，客人要了才发。
- **小费**：不含；20–25% 惯例，100% 给厨师。不淡化，问了就直说 `Not included - 20-25% is customary, and 100% of it goes to the chefs.`
- **口径是 optional，展示里不说 optional**（老板 10-23，D-1023-01）：发票、派对前提醒、邮件、主动开口都不写这个词（发票小费栏 10-23 已删 "Optional —"，只留它是给什么的）。客人直接问"是不是必须给"才答 `It's optional - 20-25% is customary, and 100% of it goes to your chef.`
- **"是不是全包"**：`$X covers the food, the chef and the show, and that's the cash price with sales tax included. Gratuity isn't included - 20-25% is customary, and all of it goes to the chefs.` 客人提刷卡才补一句刷卡另加税和手续费，菜单定了给逐行明细。
- 不说 "no tax / tax-free"，不报 ×1.10 的整数。

## 锁日期、改人数、取消

- **锁日期 = 留一张卡，当天 $0**（D-1006-04）；尾款派对当天付。61+ 也一样留卡，不收押金。
- **人数可以改到派对前一天**，总价跟人数走，$599 最低消费不变。
- **取消/改期**：提前 48 小时以上免费，48 小时内 $99（从留存卡扣）。
- **"押金能退吗"**：没收押金，没有可退的；规则就是上一条。
- **卡在锁日期页被拒**：请他换一张卡；换卡也不行就不锁，不人工建单、不改收 Zelle/Venmo、不口头占位。
- **到场承诺**（客人担心会不会放鸽子时才说）：厨师开席前实名确认；是我们自己的团队，不是平台派单；我们这边出状况，优先给他补档。不说双倍退款（已撤）。

## 吃什么、份量、过敏

- **包含**：每位成人选 2 种蛋白（chicken / steak / shrimp / salmon / tofu）+ 炒饭 + 烤蔬菜 + 姜汁沙拉 + 现场表演；小孩半份。
- **份量**（报份量时必须带 "each guest picks 2"，否则客人以为三样都给）：`Each guest picks 2 - chicken 5 oz, steak 4.5 oz, shrimp 5 jumbo (tail-off), salmon 4 oz.` scallops 4 oz、filet 4.5 oz、lobster 6 oz。
- **牛肉**：标准牛排是 Costco 的 USDA Choice top sirloin，不冷冻、前一天买；问产地答 `Costco's beef in California comes mostly from Harris Ranch in the Central Valley.` 虾是冷冻袋装的（问了照实说）。
- **同一种选两次**可以（只吃鸡就两份鸡）；只选豆腐的默认双份豆腐。
- **白米饭**：客人要可以带，替代炒饭（老板 10-22）；写进订单备注让师傅知道。
- **12–14 岁**：一般按大人订 `Kids that age usually eat like adults. Our kids' plates have half the protein, so I'd book them as adults.`
- **5–12 岁有的单要问大概几岁**（10-05）：`Quick one on the kids: roughly how old are they? Kids' plates are half portions. That's plenty for little ones, but if any are big eaters I'd count them as adults so nobody leaves hungry.`
- **素/纯素**：豆腐 + 蔬菜，同价。
- **无麸质**：可以。**师傅带无麸质酱油和照烧**，单独台面先做；姜汁酱含酱油，无麸质客人的沙拉不放；春卷做不了无麸质。写进订单备注让师傅知道。
- **鸡蛋过敏**：两种自制酱（yum yum、姜汁）都含蛋，不放。
- **坚果/芝麻**：不承诺（饺子含芝麻和小麦）。答法：`Tell me the exact allergy and I'll check the labels for that day and tell you honestly whether we can serve them safely.`
- **坚果（老板 10-24 确认）**：我们的用料里**没有任何坚果**——油、yum yum、姜汁酱、饺子、炒饭调料都不含花生和树坚果。客人问坚果可以直接答没有，再加一句过敏的客人师傅先在擦干净的铁板上做：`No peanuts or tree nuts in any of it, including the oil, the sauces, the gyoza and the fried rice. Your chef will also cook their plates first on a clean grill, just to be safe.` 写进订单备注让师傅知道。芝麻照旧：饺子含芝麻，问到照实说；整个场地无过敏原仍不承诺。
- **酱料**（10-11 起都自制）：yum yum = 美乃滋、橙汁、菠萝汁、柠檬汁、糖、蒜粉、红椒粉、黑胡椒；姜汁酱含酱油、蛋、大豆、小麦。师傅把酱直接挤在盘子上，不用备碗（问了才说）。另外带 sriracha 辣酱。没有 Benihana 那种芥末酱（mustard sauce），客人问了照实说没有、提 sriracha（老板 10-21）。客人要蒜香黄油当蘸料：可以把姜汁酱换成蒜香黄油，不加钱，直接答应（老板 10-26；师傅本来就带蒜香黄油，每人 0.5 oz），锁单后订单备注写"蘸酱：蒜香黄油代替姜汁酱"。
- **Kosher**：能做"买 kosher 认证的肉，不加价"。铁板餐具没有拉比监督——客人问到才说。
- **春卷**：炸的、像小号 egg roll、全素，一盘 10 个，**师傅现场做，不是提前炸好带去的**（老板 10-26；客人问 "pre fried?" 答 `They're cooked right there at your party, so they come off the grill hot and crispy.`）。**饺子**是鸡肉馅。
- **自带蛋白**：不行。

## 现场

- **厨师人数**：每位厨师 28 人以内，刚过一点也一位（老板 10-13），客人自己要求加人再问老板。**60 人左右两位师傅 + 一位助手、两台灶就够**，不一定要三台（老板 10-26，Temecula 婚礼场地放不下三台时这么答的）。**短信里写了 "two chefs / each chef / two stations" 就是承诺**，系统会记到派工计划里，没打算派两位就别写复数。
- **到达**：开席前 10–30 分钟（人多早到）；订了桌椅的提前 1 小时摆台。
- **多久**：表演加吃饭约 90 分钟，师傅边做边上（网站城市页同口径），客人之后可以接着聚。**最早开场**：做过中午 12 点的；网站写 10 月到 5 月适合办午饭场。比中午更早的，老板还没定口径。
- **"当天要准备什么 / 要不要插座"**：这是在担心，答一个轻松具体的场景（09-19），分两条发：`Here's the day: your chef arrives 10-30 min before start, lays a waterproof mat, sets the grill and hooks up the propane. No outlet or power needed.` / `If you booked tables and dishes, we set them and you just host. If you're using your own, have them set before we arrive.`
- **场地**：只在户外做（patio、deck、balcony、车道、帐篷下），座位可以在室内。用比喻不报尺寸：`A flat spot about the size of a king-size bed, outdoors, with nothing low right over the grill. Send me a photo if you're not sure.` 铺防水防油垫，走前清理。不用插座、不用电，用丙烷。**草地只要平也可以放灶**；客人坐自己的圆桌、不围着灶坐也可以（婚礼这种摆法）——老板 10-26 确认（Temecula 婚礼 60 人发平面图问三台灶放哪）。
- **灯**：我们不带灯，师傅戴头灯；客人那边太暗要自己备串灯。被问才答。
- **下雨、大风**（D-1019-03，老板待最终确认，现在照此答）：下雨在带顶的露台或客人备的 10×10 帐篷下做（我们不带帐篷）；大风或红旗预警不安全时，免费改期或取消，48 小时内也不收 $99（以官方 NWS 预警为准）。
- **最晚几点开场**：不报"最晚"，问他打算几点 `What time do you have in mind? Later starts usually work.` 半夜 12 点以后要先问师傅（这一层不对客说）。
- **接食游戏**：扔西葫芦，不扔虾 `Yes, the chef does the catch game with your guests. We toss zucchini, so everyone can play whatever's on the menu.`
- **酒**：`We bring sake for the adults, it's included.` 只在客人问饮料时说（或比价时当差异讲，见 `negotiation.md` §4）；带足 2 加仑，很少有派对喝得完（老板 10-21），不说 unlimited。喷酒枪客人提了可以认，不主动对带小孩的派对提。
- **软饮**：$5/位，或客人自备。

## 桌椅、餐具

- **价格**：桌椅 + 黑桌布 $10/人；盘子餐具 $5/人；全套 $15/人。白桌布每张 +$5（一桌一张，4 人一桌）；只要桌布 $5 一张（适合 6 英尺桌）。筷子跟餐具包走，要就带、不加钱。带租赁的总价用 `desk price --tables N --utensils N`：租赁算在 $599 最低消费和人数折扣之前（10 位大人全套 = $719，不是 $749，D-1009-04），不在引擎价上手加。
- **长什么样**：发 `/rentals` 实拍（已订的客人带 `?lead_id=`，在页面上选了直接进订单）。椅子是铝框 + 黑色塑料靠背；桌子是 6 英尺折叠桌；4 人一桌；没有白椅子（户外难保持干净）；白桌布是弹力布贴合桌套、带褶裙，不是塑料。
- **材质**（客人问"塑料还是布""是不是一次性"）：黑白桌布都是布的，用完我们带走；盘子餐具是好一点的硬塑料一次性款（银边白盘、金色刀叉），用完不用洗、不用还。`The tablecloths are fabric, and the plates and utensils are the nicer hard-plastic kind. They're disposable, so there's nothing to wash.`（10-23 按库存——盘具全是消耗品、桌布是周转品——和实拍照片 hard-plastic-plates 写的，等老板确认。）
- **主题盘具**（黑金边、蓝白瓷、红黑）：派对在 7 天以外直接答可以（D-1007-07）；7 天以内先问老板。不对客说"要去网上订"。
- **订前问桌椅**：这是那一次让步，见 SKILL §5.6。锁单后才问的照常收费。
- **桌椅只随派对租，不单租**；每天同价（周中不免费）。

## 档期、范围

- **"X 号有空吗"**：一律按开着回 `open on our end`，直接接，不问老板（D-1009-01）；临时单照样要时间、地址、菜单。
- **"你们去 X 吗"**：南加州单程 2.5 小时内都去；报路费前先 `desk travel`。
- **点名要 Bling**：那天 Bling 已有安排，派另一位招牌师傅（D-1013-02）。点名别的师傅照常查档期。
- **只要邮件联系、别打电话**：照办，备注写 email only。
