'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Send, X, Minimize2, Maximize2, Minus, ChevronDown, RefreshCw, GripVertical, Bot } from 'lucide-react';
import { AVATAR_ASSETS, AvatarState } from '@/lib/avatars';
import { chatAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { LoadingSpinner } from '@/components/ui/StatusBadges';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  mode?: string;
}

function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  if (isUser) {
    return <div className="whitespace-pre-wrap text-[#F4F3EC] font-medium">{content}</div>;
  }

  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 leading-relaxed" style={{ color: '#19382D' }}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        const renderInline = (str: string) => {
          const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
          return parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-bold" style={{ color: '#19382D' }}>
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={pIdx} className="px-1 py-0.5 rounded font-mono text-[11px]" style={{ background: '#E8F0EA', color: '#166534', border: '1px solid #C4D7C8' }}>
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          });
        };

        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.replace(/^[•\-*]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="mt-1 flex-shrink-0 text-[10px]" style={{ color: '#166534' }}>●</span>
              <span className="flex-1">{renderInline(bulletText)}</span>
            </div>
          );
        }

        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1 my-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold mt-0.5 flex-shrink-0" style={{ background: '#E8F0EA', color: '#19382D', border: '1px solid #C4D7C8' }}>
                {numMatch[1]}
              </span>
              <span className="flex-1">{renderInline(numMatch[2])}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="my-0.5">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

interface EcoAssistantProps {
  context?: { type: 'dashboard' | 'project' | 'map' | 'finding' | 'chat' | 'settings' | 'general'; projectId?: string; label?: string };
  currentTourStep?: number;
  tourActive?: boolean;
}

const CONTEXT_STARTERS: Record<string, string[]> = {
  dashboard: ['What can I investigate in EcoSentinel?', 'How do I create a new project?', 'What does a FER contain?'],
  project:   ["Summarize this project's findings.", 'What are the key evidence gaps?', 'What should the officer verify next?'],
  map:       ['What do Zone A and Zone B mean?', 'What is the candidate NDVI decline?', 'How are boundaries determined?'],
  finding:   ['What evidence supports this finding?', 'What contradicts this finding?', 'What follow-up checks are recommended?'],
  general:   ['What is EcoSentinel?', 'How do I start an investigation?', 'What data sources does EcoSentinel use?'],
};

