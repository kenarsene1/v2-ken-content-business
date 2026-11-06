import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { assistantIdentity } from '@/lib/assistant.functions';
import { Button } from '@/components/ui/button';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';

/** The "Ask" view of the assistant pop-up. Loaded lazily by assistant-popover.tsx. */
export function AssistantAsk() {
  const loadIdentity = useServerFn(assistantIdentity);
  const identity = useQuery({ queryKey: ['assistant-identity'], queryFn: () => loadIdentity(), staleTime: Infinity });
  if (!identity.data) return <p role="status" className="py-6 text-center text-xs text-muted-foreground">{identity.isError ? 'Please sign in again to use the assistant.' : 'Opening your conversation…'}</p>;
  return <AssistantChat key={identity.data.userId} userId={identity.data.userId} />;
}

function AssistantChat({ userId }: { userId: string }) {
  const storageKey = `my-content-crm-assistant:${userId}`;
  const [initialMessages] = useState<UIMessage[]>(() => {
    try { const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(saved) ? saved.filter(m => m && typeof m.id === 'string' && ['user', 'assistant'].includes(m.role) && Array.isArray(m.parts)) : []; }
    catch { return []; }
  });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState('');
  const [storageError, setStorageError] = useState(false);
  const transport = useMemo(() => new DefaultChatTransport({ api: '/api/assistant', fetch: async (url, init) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Please sign in to use the assistant.');
    const headers = new Headers(init?.headers); headers.set('Authorization', `Bearer ${data.session.access_token}`);
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.error === 'string' ? body.error : 'The assistant is unavailable. Please try again later.');
    }
    return response;
  } }), []);
  const { messages, sendMessage, status, error, stop, setMessages } = useChat({ id: `assistant:${userId}`, messages: initialMessages, transport });
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [messages, storageKey]);
  useEffect(() => { if (!busy) textarea.current?.focus(); }, [busy]);
  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <Conversation className="min-h-0"><ConversationContent className="gap-4 px-1 py-1">
      {!messages.length && <div className="py-6 text-center"><p className="text-sm font-medium">What’s next for your content?</p><p className="mt-1 text-[11px] text-muted-foreground">Ask about content, deals or money. Read-only.</p></div>}
      {messages.map(message => <Message key={message.id} from={message.role}><MessageContent>{message.parts.map((part, index) => part.type === 'text' ? <MessageResponse key={index} isAnimating={busy && message.role === 'assistant'}>{part.text}</MessageResponse> : null)}</MessageContent></Message>)}
      {status === 'submitted' && <Shimmer>Reading your workspace…</Shimmer>}
    </ConversationContent><ConversationScrollButton /></Conversation>
    {error && <p role="alert" className="text-xs text-destructive">{error.message}</p>}
    {storageError && <p role="alert" className="text-xs text-destructive">Browser storage is full; this chat may not be saved.</p>}
    <PromptInput onSubmit={async ({ text }) => {
      if (busy || !text.trim()) return;
      setInput(''); textarea.current?.focus();
      await sendMessage({ text: text.trim() });
    }}><PromptInputTextarea ref={textarea} value={input} onChange={event => setInput(event.target.value)} aria-label="Message your assistant" placeholder="Ask anything…" className="min-h-10 text-sm" /><PromptInputFooter className="justify-between py-1">
      <Button type="button" variant="ghost" size="icon-sm" title="Clear conversation" aria-label="Clear conversation" className="text-muted-foreground" disabled={busy || !messages.length} onClick={() => { if (window.confirm('Clear this conversation from this browser?')) setMessages([]); }}><Trash2 className="h-3.5 w-3.5" /></Button>
      <PromptInputSubmit status={status} onStop={() => stop()} disabled={!busy && !input.trim()} />
    </PromptInputFooter></PromptInput>
  </div>;
}
