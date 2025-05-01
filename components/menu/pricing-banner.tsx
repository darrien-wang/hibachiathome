interface PricingBannerProps {
  adultPrice: number
  childPrice: number
  minimumTotal: number
}

export default function PricingBanner({ adultPrice, childPrice, minimumTotal }: PricingBannerProps) {
  return (
    <div className="bg-primary text-white rounded-lg p-6 mb-10">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Hibachi Experience Pricing</h2>
        <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-10 mt-4">
          <div className="text-center">
            <p className="text-sm uppercase tracking-wide">Adult</p>
            <p className="text-3xl font-bold">${adultPrice}</p>
            <p className="text-sm">starting from</p>
          </div>
          <div className="text-center">
            <p className="text-sm uppercase tracking-wide">Child</p>
            <p className="text-3xl font-bold">${childPrice}</p>
            <p className="text-sm">starting from</p>
          </div>
          <div className="text-center">
            <p className="text-sm uppercase tracking-wide">Minimum</p>
            <p className="text-3xl font-bold">${minimumTotal}</p>
            <p className="text-sm">some parties</p>
          </div>
        </div>
      </div>
    </div>
  )
}
