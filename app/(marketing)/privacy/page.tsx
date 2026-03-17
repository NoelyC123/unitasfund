import type { Metadata } from "next";
import Link from "next/link";

const NAVY = "#1a1f2e";
const GOLD = "#c9923a";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Privacy Policy | UnitasFund",
    robots: { index: false, follow: false },
  };
}

export default function PrivacyPolicyPage() {
  return (
    <article className="rounded-2xl border p-6 sm:p-10" style={{ borderColor: "#ece6dd", backgroundColor: "#fff" }}>
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: GOLD }}>
          UnitasFund
        </p>
        <h1 className="text-3xl font-bold mb-2" style={{ color: NAVY }}>
          Privacy Policy
        </h1>
        <p className="text-sm" style={{ color: "#6b7280" }}>
          Last updated: March 2026
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed" style={{ color: "#374151" }}>
        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            1. Who we are
          </h2>
          <p>
            UnitasFund is a trading name of UnitasConnect, based in Cumbria, UK.
          </p>
          <p className="mt-2">
            Contact:{" "}
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
          <p className="mt-2">Data controller: Noel Collins, UnitasConnect</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            2. What data we collect
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Account data</strong>: email address, password (hashed by Supabase Auth)
            </li>
            <li>
              <strong>Organisation profile</strong>: name, type, region, income band, sectors, funding goals
            </li>
            <li>
              <strong>Usage data</strong>: opportunities viewed, pipeline activity, alert preferences
            </li>
            <li>
              <strong>Technical data</strong>: IP address, browser type (via Vercel/Supabase logs)
            </li>
          </ul>
          <p className="mt-3">
            We do not collect payment card data directly — this is handled by Stripe, who are PCI-DSS compliant.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            3. Why we collect it and our legal basis
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>To provide the UnitasFund service (contract performance)</li>
            <li>
              To score and match your organisation to funding opportunities (contract performance)
            </li>
            <li>
              To send you email alerts about new matches (consent — you can withdraw at any time in{" "}
              <Link href="/settings" className="font-semibold hover:underline" style={{ color: GOLD }}>
                Settings
              </Link>
              )
            </li>
            <li>To improve the platform (legitimate interests)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            4. How long we keep it
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              Account and profile data: retained while your account is active, deleted within 30 days of account deletion request
            </li>
            <li>Usage logs: 90 days</li>
            <li>Email alert logs: 12 months</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            5. Who we share it with
          </h2>
          <p>We share data with the following trusted processors:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Supabase (database and authentication) — EU hosted</li>
            <li>Vercel (hosting and serverless functions) — EU region</li>
            <li>Resend (email delivery) — for alert emails only</li>
            <li>Stripe (payment processing) — for billing only</li>
          </ul>
          <p className="mt-3">We do not sell your data. We do not share it with advertisers.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            6. Your rights under UK GDPR
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-2 mt-2">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Withdraw consent for email alerts (via Settings → Alerts)</li>
            <li>
              Lodge a complaint with the ICO (
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:underline"
                style={{ color: GOLD }}
              >
                ico.org.uk
              </a>
              )
            </li>
          </ul>
          <p className="mt-3">
            To exercise your rights:{" "}
            <a href="mailto:unitasconnect@hotmail.com" className="font-semibold hover:underline" style={{ color: GOLD }}>
              unitasconnect@hotmail.com
            </a>
          </p>
        </section>

        <section id="cookies">
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            7. Cookies
          </h2>
          <p>
            We use essential cookies only (session management via Supabase Auth). We do not use advertising or tracking cookies.
          </p>
          <p className="mt-2">
            You can disable cookies in your browser settings, but this will prevent you from logging in.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            8. Changes to this policy
          </h2>
          <p>
            We will notify registered users of material changes by email. The &quot;last updated&quot; date at the top of this page will always reflect the current version.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2" style={{ color: NAVY }}>
            9. Contact
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

