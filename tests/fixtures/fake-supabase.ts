// An in-memory stand-in for the Supabase client, for the order-flow tests
// (chef notices, cancel, inbox rules). Just enough PostgREST: the filters those
// modules use, applied to rows held in memory, and every write recorded so a
// test can say exactly what would have reached the database - and that a dry
// run reached nothing. A table listed in `missing` answers the way PostgREST
// does for one that does not exist (PGRST205), which is how chef_change_notices
// looks until card A is deployed.

export type Row = Record<string, unknown>
export type Write = { table: string; op: "insert" | "update" | "upsert" | "delete"; values?: unknown; rows: Row[] }

const MISSING = { code: "PGRST205", message: "Could not find the table in the schema cache", details: null, hint: null }

/** "raw_payload_json->>note" reads row.raw_payload_json.note. */
function read(row: Row, column: string): unknown {
  const parts = column.split(/->>?/)
  let v: unknown = row
  for (const p of parts) v = v && typeof v === "object" ? (v as Row)[p.trim()] : undefined
  return v
}

const cmp = (a: unknown, b: unknown): number => {
  const an = typeof a === "number" ? a : Date.parse(String(a))
  const bn = typeof b === "number" ? b : Date.parse(String(b))
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn
  return String(a).localeCompare(String(b))
}

export function fakeSupabase(tables: Record<string, Row[]>, opts: { missing?: string[] } = {}) {
  const writes: Write[] = []
  let seq = 0
  const db = {
    writes,
    tables,
    from(table: string) {
      const gone = (opts.missing ?? []).includes(table)
      if (!gone && !tables[table]) tables[table] = []
      const filters: Array<(r: Row) => boolean> = []
      let mode: "select" | "update" | "delete" | "insert" | "upsert" = "select"
      let values: unknown = null
      let conflict = "id"
      let sort: { column: string; ascending: boolean } | null = null
      let max = Infinity
      let single: "one" | "maybe" | null = null
      const keep = (f: (r: Row) => boolean) => (filters.push(f), q)

      const run = () => {
        if (gone) return { data: null, error: MISSING }
        const all = tables[table]
        const match = () => all.filter((r) => filters.every((f) => f(r)))
        let rows: Row[]
        if (mode === "insert" || mode === "upsert") {
          const list = (Array.isArray(values) ? values : [values]) as Row[]
          rows = list.map((v) => ({ id: v.id ?? `new-${++seq}`, ...v }))
          for (const r of rows) {
            const at = mode === "upsert" ? all.findIndex((x) => x[conflict] === r[conflict]) : -1
            if (at >= 0) all[at] = { ...all[at], ...r }
            else all.push(r)
          }
          writes.push({ table, op: mode, values, rows })
        } else if (mode === "update") {
          rows = match()
          for (const r of rows) Object.assign(r, values as Row)
          writes.push({ table, op: "update", values, rows: rows.map((r) => ({ ...r })) })
        } else if (mode === "delete") {
          rows = match()
          tables[table] = all.filter((r) => !rows.includes(r))
          writes.push({ table, op: "delete", rows })
        } else {
          rows = match()
        }
        if (sort) {
          const s = sort
          rows = [...rows].sort((a, b) => cmp(read(a, s.column), read(b, s.column)) * (s.ascending ? 1 : -1))
        }
        rows = rows.slice(0, max)
        if (single) return { data: rows[0] ?? null, error: null }
        return { data: rows, error: null }
      }

      const q = {
        select: (_columns?: string, _o?: unknown) => q,
        insert: (v: unknown) => ((mode = "insert"), (values = v), q),
        upsert: (v: unknown, o?: { onConflict?: string }) => ((mode = "upsert"), (values = v), (conflict = o?.onConflict ?? "id"), q),
        update: (v: unknown) => ((mode = "update"), (values = v), q),
        delete: () => ((mode = "delete"), q),
        eq: (c: string, v: unknown) => keep((r) => read(r, c) === v),
        neq: (c: string, v: unknown) => keep((r) => read(r, c) !== v),
        in: (c: string, vs: unknown[]) => keep((r) => vs.includes(read(r, c))),
        is: (c: string, v: unknown) => keep((r) => (v === null ? read(r, c) == null : read(r, c) === v)),
        not: (c: string, op: string, v: unknown) =>
          keep((r) => {
            const x = read(r, c)
            if (op === "is") return v === null ? x != null : x !== v
            if (op === "in") return !String(v).replace(/^\(|\)$/g, "").split(",").includes(String(x))
            if (op === "like") return !likes(String(x ?? ""), String(v))
            return true
          }),
        gt: (c: string, v: unknown) => keep((r) => read(r, c) != null && cmp(read(r, c), v) > 0),
        gte: (c: string, v: unknown) => keep((r) => read(r, c) != null && cmp(read(r, c), v) >= 0),
        lt: (c: string, v: unknown) => keep((r) => read(r, c) != null && cmp(read(r, c), v) < 0),
        lte: (c: string, v: unknown) => keep((r) => read(r, c) != null && cmp(read(r, c), v) <= 0),
        like: (c: string, pattern: string) => keep((r) => likes(String(read(r, c) ?? ""), pattern)),
        ilike: (c: string, pattern: string) => keep((r) => likes(String(read(r, c) ?? "").toLowerCase(), pattern.toLowerCase())),
        // An or() is not evaluated: every caller here re-checks in code what it asked the database for.
        or: (_filter: string) => q,
        order: (c: string, o?: { ascending?: boolean }) => ((sort = { column: c, ascending: o?.ascending !== false }), q),
        limit: (n: number) => ((max = n), q),
        range: (from: number, to: number) => ((max = to + 1), void from, q),
        maybeSingle: () => ((single = "maybe"), q),
        single: () => ((single = "one"), q),
        then: (ok: (v: { data: unknown; error: unknown }) => unknown, fail?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, fail),
      }
      return q
    },
  }
  return db
}

/** SQL LIKE with % only. */
function likes(value: string, pattern: string): boolean {
  const rx = new RegExp(`^${pattern.split("%").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`, "s")
  return rx.test(value)
}

export type FakeSupabase = ReturnType<typeof fakeSupabase>
