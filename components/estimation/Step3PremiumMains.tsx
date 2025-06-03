import React from "react";

interface Step3PremiumMainsProps {
  filetMignon: string;
  lobsterTail: string;
  onNumberChange: (field: string, value: string) => void;
  onNumberBlur: (field: string, value: string) => void;
  onDecrement: (field: string) => void;
  onIncrement: (field: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const Step3PremiumMains: React.FC<Step3PremiumMainsProps> = ({
  filetMignon,
  lobsterTail,
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
      <h2 className="text-2xl font-bold text-center mb-6">Upgrade Your Main Course?</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-lg font-medium">🥩 Filet Mignon</label>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onDecrement("filetMignon")}
              className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
            >
              -
            </button>
            <input
              type="number"
              value={filetMignon}
              onChange={e => onNumberChange("filetMignon", e.target.value)}
              onBlur={e => onNumberBlur("filetMignon", e.target.value)}
              className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
              min="0"
              pattern="\\d*"
            />
            <button
              type="button"
              onClick={() => onIncrement("filetMignon")}
              className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
            >
              +
            </button>
            <span className="ml-3 text-[#6B7280]">$5 per person</span>
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-lg font-medium">🦞 Lobster Tail</label>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onDecrement("lobsterTail")}
              className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
            >
              -
            </button>
            <input
              type="number"
              value={lobsterTail}
              onChange={e => onNumberChange("lobsterTail", e.target.value)}
              onBlur={e => onNumberBlur("lobsterTail", e.target.value)}
              className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
              min="0"
              pattern="\\d*"
            />
            <button
              type="button"
              onClick={() => onIncrement("lobsterTail")}
              className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
            >
              +
            </button>
            <span className="ml-3 text-[#6B7280]">$10 per person</span>
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
          No upgrades needed, skip
        </button>
      </div>
      <div className="pt-2 text-center">
        <button onClick={onPrev} className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
          Back to previous step
        </button>
      </div>
    </div>
  );
};

export default Step3PremiumMains; 