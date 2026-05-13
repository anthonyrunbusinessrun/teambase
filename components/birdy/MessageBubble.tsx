'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import { QUICK_ACTIONS } from '@/lib/birdy/quick-actions'

const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })

export interface MessageData {
  id:         string
  role:       'USER' | 'ASSISTANT' | 'user' | 'assistant'
  content:    string
  modelUsed?: string | null
  actionKey?: string | null
  citations?: Array<{ index: number; documentName: string; score: number }> | null
  isStreaming?: boolean
}

const MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-4-20250514': 'Claude Sonnet',
  'phi4': 'Phi-4',
  'deepseek-coder-v2:16b': 'DeepSeek Coder',
  'qwen3:32b': 'Qwen3',
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [code])
  return (
    <div style={{ position: 'relative', margin: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#030b1a', borderRadius: '8px 8px 0 0', padding: '5px 12px', borderBottom: '1px solid rgba(232,201,107,.15)' }}>
        <span style={{ fontFamily: 'Lato,sans-serif', fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{lang ?? 'code'}</span>
        <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#4caf78' : 'rgba(255,255,255,.3)', fontSize: 11, fontFamily: 'Lato,sans-serif', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', transition: 'color .15s', padding: '2px 6px' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ background: '#030b1a', border: '1px solid rgba(232,201,107,.2)', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', overflowX: 'auto', margin: 0 }}>
        <code style={{ color: '#a8d8a8', fontFamily: "'Courier New',monospace", fontSize: 12, lineHeight: 1.6 }}>{code}</code>
      </pre>
    </div>
  )
}

export default function MessageBubble({ message }: { message: MessageData }) {
  const isUser  = message.role === 'USER' || message.role === 'user'
  const label   = message.modelUsed ? MODEL_LABELS[message.modelUsed] ?? message.modelUsed : null
  const action  = message.actionKey ? QUICK_ACTIONS.find(a => a.key === message.actionKey) : null
  const hasCitations = (message.citations?.length ?? 0) > 0

  return (
    <>
      <style>{`
        .mb-user{background:linear-gradient(135deg,#b70000,#7e0606);color:#fff;border-radius:14px 14px 4px 14px;padding:10px 14px;font-family:'Lato',sans-serif;font-size:14px;line-height:1.6;max-width:88%;word-break:break-word}
        .mb-asst{color:#e2e8f0;font-family:'Lato',sans-serif;font-size:14px;line-height:1.7;max-width:100%;word-break:break-word}
        .mb-asst p{margin:0 0 10px}.mb-asst p:last-child{margin-bottom:0}
        .mb-asst ul,.mb-asst ol{margin:0 0 10px;padding-left:20px}.mb-asst li{margin:3px 0}
        .mb-asst strong{color:#e8c96b;font-weight:700}.mb-asst em{color:#a0aec0}
        .mb-asst h1,.mb-asst h2,.mb-asst h3{color:#e8c96b;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.05em;margin:14px 0 6px;text-transform:uppercase}
        .mb-asst h1{font-size:15px}.mb-asst h2{font-size:14px}.mb-asst h3{font-size:13px}
        .mb-asst code{background:rgba(232,201,107,.12);color:#e8c96b;font-family:'Courier New',monospace;font-size:12px;padding:1px 5px;border-radius:4px;border:1px solid rgba(232,201,107,.2)}
        .mb-asst a{color:#8299c0;text-decoration:underline}
        .mb-asst blockquote{border-left:3px solid #b70000;padding-left:12px;color:#8299c0;margin:8px 0}
        .mb-asst table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}
        .mb-asst th{background:rgba(255,255,255,.07);color:#e8c96b;padding:6px 10px;text-align:left;border-bottom:1px solid rgba(255,255,255,.1)}
        .mb-asst td{padding:5px 10px;border-bottom:1px solid rgba(255,255,255,.05)}
        .mb-meta{display:flex;align-items:center;gap:7px;margin-top:6px;flex-wrap:wrap}
        .mb-badge{font-family:'Lato',sans-serif;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
        .mb-model{color:rgba(255,255,255,.25)}
        .mb-action{background:rgba(183,0,0,.12);color:rgba(232,201,107,.6);border:1px solid rgba(183,0,0,.2);border-radius:4px;padding:1px 6px}
        .mb-cite-list{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
        .mb-cite{font-family:'Lato',sans-serif;font-size:9px;font-weight:700;letter-spacing:.06em;background:rgba(96,165,250,.1);color:#60a5fa;border:1px solid rgba(96,165,250,.2);border-radius:4px;padding:1px 7px;cursor:default}
        .mb-cite:hover{background:rgba(96,165,250,.18)}
      `}</style>

      {isUser ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div>
            {action && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                <span className="mb-badge mb-action">{action.icon} {action.label}</span>
              </div>
            )}
            <div className="mb-user">{message.content}</div>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-asst">
            {message.content ? (
              <ReactMarkdown
                components={{
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className ?? '')
                    const code  = String(children).replace(/\n$/, '')
                    return match
                      ? <CodeBlock code={code} lang={match[1]} />
                      : <code className={className} {...props}>{children}</code>
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : null}
          </div>
          <div className="mb-meta">
            {label   && <span className="mb-badge mb-model">via {label}</span>}
            {action  && <span className="mb-badge mb-action">{action.icon} {action.label}</span>}
          </div>
          {hasCitations && (
            <div className="mb-cite-list">
              {message.citations!.map(c => (
                <span key={c.index} className="mb-cite" title={`${c.documentName} — ${Math.round(c.score * 100)}% relevance`}>
                  [{c.index}] {c.documentName.slice(0, 22)}{c.documentName.length > 22 ? '…' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
