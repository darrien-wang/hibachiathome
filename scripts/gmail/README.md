# support@ 邮件进工作台（安装一次，5 分钟）

2026-10-07 起，发到 support@realhibachi.com 的客户邮件会出现在 `desk next` 里（`[email]` 卡片、
标题栏"邮件 N"），挂在发件人邮箱对应的线索上；回复用 `python scripts/desk/desk.py email <to> --subject ... --body-file ... --lead <id>`，
从 support@ 发出并记进时间线。入口是 `app/api/admin/email-inbound/route.ts`，推送由 Gmail 里的一段 Apps Script 完成。

## 一、Vercel 加密钥（老板做，我被挡在 Secret Store 外）

密钥值在本机 `C:\Users\darri\realhibachi-email-inbound.key`（一行，48 个十六进制字符）。

```bash
cd D:\desktop\RealHibachi\realhibachi-marketing
vercel env add EMAIL_INBOUND_KEY production
```
粘贴那一行 → 回车。然后让生产重部署一次（空提交推 main，或 Vercel 后台 Redeploy）。

## 二、Gmail 里装脚本（在收 support@ 来信的那个 Google 账号里做，现在是 darrien.wang@gmail.com）

1. 打开 https://script.google.com → 新建项目，命名 `rh-support-inbound`。
2. 把 `scripts/gmail/support-inbound.gs` 的内容整个贴进编辑器，保存。
3. 左侧「项目设置」→「脚本属性」→ 添加 `EMAIL_INBOUND_KEY` = 同一个密钥值。
4. 编辑器里选函数 `ingestSupportInbox` → 运行一次 → 授权（读 Gmail、访问外部 URL）。
   日志应显示 `support inbox: posted N, skipped M, failed 0`。
5. 选函数 `installTrigger` → 运行一次 → 装上每分钟的定时器。

## 三、验收

- 用任意外部邮箱给 support@realhibachi.com 发一封 → 1 分钟内 `python scripts/desk/desk.py next` 标题栏"邮件 1"，卡片里 `✉ 客 ...` 一行。
- 回一封：`desk email <那个邮箱> --subject "Re: ..." --body-file reply.txt --lead <id>` → 卡片多一行 `✉ 我 ...`，"邮件"计数归零。

## 规则

- 服务端按 Gmail message id 去重，脚本重复推送不会重复入库。
- 自己域名（notify@、support@ 发出的）和退信（mailer-daemon）不入库；平台通知（Zola 等）**会**入库——企业询盘就是这么来的，由人判断。
- 2026-10-09 起脚本也收平台询价（The Knot / WeddingWire 客人消息 `member.theknot.com`、Zola 标题带 inquiry 的通知），它们直接进这个 Gmail、不经过 support@。员工表里有的邮箱（老板个人 Gmail）发的信服务端跳过（`staff_sender`），因为平台询价是从这个邮箱回的。回完平台的信跑 `desk ack <lead>`，不然那条线索会一直显示"邮件待回"。
- **改了 `QUERY` 要同步改 Gmail 里的脚本**（script.google.com → rh-support-inbound，只换 `const QUERY = ...` 那一行，保存即可，定时器不用重装）。
- 线索匹配：按发件人邮箱找最近的线索（不限时间）；没有就建新线索（lead_source `email_inbound`，渠道 `email`）。
- "待回"判定：该线索最近一封入站邮件晚于我们最近一次外发（邮件或短信）。挂起 / 标过"不用回"的照旧不响。
