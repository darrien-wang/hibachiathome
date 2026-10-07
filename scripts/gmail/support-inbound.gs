/**
 * Real Hibachi · support@ 邮件进工作台（Gmail Apps Script，2026-10-07）
 *
 * 装在"收到 support@realhibachi.com 来信"的那个 Google 账号里（现在是 darrien.wang@gmail.com）。
 * 每分钟跑一次：把最近两天发到 support@ 的每封邮件 POST 给工作台的
 * /api/admin/email-inbound；工作台按 Gmail message id 去重并挂到对应线索上。
 * 处理过的会话打标签 rh-ingested（只是标记，查重在服务端，所以老会话里的新回信也会进）。
 *
 * 安装：见同目录 README.md。脚本属性里要有 EMAIL_INBOUND_KEY（和 Vercel 里同一个值）。
 */
const API_URL = "https://www.realhibachi.com/api/admin/email-inbound";
const LABEL_NAME = "rh-ingested";
const QUERY = "to:support@realhibachi.com newer_than:2d";
const MAX_THREADS = 40;

function ingestSupportInbox() {
  const key = PropertiesService.getScriptProperties().getProperty("EMAIL_INBOUND_KEY");
  if (!key) throw new Error("Script Properties 里缺 EMAIL_INBOUND_KEY");
  const label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
  const threads = GmailApp.search(QUERY, 0, MAX_THREADS);
  let posted = 0, skipped = 0, failed = 0;
  threads.forEach((thread) => {
    let allOk = true;
    thread.getMessages().forEach((m) => {
      const from = m.getFrom() || "";
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
    if (allOk) thread.addLabel(label);
  });
  console.log("support inbox: posted " + posted + ", skipped " + skipped + ", failed " + failed + ", threads " + threads.length);
}

/** 跑一次这个装定时器（每分钟）。重复跑不会装两个。 */
function installTrigger() {
  const exists = ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "ingestSupportInbox");
  if (!exists) ScriptApp.newTrigger("ingestSupportInbox").timeBased().everyMinutes(1).create();
  console.log(exists ? "trigger already installed" : "trigger installed: every minute");
}
