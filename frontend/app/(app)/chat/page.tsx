'use client';
import { useEffect, useRef, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { chatAPI, ttsAPI } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { ModeBadge, LoadingSpinner } from '@/components/ui/StatusBadges';
import { Send, Volume2, VolumeX, MessageSquare, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { projectsAPI } from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  mode?: string;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [avatarState, setAvatarState] = useState<'idle' | 'processing' | 'investigating'>('idle');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    projectsAPI.list().then(r => setProjects(r.data));
    setMessages([{
      role: 'assistant',
      content: `Hello, ${user?.full_name?.split(' ')[0] || 'Officer'}. I'm the EcoSentinel case assistant. I can answer questions grounded in the project data, findings, and documents available in this workspace. Select a project if you want case-specific answers.`,
      mode: 'system',
    }]);
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setAvatarState('investigating');

    setMessages(m => [...m, { role: 'user', content: question }]);
    setLoading(true);

    try {
      const startTime = Date.now();
      const r = await chatAPI.send({
        question,
        project_id: selectedProject || undefined,
        history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
      });

      // Natural pause of at least 450ms
      const elapsed = Date.now() - startTime;
      if (elapsed < 450) {
        await new Promise(res => setTimeout(res, 450 - elapsed));
      }

      const fullAnswer = r.data.answer || '';
      const model = r.data.model_used;
      const mode = r.data.connection_mode;

      setAvatarState('processing');
      setMessages(m => [...m, {
        role: 'assistant',
        content: '',
        model,
        mode,
      }]);

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

        const token = tokens[i];
        let delay = 18;
        if (token.includes('.') || token.includes('!') || token.includes('?')) {
          delay = 80;
        } else if (token.includes(',') || token.includes(';') || token.includes(':')) {
          delay = 45;
        }
        await new Promise(res => setTimeout(res, delay));
      }

    } catch (err: any) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: `I could not complete that request. ${err?.response?.data?.detail || 'Please check AI service status.'}`,
        mode: 'error',
      }]);
    } finally {
      setLoading(false);
      setAvatarState('idle');
    }
  }

  async function speakMessage(text: string) {
    // Try Piper TTS via API
    setTtsLoading(true);
    setAvatarState('investigating');
    try {
      const r = await ttsAPI.synthesize(text);
      if (r.data.audio_id && r.data.engine !== 'browser_fallback') {
        // Play WAV from backend
        const audioUrl = ttsAPI.getAudio(r.data.audio_id);
        const audio = new Audio(audioUrl);
        audio.play().catch(() => fallbackTTS(text));
      } else {
        // Use browser speech synthesis as fallback
        fallbackTTS(text);
      }
    } catch {
      fallbackTTS(text);
    } finally {
      setTtsLoading(false);
      setAvatarState('idle');
    }
  }

  function fallbackTTS(text: string) {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text.slice(0, 1000));
      u.rate = 0.9;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    }
  }

  const SUGGESTED = [
    'What candidate changes are in Zone A vs outside?',
    'What evidence gaps does the FER identify?',
    'What should the officer verify next?',
    'Summarise the investigation status of this project.',
  ];

  return (
    <AppLayout>
      <div data-tour="chat" className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar state={avatarState} size={50} />
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <MessageSquare size={18} className="text-violet-400" /> Case Assistant
              </h1>
              <p className="text-xs text-slate-400">Grounded in case documents and data — cites sources when available</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="eco-select text-sm py-1.5"
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
              style={{ maxWidth: 220 }}
            >
              <option value="">All projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto eco-card p-4 space-y-4 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <Avatar state={loading && i === messages.length - 1 ? 'processing' : 'idle'} size={36} className="flex-shrink-0" />
              )}
              <div className={`max-w-2xl ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                <div className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-teal-500/10 border border-teal-500/20 text-slate-200'
                    : 'bg-slate-800 text-slate-200'
                }`}>
                  {msg.content}
                </div>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 px-1">
                    {msg.model && (
                      <span className="text-xs text-slate-600">via {msg.model}</span>
                    )}
                    {msg.mode && msg.mode !== 'system' && (
                      <ModeBadge mode={msg.mode === 'live_local' ? 'LIVE' : msg.mode === 'error' ? 'SYNTHETIC' : 'REPLAY'} />
                    )}
                    {msg.content.length > 20 && (
                      <button
                        onClick={() => speakMessage(msg.content)}
                        disabled={ttsLoading}
                        className="text-slate-500 hover:text-teal-400 transition-colors"
                        aria-label="Read aloud"
                        title="Read aloud"
                      >
                        {ttsLoading ? <LoadingSpinner size={12} /> : <Volume2 size={12} />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <Avatar state="processing" size={36} className="flex-shrink-0" />
              <div className="bg-slate-800 rounded-xl px-4 py-3 flex items-center gap-2">
                <LoadingSpinner size={14} />
                <span className="text-sm text-slate-400">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggested */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {SUGGESTED.map(s => (
              <button
                key={s}
                onClick={() => { setInput(s); }}
                className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-teal-400 transition-colors border border-slate-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={send} className="flex gap-3">
          <input
            className="eco-input flex-1"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about project evidence, findings, or next investigation steps…"
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()} className="btn-primary px-5">
            {loading ? <LoadingSpinner size={16} /> : <Send size={16} />}
          </button>
        </form>

        <p className="text-xs text-slate-600 mt-2 text-center">
          Answers are generated by local Ollama AI and grounded in case data. Configure Ollama for AI responses.
          <span className="mx-2">·</span>
          Speech: Piper TTS with browser fallback.
        </p>
      </div>
    </AppLayout>
  );
}
