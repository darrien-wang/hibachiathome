# CPL Conversion Optimization Progress Log

Last updated: 2026-03-06  
Scope file: `CPLfeaturelist.json`

---

## 1) Goal

以 **最低 CPL（每条线索成本）** 为目标，建立可审计、可复现、端到端可验证的增长执行体系，覆盖：

- 站内转化路径（Home / Quote / Contact / Deposit）
- 追踪与归因（GTM / GA4 / Google Ads / Meta）
- 投放后台治理（Primary/Secondary、单计数路径、防双计数）
- 发布流程与证据管理（自动化 + 人工验证）

---

## 2) Working Rules（CPL 专项）

1. 每次只推进一个最高优先级失败项（P0 > P1 > P2）。
2. 每次改动必须留下证据到 `cpl-verification/<date>/...`。
3. 代码改动和人工后台改动都必须可验证、可复盘。
4. 广告计数路径必须单一且有证据（避免双计数）。
5. 关键事件（高质量 lead、deposit completed）必须具备去重机制。

---

## 3) Current Snapshot（from CPLfeaturelist.json）

- Total items: **25**
- Passing: **7**
- Remaining: **18**
- P0 remaining: **5**（CPL-005、CPL-009~CPL-012）

### Passed baseline items

- CPL-001 GTM 前端入口已安装
- CPL-002 无直接 `window.gtag` 业务调用
- CPL-003 attribution 持久化（utm + gclid/wbraid/gbraid）
- CPL-004 deposit_completed paid 验证 + 客户端 transaction_id 去重

---

## 4) Recommended Execution Order（Next 2 weeks）

### Phase A（信号层，先做，直接影响算法学习）

1. **CPL-005** 拆分高质量线索事件与非销售事件  
2. **CPL-006** Quote 的 SMS/Call 纳入可优化线索事件  
3. **CPL-007** Contact 语义与 lead_type 对齐新客咨询  
4. **CPL-010** GTM_ID 生产强校验  
5. **CPL-011** Ads/GTM 单计数路径治理

### Phase B（成交可靠性 + 漏斗完整性）

6. **CPL-009** webhook 服务端成交回传兜底  
7. **CPL-013** /book + footer 触点补齐 tracking  
8. **CPL-014** 主 CTA 路径统一  
9. **CPL-022** e2e 回归用例升级

### Phase C（平台扩展 + 运营闭环）

10. **CPL-019** event_id 跨端去重合同  
11. **CPL-020** Meta attribution 扩展  
12. **CPL-021** Meta Pixel + CAPI 去重  
13. **CPL-023/024/025** 周报与发布治理固化

---

## 5) End-to-End Verification Protocol（你和我都可执行）

每次发布必须提供以下 6 类证据（缺一不可）：

1. **代码证据**：PR diff + 关键文件列表  
2. **浏览器证据**：dataLayer 事件 JSON（关键路径）  
3. **GTM 证据**：Tag Assistant 触发截图（含 trigger + fired tags）  
4. **Ads 证据**：Conversion 设置截图（Primary/Secondary + 计数路径）  
5. **Meta 证据（如投放）**：Test Events 的 browser/server 去重截图  
6. **回归证据**：自动化测试日志与结果（smoke/e2e）

建议目录模板：

```text
cpl-verification/
  2026-03-06-cpl-005/
    code-diff-summary.md
    datalayer-snapshots.json
    gtm-preview-qualified-lead.png
    google-ads-conversion-settings.png
    verification-checklist.md
```

---

## 6) User-side Manual Tasks（需要你配合的关键项）

以下任务属于“必须你在平台后台操作或授权”的环节：

- CPL-011：Google Ads / GTM 单计数路径治理
- CPL-012：GTM 容器导出与版本归档
- CPL-017：Google Ads Primary/Secondary 分层
- CPL-018：Enhanced Conversions for Leads
- CPL-021：Meta Pixel + CAPI 测试去重
- CPL-024：每周搜索词/素材迭代

> 这些任务在 `CPLfeaturelist.json` 里均有“可验证 steps”，执行后把截图和日志放到 `cpl-verification/<date>/...` 即可完成验收。

---

## 7) Session Log

## 2026-03-06 (Initialization)

- Completed:
  - 创建 CPL 专项 backlog：`CPLfeaturelist.json`
  - 创建 CPL 专项进度日志：`CPL-codex-progress.md`
  - 将任务拆分为：
    - 代码可改动项（functional / qa / experiment）
    - 人工平台项（manual / governance）
  - 为每项任务定义了可复验步骤（含证据产物路径约定）

- Evidence:
  - `CPLfeaturelist.json`
  - `CPL-codex-progress.md`

- Next highest-priority action:
  - 执行 **CPL-005**（高质量线索事件拆分，清洗 Ads 优化信号）

