/** @type {import('next').NextConfig} */
const nextConfig = {
  // Node.js runtime for API routes that need filesystem + child_process access
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Required so the Claude Agent SDK (which uses native Node modules)
  // isn't bundled into Edge runtime
  serverExternalPackages: ['@anthropic-ai/claude-agent-sdk'],
};

export default nextConfig;
