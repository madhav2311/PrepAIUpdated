import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrepAI - Interview & Group Discussion Coach',
  description: 'High-end AI mock interview and multi-agent debate platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}