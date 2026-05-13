export default function TypingIndicator() {
  return (
    <>
      <style>{`
        @keyframes birdy-pulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        .birdy-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#e8c96b; animation: birdy-pulse 1.4s ease-in-out infinite; }
        .birdy-dot:nth-child(2) { animation-delay: 0.16s; }
        .birdy-dot:nth-child(3) { animation-delay: 0.32s; }
      `}</style>
      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 0' }}>
        <span className="birdy-dot" />
        <span className="birdy-dot" />
        <span className="birdy-dot" />
      </div>
    </>
  )
}
