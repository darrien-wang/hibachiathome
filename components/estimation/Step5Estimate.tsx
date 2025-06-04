import React from "react";

interface Step5EstimateProps {
  zipcode: string;
  adults: number;
  kids: number;
  filetMignon: number;
  lobsterTail: number;
  extraProteins: number;
  noodles: number;
  gyoza: number;
  edamame: number;
  travelFee: number;
  subtotal: number;
  total: number;
  minimumSpending: number;
  usedMinimum: boolean;
  onNext: () => void;
  onPrev: () => void;
  isEstimationValid: boolean;
  adultsUnit: number;
  adultsCost: number;
  kidsUnit: number;
  kidsCost: number;
  filetMignonUnit: number;
  filetMignonCost: number;
  lobsterTailUnit: number;
  lobsterTailCost: number;
  extraProteinsUnit: number;
  extraProteinsCost: number;
  noodlesUnit: number;
  noodlesCost: number;
  gyozaUnit: number;
  gyozaCost: number;
  edamameUnit: number;
  edamameCost: number;
}

const Step5Estimate: React.FC<Step5EstimateProps> = ({
  zipcode,
  adults,
  kids,
  filetMignon,
  lobsterTail,
  extraProteins,
  noodles,
  gyoza,
  edamame,
  travelFee,
  subtotal,
  total,
  minimumSpending,
  usedMinimum,
  onNext,
  onPrev,
  isEstimationValid,
  adultsUnit,
  adultsCost,
  kidsUnit,
  kidsCost,
  filetMignonUnit,
  filetMignonCost,
  lobsterTailUnit,
  lobsterTailCost,
  extraProteinsUnit,
  extraProteinsCost,
  noodlesUnit,
  noodlesCost,
  gyozaUnit,
  gyozaCost,
  edamameUnit,
  edamameCost,
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6">Your Estimated Price</h2>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-lg font-medium">📍 ZIP Code</label>
          <input
            type="text"
            value={zipcode}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 cursor-not-allowed"
          />
          <p className="text-sm text-[#4B5563]">This ZIP code was entered in Step 1 and will affect the travel fee.</p>
        </div>
        <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-xl font-bold mb-3">Your Estimated Price</h3>
          <div className="space-y-2">
            {adults > 0 && (
              <div className="flex justify-between">
                <span>Adults ({adults} x ${adultsUnit})</span>
                <span>${adultsCost}</span>
              </div>
            )}
            {kids > 0 && (
              <div className="flex justify-between">
                <span>Children ({kids} x ${kidsUnit})</span>
                <span>${kidsCost}</span>
              </div>
            )}
            {filetMignon > 0 && (
              <div className="flex justify-between">
                <span>Filet Mignon ({filetMignon} x ${filetMignonUnit})</span>
                <span>${filetMignonCost}</span>
              </div>
            )}
            {lobsterTail > 0 && (
              <div className="flex justify-between">
                <span>Lobster Tail ({lobsterTail} x ${lobsterTailUnit})</span>
                <span>${lobsterTailCost}</span>
              </div>
            )}
            {extraProteins > 0 && (
              <div className="flex justify-between">
                <span>Extra Proteins ({extraProteins} x ${extraProteinsUnit})</span>
                <span>${extraProteinsCost}</span>
              </div>
            )}
            {noodles > 0 && (
              <div className="flex justify-between">
                <span>Noodles ({noodles} x ${noodlesUnit})</span>
                <span>${noodlesCost}</span>
              </div>
            )}
            {gyoza > 0 && (
              <div className="flex justify-between">
                <span>Gyoza ({gyoza} x ${gyozaUnit})</span>
                <span>${gyozaCost}</span>
              </div>
            )}
            {edamame > 0 && (
              <div className="flex justify-between">
                <span>Edamame ({edamame} x ${edamameUnit})</span>
                <span>${edamameCost}</span>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="flex justify-between">
                <span>Travel Fee</span>
                <span>${travelFee}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t-2 border-amber-700 font-bold">
              {usedMinimum && (
                <div className="flex justify-between text-sm text-amber-600 font-semibold mb-1">
                  <span>Minimum Spending Adjustment</span>
                  <span>${minimumSpending.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg">
                <span>Total</span>
                <span>${total}</span>
              </div>
              {usedMinimum && (
                <div className="text-xs text-amber-600 mt-1 text-right">
                  (Your total was adjusted to meet the minimum spending requirement of ${minimumSpending.toFixed(2)})
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="pt-4 space-y-3">
        <button
          onClick={onNext}
          disabled={!isEstimationValid}
          className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          Yes, I want to book this!
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

export default Step5Estimate;
