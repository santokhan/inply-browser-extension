import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export function EmailField({ value, onChange, disabled }) {
  return (
    <div className="auth-field">
      <label htmlFor="auth-email">Email address</label>
      <div className="auth-input-wrap">
        <Mail size={16} aria-hidden="true" />
        <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required value={value} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

export function PasswordField({ value, onChange, disabled, creating = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label htmlFor="auth-password">Password</label>
      <div className="auth-input-wrap">
        <LockKeyhole size={16} aria-hidden="true" />
        <input id="auth-password" name="password" type={visible ? "text" : "password"} autoComplete={creating ? "new-password" : "current-password"} placeholder={creating ? "Create a password" : "Enter your password"} required minLength={creating ? 6 : undefined} aria-describedby={creating ? "password-hint" : undefined} value={value} onChange={onChange} disabled={disabled} />
        <button className="auth-password-toggle" type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)} disabled={disabled}>
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {creating && <p id="password-hint" className="auth-hint">Use at least 6 characters.</p>}
    </div>
  );
}
