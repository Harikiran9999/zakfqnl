import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const ORB = "https://static.prod-images.emergentagent.com/jobs/c91f3d62-59bb-4e35-ae05-5c30305c47ad/images/cb5ff670d037c35a41232e2978bf373ce89d44356a3f404e23ee78d8264f5020.png";

const spring = { type: "spring", stiffness: 120, damping: 18 };

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen relative overflow-hidden" data-testid="landing-page">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(79,70,229,0.06), transparent 70%)" }} />
      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[10px] bg-[var(--ink)] flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-white memory-glow" />
          </div>
          <span className="font-semibold tracking-tight">Bounce</span>
        </div>
        <button data-testid="nav-signin-btn" onClick={() => navigate("/login")}
                className="btn-ghost focus-ring px-4 py-2 text-sm font-medium">Sign in</button>
      </nav>

      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-16 items-center">
        <div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-medium text-[var(--ink)] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" /> The AI memory layer
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.05 }}
                     className="text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)]">
            Save memory,<br />not messages.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.12 }}
                    className="mt-6 text-lg text-[#4b5563] max-w-md leading-relaxed">
            Bounce is iCloud for your AI conversations. Never copy a chat again — carry your context
            into any AI, instantly.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.18 }}
                      className="mt-10 flex items-center gap-3">
            <button data-testid="get-started-btn" onClick={() => navigate("/login")}
                    className="btn-primary focus-ring px-6 py-3 text-sm font-medium">Get started</button>
            <span className="text-sm text-[#6b7280]">Free during beta</span>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ ...spring, delay: 0.1 }} className="flex justify-center">
          <motion.img src={ORB} alt="Memory" className="w-[360px] h-[360px] object-contain select-none"
                      animate={{ y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} />
        </motion.div>
      </main>
    </div>
  );
}