## 2026-03-06 (CPL-005 implementation started: lead signal split in code)

- Completed:
  - 复验既有通过核心流（基线）：
    - 执行 `node harness/scripts/verify-tracking-page-view.mjs cpl-verification/2026-03-06-cpl-005`
    - 输出 `trk-001-trk-002-tracking-lib-evidence.json`（通过）
  - 完成 CPL-005 的代码层改造（线索信号拆分）：
    - `app/contact/ContactPageClient.tsx`
      - `trackEvent("lead_submit")` -> `trackEvent("support_submit")`
    - `app/partner-opportunities/PartnerOpportunitiesPageClient.tsx`
      - `trackEvent("lead_submit")` -> `trackEvent("partner_application_submit")`
    - `lib/tracking.ts`
      - 新增事件类型：`support_submit`、`partner_application_submit`
    - `harness/docs/tracking.md`
      - 更新事件字典与 GTM mapping，明确 support/partner 事件不应绑定 Ads conversion tag
  - 完成代码层审计与验证：
    - `event-signal-split-audit.log`（确认 `lead_submit` 仅保留在销售语义路径）
    - `cpl-005-signal-split-summary.json`（断言全部 PASS）
    - `targeted-eslint.exit=0`

- CPL-005 status:
  - 仍保持 `passes: false`（待完成人工 GTM Preview/Ads 触发验收后再转为 true）。

- Blockers:
  - 需要 GTM/Ads 后台访问权限完成 CPL-005 的最终人工验收步骤（Tag Assistant + Ads trigger 对照）。
  - 通用静态门禁 `codex-verify` 在 build 阶段失败（`ENOENT .next/server/pages-manifest.json`），已留存证据，属于现有环境/构建问题，非本次改动引入。

- Evidence:
  - `cpl-verification/2026-03-06-cpl-005/core-baseline-trk-001-002.log`
  - `cpl-verification/2026-03-06-cpl-005/core-baseline-trk-001-002.exit`
  - `cpl-verification/2026-03-06-cpl-005/trk-001-trk-002-tracking-lib-evidence.json`
  - `cpl-verification/2026-03-06-cpl-005/event-signal-split-audit.log`
  - `cpl-verification/2026-03-06-cpl-005/cpl-005-signal-split-summary.json`
  - `cpl-verification/2026-03-06-cpl-005/targeted-eslint.exit`
  - `cpl-verification/2026-03-06-cpl-005/codex-verify.log`
  - `cpl-verification/2026-03-06-cpl-005/codex-verify.exit`

- Next highest-priority action:
  - 先完成 CPL-005 的人工 GTM/Ads 验收（你侧后台操作），完成后将 CPL-005 改为 `passes: true`；
  - 随后进入 **CPL-006**（Quote 的 SMS/Call 补充可优化线索信号）。

## 2026-03-06 (CPL-006 complete: quote SMS/Call/Email emit qualified lead_submit)

- Completed:
  - 复验既有通过核心流（基线）：
    - 执行 `node harness/scripts/verify-tracking-page-view.mjs cpl-verification/2026-03-06-cpl-006`
    - 输出 `trk-001-trk-002-tracking-lib-evidence.json`（通过）
  - 完成 CPL-006 代码改造：
    - `app/quote/QuoteBuilderClient.tsx`
      - 新增 `buildQualifiedLeadPayload(leadChannel)` 统一销售线索参数合同
      - `onSmsClick` 在 `contact_sms_click` 后补发 `lead_submit`（`lead_channel=sms`）
      - `onCallClick` 在 `contact_call_click` 后补发 `lead_submit`（`lead_channel=phone`）
      - `onEmailClick` 改为复用统一 payload（`lead_channel=email`）
      - 增加 `__REALHIBACHI_DISABLE_NAVIGATION__` 测试钩子，保证自动化验证时可阻止外部协议跳转
    - `harness/docs/tracking.md`
      - 更新 `lead_submit` 定义为 Quote 的 SMS/Call/Email 销售意图动作
  - 新增并通过端到端自动化验证：
    - 新增 `e2e/cpl-006.spec.ts`
    - 验证 SMS / Call / Email 三个动作均同时产生：
      - 1 条 `contact_*_click`
      - 1 条 `lead_submit`（channel 匹配 + `lead_type=quote_contact` + `lead_source=quote_builder_a`）
  - 更新状态：
    - `CPL-006` changed from `passes: false -> true`

- Verified:
  - `lead_submit` 在 Quote 页面已覆盖 SMS/Call/Email 三种渠道 ✅
  - 每个渠道的 `lead_submit` 均包含核心上下文字段（city、estimate、quote_summary、event_time 等）✅
  - 静态门禁（`codex-verify`）本次通过（lint + build）✅

