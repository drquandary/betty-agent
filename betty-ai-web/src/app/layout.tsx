import type { Metadata } from 'next';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Betty AI',
  description:
    'Conversational assistant for the PARCC Betty HPC cluster — ask questions, submit jobs, explore the wiki.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
