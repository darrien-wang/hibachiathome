import { createHash, randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export const LIVECHAT_VISITOR_COOKIE_NAME = "rh_livechat_visitor"
export const LIVECHAT_FIRST_REPLY_TIMEOUT_MS = 5 * 60 * 1000
export const LIVECHAT_FIRST_REPLY_TIMEOUT_MESSAGE =
  "We're a bit busy right now. Please call 2137707788 for faster assistance."
export const LIVECHAT_VISITOR_ACKNOWLEDGEMENT_MESSAGE =
  "Thanks for your message. A support agent will be with you shortly."

const AUTO_BUSY_REPLY_SENDER_ID = "auto_busy_callback"
const AUTO_BUSY_REPLY_SENDER_NAME = "Real Hibachi Support"
const AUTO_VISITOR_ACKNOWLEDGEMENT_ID = "auto_visitor_acknowledgement"

const SESSION_SELECT = [
  "id",
  "visitor_key",
  "source",
  "status",
  "priority",
  "assigned_admin",
  "visitor_name",
  "visitor_email",
  "visitor_phone",
  "initial_page_url",
  "latest_message_preview",
  "latest_message_sender_role",
  "unread_for_admin_count",
  "unread_for_visitor_count",
  "started_at",
  "last_message_at",
  "updated_at",
].join(",")

const MESSAGE_SELECT = [
  "id",
  "sender_role",
  "sender_name",
  "body",
  "content_type",
  "created_at",
].join(",")

export type LivechatSessionRow = {
  id: string
  visitor_key: string
  source: string
  status: string
  priority: string
  assigned_admin: string | null
  visitor_name: string | null
  visitor_email: string | null
  visitor_phone: string | null
  initial_page_url: string | null
  latest_message_preview: string | null
  latest_message_sender_role: string | null
  unread_for_admin_count: number
  unread_for_visitor_count: number
  started_at: string
  last_message_at: string | null
  updated_at: string
}

export type LivechatMessageRow = {
  id: string
  sender_role: "visitor" | "admin" | "system"
  sender_name: string | null
  body: string
  content_type: string
  created_at: string
}

export type PublicLivechatPayload = {
  session: ReturnType<typeof mapSession>
  messages: Array<ReturnType<typeof mapMessage>>
}

type LivechatTimeoutTarget = Pick<LivechatSessionRow, "id" | "status" | "started_at">

export function createLivechatVisitorKey() {
  return randomUUID()
}

export function normalizeChatText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim().replace(/\r\n/g, "\n")
}

export function mapSession(row: LivechatSessionRow) {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    priority: row.priority,
    assignedAdmin: row.assigned_admin,
    visitorName: row.visitor_name,
    visitorEmail: row.visitor_email,
    visitorPhone: row.visitor_phone,
    initialPageUrl: row.initial_page_url,
    latestMessagePreview: row.latest_message_preview,
    latestMessageSenderRole: row.latest_message_sender_role,
    unreadForAdminCount: row.unread_for_admin_count,
    unreadForVisitorCount: row.unread_for_visitor_count,
    startedAt: row.started_at,
    lastMessageAt: row.last_message_at,
    updatedAt: row.updated_at,
  }
}

export function mapMessage(row: LivechatMessageRow) {
  return {
    id: row.id,
    senderRole: row.sender_role,
    senderName: row.sender_name,
    body: row.body,
    contentType: row.content_type,
    createdAt: row.created_at,
  }
}

