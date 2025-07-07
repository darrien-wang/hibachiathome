"use client"

import type React from "react"

interface Step2AppetizersProps {
  gyoza: string
  edamame: string
  onNumberChange: (field: string, value: string) => void
  onNumberBlur: (field: string, value: string) => void
  onDecrement: (field: string) => void
  onIncrement: (field: string) => void
  onNext: () => void
  onPrev: () => void
  onSkip: () => void
}

const Step2Appetizers: React.FC<Step2AppetizersProps> = ({
  gyoza,
  edamame,
  onNumberChange,
  onNumberBlur,
  onDecrement,
  onIncrement,
  onNext,
  onPrev,
  onSkip,
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6">Would You Like Appetizers?</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-lg font-medium">🥟 Gyoza (Japanese Dumplings) - 12 pieces</label>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onDecrement("gyoza")}
              className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
            >
              -
            </button>
            <input
              type="number"
              value={gyoza}
              onChange={(e) => onNumberChange("gyoza", e.target.value)}
              onBlur={(e) => onNumberBlur("gyoza", e.target.value)}
              className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
              min="0"
              max="99"
              pattern="\\d*"
            />
            <button
              type="button"
              onClick={() => onIncrement("gyoza")}
              className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
            >
              +
            </button>
            <span className="ml-3 text-[#6B7280]">$15 per order</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-lg font-medium">🫛 Edamame (Soybeans)</label>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onDecrement("edamame")}
              className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
            >
              -
            </button>
            <input
              type="number"
              value={edamame}
              onChange={(e) => onNumberChange("edamame", e.target.value)}
              onBlur={(e) => onNumberBlur("edamame", e.target.value)}
              className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
              min="0"
              max="99"
              pattern="\\d*"
            />
            <button
              type="button"
              onClick={() => onIncrement("edamame")}
              className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
            >
              +
            </button>
            <span className="ml-3 text-[#6B7280]">$10 per order</span>
          </div>
        </div>
      </div>
      <div className="pt-4 flex flex-col space-y-3">
        <button
          onClick={onNext}
          className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          Next Step
        </button>
        <button
          onClick={onSkip}
          className="w-full py-2 border border-gray-300 text-[#4B5563] font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          I don't need appetizers, skip
        </button>
      </div>
      <div className="pt-2 text-center">
        <button onClick={onPrev} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
          Back to previous step
        </button>
      </div>
    </div>
  )
}

export default Step2Appetizers
