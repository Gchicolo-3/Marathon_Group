import './globals.css';

export const metadata = {
  title: 'Marathon Group CRM',
  description: 'Prospect pipeline dashboard for Marathon Group LLC',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <a href="/" className="brand">Marathon Group <span>CRM</span></a>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
