import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | Real Hibachi",
  description: "Learn about how Real Hibachi protects and handles your personal information.",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Privacy Policy</h1>
            <div className="w-24 h-1 bg-orange-500 mx-auto"></div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                We value your privacy. Any personal information you provide (such as your name, email, or phone number)
                will be used only to contact you regarding your inquiry or booking. We do not share your information
                with third parties.
              </p>

              <p className="text-gray-700 leading-relaxed">
                For any questions about your data, you may contact us at{" "}
                <a href="mailto:info@realhibachi.com" className="text-orange-600 hover:text-orange-700 font-medium">
                  info@realhibachi.com
                </a>
                .
              </p>
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4">
                  Last updated:{" "}
                  {new Date().toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <div className="flex justify-center space-x-4">
                  <a href="/contact" className="text-orange-600 hover:text-orange-700 font-medium">
                    Contact Us
                  </a>
                  <span className="text-gray-300">|</span>
                  <a href="/" className="text-orange-600 hover:text-orange-700 font-medium">
                    Back to Home
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
