import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export const LIVECHAT_VISITOR_COOKIE_NAME = "rh_livechat_visitor"

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
