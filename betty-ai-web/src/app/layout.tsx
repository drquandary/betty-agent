import type { Metadata } from 'next';
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
    <html lang="en" className="dark h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
