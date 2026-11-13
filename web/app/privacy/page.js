export const metadata = { title: 'Privacy Policy, Marathon Group' };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 py-6 text-sm leading-relaxed text-muted-foreground">
      <h1 className="text-xl font-semibold text-foreground">Privacy Policy</h1>
      <p>Last updated November 13, 2026.</p>
      <p>
        This dashboard is a private tool built by Chicolo Consultative CoLab for Marathon Group LLC. It helps the account
        owner keep in touch with people already in their own professional network. Only email addresses the owner has
        approved can sign in.
      </p>
      <h2 className="pt-2 text-base font-semibold text-foreground">What we access from Google</h2>
      <p>
        When you sign in with Google and approve access, the app uses two Gmail permissions. Send (gmail.send) is used only
        to send a note you have reviewed and tapped Send on, from your own address. Read (gmail.readonly) is used only to
        check the threads of notes this app sent, to see whether the person replied, and to read your own address. The app
        does not read, store, or scan the rest of your inbox.
      </p>
      <h2 className="pt-2 text-base font-semibold text-foreground">What we store</h2>
      <p>
        Your Google sign in tokens, encrypted. The contacts you import, the notes the app drafts, notes you send, and a
        short snippet of any reply to those notes. Writing samples you paste in so drafts match your voice. This data lives
        in a private database for your account only.
      </p>
      <h2 className="pt-2 text-base font-semibold text-foreground">How we use it</h2>
      <p>
        Only to run this tool for you. Note drafts are written with an AI model (Anthropic Claude), which receives the
        contact details and writing samples needed to draft a note. We do not sell or share your data, use it for ads, or
        use Google user data to train AI models. Use of information received from Google APIs follows the Google API
        Services User Data Policy, including the Limited Use requirements.
      </p>
      <h2 className="pt-2 text-base font-semibold text-foreground">Your control</h2>
      <p>
        You can disconnect Gmail at any time in Settings, or revoke access at myaccount.google.com/permissions.
        Disconnecting deletes the stored tokens. To have all of your data deleted, ask us and we will remove it.
      </p>
      <h2 className="pt-2 text-base font-semibold text-foreground">Contact</h2>
      <p>Chicolo Consultative CoLab, Hillsdale, NJ. Reach out through the contact listed on the Google sign in screen.</p>
    </article>
  );
}
