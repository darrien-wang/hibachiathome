# 工具：desk 命令、接口、订单、Facebook

**一律先用 `desk`**（`scripts/desk/desk.py`，在营销仓库或它的 worktree 里跑）。它只调接口、不含规则；Cloudflare UA、Windows 编码、非 ASCII 正文、409 刹车都处理好了。**处理线索时不写临时 curl/urllib 脚本**，缺什么子命令就加进 desk。密钥只从 `.env.local` 读，不打印到对话里。

---

## desk 常用命令

```bash
python scripts/desk/desk.py next                         # 收件箱：每个待办一张完整卡（线索 + 标签 + 报价 + 全对话 + 刹车预演）
python scripts/desk/desk.py card   <手机|leadId>          # 单条卡
python scripts/desk/desk.py thread <手机|leadId>          # 只看对话（Twilio 为准，旧→新，tapback 已标）；最后一行是回复要带的 --seen
python scripts/desk/desk.py search <姓名|手机|邮箱|单号>
python scripts/desk/desk.py price  --adults 24 --kids 0 --date 2026-11-07 --zip 92780 [--tables 18 --utensils 18]   # 引擎价，禁止手算
python scripts/desk/desk.py travel "<地址或 zip>"         # 里程和路费
python scripts/desk/desk.py send   <手机> --lead <id> --body-file draft.txt --seen <时间> [--force]   # 发短信；会清掉挂起，先发后挂
python scripts/desk/desk.py send   <手机> --lead <id> --body "..." --media photo.jpg --seen <时间>     # 发图（只用于回复）
python scripts/desk/desk.py email  <to> --lead <id> --subject "..." --body-file e.txt [--cc x] [--attach W-9.pdf]
python scripts/desk/desk.py note   <leadId> "[SOP:f_one] ..."     # 备注标签见 SKILL §3 ⑥
python scripts/desk/desk.py hold   <leadId> <天数>                 # 等客户回；0 撤销
python scripts/desk/desk.py status <leadId> won|lost|disqualified|qualified|new
python scripts/desk/desk.py ack    <leadId> [--clear]              # 「不用回」：tapback、过时的客气话
python scripts/desk/desk.py fields <leadId> full_name="Ana" guest_count=15 city_or_zip="Granada Hills"
python scripts/desk/desk.py heard  <leadId> "客人原话" [--as friend]   # 来源（D-1010-02）
python scripts/desk/desk.py callback <leadId> --why "原话"           # 给老板 App 响铃回电
python scripts/desk/desk.py calls  <手机|leadId>                     # 来电录音列表
python scripts/desk/desk.py transcribe <手机|leadId> --last 2 [--note]   # 本机转录电话
python scripts/desk/desk.py chef-rule <leadId> --kids all --note "..."   # 发票人头和师傅工钱人头不同时
python scripts/desk/desk.py scan [--bucket D] [--no-write]          # 全池分桶（lead-scan skill）
python scripts/desk/desk.py report day|week [--date 2026-10-17]      # 日报/周报的数
```

**`send --seen`（10-26 起）**：写你读到的客人最后一条的时间，就是 `desk card` / `desk thread` 在对话下面打的那行 `回复带 --seen 2026-10-24T18:54:18-07:00` 里的值（也认 `18:54`、`10-24 18:54`，太平洋时间）。发之前 desk 自己再读一遍 Twilio 对话，客人在那条之后又发了（没带 `--seen` 时：90 秒内刚到的），就**不发**：打出那几条和新的 `--seen`，exit 2。读完，稿子还接得上就带新的 `--seen` 发，接不上就改了再发。
- `--force` 只放行服务器刹车，**不跳过这一道**；要发就得带 `--seen`。
- `HH:MM` 认那一分钟客人的第一条，同一分钟后面那条算没读；那条是 90 秒内刚到的，`HH:MM` 不算数（分不清你读过还是只看了表），要写到秒。`--seen` 对不上客人任何一条短信也不发。
- 只算客人发来的：我们自己发的（别的会话、App、机器）不算；员工号码（师傅、后勤、老板）不查。
- 读和发分两次跑，不串在同一条命令里：串着跑，等于没读。

