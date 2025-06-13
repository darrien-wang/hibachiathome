interface SocialProofCounterProps {
  value: string
  label: string
}

export function SocialProofCounter({ value, label }: SocialProofCounterProps) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white mb-2">{value}</div>
      <div className="text-amber-100">{label}</div>
    </div>
  )
}
