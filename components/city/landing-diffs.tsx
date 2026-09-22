import LandingCtaButton from "@/components/city/landing-cta-button"
import { TRAVEL_FREE_RADIUS_MILES } from "@/config/pricing-rules"

// The four facts right under the Joshua Tree hero, shared by every
// landing-type page (2026-09-21). The first card is the one people try to tap
// (2026-09-12: 13 rage clicks on it in one session, then "$0" and "50 mi"), so
// it is a real button that brings them to the phone input; the rest are flat
// facts, not buttons.
export default function LandingDiffs({ distanceLine }: { distanceLine: string }) {
  const diffs = [
    { big: "15 min", label: "text reply", body: "A real person, not a bot", action: true },
    { big: `${TRAVEL_FREE_RADIUS_MILES} mi`, label: "of travel free", body: distanceLine },
    { big: "$0", label: "setup surcharge", body: "Tarp, setup and cleanup in the price" },
    { big: "2×", label: "back if we ever cancel", body: "Your chef is confirmed by name before your party" },
  ]
  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="font-serif text-[26px] font-extrabold leading-[1.1] lg:sr-only">What your quote actually includes</h2>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        {diffs.map((d) =>
          d.action ? (
            <LandingCtaButton
              key={d.label}
              surface="landing_deposit_card"
              className="flex flex-col items-start gap-1 rounded-2xl border-2 border-flame/60 bg-surface p-3.5 text-left transition hover:bg-flame/5 lg:gap-1.5 lg:p-[22px]"
            >
              <span className="font-serif text-2xl font-extrabold leading-none text-flame lg:text-[34px]">{d.big}</span>
              <span className="text-[13px] font-semibold lg:text-[15px]">{d.label}</span>
              <span className="text-xs leading-snug text-clay-600 lg:text-[13px]">{d.body}</span>
              <span className="mt-1 text-xs font-bold text-flame lg:text-[13px]">Text me my quote →</span>
            </LandingCtaButton>
          ) : (
            <div key={d.label} className="flex flex-col gap-1 rounded-2xl bg-surface/70 p-3.5 lg:gap-1.5 lg:p-[22px]">
              <span className="font-serif text-2xl font-extrabold leading-none text-flame lg:text-[34px]">{d.big}</span>
              <span className="text-[13px] font-semibold lg:text-[15px]">{d.label}</span>
              <span className="text-xs leading-snug text-clay-600 lg:text-[13px]">{d.body}</span>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
