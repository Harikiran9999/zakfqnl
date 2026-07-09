import { motion } from "framer-motion";
import { API } from "@/lib/api";

const spring = { type: "spring", stiffness: 130, damping: 18 };

export default function Login() {
  const handleGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleGithub = () => {
    const redirect = window.location.origin;
    window.location.href = `${API}/auth/github/login?redirect=${encodeURIComponent(redirect)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" data-testid="login-page">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={spring}
                  className="card-surface w-full max-w-[420px] p-10">
        <div className="flex flex-col items-center text-center">
          <div className="w-11 h-11 rounded-[14px] bg-[var(--ink)] flex items-center justify-center mb-6">
            <span className="w-2.5 h-2.5 rounded-full bg-white memory-glow" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Bounce</h1>
          <p className="mt-2 text-sm text-[#6b7280] leading-relaxed">
            Your memory layer for every AI. Sign in to continue.
          </p>

          <div className="mt-8 w-full space-y-3">
            <button data-testid="google-login-btn" onClick={handleGoogle}
                    className="w-full h-12 rounded-[14px] border border-[var(--border)] bg-white flex items-center justify-center gap-3 text-sm font-medium transition-transform duration-200 hover:scale-[1.02] focus-ring">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
              Continue with Google
            </button>
            <button data-testid="github-login-btn" onClick={handleGithub}
                    className="w-full h-12 rounded-[14px] bg-[var(--ink)] text-white flex items-center justify-center gap-3 text-sm font-medium transition-transform duration-200 hover:scale-[1.02] focus-ring">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z"/></svg>
              Continue with GitHub
            </button>
          </div>

          <p className="mt-8 text-xs text-[#9ca3af] leading-relaxed">
            No passwords. We only store structured memory, never your raw conversations.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
