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
                At Real Hibachi, your privacy is important to us. This Privacy Policy outlines how we collect, use, and
                protect your information when you use our website and services.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">1. Information We Collect</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We may collect and process the following types of information:
              </p>
              <ul className="list-disc pl-6 mb-6">
                <li className="mb-2">
                  <strong>Personal Information:</strong> Name, email address, phone number, and any other details you
                  provide when making a booking or contacting us.
                </li>
                <li className="mb-2">
                  <strong>Payment Information:</strong> When you make a payment, your payment details are securely
                  processed by third-party payment providers—we do not store your full payment information.
                </li>
                <li className="mb-2">
                  <strong>Automatically Collected Information:</strong> This includes IP address, device type, browser,
                  pages visited, and other analytics data gathered through cookies and similar technologies.
                </li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 mb-6">
                <li className="mb-2">Confirm and manage bookings.</li>
                <li className="mb-2">Provide customer support and respond to your inquiries.</li>
                <li className="mb-2">Improve our services and website functionality.</li>
                <li className="mb-2">Send promotional updates (only if you choose to opt-in).</li>
                <li className="mb-2">Fulfill legal and regulatory requirements.</li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">3. Sharing Your Information</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                We do not sell, rent, or trade your personal data. We may share your information only in the following
                cases:
              </p>
              <ul className="list-disc pl-6 mb-6">
                <li className="mb-2">
                  <strong>With Trusted Service Providers:</strong> Such as payment processors, analytics platforms, and
                  marketing tools, strictly for business operations.
                </li>
                <li className="mb-2">
                  <strong>Legal Obligations:</strong> When required to comply with applicable laws or protect our rights
                  and customers.
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mb-6">
                Text messaging originator opt-in data and consent will not be shared with any third parties or
                affiliates for marketing purposes.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">4. Cookies and Tracking</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                We use cookies and similar technologies to enhance your experience and gather usage analytics. You may
                adjust your browser settings to disable cookies, but this may affect some features on our site.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">5. Data Security</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                We implement industry-standard safeguards to protect your personal information. While we strive to
                secure all data, no method of transmission over the internet is entirely secure.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">6. Your Rights and Choices</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc pl-6 mb-6">
                <li className="mb-2">Access or update your personal data.</li>
                <li className="mb-2">Request deletion of your information.</li>
                <li className="mb-2">Opt out of promotional communications at any time.</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mb-6">
                To exercise any of these rights, please contact us at the email below.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">7. Third-Party Links</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                Our website may contain links to third-party sites. We are not responsible for the privacy practices of
                those sites and recommend reviewing their policies individually.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">8. Policy Updates</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                We may revise this Privacy Policy from time to time. Updates will be posted on this page with the
                revised effective date.
              </p>

              <p className="text-gray-700 leading-relaxed">
                For any questions about your data, you may contact us at{" "}
                <a
                  href="mailto:realhibachiathome@gmail.com"
                  className="text-orange-600 hover:text-orange-700 font-medium"
                >
                  realhibachiathome@gmail.com
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
