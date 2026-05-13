'use client'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const BirdyPanel = dynamic(() => import('./BirdyPanel'), { ssr: false, loading: () => null })

export default function BirdyButton() {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); setOpen(p => !p) }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open])

  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])

  return (
    <>
      <style>{`
        @keyframes b-pulse{0%,100%{box-shadow:0 0 0 0 rgba(183,0,0,.4)}50%{box-shadow:0 0 0 8px rgba(183,0,0,0)}}
        .birdy-fab{position:fixed;bottom:24px;right:24px;z-index:9997;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#b70000,#7e0606);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(183,0,0,.45),0 2px 8px rgba(5,9,49,.5);transition:transform .18s,box-shadow .18s;animation:b-pulse 3s ease-in-out infinite}
        .birdy-fab:hover{transform:scale(1.07) translateY(-2px);box-shadow:0 8px 28px rgba(183,0,0,.55);animation:none}
        .birdy-fab:active{transform:scale(0.95)}
        .birdy-fab.open{animation:none}
        .birdy-tooltip{position:fixed;bottom:34px;right:86px;background:#0a1628;color:rgba(255,255,255,.8);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:6px;border:1px solid rgba(183,0,0,.3);white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;z-index:9997;font-family:system-ui,sans-serif}
        .birdy-fab:hover+.birdy-tooltip{opacity:1}
        @media(max-width:540px){.birdy-fab{bottom:80px;right:16px}.birdy-tooltip{display:none}}
      `}</style>
      <button className={`birdy-fab ${open?'open':''}`} onClick={()=>setOpen(p=>!p)} aria-label="Birdy AI" title="Birdy (⌘/)">
        {open ? (
          <svg width="19" height="19" fill="none" stroke="white" strokeWidth="2"><path d="M3 3l13 13M16 3L3 16" strokeLinecap="round"/></svg>
        ) : (
          <svg width="22" height="22" fill="none" stroke="white" strokeWidth="1.75">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 10h.01M12 10h.01M16 10h.01" strokeLinecap="round"/>
          </svg>
        )}
      </button>
      <div className="birdy-tooltip">Birdy AI · ⌘/</div>
      <BirdyPanel open={open} onClose={close}/>
    </>
  )
}
