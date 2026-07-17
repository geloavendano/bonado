import { PageShell } from "@/components/layout/PageShell";
import { ScreenHeader } from "@/components/ui/ScreenHeader";

function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <ScreenHeader title={title} />
      <article className="flex flex-col gap-5 pb-16 pt-4 text-[13.5px] leading-relaxed text-secondary">
        <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-faint">
          Effective July 5, 2026
        </p>
        {children}
      </article>
    </PageShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[15px] font-extrabold text-ink">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Bonado stores the information needed to create shared trips, divide
        expenses, calculate balances, and coordinate with trip members.
      </p>
      <Section title="Information we process">
        <p>
          This includes your Google account name, email, profile photo and
          identifier; trip membership and invitations; expenses, payment
          methods and settlements; comments and mentions; uploaded receipts;
          selected currencies, theme preference, and notification read state.
        </p>
      </Section>
      <Section title="How information is used">
        <p>
          We use it to authenticate you, provide trip features, calculate and
          display balances, send in-app notifications, preserve transaction
          history, and maintain security and reliability.
        </p>
      </Section>
      <Section title="Sharing and service providers">
        <p>
          Trip information is visible to members of that trip. Bonado relies
          on Supabase for authentication, database and file storage; Vercel
          for hosting; Google for sign-in and place search; Unsplash for
          optional cover imagery; and exchange-rate services for conversions.
          These providers process data under their own terms and policies.
        </p>
      </Section>
      <Section title="Retention and control">
        <p>
          Transaction records remain while their trip exists so balances stay
          accurate. In-app notification rows are removed after six months.
          Trip owners can delete trips; users can leave non-owned trips.
          Browser storage may retain interface preferences and offline data
          until cleared.
        </p>
      </Section>
      <Section title="Security and changes">
        <p>
          Access controls restrict trip data to members, but no online service
          can guarantee absolute security. This policy may be updated as
          Bonado changes; the effective date above will be revised.
        </p>
      </Section>
    </LegalPage>
  );
}

export function TermsConditions() {
  return (
    <LegalPage title="Terms & conditions">
      <p>
        By using Bonado, you agree to these terms. If you do not agree, do not
        use the service.
      </p>
      <Section title="Using Bonado">
        <p>
          You are responsible for your account, the accuracy of information
          you enter, and inviting only people who should access a trip. Do not
          misuse the service, attempt unauthorized access, upload unlawful
          content, or interfere with other users.
        </p>
      </Section>
      <Section title="Financial information">
        <p>
          Bonado is a record-keeping and calculation tool, not a bank,
          payment processor, accountant, or financial adviser. Currency
          conversions may use estimated or delayed rates. Trip members remain
          responsible for confirming amounts and completing payments.
        </p>
      </Section>
      <Section title="Your content">
        <p>
          You retain ownership of content you submit. You permit Bonado to
          store, process, and display it as needed to operate the service for
          you and the members of your trips.
        </p>
      </Section>
      <Section title="Availability and liability">
        <p>
          The service is provided as available and may change, experience
          interruptions, or contain errors. To the extent permitted by law,
          Bonado is not liable for indirect losses, missed payments, disputes
          between trip members, or decisions based on estimated calculations.
        </p>
      </Section>
      <Section title="Termination and changes">
        <p>
          Access may be limited for abuse or security reasons. You may stop
          using Bonado at any time. These terms may be updated as the service
          evolves; continued use after an update means you accept the revised
          terms.
        </p>
      </Section>
    </LegalPage>
  );
}


export function DeleteAccountInfo() {
  return (
    <LegalPage title="Delete your account">
      <p>
        You can permanently delete your Bonado account and sign-in from inside
        the app at any time.
      </p>
      <Section title="How to delete your account">
        <p>
          Sign in, open the Dashboard, tap your avatar in the top-right
          corner, and choose "Delete account". After you confirm, your account
          and sign-in credentials are removed immediately.
        </p>
      </Section>
      <Section title="What happens to your data">
        <p>
          Your profile, sign-in identity, payment accounts, notifications, and
          personal preferences are deleted. Trips where you are the only
          member are deleted entirely, including their expenses and receipts.
          In trips you share with other people, the expenses and settlements
          you took part in remain visible to those members under an unclaimed
          placeholder carrying your display name, so their balances stay
          correct — this retained ledger data is no longer linked to any
          sign-in identity.
        </p>
      </Section>
      <Section title="Questions">
        <p>
          If you cannot access the app to delete your account, contact support
          through the store listing and we will process the deletion for you.
        </p>
      </Section>
    </LegalPage>
  );
}

export function SupportInfo() {
  return (
    <LegalPage title="Support">
      <p>
        Bonado is currently maintained as an early-access app for coordinating
        shared trip expenses with friends and groups.
      </p>
      <Section title="Getting help">
        <p>
          For account, invite, trip, expense, settlement, or data deletion
          questions, contact Bonado support at{" "}
          <a className="font-bold text-teal" href="mailto:support@bonado.app">
            support@bonado.app
          </a>
          .
        </p>
      </Section>
      <Section title="What to include">
        <p>
          Please include the email address you use to sign in, the trip name
          if the issue is trip-specific, screenshots when useful, and a short
          description of what happened versus what you expected.
        </p>
      </Section>
      <Section title="Response expectations">
        <p>
          During early access, support is handled manually. We prioritize
          sign-in problems, incorrect balance calculations, invite issues,
          and account deletion requests.
        </p>
      </Section>
      <Section title="Legal pages">
        <p>
          You can review the Bonado privacy policy, terms, and account
          deletion information from the account menu in the app.
        </p>
      </Section>
    </LegalPage>
  );
}
