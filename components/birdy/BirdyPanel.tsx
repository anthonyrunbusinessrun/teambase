'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import MessageBubble, { type MessageData } from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import SlashCommandMenu from './SlashCommandMenu'
import { filterCommands, type SlashCommand } from '@/lib/birdy/slash-commands'
import { detectModule } from '@/lib/birdy/prompt'
import { QUICK_ACTIONS, type ActionCategory, ACTION_CATEGORIES } from '@/lib/birdy/quick-actions'

type Tab = 'chat' | 'actions' | 'activity'

interface Conversation {
  id: string; title: string | null; module: string | null; updatedAt: string; _count: { messages: number }
}
interface ActivityEntry {
  id: string; provider: string; model: string; intent: string | null
  tokens_out: number; latency_ms: number | null; status: string
  page_module: string | null; action_key: string | null; created_at: string
}

interface Props { open: boolean; onClose: () => void }

const MODEL_SHORT: Record<string,string> = { 'claude-sonnet-4-20250514':'Claude Sonnet','phi4':'Phi-4','deepseek-coder-v2:16b':'DeepSeek','qwen3:32b':'Qwen3' }
const STATUS_COLOR: Record<string,string> = { success:'#4caf78', error:'#f87171', fallback:'#e8c96b' }
function timeAgo(s: string): string { const d=Date.now()-new Date(s).getTime(); if(d<60000) return `${Math.round(d/1000)}s ago`; if(d<3600000) return `${Math.round(d/60000)}m ago`; return `${Math.round(d/3600000)}h ago` }

