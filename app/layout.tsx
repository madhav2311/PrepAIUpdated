import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrepAI - Interview & Group Discussion Coach',
  description: 'High-end AI mock interview and multi-agent debate platform',
};

// Apply saved theme before first paint so there is no dark flash on load.
// IMPORTANT: data-mode/data-palette are NOT rendered as React props on <html> —
// if they were, React would reset them to these defaults on every layout
// re-render, clobbering the user's saved theme. The script below owns them.
const themeInit = `
(function(){try{
  var m = localStorage.getItem('mode');
  document.documentElement.dataset.mode = (m === 'light') ? 'light' : 'dark';
  var p = localStorage.getItem('palette');
  document.documentElement.dataset.palette = ['aurora','ocean','grape'].indexOf(p) !== -1 ? p : 'aurora';
}catch(e){
  document.documentElement.dataset.mode = 'dark';
  document.documentElement.dataset.palette = 'aurora';
}})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}