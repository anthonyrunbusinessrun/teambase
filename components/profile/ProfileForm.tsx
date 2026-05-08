"use client";

import { useState, useTransition, useRef } from "react";
import { updateProfile } from "@/lib/actions/profile";
import { Camera, Save, User, Briefcase, MapPin, Phone, FileText, Loader2 } from "lucide-react";

interface Props {
  userId: string; email: string;
  currentName: string; currentPosition: string; currentBio: string;
  currentPhone: string; currentLocation: string; currentAvatar: string | null;
}

function getAvatarSrc(userId: string, name: string, avatarUrl: string | null): string {
  if (avatarUrl) return avatarUrl;
  const seed = encodeURIComponent(name || userId);
  return `https://api.dicebear.com/8.x/notionists/svg?seed=${seed}&backgroundColor=c41230,1B3A6B&scale=80`;
}

export function ProfileForm({ userId, email, currentName, currentPosition, currentBio, currentPhone, currentLocation, currentAvatar }: Props) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatar, setAvatar] = useState(currentAvatar);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: currentName, positionTitle: currentPosition,
    bio: currentBio, phone: currentPhone, location: currentLocation,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError("Image must be under 3MB"); return; }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch("/api/upload/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setAvatar(data.avatarUrl);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSaved(false);
    startTransition(async () => {
      try {
        await updateProfile(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch (err) { setError(String(err)); }
    });
  };

  const avatarSrc = getAvatarSrc(userId, form.name, avatar);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Avatar */}
      <div className="card-base p-5">
        <div className="flex items-center gap-5">
          <div className="relative group flex-shrink-0">
            <div className="w-20 h-20 rounded overflow-hidden"
              style={{ outline: "3px solid hsl(var(--crimson) / 0.25)", background: "hsl(var(--charcoal))" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatarSrc} alt={form.name} className="w-full h-full object-cover" />
            </div>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded" style={{ background: "rgba(0,0,0,0.6)" }}>
                <Loader2 size={18} color="white" className="animate-spin" />
              </div>
            )}
            {!uploading && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: "rgba(0,0,0,0.5)" }}>
                <Camera size={18} color="white" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex-1">
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.25rem", lineHeight: 1 }}>
              {form.name || email}
            </div>
            {form.positionTitle && (
              <div className="label-caps mt-1" style={{ color: "hsl(var(--crimson))" }}>{form.positionTitle}</div>
            )}
            <div className="label-caps mt-0.5">{email}</div>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="label-caps mt-2 inline-flex items-center gap-1"
              style={{ color: "hsl(var(--crimson))", fontSize: "0.6rem" }}>
              <Camera size={10} /> {uploading ? "Uploading…" : "Change photo (max 3MB)"}
            </button>
          </div>
        </div>
      </div>

      {/* Fields */}
      <div className="card-base p-5 space-y-4">
        <h2 className="heading-sm border-b border-border pb-2">Personal Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label flex items-center gap-1"><User size={10} /> Full Name</label>
            <input type="text" className="field-input" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" required />
          </div>
          <div>
            <label className="field-label flex items-center gap-1"><Briefcase size={10} /> Position Title</label>
            <input type="text" className="field-input" value={form.positionTitle}
              onChange={e => setForm(p => ({ ...p, positionTitle: e.target.value }))} placeholder="e.g. Operations Manager" />
          </div>
        </div>
        <div>
          <label className="field-label flex items-center gap-1"><FileText size={10} /> Bio</label>
          <textarea className="field-input resize-none" rows={3} value={form.bio}
            onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Brief description about yourself…" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="field-label flex items-center gap-1"><Phone size={10} /> Phone</label>
            <input type="tel" className="field-input" value={form.phone}
              onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <label className="field-label flex items-center gap-1"><MapPin size={10} /> Location</label>
            <input type="text" className="field-input" value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Austin, TX" />
          </div>
        </div>
      </div>

      {/* Account */}
      <div className="card-base p-5">
        <h2 className="heading-sm border-b border-border pb-2 mb-3">Account</h2>
        <div>
          <label className="field-label">Email Address</label>
          <div className="field-input" style={{ opacity: 0.6, background: "hsl(var(--muted))", cursor: "not-allowed" }}>{email}</div>
          <p className="label-caps mt-1" style={{ fontSize: "0.58rem" }}>Contact admin to change email.</p>
        </div>
      </div>

      {error && (
        <div className="card-accent p-3">
          <p className="text-sm" style={{ color: "hsl(var(--crimson))", fontFamily: "'Barlow', sans-serif" }}>{error}</p>
        </div>
      )}

      <button type="submit" disabled={isPending || uploading} className="btn-primary w-full justify-center">
        <Save size={14} />
        {isPending ? "Saving…" : saved ? "✓ Saved!" : "Save Profile"}
      </button>
    </form>
  );
}
