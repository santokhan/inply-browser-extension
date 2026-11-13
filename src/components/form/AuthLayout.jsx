import { FileCheck2, FolderHeart, Sparkles, Zap } from "lucide-react";

export default function AuthLayout({ mode, children }) {
  const signingUp = mode === "signup";
  const resetting = mode === "forgot";

  return (
    <main className="auth-page">
      <section className="auth-intro" aria-label="What you can do with Tenddoo">
        <span className="auth-eyebrow"><Sparkles size={12} aria-hidden="true" /> MADE FOR EPROCURE</span>
        <h1>Your tender work,<br /><span>made simpler.</span></h1>
        <p>Spend less time on repetitive tasks.<br />Keep your next tender moving with Tenddoo.</p>
      </section>

      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card-heading">
          <div>
            <h2 id="auth-title">{resetting ? "Reset your password" : signingUp ? "Create your account" : "Welcome back"}</h2>
            <p>{resetting ? "We’ll send a reset link to your account email." : signingUp ? "Create your Tenddoo account to get started." : "Sign in to your Tenddoo workspace."}</p>
          </div>
        </div>
        {children}
      </section>

      <section className="auth-outro" aria-labelledby="auth-benefits-title">
        <h2 id="auth-benefits-title">A little help with every tender</h2>
        <ul className="auth-benefits">
          <li><span className="auth-benefit-icon"><Zap size={16} aria-hidden="true" /></span><span>Faster<br />form filling</span></li>
          <li><span className="auth-benefit-icon"><FolderHeart size={16} aria-hidden="true" /></span><span>Saved<br />customer details</span></li>
          <li><span className="auth-benefit-icon"><FileCheck2 size={16} aria-hidden="true" /></span><span>Easier<br />tender tasks</span></li>
        </ul>
      </section>
    </main>
  );
}
