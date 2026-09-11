// Shown while the quote page's client chunk is still on its way. Without it
// a tap on "Get instant quote" over a slow connection renders nothing for
// several seconds - the owner's own phone made the page look frozen
// (2026-09-10). The skeleton mirrors the real page's rhythm so the swap in
// is a fill, not a jump.
export default function QuoteLoading() {
  return (
    <div className="bg-cream text-ink" aria-busy="true" aria-label="Loading your quote">
      <div className="mx-auto max-w-7xl px-5 pb-36 pt-[calc(var(--header-height,60px)+12px)] lg:px-8 lg:pb-20 lg:pt-[calc(var(--header-height,72px)+36px)]">
        <div className="mx-auto max-w-5xl animate-pulse">
          <div className="h-9 w-2/3 max-w-sm rounded-full bg-ink/10" />
          <div className="mt-3 h-4 w-1/2 max-w-xs rounded-full bg-ink/10" />
          <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="h-40 rounded-[28px] bg-surface shadow-organic" />
              <div className="h-56 rounded-[28px] bg-surface shadow-organic" />
            </div>
            <div className="h-64 rounded-[28px] bg-surface shadow-organic" />
          </div>
          <p className="mt-6 text-center text-sm text-clay-600">Opening your quote…</p>
        </div>
      </div>
    </div>
  )
}
