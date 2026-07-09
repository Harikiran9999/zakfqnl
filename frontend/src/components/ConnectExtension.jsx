import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Puzzle } from "lucide-react";
import { toast } from "sonner";

export default function ConnectExtension() {
  const [copied, setCopied] = useState(false);
  const token = localStorage.getItem("bounce_token") || "";

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Connection code copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 130, damping: 18 }}
                className="max-w-2xl" data-testid="connect-extension">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-[14px] bg-[var(--ink)] flex items-center justify-center">
          <Puzzle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Connect the Bounce extension</h2>
          <p className="text-sm text-[#6b7280]">Link your browser to your memory layer.</p>
        </div>
      </div>

      <div className="card-surface p-6 space-y-5">
        <ol className="space-y-4 text-sm text-[#374151]">
          <li className="flex gap-3"><Step n={1} /> Install the Bounce extension in Chrome.</li>
          <li className="flex gap-3"><Step n={2} /> Open the popup and choose <span className="font-medium">Paste connection code</span>.</li>
          <li className="flex gap-3"><Step n={3} /> Paste the code below. That's it.</li>
        </ol>

        <div className="rounded-[14px] border border-[var(--border)] bg-[#F9FAFB] p-3 flex items-center gap-3">
          <code data-testid="connect-token" className="flex-1 text-xs text-[#4b5563] break-all font-mono">
            {token ? token : "Sign in to generate a code"}
          </code>
          <button data-testid="copy-token-btn" onClick={copy} disabled={!token}
                  className="btn-primary focus-ring px-3 py-2 text-xs font-medium flex items-center gap-1.5 disabled:opacity-40">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const Step = ({ n }) => (
  <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--glow)] text-[var(--accent)] text-xs font-semibold flex items-center justify-center">
    {n}
  </span>
);
