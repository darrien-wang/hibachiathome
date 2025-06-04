import React from "react";

interface Step1PartySizeProps {
  name: string;
  email: string;
  phone: string;
  zipcode: string;
  adults: string;
  kids: string;
  onInputChange: (field: string, value: string) => void;
  onNumberChange: (field: string, value: string) => void;
  onNumberBlur: (field: string, value: string) => void;
  onDecrement: (field: string) => void;
  onIncrement: (field: string) => void;
  onNext: () => void;
  disableNext: boolean;
}

const Step1PartySize: React.FC<Step1PartySizeProps> = ({
  name,
  email,
  phone,
  zipcode,
  adults,
  kids,
  onInputChange,
  onNumberChange,
  onNumberBlur,
  onDecrement,
  onIncrement,
  onNext,
  disableNext,
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6">Your Info & Party Size</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-lg font-medium">Full Name*</label>
          <input
            type="text"
            value={name}
            onChange={e => onInputChange("name", e.target.value)}
            placeholder="Your full name"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-lg font-medium">Email Address*</label>
          <input
            type="email"
            value={email}
            onChange={e => onInputChange("email", e.target.value)}
            placeholder="your.email@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-lg font-medium">Phone Number*</label>
          <input
            type="tel"
            value={phone}
            onChange={e => onInputChange("phone", e.target.value)}
            placeholder="(123) 456-7890"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-lg font-medium">ZIP Code*</label>
          <input
            type="text"
            value={zipcode}
            onChange={e => onInputChange("zipcode", e.target.value)}
            placeholder="Example: 10001"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E] bg-white"
            maxLength={5}
            required
          />
          <p className="text-sm text-[#4B5563] mt-1">Please enter the ZIP code where you plan to host the event. This will affect the travel fee.</p>
        </div>
      </div>
      <div className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="block text-lg font-medium">👤 How many adults? (13 years and older)</label>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onDecrement("adults")}
              className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
              aria-label="Decrease adult count"
            >
              -
            </button>
            <input
              type="number"
              value={adults}
              onChange={e => onNumberChange("adults", e.target.value)}
              onBlur={e => onNumberBlur("adults", e.target.value)}
              className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
              min="0"
              max="99"
              pattern="\\d*"
            />
            <button
              type="button"
              onClick={() => onIncrement("adults")}
              className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
              aria-label="Increase adult count"
            >
              +
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-lg font-medium">👶 How many children? (12 years and under)</label>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onDecrement("kids")}
              className="px-4 py-2 bg-[#4B5563] rounded-l-md hover:bg-[#374151] text-white"
              aria-label="Decrease children count"
            >
              -
            </button>
            <input
              type="number"
              value={kids}
              onChange={e => onNumberChange("kids", e.target.value)}
              onBlur={e => onNumberBlur("kids", e.target.value)}
              className="w-16 text-center py-2 border-y border-gray-300 bg-[#F9FAFB] text-[#111827] font-medium"
              min="0"
              max="99"
              pattern="\\d*"
            />
            <button
              type="button"
              onClick={() => onIncrement("kids")}
              className="px-4 py-2 bg-[#4B5563] rounded-r-md hover:bg-[#374151] text-white"
              aria-label="Increase children count"
            >
              +
            </button>
          </div>
          <p className="text-sm text-[#4B5563]">(Note: Children under 3 are free, no need to include)</p>
        </div>
      </div>
      <div className="pt-2">
        <button
          onClick={onNext}
          disabled={disableNext}
          className="w-full py-3 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          Next Step
        </button>
      </div>
      <div className="mt-4 text-sm text-[#4B5563] text-center">
        <p>Be sure to fill in your primary <b>CELL PHONE</b> and email address.</p>
        <p className="mt-1">Please rest assured that we respect and protect your privacy. You can review our privacy policy at the bottom of our website.</p>
      </div>
    </div>
  );
};

export default Step1PartySize;