export default function BirdyPanel({ open, onClose }: Props) {
  const [tab,           setTab]           = useState<Tab>('chat')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId,  setActiveConvId]  = useState<string | null>(null)
  const [messages,      setMessages]      = useState<MessageData[]>([])
  const [isStreaming,   setIsStreaming]    = useState(false)
  const [showHistory,   setShowHistory]   = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [inputValue,    setInputValue]    = useState('')
  const [slashCmds,     setSlashCmds]     = useState<SlashCommand[]>([])
  const [slashActive,   setSlashActive]   = useState(-1)
  const [pageModule,    setPageModule]    = useState('/')
  const [activity,      setActivity]      = useState<ActivityEntry[]>([])
  const [actFilter,     setActFilter]     = useState<ActionCategory | 'all'>('all')

  const bottomRef   = useRef<HTMLDivElement>(null)
  const abortRef    = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setPageModule(window.location.pathname) }, [])
  const pageCtx = detectModule(pageModule)

  useEffect(() => {
    if (!open) return
    fetch('/api/birdy/conversations').then(r=>r.json()).then(d=>setConversations(d.conversations??[])).catch(()=>{})
    if (tab==='activity') fetchActivity()
  }, [open, tab])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const fetchActivity = () => {
    fetch('/api/birdy/activity').then(r=>r.json()).then(d=>setActivity(d.activity??[])).catch(()=>{})
  }

  const loadConversation = useCallback(async (convId: string) => {
    setActiveConvId(convId); setMessages([]); setShowHistory(false)
    try {
      const r = await fetch(`/api/birdy/conversations/${convId}/messages`)
      const d = await r.json()
      if (d.messages) setMessages(d.messages.map((m: MessageData & {role:string}) => ({...m, role: m.role.toUpperCase() as 'USER'|'ASSISTANT'})))
    } catch { setError('Could not load conversation.') }
  }, [])

  const startNew = () => { abortRef.current?.abort(); setActiveConvId(null); setMessages([]); setIsStreaming(false); setError(null); setInputValue('') }

  const sendMessage = useCallback(async (message: string, actionKey?: string) => {
    if (isStreaming || !message.trim()) return
    setError(null); setIsStreaming(true)
    if (tab !== 'chat') setTab('chat')
    const trimmed = message.trim()
    const userMsg: MessageData = { id: crypto.randomUUID(), role: 'USER', content: trimmed, actionKey }
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'ASSISTANT', content: '', isStreaming: true }])
    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/birdy/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversationId: activeConvId, pageModule, actionKey }),
        signal: abortRef.current.signal,
      })
      if (res.status === 429) { setError('Rate limit reached.'); setMessages(prev=>prev.filter(m=>m.id!==assistantId)); setIsStreaming(false); return }
      if (!res.ok || !res.body) throw new Error('Stream failed')
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buf='', model: string|undefined
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop()??''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const d = JSON.parse(line.slice(6))
            if (d.conversationId && !activeConvId) {
              setActiveConvId(d.conversationId)
              setConversations(prev=>[...prev.filter(c=>c.id!==d.conversationId), {id:d.conversationId,title:trimmed.slice(0,55),module:pageModule,updatedAt:new Date().toISOString(),_count:{messages:1}}].sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()))
            }
            if (d.model) model = d.model
            if (d.delta) setMessages(prev=>prev.map(m=>m.id===assistantId?{...m,content:m.content+d.delta}:m))
            if (d.error) setError(d.error)
            if (d.done) setMessages(prev=>prev.map(m=>m.id===assistantId?{...m,isStreaming:false,modelUsed:model}:m))
          } catch {}
        }
      }
    } catch(err) {
      if ((err as Error).name !== 'AbortError') setMessages(prev=>prev.map(m=>m.id===assistantId?{...m,content:'Something went wrong. Please try again.',isStreaming:false}:m))
    } finally { setIsStreaming(false) }
  }, [activeConvId, isStreaming, pageModule, tab])

  const handleInputChange = (v: string) => {
    setInputValue(v)
    if (v.startsWith('/') && !v.includes(' ')) { const f=filterCommands(v); setSlashCmds(f); setSlashActive(f.length>0?0:-1) }
    else { setSlashCmds([]); setSlashActive(-1) }
  }
  const handleSlashSelect = (cmd: SlashCommand) => { setInputValue(cmd.template); setSlashCmds([]); setSlashActive(-1); setTimeout(()=>textareaRef.current?.focus(),0) }
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashCmds.length > 0) {
      if (e.key==='ArrowDown') { e.preventDefault(); setSlashActive(i=>Math.min(i+1,slashCmds.length-1)) }
      if (e.key==='ArrowUp')   { e.preventDefault(); setSlashActive(i=>Math.max(i-1,0)) }
      if (e.key==='Tab'||e.key==='Enter') { e.preventDefault(); if(slashActive>=0) handleSlashSelect(slashCmds[slashActive]); return }
      if (e.key==='Escape') { setSlashCmds([]); setSlashActive(-1); return }
    }
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); if(inputValue.trim()&&!isStreaming){sendMessage(inputValue);setInputValue('')} }
  }
  const filteredActions = actFilter==='all' ? QUICK_ACTIONS : QUICK_ACTIONS.filter(a=>a.category===actFilter)

  if (!open) return null
  return (
    <>
      <style>{`
        @keyframes b-slide{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes b-fade{from{opacity:0}to{opacity:1}}
        .bp-overlay{position:fixed;inset:0;z-index:9998;background:rgba(5,9,49,.5);animation:b-fade .2s ease;backdrop-filter:blur(2px)}
        .bp-panel{position:fixed;top:0;right:0;bottom:0;width:520px;max-width:100vw;z-index:9999;display:flex;flex-direction:column;background:#0b1829;border-left:1px solid rgba(183,0,0,.3);animation:b-slide .24s cubic-bezier(.25,.46,.45,.94);box-shadow:-12px 0 48px rgba(5,9,49,.7)}
        .bp-hdr{display:flex;flex-direction:column;background:linear-gradient(135deg,#0a1628,#0f2040);border-bottom:1px solid rgba(183,0,0,.3);flex-shrink:0}
        .bp-hdr-top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 0}
        .bp-brand{display:flex;align-items:center;gap:8px}
        .bp-title{font-family:'Rajdhani',system-ui,sans-serif;font-weight:700;font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#fff}
        .bp-sub{font-family:system-ui,sans-serif;font-size:9px;color:rgba(255,255,255,.35);letter-spacing:.1em;text-transform:uppercase}
        .bp-ctx{display:flex;align-items:center;gap:5px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:3px 10px}
        .bp-ctx-dot{width:5px;height:5px;border-radius:50%;background:#4caf78;flex-shrink:0}
        .bp-ctx-label{font-family:system-ui,sans-serif;font-size:10px;color:rgba(255,255,255,.45);letter-spacing:.06em;text-transform:uppercase}
        .bp-hbtn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.45);padding:6px;border-radius:6px;transition:all .15s;display:flex;align-items:center;justify-content:center}
        .bp-hbtn:hover{color:#fff;background:rgba(255,255,255,.07)}
        .bp-tabs{display:flex;padding:0 12px;margin-top:10px;border-top:1px solid rgba(255,255,255,.05)}
        .bp-tab{display:flex;align-items:center;gap:5px;padding:8px 11px;font-family:system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.35);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;background:none;border-top:none;border-left:none;border-right:none}
        .bp-tab:hover{color:rgba(255,255,255,.7)}
        .bp-tab.active{color:#e8c96b;border-bottom-color:#b70000}
        .bp-body{flex:1;display:flex;overflow:hidden}
        .bp-hist{width:160px;flex-shrink:0;background:#071020;border-right:1px solid rgba(255,255,255,.05);overflow-y:auto;display:flex;flex-direction:column}
        .bp-hist-hdr{padding:10px 12px 7px;font-family:system-ui,sans-serif;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.25);border-bottom:1px solid rgba(255,255,255,.05)}
        .bp-new-btn{margin:8px;padding:7px;font-family:system-ui,sans-serif;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35);background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:6px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:4px}
        .bp-new-btn:hover{color:#fff;background:rgba(183,0,0,.2);border-color:rgba(183,0,0,.4)}
        .bp-conv{padding:9px 12px;font-family:system-ui,sans-serif;font-size:11px;color:rgba(255,255,255,.45);cursor:pointer;border-bottom:1px solid rgba(255,255,255,.03);transition:all .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .bp-conv:hover{background:rgba(255,255,255,.04);color:rgba(255,255,255,.8)}
        .bp-conv.active{background:rgba(183,0,0,.12);color:#e8c96b;border-left:2px solid #b70000;padding-left:10px}
        .bp-chat{flex:1;display:flex;flex-direction:column;overflow:hidden}
        .bp-msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:14px;scroll-behavior:smooth}
        .bp-msgs::-webkit-scrollbar{width:3px}
        .bp-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
        .bp-empty{flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;padding:24px;color:rgba(255,255,255,.25)}
        .bp-empty-icon{width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,rgba(183,0,0,.18),rgba(126,6,6,.12));border:1px solid rgba(183,0,0,.22);display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 14px}
        .bp-empty-title{font-family:'Rajdhani',system-ui,sans-serif;font-weight:700;font-size:16px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:7px}
        .bp-empty-sub{font-family:system-ui,sans-serif;font-size:12px;line-height:1.6;margin-bottom:16px}
        .bp-sug-btn{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:7px 12px;font-family:system-ui,sans-serif;font-size:12px;color:rgba(255,255,255,.45);cursor:pointer;transition:all .15s;text-align:left;margin-bottom:5px;width:100%;max-width:280px}
        .bp-sug-btn:hover{background:rgba(183,0,0,.12);border-color:rgba(183,0,0,.35);color:rgba(255,255,255,.8)}
        .bp-err{margin:0 14px 8px;padding:8px 12px;background:rgba(183,0,0,.12);border:1px solid rgba(183,0,0,.28);border-radius:8px;font-family:system-ui,sans-serif;font-size:12px;color:#ff8080;display:flex;align-items:center;justify-content:space-between;gap:8px}
        .bp-input-wrap{border-top:1px solid rgba(255,255,255,.07);padding:11px 13px 13px;background:#0a1628;position:relative}
        .bp-input-row{display:flex;align-items:flex-end;gap:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:9px 11px;transition:border-color .15s}
        .bp-input-row:focus-within{border-color:rgba(183,0,0,.55)}
        .bp-textarea{flex:1;background:none;border:none;outline:none;resize:none;color:#e2e8f0;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5;min-height:20px;max-height:160px}
        .bp-textarea::placeholder{color:rgba(255,255,255,.2)}
        .bp-send-btn{width:30px;height:30px;border-radius:7px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
        .bp-send-btn.ready{background:linear-gradient(135deg,#b70000,#7e0606)}.bp-send-btn.ready:hover{opacity:.85}
        .bp-send-btn.idle{background:rgba(255,255,255,.06);cursor:not-allowed}
        .bp-hint{font-family:system-ui,sans-serif;font-size:9px;color:rgba(255,255,255,.15);text-align:center;margin-top:7px;letter-spacing:.05em}
        .bp-qa-wrap{flex:1;overflow-y:auto;padding:14px}
        .bp-qa-cats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}
        .bp-qa-cat{font-family:system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:transparent;color:rgba(255,255,255,.4);cursor:pointer;transition:all .15s}
        .bp-qa-cat:hover{border-color:rgba(183,0,0,.4);color:rgba(255,255,255,.75)}
        .bp-qa-cat.active{border-color:rgba(183,0,0,.6);background:rgba(183,0,0,.15);color:#e8c96b}
        .bp-qa-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .bp-qa-card{border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:13px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:6px}
        .bp-qa-card:hover{border-color:rgba(183,0,0,.5);transform:translateY(-1px);box-shadow:0 4px 16px rgba(5,9,49,.5)}
        .bp-qa-icon{font-size:20px}.bp-qa-label{font-family:'Rajdhani',system-ui,sans-serif;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.85)}
        .bp-qa-desc{font-family:system-ui,sans-serif;font-size:11px;color:rgba(255,255,255,.35);line-height:1.4}
        .bp-act-wrap{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
        .bp-act-item{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:7px;padding:9px 11px;display:flex;align-items:flex-start;gap:9px}
        .bp-act-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:3px}
        .bp-act-model{font-family:system-ui,sans-serif;font-size:12px;font-weight:700;color:rgba(255,255,255,.75)}
        .bp-act-meta{font-family:system-ui,sans-serif;font-size:10px;color:rgba(255,255,255,.3);margin-top:2px}
        .bp-act-empty{text-align:center;padding:40px 16px;color:rgba(255,255,255,.2);font-family:system-ui,sans-serif;font-size:13px}
        @media(max-width:540px){.bp-panel{width:100vw}.bp-hist{width:140px}}
      `}</style>
      <div className="bp-overlay" onClick={onClose}/>
      <div className="bp-panel">
        <div className="bp-hdr">
          <div className="bp-hdr-top">
            <div className="bp-brand">
              <button className="bp-hbtn" onClick={()=>setShowHistory(s=>!s)} title="History">
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1.5 3.5h12M1.5 7.5h8M1.5 11.5h10" strokeLinecap="round"/></svg>
              </button>
              <div>
                <div className="bp-title">Birdy</div>
                <div className="bp-sub">Rayland AI Copilot</div>
              </div>
              <div className="bp-ctx"><div className="bp-ctx-dot"/><div className="bp-ctx-label">{pageCtx.label}</div></div>
            </div>
            <div style={{display:'flex',gap:2}}>
              <button className="bp-hbtn" onClick={startNew} title="New"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 1v12M1 7h12" strokeLinecap="round"/></svg></button>
              <button className="bp-hbtn" onClick={onClose} title="Close"><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l10 10M12 2L2 12" strokeLinecap="round"/></svg></button>
            </div>
          </div>
          <div className="bp-tabs">
            {(['chat','actions','activity'] as Tab[]).map(t=>(
              <button key={t} className={`bp-tab ${tab===t?'active':''}`} onClick={()=>{setTab(t);if(t==='activity')fetchActivity()}}>
                {t==='chat'?'💬':t==='actions'?'⚡':'📊'} {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="bp-body">
          {showHistory && tab==='chat' && (
            <div className="bp-hist">
              <div className="bp-hist-hdr">History</div>
              <button className="bp-new-btn" onClick={startNew}>+ New</button>
              {conversations.map(c=>(
                <div key={c.id} className={`bp-conv ${c.id===activeConvId?'active':''}`} onClick={()=>loadConversation(c.id)} title={c.title??'Conversation'}>
                  {c.title??'Conversation'}
                </div>
              ))}
            </div>
          )}
          {tab==='chat' && (
            <div className="bp-chat">
              <div className="bp-msgs">
                {!messages.length ? (
                  <div className="bp-empty">
                    <div className="bp-empty-icon">🐦</div>
                    <div className="bp-empty-title">Birdy is ready</div>
                    <div className="bp-empty-sub">Enterprise AI for Rayland operations.<br/>Type a message or try a suggestion.</div>
                    <div style={{width:'100%',display:'flex',flexDirection:'column',alignItems:'center'}}>
                      {pageCtx.suggestions.map(s=>(
                        <button key={s} className="bp-sug-btn" onClick={()=>sendMessage(s)}>{s}</button>
                      ))}
                    </div>
                  </div>
                ) : messages.map(msg=>(
                  <div key={msg.id}>{msg.isStreaming&&!msg.content?<TypingIndicator/>:<MessageBubble message={msg}/>}</div>
                ))}
                <div ref={bottomRef}/>
              </div>
              {error && <div className="bp-err"><span>{error}</span><button onClick={()=>setError(null)} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',padding:0,fontSize:15}}>×</button></div>}
              <div className="bp-input-wrap">
                {slashCmds.length>0 && <SlashCommandMenu commands={slashCmds} activeIdx={slashActive} onSelect={handleSlashSelect}/>}
                <div className="bp-input-row">
                  <textarea ref={textareaRef} className="bp-textarea" value={inputValue} onChange={e=>handleInputChange(e.target.value)} onKeyDown={handleKeyDown} onInput={()=>{if(textareaRef.current){textareaRef.current.style.height='auto';textareaRef.current.style.height=Math.min(textareaRef.current.scrollHeight,160)+'px'}}} placeholder={isStreaming?'Birdy is responding…':'Ask Birdy anything… (/ for commands)'} rows={1} disabled={isStreaming}/>
                  <button className={`bp-send-btn ${inputValue.trim()&&!isStreaming?'ready':'idle'}`} onClick={()=>{if(inputValue.trim()&&!isStreaming){sendMessage(inputValue);setInputValue('')}}} aria-label="Send">
                    <svg width="13" height="13" fill="none"><path d="M1 6.5H12M7.5 2L12 6.5L7.5 11" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                <div className="bp-hint">Enter to send · Shift+Enter new line · / for commands · ⌘/ to close</div>
              </div>
            </div>
          )}
          {tab==='actions' && (
            <div className="bp-qa-wrap">
              <div className="bp-qa-cats">
                <button className={`bp-qa-cat ${actFilter==='all'?'active':''}`} onClick={()=>setActFilter('all')}>All</button>
                {(Object.keys(ACTION_CATEGORIES) as ActionCategory[]).map(cat=>(
                  <button key={cat} className={`bp-qa-cat ${actFilter===cat?'active':''}`} onClick={()=>setActFilter(cat)}>{ACTION_CATEGORIES[cat]}</button>
                ))}
              </div>
              <div className="bp-qa-grid">
                {filteredActions.map(action=>(
                  <div key={action.key} className="bp-qa-card" style={{background:action.color+'30'}} onClick={()=>sendMessage(action.prompt,action.key)}>
                    <div className="bp-qa-icon">{action.icon}</div>
                    <div className="bp-qa-label">{action.label}</div>
                    <div className="bp-qa-desc">{action.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==='activity' && (
            <div className="bp-act-wrap">
              {activity.length ? activity.map(item=>(
                <div key={item.id} className="bp-act-item">
                  <div className="bp-act-dot" style={{background:STATUS_COLOR[item.status]??'#888'}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="bp-act-model">{MODEL_SHORT[item.model]??item.model}</div>
                    <div className="bp-act-meta">{item.intent??item.provider}{item.page_module?` · ${item.page_module}`:''}{item.action_key?` · ${item.action_key}`:''}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,fontFamily:'system-ui,sans-serif',fontSize:10,color:'rgba(255,255,255,.28)'}}>
                    <div style={{fontFamily:'monospace',fontSize:10,color:'rgba(232,201,107,.5)'}}>{item.tokens_out}t</div>
                    <div>{item.latency_ms?`${(item.latency_ms/1000).toFixed(1)}s`:'—'}</div>
                    <div>{timeAgo(item.created_at)}</div>
                  </div>
                </div>
              )) : (
                <div className="bp-act-empty">No activity yet.<br/>Start chatting to see AI request logs here.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
