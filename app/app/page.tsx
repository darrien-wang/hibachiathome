import type { Metadata } from "next"
import Link from "next/link"
import { phone } from "@/config/site"

// Purpose page for the "Real Hibachi" OAuth application (Google Cloud project
// branding). Google's brand-verification reviewers open the "Application home
// page" and need a plain statement of what the app does and which Google data
// it touches. The marketing homepage cannot carry that, so this page is the
// app's home page. Kept out of search: it is documentation, not a landing page.
export const metadata: Metadata = {
  title: "Real Hibachi App | Purpose and Data Use",
  description:
    "What the Real Hibachi application does: an internal marketing tool used by Real Hibachi LLC to manage its own Google Ads account and reporting.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://www.realhibachi.com/app" },
}

export default function AppPurposePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="page-container container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Real Hibachi App</h1>
            <p className="text-lg text-gray-600">Purpose, Google data use, and who can sign in</p>
            <div className="w-24 h-1 bg-orange-500 mx-auto mt-4"></div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
            <div className="prose prose-lg max-w-none">
              <h2 className="text-2xl font-bold text-gray-800 mt-2 mb-4">What this application is</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                <strong>Real Hibachi</strong> is the internal marketing and operations application of Real Hibachi
                LLC, the private hibachi chef and catering company behind{" "}
                <Link href="/" className="text-orange-600 underline">
                  realhibachi.com
                </Link>
                . Our team uses it to run our own business. It is a first-party tool: there are no customer accounts,
                no third-party users, and nothing to download.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">What it does</h2>
              <ul className="list-disc pl-6 mb-6 text-gray-700">
                <li className="mb-2">
                  <strong>Manages our own Google Ads account</strong> through the Google Ads API: campaigns, ad groups,
                  keywords, budgets, ad copy, and performance reports for the advertising we run for Real Hibachi.
                </li>
                <li className="mb-2">
                  <strong>Builds internal reports</strong> that combine our advertising spend with our own booking
                  records, so we can see which campaigns lead to real parties.
                </li>
                <li className="mb-2">
                  <strong>Reads reporting data</strong> from our own Google Analytics and Search Console properties for
                  the same reporting purpose.
                </li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">Google data it accesses, and why</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                When a member of our staff signs in with Google, the application asks for permission to access the
                Google Ads account owned by Real Hibachi LLC. It uses that access only to manage and report on our own
                advertising. It does not access Gmail, Drive, Contacts, Calendar, or any other personal data of the
                person signing in.
              </p>
              <ul className="list-disc pl-6 mb-6 text-gray-700">
                <li className="mb-2">
                  <strong>Google Ads</strong> (read and write): our campaigns, keywords, budgets, ads, and performance
                  metrics.
                </li>
                <li className="mb-2">
                  <strong>Google Analytics and Search Console</strong> (read only): traffic and search reports for
                  realhibachi.com.
                </li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">Who can sign in</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                Only Real Hibachi LLC staff accounts. The Google sign-in exists so that our own team can authorize the
                tool to work with the company&apos;s Google Ads account. Customers never sign in to this application;
                customers book parties through the public website, by text, or by phone.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">How the data is handled</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Data retrieved from Google APIs stays within Real Hibachi&apos;s own systems and is used solely to
                operate and report on our advertising. We do not sell it, share it with third parties, use it for
                advertising to other people, or use it to train machine-learning models. Our use of information
                received from Google APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 underline"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
              <p className="text-gray-700 leading-relaxed mb-6">
                Full details are in our{" "}
                <Link href="/privacy-policy" className="text-orange-600 underline">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" className="text-orange-600 underline">
                  Terms of Service
                </Link>
                .
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">Contact</h2>
              <p className="text-gray-700 leading-relaxed mb-2">
                Real Hibachi LLC, Southern California
              </p>
              <p className="text-gray-700 leading-relaxed mb-2">
                Email:{" "}
                <a href="mailto:support@realhibachi.com" className="text-orange-600 underline">
                  support@realhibachi.com
                </a>
              </p>
              <p className="text-gray-700 leading-relaxed mb-2">
                Phone:{" "}
                <a href={phone.voice.tel} className="text-orange-600 underline">
                  {phone.voice.display}
                </a>
              </p>
              <p className="text-gray-700 leading-relaxed">
                Website:{" "}
                <Link href="/" className="text-orange-600 underline">
                  https://www.realhibachi.com
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
