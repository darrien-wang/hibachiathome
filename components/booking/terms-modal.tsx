import React from "react"

export function TermsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="relative bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] sm:max-h-[80vh] overflow-y-auto mx-2">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none z-10"
          style={{ lineHeight: 1 }}
        >
          ×
        </button>
        <h3 className="text-xl font-bold mb-4 text-center">Terms & Conditions</h3>
        <div className="prose prose-sm space-y-6">
          <div>
            <p className="font-medium">PLEASE TAKE NOTICE:</p>
            <p>
              Real Hibachi, Inc., or any agent, employee, director, or representative of Real Hibachi, Inc., will NOT
              be liable to any Licensee (Host) or Licensee's guests for property damage caused as a result of any
              party held on the Licensee's (Hosts) premises. For the purpose of this paragraph "property damage" is
              defined as: injury to any real or personal property on the premises of where the Real Hibachi event is
              taking place. Furthermore, Licensee (Host), individually and for Licensee's guests, waives any claim
              against Real Hibachi, Inc. for any loss of, or damage or destruction to, property of Licensee (Host) or
              Licensee's guests, arising from any cause. This waiver is intended to be a complete release of any
              responsibility for property loss or damage or destruction to the property sustained by the Licensee or
              Licensee's guests before, during, or after the Real Hibachi Inc. event has taken place.
            </p>
          </div>
          <div>
            <p className="font-medium">Communication Consent</p>
            <p>
              I agree to receive communications by text message about my inquiry. You may opt-out by replying STOP
              or reply HELP for more information. Message frequency varies. Message and data rates may apply. You
              may review our Privacy Policy to learn how your data is used.
            </p>
          </div>
          <div>
            <p className="font-medium">Cancelation Policy & Weather Policy</p>
            <p>
              48 hours notice for all cancellations and rescheduled parties or guest will be charged a fee of
              $100.00. If it rains, customer is required to provide some type of covering for the chef to cook under
              so they can stay dry. We can cook under tents, and patios. Customer is responsible for canceling due
              to inclement weather within 48 hours of your party.
            </p>
          </div>
          <div>
            <p className="font-medium">Travel Fee Policy</p>
            <p>
              PLEASE NOTE: The Following Locations Require A Travel Fee And/ Or Larger Minimum. 1 Travel Fee Per
              Chef.
            </p>
            <p>Updating Travel Fees, a Booking Manager will let you know if your city requires one!</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
