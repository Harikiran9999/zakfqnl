import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function parseHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  return { session_id: params.get("session_id"), session_token: params.get("session_token") };
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser, checkAuth } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    (async () => {
      const { session_id, session_token } = parseHash();
      try {
        if (session_id) {
          const res = await api.post("/auth/session", { session_id });
          if (res.data.session_token) localStorage.setItem("bounce_token", res.data.session_token);
          setUser(res.data.user);
        } else if (session_token) {
          localStorage.setItem("bounce_token", session_token);
          await checkAuth();
        }
      } catch (e) {
        // fall through to login
      } finally {
        window.history.replaceState(null, "", "/dashboard");
        navigate("/dashboard", { replace: true });
      }
    })();
  }, [navigate, setUser, checkAuth]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[var(--bg)]">
      <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] memory-glow" />
      <p className="text-sm text-[var(--muted,#6b7280)] tracking-tight">Preparing your memory layer…</p>
    </div>
  );
}
