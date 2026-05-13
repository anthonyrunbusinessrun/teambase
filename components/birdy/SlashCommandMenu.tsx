'use client'
import { SlashCommand } from '@/lib/birdy/slash-commands'

interface Props {
  commands:  SlashCommand[]
  activeIdx: number
  onSelect:  (cmd: SlashCommand) => void
}

export default function SlashCommandMenu({ commands, activeIdx, onSelect }: Props) {
  if (!commands.length) return null
  return (
    <>
      <style>{`
        .slash-menu {
          position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
          background: #0a1628;
          border: 1px solid rgba(183,0,0,0.35);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 -8px 32px rgba(5,9,49,0.7);
          z-index: 10;
          max-height: 240px; overflow-y: auto;
        }
        .slash-item {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 13px; cursor: pointer;
          transition: background 0.1s;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .slash-item:last-child { border-bottom: none; }
        .slash-item:hover, .slash-item.active { background: rgba(183,0,0,0.15); }
        .slash-cmd { font-family: 'Courier New', monospace; font-size: 12px; font-weight: 700; color: #e8c96b; min-width: 80px; }
        .slash-desc { font-family: 'Lato', sans-serif; font-size: 12px; color: rgba(255,255,255,0.5); }
      `}</style>
      <div className="slash-menu">
        {commands.map((cmd, i) => (
          <div key={cmd.command} className={`slash-item ${i === activeIdx ? 'active' : ''}`} onMouseDown={() => onSelect(cmd)}>
            <span className="slash-cmd">/{cmd.command}</span>
            <span className="slash-desc">{cmd.description}</span>
          </div>
        ))}
      </div>
    </>
  )
}
