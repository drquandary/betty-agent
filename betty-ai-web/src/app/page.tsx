import { AppShell } from '@/components/AppShell';

export default function HomePage() {
  // Server-only read so NEXT_PUBLIC_ isn't needed on the client.
  const deployTarget = process.env.NEXT_PUBLIC_BETTY_DEPLOY_TARGET ?? 'local';
  return <AppShell deployTarget={deployTarget} />;
}