**锁单链接**（全部先签规则再缩短）
```bash
python scripts/desk/desk.py link deposit --lead <id> --adults 18 --kids 0 --city Tustin --zip 92780 --date 2026-11-07 [--time 19:00] --email <e>
python scripts/desk/desk.py link deposit ... --rate tables_chairs=5        # 周六桌椅半价（D-1017-01）
python scripts/desk/desk.py link deposit ... --free tables_chairs          # 免费桌椅
python scripts/desk/desk.py link deposit ... --flat-off 60 --deal-note "why"
python scripts/desk/desk.py link deposit ... --waive-travel --deal-note "why"   # 路费老板请：单上路费 $0，里程照记（师傅照拿）
python scripts/desk/desk.py link planner --email <e> --phone <p> [--booked] --lead <id>
python scripts/desk/desk.py link short  <长链> --lead <id>
```
`--est` 只收整数。让步不要冻成总价（`agreed-total` 已停用），一律签规则（`custom-deal`），人数变了会自动重算。送前菜不要签进 `freeExtraIds`（会把那一类全退），锁单后在订单里加 `--free-item`。周中每人特价要加回 $5 再签（发票从 $59.90 往下让）。

锁单那一刻网站自己算路费（2026-10-21 起）：按客人填的地址、和报价同一套量法（前 50 英里免费，之后 $1/英里），地址补成「街道, 城市, CA 邮编」；量不出来就用客人收到的报价里的路费。"Deposit Paid" 邮件里有一行 `Travel:` 写明怎么来的；标题带 `⚠ Travel unknown` 才需要手补 `order set --travel-miles`。电话里答应免路费的，发链接时加 `--waive-travel`（已锁的单用 `order set --travel-fee 0`）。