function createDeterministicChatMessageId(sessionId: string, purpose: string) {
  const hash = createHash("sha256").update(`livechat:${purpose}:${sessionId}`).digest("hex").slice(0, 32).split("")
  hash[12] = "4"
  hash[16] = "8"
  const normalized = hash.join("")
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20, 32)}`
}

export function getLivechatFirstReplyTimeoutRemainingMs(session: Pick<LivechatSessionRow, "status" | "started_at">, now = Date.now()) {
  if (session.status !== "waiting_admin") {
    return null
  }

  const startedAt = new Date(session.started_at).getTime()
  if (!Number.isFinite(startedAt)) {
    return null
  }

  return Math.max(startedAt + LIVECHAT_FIRST_REPLY_TIMEOUT_MS - now, 0)
}

async function hasAdminReply(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .eq("sender_role", "admin")
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (error) {
    throw new Error(`Failed to inspect admin chat replies: ${error.message}`)
  }

  return Boolean(data)
}

async function hasNonVisitorReply(supabase: SupabaseClient, sessionId: string) {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .neq("sender_role", "visitor")
    .limit(1)
    .maybeSingle<{ id: string }>()

  if (error) {
    throw new Error(`Failed to inspect support chat replies: ${error.message}`)
  }

  return Boolean(data)
}

export async function ensureLivechatVisitorAcknowledgementMessage(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<{ sent: boolean }> {
  if (await hasNonVisitorReply(supabase, sessionId)) {
    return { sent: false }
  }

  const { error } = await supabase.from("chat_messages").insert({
    id: createDeterministicChatMessageId(sessionId, "visitor-acknowledgement"),
    session_id: sessionId,
    sender_role: "system",
    sender_id: AUTO_VISITOR_ACKNOWLEDGEMENT_ID,
    sender_name: AUTO_BUSY_REPLY_SENDER_NAME,
    body: LIVECHAT_VISITOR_ACKNOWLEDGEMENT_MESSAGE,
    content_type: "text",
    delivery_status: "sent",
    metadata: {
      auto_visitor_acknowledgement: true,
      trigger: "first_visitor_message",
    },
  })

  if (error && error.code !== "23505") {
    throw new Error(`Failed to send visitor acknowledgement message: ${error.message}`)
  }

  return { sent: !error }
}

export async function ensureLivechatFirstReplyTimeoutMessage(
  supabase: SupabaseClient,
  session: LivechatTimeoutTarget,
): Promise<{ sent: boolean; remainingMs: number | null }> {
  const remainingMs = getLivechatFirstReplyTimeoutRemainingMs(session)
  if (remainingMs === null) {
    return { sent: false, remainingMs: null }
  }

  if (remainingMs > 0) {
    return { sent: false, remainingMs }
  }

  if (await hasAdminReply(supabase, session.id)) {
    return { sent: false, remainingMs: 0 }
  }

  const { error } = await supabase.from("chat_messages").insert({
    id: createDeterministicChatMessageId(session.id, "first-reply-timeout"),
    session_id: session.id,
    sender_role: "admin",
    sender_id: AUTO_BUSY_REPLY_SENDER_ID,
    sender_name: AUTO_BUSY_REPLY_SENDER_NAME,
    body: LIVECHAT_FIRST_REPLY_TIMEOUT_MESSAGE,
    content_type: "text",
    delivery_status: "sent",
    metadata: {
      auto_busy_callback: true,
      trigger: "first_reply_timeout_5m",
    },
  })

  if (error && error.code !== "23505") {
    throw new Error(`Failed to send first reply timeout message: ${error.message}`)
  }

  return { sent: !error, remainingMs: 0 }
}

export async function findAuthorizedSession(
  supabase: SupabaseClient,
  sessionId: string | null | undefined,
  visitorKey: string,
): Promise<LivechatSessionRow | null> {
  if (!sessionId) return null

  const { data, error } = await supabase
    .from("chat_sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .eq("visitor_key", visitorKey)
    .maybeSingle<LivechatSessionRow>()

  if (error) {
    throw new Error(`Failed to load chat session: ${error.message}`)
  }

  return data
}

export async function findLatestVisitorSession(supabase: SupabaseClient, visitorKey: string): Promise<LivechatSessionRow | null> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select(SESSION_SELECT)
    .eq("visitor_key", visitorKey)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<LivechatSessionRow>()

  if (error) {
    throw new Error(`Failed to find visitor chat session: ${error.message}`)
  }

  return data
}

export async function fetchSessionMessages(supabase: SupabaseClient, sessionId: string): Promise<LivechatMessageRow[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(MESSAGE_SELECT)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .returns<LivechatMessageRow[]>()

  if (error) {
    throw new Error(`Failed to load chat messages: ${error.message}`)
  }

  return data ?? []
}

export async function fetchSessionPayload(
  supabase: SupabaseClient,
  sessionId: string,
  visitorKey: string,
): Promise<PublicLivechatPayload | null> {
  const session = await findAuthorizedSession(supabase, sessionId, visitorKey)
  if (!session) return null

  const messages = await fetchSessionMessages(supabase, session.id)
  return {
    session: mapSession(session),
    messages: messages.map(mapMessage),
  }
}
