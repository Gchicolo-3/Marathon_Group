import Link from 'next/link';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { MainNav } from '../components/main-nav';
import { HeaderClock } from '../components/header-clock';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata = {
  title: 'Marathon Group CRM',
  description: 'Pipeline CRM for Marathon Group LLC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-10 border-b border-white/[0.07] bg-[#0B1120]/85 px-6 backdrop-blur-xl lg:px-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-gradient-to-br from-[#2E63E8] to-[#5B8CFF] text-[15px] font-bold text-white">
              M
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-[0.01em]">Marathon Group</span>
              <span className="mt-[3px] font-mono text-[9.5px] tracking-[0.22em] text-[#5F6B85]">
                CRM
              </span>
            </div>
          </Link>
          <MainNav />
          <div className="ml-auto flex items-center gap-4">
            <HeaderClock />
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-white/10 bg-[#1A2338] text-[11px] font-semibold text-[#9DB4E8]">
              MS
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