**订单**
```bash
python scripts/desk/desk.py order find <姓名|手机|单号>
python scripts/desk/desk.py order show <单号> [--json]         # 菜单、加购、NOTES（客人看得到）、内部备注、派工、⚠ 缺项、总价
python scripts/desk/desk.py order set  <单号> --reconcile             # 原样存一次，发票引擎按规则补上该有的（20+ 前菜、人数折扣…）
python scripts/desk/desk.py order set  <单号> --date 2026-11-03 --time 18:00 --address "10756 McLennan Ave, Granada Hills, CA 91344" --dry
python scripts/desk/desk.py order set  <单号> --travel-miles 69 --travel-fee 19
python scripts/desk/desk.py order set  <单号> --proteins steak=15 chicken=15          # 只给了总数（快速模式）；只管菜，不改人数
python scripts/desk/desk.py order set  <单号> --headcount 11/1[/1] --dry             # 没有逐人名单的单改人数：大人/5–12 岁小孩[/3–4 岁免费]（快速模式、还没菜单的新单）
python scripts/desk/desk.py order set  <单号> --retier --dry                         # 人数折扣那行按现在的人数重排（自查报 party size 不对时用）
python scripts/desk/desk.py order set  <单号> --guests-file rows.json [--replace-guests]   # 逐人名单 [{name, child?, little?, proteins:[...], allergy?, note?}]，每人 ≥2 种（little 的 3–4 岁可以不写）
python scripts/desk/desk.py order set  <单号> --add-extra tables_chairs=27 | edamame=1 | side_shrimp=15   # 买的加购 / 桌椅按人头 / 整桌蛋白份
python scripts/desk/desk.py order set  <单号> --free-item edamame=2                    # 送的前菜
python scripts/desk/desk.py order set  <单号> --free-appetizer spring_rolls --dry      # 客人挑的免费前菜（押金页默认 gyoza）
python scripts/desk/desk.py order set  <单号> --deal-rate tables_chairs=5 | --deal-free tables_chairs
python scripts/desk/desk.py order set  <单号> --promo official_weekday=185 --remove-promo X --add-promo appreciation_veteran=50 --promo-label "..."
python scripts/desk/desk.py order set  <单号> --chefs 2 --grills 2 --stations "..."   # 派工计划（老板定的）
python scripts/desk/desk.py order hold <单号> --why "寿星出城，另挑日期"      # 日期待定：派对还在、日期拿掉（日历「日期待定」栏）；客人改期就用它
python scripts/desk/desk.py order redate <单号> --date 2026-11-14 [--time 18:00]   # 待定的单定了新日期
python scripts/desk/desk.py order preview <单号>
python scripts/desk/desk.py order remind <单号> --dry              # 前一天提醒，先 --dry；有 !! 缺项不发，核过才 --force
python scripts/desk/desk.py order send <单号>                      # 发票：邮件 PDF + 短信请回 confirm（先自查、老板看过）
python scripts/desk/desk.py order email <单号> [--notes-reviewed]
```
- 改之前先 `--dry` 看 TOTAL；每次 `order set` 会自己拿 TOTAL 和 `desk price`（同样的大人/小孩/日期/桌椅餐具，加上订单自己的加购、优惠和路费）对一遍：对上打 `✓ total check`，差 $1 以上打一大段 `!!! TOTAL CHECK FAILED`，并写出可能的改法（`--retier`、`--promo official_weekday=…`）。存的时候订单在你读之后被改过会 409 `STALE`，什么都没存，重看再改。
- 人数一变（`--headcount` / `--guests-file` / `--add-adult` / `--add-child` / `--remove-guest`），`official_party*` 那行自动按掏钱人头换档（大人 1、5–12 岁 0.5、往下取整，档位读 `config/pricing-rules.ts`）；61+ 不动（人工报价），订单上有 appreciation 顶替人数折扣的不加回，其他优惠一行不动。周中特价那行存的时候由发票引擎按新人数重算（每加一个大人 $5、小孩 $2.45，手改过的多送几盘照留）；同一条命令里 `--promo` 手改的照你的。
- 存完多出 `+ 引擎按规则：…`（10-24 起，D-1017-02）：该给客人的由发票引擎每次保存时补上——人数折扣、周中特价、20 人以上 / 全套桌椅餐具送的前菜（连托盘，师傅单上才有）、特价规则那几行。手加的行（`--free-item` 送的盘、appreciation、custom）不动；按报价锁定的价格（as quoted / agreed total）不往上加，只在缺项里提醒。引擎补完会重印 TOTAL 和 total check。
- `⚠ 缺项`（`order show` 末尾、`order set` 存完）是发票系统的订单检查。`!!` 拦备料单（发票工具 Send to Chef 弹清单，可 Send anyway）和 `order remind`（`--force` 才发）：该有的优惠/前菜没上、送的盘或特价送的东西订单上没有（师傅不会带）、人头优惠还按旧人数算、一周内路费没算、三天内菜单不全、派对页人数和发票对不上（三天内）。`!` 只提醒、不拦。
- 几样加购可以写在同一个 `--add-extra` 后面（`--add-extra tables_chairs=10 utensils=10`），也可以分开写几遍；10-21 之前分开写只留最后一个（Yunnie 差点只加上餐具），已改成会累加。改完照样看 `--dry` 的 TOTAL。
- 客人回短信挑免费前菜：`--free-appetizer edamame`（gyoza / edamame / spring_rolls）。托盘和优惠行（周中特价 / 20 人以上 / 全套那条，连同同一种的 `--free-item`）一起换；edamame 一盘便宜 $5，差价记在优惠行上，总价不变，引擎换前换后各算一次，总价动了就不存。同一种托盘不止一盘时按优惠行金额认送了几盘，认不出来会让你先 `--promo` 重设金额。
- 3–4 岁免费小孩：名单里写 `{"name": "Mia", "little": true}`（自动算小孩行，可以不写蛋白），desk 按名单里 little 行的个数自动加 / 改 / 删 `Little kids (3-4) @ $0 ×N`（under5_auto）那行；`--remove-guest` 拿掉一个 little 行，那行跟着减一。没有逐人名单（快速模式、还没菜单的新单）用 `--headcount` 的第三个数：`--headcount 11/1/1` = 11 大人 + 1 个 5–12 岁 + 1 个 3–4 岁，那行自动设成 ×1（`11/1/0` 拿掉；只写 `11/1` 那行不动）。只改 3–4 岁人数也这样写，大人小孩照填。不再手打 `--add-promo under5_auto=…`（× 经过命令行会乱码）。少了这行每人多收 $29.90，total check 会报；3–4 岁不算进人数折扣。
- 名单只在派对页（`lp_` 计划）、订单 0 行时，师傅备料单是空的：派对前用 `--guests-file` 灌进订单（10-21 Stephanie 那单）。
- 存完多出 `WARN  Planner has …, the invoice counts …. Kept …: <名字>`（10-24 起）：客人派对页上有人填过名字或点过菜，这张发票的人数没算他们；存的时候留下了，没删（只删空位）。人真来就补进发票（比如 5 岁以下的照上面加 `under5_auto` 那行），不来就请客人在派对页删掉。
- 订单 NOTES 会原样印在客人发票上：过程记录写 `orders.internal_notes`，不写 NOTES。

