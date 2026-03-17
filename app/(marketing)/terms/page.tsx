import type { Metadata } from "next";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Terms of Service | UnitasFund",
    robots: { index: false, follow: false },
  };
}

export default function TermsPage() {
  return (
    <article className="rounded-2xl border p-6 sm:p-10" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
          UnitasFund
        </p>
        <h1 className="text-3xl font-bold mb-2" style={{ color: NAVY }}>
          Terms of Service
        </h1>
        <p className="text-sm" style={{ color: "#6b7280" }}>
          Last updated: March 2026
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed" style={{ color: "#374151" }}>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            1. About UnitasFund
          </h2>
          <p>
            UnitasFund is provided by UnitasConnect (Noel Collins, sole trader), Cumbria, UK. By creating an account you agree to these terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            2. The service
          </h2>
          <p>
            UnitasFund provides funding intelligence, grant matching, and pipeline management tools for organisations seeking funding in the UK.
          </p>
          <p className="mt-2">
            We do not guarantee that any grant opportunity listed will result in a successful application or award.
          </p>
          <p className="mt-2">
            Data on the platform is sourced from publicly available information and is provided for informational purposes. Always verify eligibility and deadlines directly with the funder.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            3. Your account
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You are responsible for maintaining the security of your account.</li>
            <li>
              You must not share login credentials or use the platform on behalf of others without an appropriate subscription plan.
            </li>
            <li>
              You must provide accurate information when creating your organisation profile — inaccurate profiles will produce poor matches.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            4. Acceptable use
          </h2>
          <p>You may not use UnitasFund to:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Scrape, copy or redistribute the platform&apos;s data</li>
            <li>Attempt to reverse-engineer the scoring system</li>
            <li>Use the platform for any unlawful purpose</li>
            <li>Create multiple free accounts to circumvent plan limits</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            5. Subscription and billing
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Free tier: available to all registered users, subject to feature limits.</li>
            <li>
              Paid plans: billed monthly via Stripe. Cancel any time — no refunds for partial months already paid.
            </li>
            <li>We reserve the right to change pricing with 30 days notice to existing subscribers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            6. Data accuracy
          </h2>
          <p>We make reasonable efforts to keep funding opportunity data accurate and up to date. However:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Grant deadlines, amounts and eligibility can change without notice</li>
            <li>
              We are not liable for any loss arising from reliance on data displayed on the platform
            </li>
            <li>
              Always verify critical information directly with the funder before submitting an application
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            7. Limitation of liability
          </h2>
          <p>
            To the maximum extent permitted by law, UnitasConnect&apos;s liability to you is limited to the amount you paid for the service in the 12 months preceding the claim.
          </p>
          <p className="mt-2">We are not liable for indirect, consequential or economic losses.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            8. Termination
          </h2>
          <p>We may suspend or terminate accounts that breach these terms.</p>
          <p className="mt-2">You may delete your account at any time via Settings.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            9. Governing law
          </h2>
          <p>
            These terms are governed by the law of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            10. Contact
          </h2>
          <p>
            UnitasConnect |{" "}
            <a href="mailto:unitasconnect@hotmail.com" className="font-semibold hover:underline" style={{ color: GOLD }}>
              unitasconnect@hotmail.com
            </a>{" "}
            |{" "}
            <a
              href="https://www.unitasconnect.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline"
              style={{ color: GOLD }}
            >
              www.unitasconnect.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}

