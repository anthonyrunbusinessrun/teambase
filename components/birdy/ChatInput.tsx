'use client'
import { useState, useRef, KeyboardEvent } from 'react'

interface Props {
  onSend: (message: string) => void
  isStreaming: boolean
  disabled?: boolean
}

export default function ChatInput({ onSend, isStreaming, disabled }: Props) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const canSend = value.trim().length > 0 && !isStreaming && !disabled

  const handleSend = () => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
    if (ref.current) ref.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = `${Math.min(ref.current.scrollHeight, 160)}px`
    }
  }

  return (
    <>
      <style>{`
        .birdy-input-wrap {
          border-top: 1px solid rgba(255,255,255,0.08);
          padding: 12px 14px;
          background: #0a1628;
        }
        .birdy-input-row {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px 12px;
          transition: border-color 0.15s;
        }
        .birdy-input-row:focus-within {
          border-color: rgba(183,0,0,0.6);
        }
        .birdy-textarea {
          flex: 1;
          background: none;
          border: none;
          outline: none;
          resize: none;
          color: #e2e8f0;
          font-family: 'Lato', sans-serif;
          font-size: 14px;
          line-height: 1.5;
          min-height: 22px;
          max-height: 160px;
          placeholder-color: rgba(255,255,255,0.25);
        }
        .birdy-textarea::placeholder { color: rgba(255,255,255,0.25); }
        .birdy-send-btn {
          width: 32px; height: 32px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s;
        }
        .birdy-send-btn.ready {
          background: linear-gradient(135deg, #b70000, #7e0606);
        }
        .birdy-send-btn.ready:hover { opacity: 0.85; }
        .birdy-send-btn.idle {
          background: rgba(255,255,255,0.07);
          cursor: not-allowed;
        }
        .birdy-input-hint {
          font-family: 'Lato', sans-serif;
          font-size: 10px;
          color: rgba(255,255,255,0.2);
          text-align: center;
          margin-top: 8px;
          letter-spacing: 0.05em;
        }
      `}</style>
      <div className="birdy-input-wrap">
        <div className="birdy-input-row">
          <textarea
            ref={ref}
            className="birdy-textarea"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={isStreaming ? 'Birdy is responding…' : 'Ask Birdy anything…'}
            rows={1}
            disabled={disabled}
          />
          <button
            className={`birdy-send-btn ${canSend ? 'ready' : 'idle'}`}
            onClick={handleSend}
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7H13M8 2L13 7L8 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="birdy-input-hint">Shift+Enter for new line</div>
      </div>
    </>
  )
}
