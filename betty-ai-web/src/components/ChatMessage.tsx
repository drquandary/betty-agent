'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { isWikiHref, transformWikiLinks, WikiLinkAnchor } from './WikiLink';

export interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

interface Props {
  message: DisplayMessage;
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-amber-500/20 text-[13px] font-semibold text-indigo-200 ring-1 ring-white/10 shadow-lg shadow-indigo-950/40">
          B
        </div>
      )}
      <div
        className={cn(
          'prose-chat max-w-[82%] rounded-2xl px-4 py-3 shadow-sm',
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-950/30'
            : 'rounded-bl-md border border-white/5 bg-[var(--surface-chat-assistant)] text-zinc-100',
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children, ...rest }) =>
              isWikiHref(href) ? (
                <WikiLinkAnchor href={href!}>{children}</WikiLinkAnchor>
              ) : (
                <a href={href} {...rest}>
                  {children}
                </a>
              ),
          }}
        >
          {transformWikiLinks(message.content) || (message.streaming ? '…' : '')}
        </ReactMarkdown>
        {message.streaming && (
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-300" />
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 flex-shrink-0 select-none items-center justify-center rounded-full bg-zinc-800/80 text-[13px] font-semibold text-zinc-300 ring-1 ring-white/10 shadow-lg shadow-black/30">
          J
        </div>
      )}
    </div>
  );
}
