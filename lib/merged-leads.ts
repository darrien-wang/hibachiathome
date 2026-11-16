import type { SupabaseClient } from "@supabase/supabase-js"

// A merged lead is a hidden alias of the lead it went into. Merging (PATCH
// /api/admin/leads, action merge) moves the row's timeline onto the oldest
// lead and leaves the row behind with merged_into set - still carrying its
// number and its address. Whatever files new activity by number or address
// has to follow it to the lead it went into, or the activity lands where
// nobody looks: the workbench, the desk and the reply audit read live leads
// only. A customer's text of 2026-09-10 went onto 763c4888 two days after it
// was merged - the one row carrying that number - and never reached the lead
// it was merged into.
//
// The rule is the inbox's (lib/inbox.ts leadPerPhone): a live lead carrying
// the number or address wins; when only merged rows carry it, the newest of
// them stands for the lead it went into. An id a person picks is left alone
// here: the owner writes on merged rows on purpose ("[dup] ..." notes).

export type MergeRef = { id: string; merged_into?: string | null }

/** Merges stack (a lead merged into one that is merged later); a chain longer than this is a loop. */
const MAX_HOPS = 5

/** `columns` plus merged_into, which every pick reads. */
export function withMergedInto(columns: string): string {
  const list = columns.split(",").map((c) => c.trim())
  return list.includes("*") || list.includes("merged_into") ? columns : `${columns}, merged_into`
}

/** Of the leads carrying one number or address, newest first: the first live one, else the newest merged one. */
export function pickContactRow<T extends MergeRef>(rows: readonly T[] | null | undefined): T | null {
  const list = rows ?? []
  return list.find((r) => !r.merged_into) ?? list[0] ?? null
}

/**
 * The lead activity for these rows (one number's or address's leads, newest first) is filed on, read
 * with `columns`: the first live row as it is; else the lead the newest merged row went into, a merge
 * of a merge followed. When that lead cannot be read, the deepest row that could be - never an id that
 * may not exist, which would fail the insert on its foreign key.
 */
export async function survivorOf<T extends MergeRef>(
  supabase: SupabaseClient,
  rows: readonly T[] | null | undefined,
  columns: string,
): Promise<T | null> {
  let current = pickContactRow(rows)
  for (let hop = 0; current?.merged_into && hop < MAX_HOPS; hop++) {
    const { data } = await supabase.from("leads").select(withMergedInto(columns)).eq("id", current.merged_into).maybeSingle()
    if (!data) break
    current = data as unknown as T
  }
  return current
}

/** The id activity on this row is filed on: its own, or that of the lead it was merged into. */
export async function survivorId(supabase: SupabaseClient, row: MergeRef): Promise<string> {
  return (await survivorOf(supabase, [row], "id"))?.id ?? row.id
}

/** A lead id stored before a merge (a link, a request): the lead it stands for now. An id not found comes back as it is. */
export async function currentLeadId(supabase: SupabaseClient, id: string): Promise<string> {
  const { data } = await supabase.from("leads").select("id, merged_into").eq("id", id).maybeSingle()
  return data ? survivorId(supabase, data as MergeRef) : id
}

/**
 * The leads on a number (its 10 digits): `row` is the one that speaks for the number - the newest live
 * lead carrying it, else the newest merged row - so its block state is the number's; `leadId` is where
 * activity on the number is filed. Null when no lead carries the number or the lookup fails (callers
 * treat both as "no lead", as they did before).
 */
export async function leadOnNumber<T extends MergeRef>(
  supabase: SupabaseClient,
  digits10: string,
  columns: string,
  opts: { orderBy?: "created_at" | "last_seen_at" } = {},
): Promise<{ row: T; leadId: string } | null> {
  if (!digits10) return null
  const { data, error } = await supabase
    .from("leads")
    .select(withMergedInto(columns))
    .eq("normalized_phone", digits10)
    .order(opts.orderBy ?? "created_at", { ascending: false })
    .limit(20)
  if (error) return null
  const row = pickContactRow((data ?? []) as unknown as T[])
  return row ? { row, leadId: await survivorId(supabase, row) } : null
}