- Evidence:
  - `cpl-verification/2026-03-06-cpl-006/core-baseline-trk-001-002.log`
  - `cpl-verification/2026-03-06-cpl-006/core-baseline-trk-001-002.exit`
  - `cpl-verification/2026-03-06-cpl-006/trk-001-trk-002-tracking-lib-evidence.json`
  - `cpl-verification/2026-03-06-cpl-006/cpl-006-lead-submit-quote-audit.log`
  - `cpl-verification/2026-03-06-cpl-006/cpl-006-playwright.log`
  - `cpl-verification/2026-03-06-cpl-006/cpl-006-playwright.exit`
  - `cpl-verification/2026-03-06-cpl-006/cpl-006-quote-contact-actions.json`
  - `cpl-verification/2026-03-06-cpl-006/cpl-006-quote-contact-actions.png`
  - `cpl-verification/2026-03-06-cpl-006/targeted-eslint.exit`
  - `cpl-verification/2026-03-06-cpl-006/codex-verify.log`
  - `cpl-verification/2026-03-06-cpl-006/codex-verify.exit`

- Next highest-priority action:
  - 执行 **CPL-007**（Contact 页面改为预订咨询语义并输出匹配的线索事件语义）。

## 2026-03-06 (CPL-007 complete: Contact intent aligned to booking with support fallback routing)

- Completed:
  - 复验既有通过核心流（基线）：
    - 执行 `node harness/scripts/verify-tracking-page-view.mjs cpl-verification/2026-03-06-cpl-007`
    - 输出 `trk-001-trk-002-tracking-lib-evidence.json`（通过）
  - 完成 CPL-007 代码改造：
    - `app/contact/page.tsx`
      - metadata 从 Feedback/Post-event Support 改为 Booking Help 语义
    - `app/contact/ContactPageClient.tsx`
      - 默认提交意图改为 booking_inquiry
      - 新增支持类 reason 识别（support/feedback/refund/cancel 等关键词）：
        - booking 路径 => `lead_submit` + `lead_type=booking_inquiry`
        - support 路径 => `support_submit` + `lead_type=customer_support`
      - 页面文案更新（主标题、表单标题、成功提示、按钮文案）
    - `components/header.tsx`
      - 导航名 `Feedback` -> `Contact`
    - `harness/docs/tracking.md`
      - 更新 `lead_submit` 与 `support_submit` 的触发语义说明
  - 新增并通过端到端自动化验证：
    - 新增 `e2e/cpl-007.spec.ts`
    - 用例覆盖：
      - 默认 `/contact` 提交 => `lead_submit`（booking_inquiry）
      - `/contact?reason=post_event_support` 提交 => `support_submit`（customer_support）
  - 更新状态：
    - `CPL-007` changed from `passes: false -> true`

- Verified:
  - Contact 页面默认语义为 booking inquiry，事件进入 `lead_submit` ✅
  - 支持类 reason 不污染广告主线索，正确进入 `support_submit` ✅
  - 静态门禁（`codex-verify`）通过（lint + build）✅

- Evidence:
  - `cpl-verification/2026-03-06-cpl-007/core-baseline-trk-001-002.log`
  - `cpl-verification/2026-03-06-cpl-007/core-baseline-trk-001-002.exit`
  - `cpl-verification/2026-03-06-cpl-007/trk-001-trk-002-tracking-lib-evidence.json`
  - `cpl-verification/2026-03-06-cpl-007/cpl-007-contact-semantic-audit.log`
  - `cpl-verification/2026-03-06-cpl-007/cpl-007-default-booking-intent.json`
  - `cpl-verification/2026-03-06-cpl-007/cpl-007-default-booking-intent.png`
  - `cpl-verification/2026-03-06-cpl-007/cpl-007-support-reason-intent.json`
  - `cpl-verification/2026-03-06-cpl-007/cpl-007-playwright.log`
  - `cpl-verification/2026-03-06-cpl-007/cpl-007-playwright.exit`
  - `cpl-verification/2026-03-06-cpl-007/targeted-eslint.exit`
  - `cpl-verification/2026-03-06-cpl-007/codex-verify.log`
  - `cpl-verification/2026-03-06-cpl-007/codex-verify.exit`

- Next highest-priority action:
  - 执行 **CPL-008**（`quote_started` 仅在真实首个输入后触发，避免页面加载即误记）。

## 2026-03-06 (CPL-008 complete: quote_started gated by first real user input)

