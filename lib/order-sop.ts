// ============================================================
// 订单生命周期 SOP(成单之后)
// ============================================================
// 押金到账即晋升为订单,此后的标准动作在订单工作台执行——这里是
// 从线索工作台 won 阶段迁出的话术(id 保持不变,历史 [SOP:id] 记录兼容)。
// 每条都"给东西",不做干催;发送后落 order_events(action: sop_sent),
// checklist 据此打勾。

export type OrderSopStage = "booked" | "exec" | "post"

export type OrderSopContext = {
  firstName?: string
  plannerLink?: string
  chefName?: string
  reviewUrl?: string
}

export type OrderSopStep = {
  id: string
  stage: OrderSopStage
  emoji: string
  title: string
  when: string
  build: (ctx: OrderSopContext) => string
}

export const ORDER_SOP_STAGE_LABELS: Record<OrderSopStage, string> = {
  booked: "已订·待细节",
  exec: "本周执行",
  post: "派对后",
}

export const ORDER_SOP_STEPS: OrderSopStep[] = [
  {
    id: "w_planner",
    stage: "booked",
    emoji: "🎪",
    title: "发派对布置工具(专属链接)",
    when: "订金确认后立刻发(Stripe/Venmo/Zelle 都算)",
    build: ({ plannerLink }) =>
      plannerLink
        ? `You're booked 🎉 Here's your personal party planner: ${plannerLink} — your party's already linked to it. Set up your tables and share the same link with your guests so everyone picks their own proteins. Takes 2 minutes and makes party day seamless!`
        : "You're booked 🎉 Here's your party planner: party.realhibachi.com — set up your tables and share the link with your guests so everyone picks their own proteins. Takes 2 minutes and makes party day seamless!",
  },
  {
    id: "w_confirm48",
    stage: "exec",
    emoji: "✅",
    title: "48小时厨师实名确认(承诺兑现!)",
    when: "开席前 48 小时,广告承诺过的,必发",
    build: ({ chefName }) =>
      `Hi! Confirming your hibachi party in 48 hours 🎊 Your chef is ${chefName?.trim() || "Bling"}, arriving about 10 minutes before start time with the grill and fresh ingredients. Reply to confirm you're all set — see you soon!`,
  },
  {
    id: "w_review",
    stage: "post",
    emoji: "⭐",
    title: "派对次日:邀评",
    when: "办完派对第二天",
    build: ({ firstName, reviewUrl }) =>
      `Hi${firstName ? " " + firstName : ""}! Thanks for having Real Hibachi at your party - hope everyone loved the show! If you have 30 seconds, a Google review would mean the world to our small team: ${reviewUrl || "https://g.page/r/REVIEW_LINK"}`,
  },
  {
    id: "w_ugc",
    stage: "post",
    emoji: "📸",
    title: "派对次日:晒图邀请",
    when: "邀评后接着发",
    build: ({ firstName }) =>
      `Hi${firstName ? " " + firstName : ""}! Hope everyone loved the show 🔥 If you caught any fun photos or videos at the party, we'd love to see them - tag us @realhibachi on Instagram or just text them here. Our favorites get featured (with your OK, of course)!`,
  },
]
