import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'Marathon Group CRM',
  description: 'Pipeline CRM for Marathon Group LLC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-10 border-b bg-slate-900 text-white">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
            <Link href="/" className="text-[15px] font-bold tracking-tight">
              Marathon Group <span className="font-medium text-blue-300">CRM</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-300">
              <Link href="/" className="transition-colors hover:text-white">Pipeline</Link>
              <Link href="/queue" className="transition-colors hover:text-white">Approval queue</Link>
              <Link href="/companies" className="transition-colors hover:text-white">Companies</Link>
              <Link href="/contacts" className="transition-colors hover:text-white">Contacts</Link>
              <Link href="/runs" className="transition-colors hover:text-white">Runs</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