- Completed:
  - 复验既有通过核心流（基线）：
    - 执行 `node harness/scripts/verify-tracking-page-view.mjs cpl-verification/2026-03-06-cpl-008`
    - 输出 `trk-001-trk-002-tracking-lib-evidence.json`（通过）
  - 完成 CPL-008 代码改造：
    - `app/quote/QuoteBuilderClient.tsx`
      - 新增 `QUOTE_STARTED_INPUT_FIELDS`（eventDate/location/adults/kids）
      - 新增 `quoteStartIntentCaptured` 状态
      - 仅当用户真实变更核心字段后才允许发送 `quote_started`
      - 保持 `quote_started` 只发一次（首次输入后）
  - 新增并通过端到端自动化验证：
    - 新增 `e2e/cpl-008.spec.ts`
    - 验证场景：
      - 初次加载 `/quoteA` 不输入：`quote_started = 0`
      - 首次输入核心字段后：`quote_started = 1`
      - 后续继续输入：`quote_started` 仍为 `1`
  - 更新状态：
    - `CPL-008` changed from `passes: false -> true`

- Verified:
  - quote_started 不再在页面加载时误触发 ✅
  - quote_started 在首个真实输入后触发且仅触发一次 ✅
  - 静态门禁（`codex-verify`）通过（lint + build）✅

- Evidence:
  - `cpl-verification/2026-03-06-cpl-008/core-baseline-trk-001-002.log`
  - `cpl-verification/2026-03-06-cpl-008/core-baseline-trk-001-002.exit`
  - `cpl-verification/2026-03-06-cpl-008/trk-001-trk-002-tracking-lib-evidence.json`
  - `cpl-verification/2026-03-06-cpl-008/cpl-008-code-audit.log`
  - `cpl-verification/2026-03-06-cpl-008/cpl-008-quote-started-gating.json`
  - `cpl-verification/2026-03-06-cpl-008/cpl-008-quote-started-gating.png`
  - `cpl-verification/2026-03-06-cpl-008/cpl-008-playwright.log`
  - `cpl-verification/2026-03-06-cpl-008/cpl-008-playwright.exit`
  - `cpl-verification/2026-03-06-cpl-008/targeted-eslint.exit`
  - `cpl-verification/2026-03-06-cpl-008/codex-verify.log`
  - `cpl-verification/2026-03-06-cpl-008/codex-verify.exit`

- Next highest-priority action:
  - 执行 **CPL-009**（deposit_completed 服务端回传兜底，减少回跳/脚本拦截导致的成交漏数）。

---

## 8) Blockers / Dependencies

当前潜在阻塞项（执行时若缺失需要补齐）：

1. Google Ads / GTM / GA4 / Meta 的后台访问权限  
2. “高质量线索”业务定义（例如是否要求姓名+电话+日期）  
3. Stripe webhook 服务端回传采用哪条路径（GA4 MP / sGTM / Ads API）  
4. 隐私合规确认（Enhanced Conversions / CAPI 所需字段处理）

---

## 9) Change Log Policy

- 不删除既有任务，仅允许显式状态变更（`passes: false -> true`）。
- 若测试定义发生变化，必须在本文件追加“变更原因 + 影响评估”。
- 每次完成一个任务后，新增一段 Session Log（日期、改动、验证、证据、下一步）。

## 2026-03-06 (GTM live-debug fix for Tag Assistant "No tags found")

- Trigger:
  - 用户在 `http://localhost:3000/quoteA` 使用 Tag Assistant 报告：`No debuggable Google tags found`。

- Root cause:
  - 本地 `.env.local` 的 `NEXT_PUBLIC_GTM_ID` 先前为占位值 `GTM-XXXXXXX`（Tag Assistant 无法识别有效容器）。
  - 即使环境变量已更新为 `GTM-WQZNBK82`，若 Next dev 进程未重启，页面仍会继续输出旧容器 ID。

- Actions:
  - 确认并写入：`NEXT_PUBLIC_GTM_ID=GTM-WQZNBK82`
  - 重启本地开发服务（Next.js dev server）
  - 复核 `/quoteA` 页面最终 HTML 已注入：
    - `https://www.googletagmanager.com/gtm.js?id=GTM-WQZNBK82`
    - `noscript` iframe 使用 `GTM-WQZNBK82`
  - 复核 GTM JS 响应：`HTTP/2 200`

- Re-verify baseline:
  - 重新执行既有通过项 `CPL-008`（Playwright）确保本次环境修复未引入追踪回归。

- Evidence:
  - `cpl-verification/2026-03-06-cpl-008-gtm-fix/gtm-live-check.log`
  - `cpl-verification/2026-03-06-cpl-008-gtm-fix/quoteA-live.png`
  - `cpl-verification/2026-03-06-cpl-008-reverify/cpl-008-reverify.log`
  - `cpl-verification/2026-03-06-cpl-008-reverify/cpl-008-reverify.exit`

- Next:
  - 请用户在 Tag Assistant 重新连接 `http://localhost:3000/quoteA`，确认容器显示 `GTM-WQZNBK82`。
  - 完成 `CPL-005` 手工后台验证并回传截图（见 `cpl-verification/2026-03-06-cpl-005/manual-gtm-ads-checklist.md`）。
