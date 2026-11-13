export const metadata = { title: 'Terms of Service, Marathon Group' };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-6 text-sm leading-relaxed text-muted-foreground">
      <h1 className="text-xl font-semibold text-foreground">Terms of Service</h1>
      <p>Last updated November 13, 2026.</p>
      <p>
        This dashboard is a private tool provided by Chicolo Consultative CoLab to Marathon Group LLC. Access is limited to
        approved accounts.
      </p>
      <p>
        You stay in control of everything sent. The app drafts notes; nothing is sent until you review it and tap Send.
        You are responsible for the content of the messages you send and for only contacting people you have a
        relationship with.
      </p>
      <p>
        The service is provided as is, without warranties. We may change or discontinue features with notice. You can stop
        using it and disconnect Gmail at any time in Settings.
      </p>
      <p>
        See the <a href="/privacy" className="underline">Privacy Policy</a> for how data is handled.
      </p>
    </article>
  );
}
