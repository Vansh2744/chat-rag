import { useNavigate } from "react-router-dom";
import { FileText, Youtube } from "lucide-react";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center text-center px-6">
      <div className="max-w-2xl">
        <div className="flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <FileText className="w-6 h-6 text-black" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-white leading-tight">
          Chat with your <span className="text-amber-400">Documents</span> & Videos
        </h1>

        <p className="text-zinc-500 mt-4 text-sm leading-relaxed">
          Upload PDFs or process YouTube videos and ask anything —
          summaries, explanations, or deep insights powered by AI.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10 w-full max-w-3xl">
        <div
          onClick={() => navigate("/chat-pdf")}
          className="cursor-pointer p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-amber-500/40 transition-all group"
        >
          <FileText className="w-8 h-8 text-amber-400 mb-3 group-hover:scale-110 transition" />
          <h3 className="text-lg font-semibold text-white">Chat with PDFs</h3>
          <p className="text-sm text-zinc-500 mt-2">
            Upload documents and extract insights instantly.
          </p>
        </div>
        <div
          onClick={() => navigate("/chat-youtube")}
          className="cursor-pointer p-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 hover:border-red-500/40 transition-all group"
        >
          <Youtube className="w-8 h-8 text-red-400 mb-3 group-hover:scale-110 transition" />
          <h3 className="text-lg font-semibold text-white">Chat with YouTube</h3>
          <p className="text-sm text-zinc-500 mt-2">
            Turn videos into interactive knowledge.
          </p>
        </div>
      </div>
      <p className="text-xs text-zinc-700 mt-12">
        Built with AI • Fast • Smart • Interactive
      </p>
    </div>
  );
}