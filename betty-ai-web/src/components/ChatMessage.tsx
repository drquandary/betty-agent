'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

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
    <div className={cn('flex gap-2', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 select-none items-center justify-center rounded-md bg-indigo-600/20 text-sm text-indigo-300 ring-1 ring-indigo-500/30">
          B
        </div>
      )}
      <div
        className={cn(
          'prose-chat max-w-[80%] rounded-2xl px-3.5 py-2.5 text-slate-100',
          isUser
            ? 'rounded-br-sm bg-indigo-600/90 shadow-sm'
            : 'rounded-bl-sm border border-slate-800 bg-slate-900/70',
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content || (message.streaming ? '…' : '')}
        </ReactMarkdown>
        {message.streaming && (
          <span className="ml-1 inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-300" />
        )}
      </div>
      {isUser && (
        <div className="flex h-7 w-7 flex-shrink-0 select-none items-center justify-center rounded-md bg-slate-700/60 text-sm text-slate-300 ring-1 ring-slate-600/40">
          J
        </div>
      )}
    </div>
  );
}
