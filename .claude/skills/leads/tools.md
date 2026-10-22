# 工具：desk 命令、接口、订单、Facebook

**一律先用 `desk`**（`scripts/desk/desk.py`，在营销仓库或它的 worktree 里跑）。它只调接口、不含规则；Cloudflare UA、Windows 编码、非 ASCII 正文、409 刹车都处理好了。**处理线索时不写临时 curl/urllib 脚本**，缺什么子命令就加进 desk。密钥只从 `.env.local` 读，不打印到对话里。

---

## desk 常用命令

```bash
python scripts/desk/desk.py next                         # 收件箱：每个待办一张完整卡（线索 + 标签 + 报价 + 全对话 + 刹车预演）
python scripts/desk/desk.py card   <手机|leadId>          # 单条卡
python scripts/desk/desk.py thread <手机|leadId>          # 只看对话（Twilio 为准，旧→新，tapback 已标）
python scripts/desk/desk.py search <姓名|手机|邮箱|单号>
python scripts/desk/desk.py price  --adults 24 --kids 0 --date 2026-11-07 --zip 92780 [--tables 18 --utensils 18]   # 引擎价，禁止手算
python scripts/desk/desk.py travel "<地址或 zip>"         # 里程和路费
python scripts/desk/desk.py send   <手机> --lead <id> --body-file draft.txt [--force]   # 发短信；会清掉挂起，先发后挂
python scripts/desk/desk.py send   <手机> --lead <id> --body "..." --media photo.jpg     # 发图（只用于回复）
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

**锁单链接**（全部先签规则再缩短）
```bash
python scripts/desk/desk.py link deposit --lead <id> --adults 18 --kids 0 --city Tustin --zip 92780 --date 2026-11-07 [--time 19:00] --email <e>
python scripts/desk/desk.py link deposit ... --rate tables_chairs=5        # 周六桌椅半价（D-1017-01）
python scripts/desk/desk.py link deposit ... --free tables_chairs          # 免费桌椅
python scripts/desk/desk.py link deposit ... --flat-off 60 --deal-note "why"
python scripts/desk/desk.py link planner --email <e> --phone <p> [--booked] --lead <id>
python scripts/desk/desk.py link short  <长链> --lead <id>
```
`--est` 只收整数。让步不要冻成总价（`agreed-total` 已停用），一律签规则（`custom-deal`），人数变了会自动重算。送前菜不要签进 `freeExtraIds`（会把那一类全退），锁单后在订单里加 `--free-item`。周中每人特价要加回 $5 再签（发票从 $59.90 往下让）。

**订单**
```bash
python scripts/desk/desk.py order find <姓名|手机|单号>
python scripts/desk/desk.py order show <单号> [--json]         # 菜单、加购、NOTES（客人看得到）、内部备注、派工、总价
python scripts/desk/desk.py order set  <单号> --date 2026-11-03 --time 18:00 --address "10756 McLennan Ave, Granada Hills, CA 91344" --dry
python scripts/desk/desk.py order set  <单号> --travel-miles 69 --travel-fee 19
python scripts/desk/desk.py order set  <单号> --proteins steak=15 chicken=15          # 只给了总数（快速模式）
python scripts/desk/desk.py order set  <单号> --guests-file rows.json [--replace-guests]   # 逐人名单 [{name, child?, little?, proteins:[...], allergy?, note?}]，每人 ≥2 种
python scripts/desk/desk.py order set  <单号> --add-extra tables_chairs=27 | edamame=1 | side_shrimp=15   # 买的加购 / 桌椅按人头 / 整桌蛋白份
python scripts/desk/desk.py order set  <单号> --free-item edamame=2                    # 送的前菜
python scripts/desk/desk.py order set  <单号> --deal-rate tables_chairs=5 | --deal-free tables_chairs
python scripts/desk/desk.py order set  <单号> --promo official_weekday=185 --remove-promo X --add-promo appreciation_veteran=50 --promo-label "..."
python scripts/desk/desk.py order set  <单号> --chefs 2 --grills 2 --stations "..."   # 派工计划（老板定的）
python scripts/desk/desk.py order hold <单号> --why "寿星出城，另挑日期"      # 日期待定：派对还在、日期拿掉（日历「日期待定」栏）；客人改期就用它
python scripts/desk/desk.py order redate <单号> --date 2026-11-14 [--time 18:00]   # 待定的单定了新日期
python scripts/desk/desk.py order preview <单号>
python scripts/desk/desk.py order remind <单号> --dry              # 前一天提醒，先 --dry
python scripts/desk/desk.py order send <单号>                      # 发票：邮件 PDF + 短信请回 confirm（先自查、老板看过）
python scripts/desk/desk.py order email <单号> [--notes-reviewed]
```
- 改之前先 `--dry` 看 TOTAL，和 `desk price` 对一遍；存的时候订单在你读之后被改过会 409 `STALE`，什么都没存，重看再改。
- 几样加购可以写在同一个 `--add-extra` 后面（`--add-extra tables_chairs=10 utensils=10`），也可以分开写几遍；10-21 之前分开写只留最后一个（Yunnie 差点只加上餐具），已改成会累加。改完照样看 `--dry` 的 TOTAL。
- 5 岁以下的小孩按系统惯例记成 child + little 行，并加 `--add-promo under5_auto=29.90 --promo-label "Little kids (3-4) @ $0 ×1"`，否则多收钱。
- 名单只在派对页（`lp_` 计划）、订单 0 行时，师傅备料单是空的：派对前用 `--guests-file` 灌进订单（10-21 Stephanie 那单）。
- 订单 NOTES 会原样印在客人发票上：过程记录写 `orders.internal_notes`，不写 NOTES。

**电话预定的手工建单**（客人电话里定了、不留卡）：往发票系统 `https://invoice.realhibachi.com/api/integrations/v1/events` 投一个签名的 `order.deposit_paid`（HMAC-SHA256，`X-Partner-Id: official_website`，payment `card_on_file` $0）。建完要补四样：`deposit_status → paid_verified`、`source_metadata.lead_id`、`desk order set --date --time`（时区）、`--travel-miles`；人数变了重设 promo。先例 RH-20261020-4480。

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