**电话预定的手工建单**（客人电话里定了、不留卡）：往发票系统 `https://invoice.realhibachi.com/api/integrations/v1/events` 投一个签名的 `order.deposit_paid`（HMAC-SHA256，`X-Partner-Id: official_website`，payment `card_on_file` $0）。建完要补四样：`deposit_status → paid_verified`、`source_metadata.lead_id`、`desk order set --date --time`（时区）、`--travel-miles`；人数变了用 `--headcount`（人数折扣自动换档，看 `--dry` 的 total check）。先例 RH-20261020-4480。

---

## 原始接口（desk 就是调这些；只在 desk 没包的时候用）

```bash
KEY=$(grep '^ADMIN_DASH_KEY=' .env.local | cut -d= -f2-)
curl -s -H "x-admin-key: $KEY" "https://www.realhibachi.com/api/admin/leads?detail=<leadId>"          # 线索 + 时间线
curl -s -H "x-admin-key: $KEY" "https://www.realhibachi.com/api/admin/sms-thread?leadId=<id>&phone=%2B1..."   # 对话（Twilio 实时）
curl -s -X POST -H "x-admin-key: $KEY" -H "Content-Type: application/json" -d '{"phone":"+1...","body":"...","leadId":"<id>"}' https://www.realhibachi.com/api/admin/sms-thread   # 发短信（进时间线）
curl -s -X POST ... -d '{"leadId":"<id>","to":"<email>","subject":"...","text":"..."}' https://www.realhibachi.com/api/admin/send-followup   # 发邮件
curl -s -X POST ... -d '{"leadId":"<id>","flatOff":60,"note":"..."}' https://www.realhibachi.com/api/admin/custom-deal   # 签让步规则
curl -s -X POST ... -d '{"url":"<长链>","leadId":"<id>"}' https://www.realhibachi.com/api/admin/short-link              # 短链（30 天）
curl -s -X POST ... -d '{"email":"...","phone":"...","booked":true}' https://www.realhibachi.com/api/admin/planner-link   # 派对页
```
- 直接调 Twilio 只用于**读**状态：`delivered` ✅；30003 手机收不到、30006 座机 → 系统自动标打不通、改邮件；30005 老问题；21703/21704/30024 是配置问题，停发报老板。
- 线索巡检（自动首响、提醒、派对前确认）由 Supabase pg_cron 每 10 分钟调 `lead-watch?consumer=cron`，机器只在 07:00–23:59 PT 发；`?dry=1` 只看不发。设置页「线索巡检」可调宽限期和开关。

---

## Facebook / Instagram（10-21 起）

- **入口**：Claude 应用内置浏览器已登录 Facebook。Business Suite 收件箱 `https://business.facebook.com/latest/inbox/all?asset_id=1278206205381427`；评论在「Facebook comments」页签，广告帖评论默认折叠，排序切到 **All comments** 再往下滚。广告帖用 facebook.com 链接打不开，只能在 Business Suite 看。
- **规矩**：公开回复、隐藏、私信每次先给老板稿子，回"发"再做；只隐藏不删除；私信里拿手机号。同行（Linh Ho Young 引流 Yaki24）捣乱：隐藏，不在评论区争。
- **主页设置**（服务区域、屏蔽词、通知、Messenger 自动回复）会被自动审批拦，交给老板点。
- **上传图片和视频**：内置浏览器传不了本地文件；老板同意后用 Claude in Chrome：用 `find` 找 `type=file` 的元素再 `file_upload`，**不要点** "Photo/video"、"Add cover photo" 本身（会弹原生文件框）。发帖会弹两个推荐：加 Call Now 按钮 → Not now；Hosting an event → Publish Original Post。做完关掉自己开的标签；主页身份留着就行，不用切回个人身份（老板 10-21）。
- **Instagram**：@realhibachi 10-21 已连到新主页（Switch Page）。Business Suite 发帖 "Post to" 默认 FB 和 IG 都勾，只发一边就取消另一个。IG 私信进 Business Suite 收件箱靠 IG App 里"允许访问消息"（已开）；收件箱 Instagram 页签显示 Disconnected 时私信进不来。网页版 IG 不能归档帖子（只能删，我们不删）。细节见记忆 realhibachi-facebook-page-moderation。
- **视频素材**：`D:\desktop\RealHibachi\video-pipeline`（`build_creatives.py` 的 PLANS，字幕不写 "setup & cleanup included"、"we bring everything"）。
