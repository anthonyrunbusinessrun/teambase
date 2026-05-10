"use client";
import { useState } from "react";
import { KeyRound, Eye, EyeOff, CheckCircle } from "lucide-react";

export function PasswordSection() {
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!newPwd) { setError("Enter a new password."); return; }
    if (newPwd.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (newPwd !== confirmPwd) { setError("Passwords don't match."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Failed to set password.");
      } else {
        setSuccess(true);
        setNewPwd(""); setConfirmPwd("");
        setTimeout(() => setSuccess(false), 5000);
      }
    } catch (e) {
      setError("Network error. Please try again.");
    }
    setSaving(false);
  };

  return (
    <div className="card-base p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound size={16} style={{ color: "hsl(var(--crimson))" }} />
        <h3 className="heading-sm text-foreground">Set Password</h3>
      </div>
      <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Barlow',sans-serif" }}>
        Set a password so you can sign in with email + password instead of magic links next time.
      </p>
      <div className="space-y-3">
        <div>
          <label className="field-label">New Password</label>
          <div className="relative">
            <input type={showPwd ? "text" : "password"} value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              className="field-input pr-10" placeholder="At least 8 characters" autoComplete="new-password" />
            <button type="button" onClick={() => setShowPwd(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
        <div>
          <label className="field-label">Confirm Password</label>
          <input type={showPwd ? "text" : "password"} value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            className="field-input" placeholder="Repeat new password" autoComplete="new-password" />
        </div>
      </div>
      {error && (
        <p className="text-sm px-3 py-2 rounded" style={{ background: "hsl(var(--crimson)/0.08)", color: "hsl(var(--crimson))", fontFamily: "'Barlow',sans-serif" }}>{error}</p>
      )}
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "hsl(142 71% 38%/0.08)" }}>
          <CheckCircle size={14} style={{ color: "hsl(142 71% 38%)" }} />
          <p className="text-sm" style={{ color: "hsl(142 71% 38%)", fontFamily: "'Barlow',sans-serif" }}>
            Password set! You can now sign in with email + password.
          </p>
        </div>
      )}
      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Set Password"}
      </button>
    </div>
  );
}