export function EcoSentinelAssistant({ context, tourActive }: EcoAssistantProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(prev => {
      const next = !prev;
      if (next && pos.x >= 0) {
        const targetW = Math.min(740, window.innerWidth - 32);
        if (pos.x + targetW > window.innerWidth - 16) {
          setPos(p => ({
            ...p,
            x: Math.max(16, window.innerWidth - targetW - 24),
            y: Math.max(16, Math.min(p.y, window.innerHeight - 620)),
          }));
        }
      }
      return next;
    });
  };

  // ── Position state ────────────────────────────────────────
  // Stored as viewport-relative (left/top).  -1 = use default CSS (bottom-right).
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const dragState = useRef({
    active: false,
    moved: false,
    startMouseX: 0,
    startMouseY: 0,
    startElemX: 0,
    startElemY: 0,
    pointerId: -1,
  });

  const assistantRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Restore saved position ────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('eco-assistant-pos');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.x > 0 && p.y > 0) {
          setPos({
            x: Math.min(Math.max(12, p.x), window.innerWidth - 120),
            y: Math.min(Math.max(12, p.y), window.innerHeight - 140),
          });
        }
      }
    } catch { /* ignore */ }
  }, []);

  // ── Welcome message ───────────────────────────────────────
  useEffect(() => {
    if (open && messages.length === 0 && user) {
      const name = user.full_name?.split(' ')[0] || 'Officer';
      setMessages([{
        role: 'assistant',
        content: `Hello, ${name}! I'm EcoSentinel's case assistant. I can answer questions about environmental data, project findings, and investigation methodology.${context?.label ? ` Currently on: ${context.label}.` : ''} What would you like to know?`,
        mode: 'system',
      }]);
      setAvatarState('greeting');
      setTimeout(() => setAvatarState('idle'), 2000);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll & focus ───────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (open && !minimized) setTimeout(() => inputRef.current?.focus(), 150); }, [open, minimized]);

  // ── Drag — attaches to window for smooth, uninterrupted screen-wide movement ────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!assistantRef.current) return;

    // Don't drag if clicking buttons, inputs, links (unless explicit drag handle)
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, a') && !target.closest('[data-drag-handle]')) {
      return;
    }

    const rect = assistantRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const elemX = rect.left;
    const elemY = rect.top;
    let hasMoved = false;

    document.body.style.userSelect = 'none';

    const handlePointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      if (!hasMoved && Math.hypot(dx, dy) > 4) {
        hasMoved = true;
      }

      if (hasMoved && assistantRef.current) {
        const ew = assistantRef.current.offsetWidth || 100;
        const eh = assistantRef.current.offsetHeight || 120;
        const nx = Math.max(8, Math.min(window.innerWidth - ew - 8, elemX + dx));
        const ny = Math.max(8, Math.min(window.innerHeight - eh - 8, elemY + dy));
        setPos({ x: nx, y: ny });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.userSelect = '';

      if (hasMoved) {
        if (assistantRef.current) {
          const r = assistantRef.current.getBoundingClientRect();
          try {
            localStorage.setItem('eco-assistant-pos', JSON.stringify({ x: r.left, y: r.top }));
          } catch {}
        }
      } else {
        // It was a click: toggle open if mascot was clicked
        if (target.closest('[data-mascot-trigger]')) {
          setOpen(prev => !prev);
          setMinimized(false);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });
  }, []);

  // ── Chat ──────────────────────────────────────────────────
  async function sendMessage(text?: string) {
    const question = (text || input).trim();
    if (!question || loading || isStreaming) return;
    setInput('');
    setAvatarState('investigating');
    setMessages(m => [...m, { role: 'user', content: question }]);
    setLoading(true);
    setIsStreaming(false);

    try {
      const startTime = Date.now();
      const r = await chatAPI.send({
        question,
        project_id: context?.projectId || undefined,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      });

      // Natural thinking delay (at least 500ms)
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) {
        await new Promise(res => setTimeout(res, 500 - elapsed));
      }

      const fullAnswer = r.data.answer || 'No response recorded.';
      const mode = r.data.connection_mode;

      // Start natural typing animation
      setIsStreaming(true);
      setAvatarState('processing');

      // Append empty assistant message to stream into
      setMessages(m => [...m, { role: 'assistant', content: '', mode }]);

      // Split into word tokens (preserving spaces and punctuation)
      const tokens = fullAnswer.split(/(\s+)/);
      let accumulated = '';

      for (let i = 0; i < tokens.length; i++) {
        accumulated += tokens[i];
        setMessages(m => {
          const next = [...m];
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: accumulated,
          };
          return next;
        });

        // Auto-scroll as text streams
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });

        // Natural cadence: ~18ms per word, slightly longer for punctuation
        const token = tokens[i];
        let delay = 18;
        if (token.includes('.') || token.includes('!') || token.includes('?')) {
          delay = 90;
        } else if (token.includes(',') || token.includes(';') || token.includes(':')) {
          delay = 50;
        }
        await new Promise(res => setTimeout(res, delay));
      }

      setAvatarState('success');
      setTimeout(() => setAvatarState('idle'), 1500);
    } catch (err: any) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `I couldn't complete that request. ${err?.response?.data?.detail || 'Please check that the AI service is running (Settings → Service Check).'}`,
        mode: 'error',
      }]);
      setAvatarState('idle');
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  function resetConversation() {
    setMessages([]);
    setOpen(false);
    setTimeout(() => setOpen(true), 50);
  }

  // Hide during guided tour
  if (tourActive) return null;

  const starters = CONTEXT_STARTERS[context?.type || 'general'];
  const avatarSrc = AVATAR_ASSETS[avatarState] || '/assets/avatars/general.png';

  // Inline style: absolute position when dragged, otherwise default bottom-right via CSS
  const posStyle: React.CSSProperties = pos.x >= 0
    ? { position: 'fixed', left: pos.x, top: pos.y, bottom: 'auto', right: 'auto' }
    : { position: 'fixed', bottom: 24, right: 24 };

  return (
    <div
      ref={assistantRef}
      style={{ ...posStyle, zIndex: 9000 }}
      className="select-none"
    >
      {/* ── Chat panel (when open) ── */}
      {open && !minimized && (
        <div
          className={`mb-3 border rounded-2xl flex flex-col overflow-hidden shadow-2xl transition-all duration-200 animate-fade-in-up ${
            isExpanded
              ? 'w-[94vw] sm:w-[680px] md:w-[740px] max-w-[780px]'
              : 'w-80 sm:w-96'
          }`}
          style={{
            background: '#FFFFFF',
            borderColor: '#DCE3DD',
            maxHeight: isExpanded
              ? 'min(760px, calc(100vh - 80px))'
              : 'min(460px, calc(100vh - 100px))',
          }}
        >
          {/* Header / drag handle */}
          <div
            data-drag-area
            className="flex items-center gap-2 px-3.5 py-2.5 border-b"
            style={{ background: '#19382D', borderColor: '#19382D' }}
          >
            <span
              aria-label="Drag assistant"
              className="cursor-move touch-none p-0.5 rounded transition-colors"
              style={{ color: '#C4D7C8' }}
              onPointerDown={onPointerDown}
            >
              <GripVertical size={14} className="flex-shrink-0" />
            </span>
            <div className="w-6 h-6 relative flex-shrink-0">
              <Image src={avatarSrc} alt="EcoSentinel" width={24} height={24} className="object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold" style={{ color: '#F4F3EC' }}>EcoSentinel Assistant</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#78917C] animate-pulse" />
                {isExpanded && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.2 rounded" style={{ background: '#E8F0EA', color: '#19382D' }}>
                    Expanded Console
                  </span>
                )}
              </div>
              <p className="text-[10px] truncate" style={{ color: '#C4D7C8' }}>
                {loading && !isStreaming ? 'Analyzing telemetry…' : isStreaming ? 'Typing response…' : context?.label ? `Context: ${context.label}` : 'Ready for environmental queries'}
              </p>
            </div>
            <button
              onClick={resetConversation}
              className="p-1 rounded transition-colors hover:opacity-80"
              style={{ color: '#F4F3EC' }}
              title="New conversation"
            >
              <RefreshCw size={12} />
            </button>
            <button
              onClick={toggleExpand}
              className="p-1 rounded transition-colors hover:opacity-80"
              style={{ color: '#F4F3EC' }}
              title={isExpanded ? 'Restore compact size' : 'Make chat big (Maximize)'}
            >
              {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
            <button
              onClick={() => setMinimized(true)}
              className="p-1 rounded transition-colors hover:opacity-80"
              style={{ color: '#F4F3EC' }}
              title="Minimize to floating pill"
            >
              <Minus size={13} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded transition-colors hover:opacity-80"
              style={{ color: '#F4F3EC' }}
              title="Close"
            >
              <X size={13} />
            </button>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-3.5 space-y-3 ${
            isExpanded ? 'min-h-[320px] max-h-[500px]' : 'min-h-[100px] max-h-[220px]'
          }`} style={{ background: '#FFFFFF' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 relative flex-shrink-0 mt-0.5">
                    <Image src={avatarSrc} alt="" width={24} height={24} className="object-contain" />
                  </div>
                )}
                <div
                  className={`${isExpanded ? 'max-w-[92%]' : 'max-w-[85%]'} rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed`}
                  style={{
                    background: msg.role === 'user' ? '#19382D' : msg.mode === 'error' ? '#FEE2E2' : '#F4F3EC',
                    border: msg.role === 'user' ? '1px solid #19382D' : msg.mode === 'error' ? '1px solid #FCA5A5' : '1px solid #DCE3DD',
                    color: msg.role === 'user' ? '#F4F3EC' : msg.mode === 'error' ? '#991B1B' : '#19382D',
                  }}
                >
                  <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
                </div>
              </div>
            ))}
            {loading && !isStreaming && (
              <div className="flex gap-2.5 items-center">
                <div className="w-6 h-6 relative flex-shrink-0">
                  <Image src={AVATAR_ASSETS['investigating']} alt="" width={24} height={24} className="object-contain animate-pulse" />
                </div>
                <div className="rounded-2xl px-3.5 py-2 flex items-center gap-2 shadow-sm" style={{ background: '#F4F3EC', border: '1px solid #DCE3DD' }}>
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#19382D] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#19382D] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#19382D] animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs font-medium" style={{ color: '#5A6E63' }}>Analyzing environmental telemetry…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggested starters */}
          {messages.length <= 1 && !loading && (
            <div className="px-3 pb-2.5 flex flex-wrap gap-1.5 border-t pt-2" style={{ borderColor: '#DCE3DD', background: '#F4F3EC' }}>
              {starters.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[10px] sm:text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors text-left"
                  style={{ background: '#FFFFFF', border: '1px solid #DCE3DD', color: '#19382D' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#E8F0EA'; e.currentTarget.style.borderColor = '#C4D7C8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.borderColor = '#DCE3DD'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t p-2.5 flex gap-2" style={{ borderColor: '#DCE3DD', background: '#FFFFFF' }}>
            <input
              ref={inputRef}
              className="flex-1 rounded-xl px-3 py-1.5 text-xs sm:text-sm focus:outline-none"
              style={{ background: '#F4F3EC', border: '1px solid #DCE3DD', color: '#19382D' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask EcoSentinel assistant…"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="disabled:opacity-40 disabled:cursor-not-allowed font-semibold rounded-xl px-3.5 py-1.5 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              style={{ background: '#19382D', color: '#F4F3EC' }}
              title="Send message"
            >
              <Send size={13} />
              {isExpanded && <span className="text-xs font-semibold">Send</span>}
            </button>
          </div>
        </div>
      )}

      {/* ── Minimized pill ── */}
      {open && minimized && (
        <div
          className="mb-3 px-3 py-1.5 rounded-full shadow-lg cursor-pointer flex items-center gap-2 transition-colors animate-fade-in-up"
          style={{ background: '#FFFFFF', border: '1px solid #DCE3DD' }}
          onClick={() => setMinimized(false)}
        >
          <div className="w-5 h-5 relative flex-shrink-0">
            <Image src={avatarSrc} alt="EcoSentinel" width={20} height={20} className="object-contain" />
          </div>
          <span className="text-xs font-bold" style={{ color: '#19382D' }}>EcoSentinel AI</span>
          <ChevronDown size={11} style={{ color: '#5A6E63' }} />
          <button
            onClick={e => { e.stopPropagation(); setOpen(false); setMinimized(false); }}
            className="hover:opacity-70 ml-1 p-0.5"
            style={{ color: '#5A6E63' }}
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* ── Mascot avatar (always visible, triggers open on click) ── */}
      <div
        data-mascot-trigger
        className="relative group cursor-grab active:cursor-grabbing select-none flex flex-col items-center"
        title="EcoSentinel Assistant — Click to open · Drag to move"
        onPointerDown={onPointerDown}
      >
        {/* Floating label when closed */}
        {!open && (
          <div
            className="mb-1 px-3 py-1 rounded-full text-[11px] font-bold shadow-md backdrop-blur-sm pointer-events-none transition-transform group-hover:scale-105 flex items-center gap-1.5"
            style={{ background: '#19382D', border: '1px solid #C4D7C8', color: '#F4F3EC' }}
          >
            <Bot size={12} style={{ color: '#C4D7C8' }} />
            <span>Ask Assistant</span>
          </div>
        )}

        {/* Character image */}
        <div className="relative w-20 h-24 sm:w-24 sm:h-28 transition-transform duration-200 group-hover:scale-110 filter drop-shadow-[0_8px_20px_rgba(25,56,45,0.35)]">
          <Image
            src={avatarSrc}
            alt={`EcoSentinel assistant — ${avatarState}`}
            fill
            sizes="110px"
            className="object-contain"
            priority
            onError={e => { (e.target as HTMLImageElement).src = '/assets/avatars/general.png'; }}
          />
        </div>

        {/* Drag hint */}
        <div
          className="mt-0.5 text-[9px] font-mono tracking-wider rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-sm"
          style={{ background: '#FFFFFF', border: '1px solid #DCE3DD', color: '#5A6E63' }}
        >
          <GripVertical size={8} /> drag to move
        </div>
      </div>
    </div>
  );
}
