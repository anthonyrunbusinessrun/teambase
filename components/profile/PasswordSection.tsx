"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { KeyRound, Eye, EyeOff, CheckCircle } from "lucide-react";

export function PasswordSection() {
  const [currentPwd, setCurrentPwd] = useState("");
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
      const result = await authClient.changePassword({
        currentPassword: currentPwd || '',
        newPassword: newPwd,
        revokeOtherSessions: false,
      });
      if (result.error) {
        setError(result.error.message || "Failed to set password.");
      } else {
        setSuccess(true);
        setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch (e) {
      setError(String(e));
    }
    setSaving(false);
  };

  return (
    <div className="card-base p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound size={16} style={{ color: "hsl(var(--crimson))" }} />
        <h3 className="heading-sm text-foreground">Password</h3>
      </div>

      <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Barlow',sans-serif" }}>
        Set a password so you can sign in with email + password instead of magic links.
      </p>

      <div className="space-y-3">
        <div>
          <label className="field-label">Current Password <span style={{ opacity: 0.5 }}>(leave blank if not set yet)</span></label>
          <div className="relative">
            <input type={showPwd ? "text" : "password"} value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              className="field-input pr-10" placeholder="Current password (if any)" autoComplete="current-password" />
            <button type="button" onClick={() => setShowPwd(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="field-label">New Password</label>
          <input type={showPwd ? "text" : "password"} value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            className="field-input" placeholder="At least 8 characters" autoComplete="new-password" />
        </div>

        <div>
          <label className="field-label">Confirm New Password</label>
          <input type={showPwd ? "text" : "password"} value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            className="field-input" placeholder="Repeat new password" autoComplete="new-password" />
        </div>
      </div>

      {error && (
        <p className="text-sm px-3 py-2 rounded" style={{ background: "hsl(var(--crimson)/0.08)", color: "hsl(var(--crimson))", fontFamily: "'Barlow',sans-serif" }}>
          {error}
        </p>
      )}

      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "hsl(142 71% 38%/0.08)" }}>
          <CheckCircle size={14} style={{ color: "hsl(142 71% 38%)" }} />
          <p className="text-sm" style={{ color: "hsl(142 71% 38%)", fontFamily: "'Barlow',sans-serif" }}>
            Password updated! You can now sign in with email + password.
          </p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Set Password"}
      </button>
    </div>
  );
}
