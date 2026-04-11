import { Zap, X, ArrowRight } from "lucide-react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  used: number;
  limit: number;
};

export function TokenLimitModal({ isOpen, onClose, used, limit }: Props) {
  if (!isOpen) return null;

  const pct = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>

        <h2 className="text-base font-semibold text-zinc-100 mb-1">
          Free token limit reached
        </h2>
        <p className="text-sm text-zinc-500 leading-relaxed mb-5">
          You've used all {limit.toLocaleString()} free tokens. Upgrade to keep
          chatting without limits.
        </p>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
            <span>{used.toLocaleString()} used</span>
            <span>{limit.toLocaleString()} limit</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-amber-400 to-amber-600 hover:opacity-90 text-amber-950 font-medium text-sm py-2.5 rounded-xl transition-opacity">
          Upgrade to Pro <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={onClose}
          className="w-full mt-2 text-sm text-zinc-600 hover:text-zinc-400 py-2 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}