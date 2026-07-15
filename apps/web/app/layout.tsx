import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Virtual Campus',
  description: 'A 3D office visualizing real Claude Code and Codex activity across projects.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
