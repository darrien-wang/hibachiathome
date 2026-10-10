/**
 * Real Hibachi · support@ 邮件进工作台（Gmail Apps Script，2026-10-07）
 *
 * 装在 support@realhibachi.com 自己的 Google 账号里（项目 rh-support-inbound；10-09 核实，不是 darrien.wang@gmail.com——
 * 那边只有一个 10-07 建了没填的空项目）。support@ 收到的信同时抄转到 darrien.wang@gmail.com。
 * 每分钟跑一次：把最近两天发到 support@ 的每封邮件 POST 给工作台的
 * /api/admin/email-inbound；工作台按 Gmail message id 去重并挂到对应线索上。
 * 10-09 起也收平台询价：The Knot / WeddingWire 的客人消息、Zola 的询价通知原本只发到 darrien.wang@gmail.com，
 * 以前要有人翻 Gmail 才看得到（The Knot 一个 150 人婚礼 45 小时没人回）；那边设 Gmail 过滤把它们转发到 support@，
 * 这里按发件人认。平台的营销邮件和"某某在等你回复"的催促信不收；员工邮箱发的信服务端跳过。
 * 处理过的会话打标签 rh-ingested（只是标记，查重在服务端，所以老会话里的新回信也会进）。
 * 10-09 起只读上次成功之后的新邮件（LAST_OK_MS，留 10 分钟重叠）：以前每分钟把两天的邮件全读一遍，
 * 一天 1,440 遍，Gmail 每日额度用光（"Service invoked too many times for one day: gmail"），
 * 之后每次都在第一个 Gmail 调用上失败——April 10-08 23:42 的信 10 小时后才进工作台。
 *
 * 安装：见同目录 README.md。脚本属性里要有 EMAIL_INBOUND_KEY（和 Vercel 里同一个值）。
 */
const API_URL = "https://www.realhibachi.com/api/admin/email-inbound";
const LABEL_NAME = "rh-ingested";
const QUERY = '(to:support@realhibachi.com OR from:member.theknot.com OR from:member.weddingwire.com OR (from:zola.com subject:"New Zola inquiry")) -subject:"waiting to hear back"';
const MAX_THREADS = 40; const OVERLAP_MS = 10 * 60 * 1000;

function ingestSupportInbox() {
  const key = PropertiesService.getScriptProperties().getProperty("EMAIL_INBOUND_KEY");
  if (!key) throw new Error("Script Properties 里缺 EMAIL_INBOUND_KEY");
  const props = PropertiesService.getScriptProperties(); const last = Number(props.getProperty("LAST_OK_MS") || 0); const since = last ? last - OVERLAP_MS : Date.now() - 3 * 86400000; const startedAt = Date.now(); let label = null;
  const threads = GmailApp.search(QUERY + " after:" + Math.floor(since / 1000), 0, MAX_THREADS);
  let posted = 0, skipped = 0, failed = 0;
  threads.forEach((thread) => {
    let allOk = true;
    thread.getMessages().forEach((m) => {
      if (m.getDate().getTime() < since) return; const from = m.getFrom() || "";
      // 自己域名的信（notify@ 的系统通知、我们发出的回复）和退信不是客人。
      if (/@([a-z0-9-]+\.)*realhibachi\.com/i.test(from) || /mailer-daemon|postmaster/i.test(from)) { skipped++; return; }
      const payload = {
        messageId: m.getId(),
        threadId: thread.getId(),
        from: from,
        to: m.getTo(),
        subject: m.getSubject(),
        text: (m.getPlainBody() || "").slice(0, 20000),
        receivedAt: m.getDate().toISOString(),
        gmailUrl: "https://mail.google.com/mail/u/0/#inbox/" + thread.getId(),
        // 群发邮件（newsletter 之类）带这个头；服务端据此过滤，平台询盘除外。
        listUnsubscribe: Boolean(m.getHeader("List-Unsubscribe")),
      };
      const res = UrlFetchApp.fetch(API_URL, {
        method: "post",
        contentType: "application/json",
        headers: { "x-admin-key": key },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      if (res.getResponseCode() >= 300) { allOk = false; failed++; console.warn("email-inbound " + res.getResponseCode() + ": " + res.getContentText().slice(0, 200)); }
      else posted++;
    });
    if (allOk) { label = label || GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME); thread.addLabel(label); }
  });
  if (failed === 0) props.setProperty("LAST_OK_MS", String(startedAt)); console.log("support inbox: posted " + posted + ", skipped " + skipped + ", failed " + failed + ", threads " + threads.length);
}

/** 跑一次这个装定时器（每分钟）。重复跑不会装两个。 */
function installTrigger() {
  const exists = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "ingestSupportInbox");
  if (!exists) ScriptApp.newTrigger("ingestSupportInbox").timeBased().everyMinutes(1).create();
  console.log(exists ? "trigger already installed" : "trigger installed: every minute");
}
