import { useState, useRef, useEffect } from "react";
import {
  Youtube,
  Send,
  Loader2,
  Bot,
  User,
  ChevronDown,
  Play,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import axios from "axios";
import { backendUrl } from "../../utils/backendUrl";
import { useCurrentUser } from "../context/userContext";
import { TokenLimitModal } from "../TokenLimitModal";
import { useTokenLimit } from "../hooks/useTokenLimit";

type Message = { role: "user" | "assistant"; content: string };
type VideoDoc = {
  doc_id: string;
  doc_name: string;
  source_url: string;
  created_at: string;
};
type ProcessStep = "idle" | "processing" | "done" | "error";

export function ChatWithYouTube() {
  const { user } = useCurrentUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [videos, setVideos] = useState<VideoDoc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [loadingVideos, setLoadingVideos] = useState(true);

  const [url, setUrl] = useState("");
  const [processStep, setProcessStep] = useState<ProcessStep>("idle");
  const [processError, setProcessError] = useState("");
  const [newVideoTitle, setNewVideoTitle] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const { showModal, used, limit, handleStreamLimitError, closeModal } =
    useTokenLimit();

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchVideos = async () => {
    setLoadingVideos(true);
    try {
      const { data } = await axios.get(
        `${backendUrl}/yt-chat/videos/${user?.id}`,
      );
      setVideos(data);
      if (data.length > 0) setSelectedDocId(data[0].doc_id);
    } finally {
      setLoadingVideos(false);
    }
  };

  const handleProcessVideo = async () => {
    if (!url.trim()) return;
    setProcessStep("processing");
    setProcessError("");

    try {
      const { data } = await axios.post(
        `${backendUrl}/yt-chat/process-video`,
        { url: url.trim(), user_id: String(user!.id) },
        { headers: { "Content-Type": "application/json" } },
      );

      setNewVideoTitle(data.video_title);
      setProcessStep("done");
      await fetchVideos();
      setSelectedDocId(data.doc_id);
      setMessages([]);
      setUrl("");
    } catch (err: any) {
      const raw = err.response?.data?.detail;
      const msg =
        typeof raw === "string"
          ? raw
          : Array.isArray(raw)
            ? raw
                .map((e: any) => `${e.loc?.slice(-1)[0]}: ${e.msg}`)
                .join(" · ")
            : `HTTP ${err.response?.status ?? "?"} — Failed to process video.`;
      setProcessError(msg);
      setProcessStep("error");
      console.error("process-video error:", err.response?.data);
    }
  };

  const handleSend = async () => {
    if (!question.trim() || !selectedDocId || isStreaming) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((p) => [...p, userMsg, { role: "assistant", content: "" }]);
    setQuestion("");
    setIsStreaming(true);

    try {
      const formData = new FormData();
      formData.append("question", userMsg.content);
      formData.append("user_id", String(user!.id));
      formData.append("doc_id", selectedDocId);

      const response = await fetch(`${backendUrl}/yt-chat/chat/`, {
        method: "POST",
        body: formData,
      });

      if (await handleStreamLimitError(response)) {
        setMessages((prev) => prev.slice(0, -1));
        setIsStreaming(false);
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          try {
            const { content } = JSON.parse(raw);
            setMessages((p) => {
              const u = [...p];
              u[u.length - 1].content += content;
              return u;
            });
          } catch {}
        }
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const selectedVideo = videos.find((v) => v.doc_id === selectedDocId);

  const suggestions = [
    "Summarise this video",
    "What are the key points?",
    "Explain the main topic simply",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex-shrink-0">
            <Youtube className="w-4 h-4 text-red-400" />
          </span>
          <div>
            <h1 className="text-base font-semibold text-slate-100 leading-none">
              Chat with YouTube
            </h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Ask anything about a video
            </p>
          </div>
        </div>
        {loadingVideos ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading videos...
          </div>
        ) : videos.length > 0 ? (
          <div className="relative">
            <select
              value={selectedDocId}
              onChange={(e) => {
                setSelectedDocId(e.target.value);
                setMessages([]);
              }}
              className="appearance-none bg-slate-900 border border-slate-800 text-slate-300 text-xs pl-3 pr-7 py-2 rounded-xl cursor-pointer outline-none hover:border-slate-700 focus:border-red-500/40 max-w-[200px] truncate"
            >
              {videos.map((v) => (
                <option key={v.doc_id} value={v.doc_id}>
                  {v.doc_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 w-3 h-3" />
          </div>
        ) : null}
      </div>
      <div className="flex-shrink-0 rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Add a new video
        </p>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (processStep !== "processing") {
                setProcessStep("idle");
                setProcessError("");
              }
            }}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && handleProcessVideo()
            }
            placeholder="https://youtube.com/watch?v=..."
            disabled={processStep === "processing"}
            className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 placeholder:text-slate-600 text-sm px-3 py-2 rounded-lg outline-none focus:border-red-500/40 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleProcessVideo}
            disabled={!url.trim() || processStep === "processing"}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex-shrink-0"
          >
            {processStep === "processing" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Process
              </>
            )}
          </button>
        </div>

        {processStep === "done" && (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />"{newVideoTitle}" is ready —
            start chatting!
          </div>
        )}
        {processStep === "error" && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg p-2.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{processError}</span>
          </div>
        )}
        {processStep === "idle" && (
          <p className="text-xs text-slate-700">
            Requires a video with captions or auto-generated subtitles.
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800">
              <Youtube className="w-7 h-7 text-slate-700" />
            </div>
            <p className="text-base font-medium text-slate-500">
              {selectedVideo
                ? `Chatting with "${selectedVideo.doc_name}"`
                : "No video selected"}
            </p>
            <p className="text-sm text-center max-w-xs leading-relaxed text-slate-600">
              {selectedVideo
                ? "Ask anything — key ideas, summaries, clarifications."
                : "Process a YouTube video above, or pick one you've already added."}
            </p>
            {selectedVideo && (
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuestion(s)}
                    className="text-xs text-slate-500 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-slate-300 px-3.5 py-1.5 rounded-full transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={[
                  "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg mt-0.5",
                  msg.role === "assistant"
                    ? "bg-red-950/40 border border-red-800/30"
                    : "bg-slate-800 border border-slate-700",
                ].join(" ")}
              >
                {msg.role === "assistant" ? (
                  <Bot className="w-3.5 h-3.5 text-red-400" />
                ) : (
                  <User className="w-3.5 h-3.5 text-slate-500" />
                )}
              </div>
              <div
                className={[
                  "max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-slate-800 border border-slate-700 text-slate-200 rounded-tr-sm"
                    : "bg-slate-900/80 border border-slate-800 text-slate-200 rounded-tl-sm",
                ].join(" ")}
              >
                {msg.content === "" &&
                msg.role === "assistant" &&
                isStreaming ? (
                  <div className="flex items-center gap-1 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                ) : (
                  <>
                    {msg.content}
                    {msg.role === "assistant" &&
                      isStreaming &&
                      i === messages.length - 1 &&
                      msg.content && (
                        <span className="inline-block w-0.5 h-3.5 bg-red-400 ml-0.5 align-middle rounded-sm animate-pulse" />
                      )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 flex items-end gap-2 bg-slate-900 border border-slate-800 focus-within:border-red-500/30 rounded-2xl px-4 py-3 transition-colors">
        <textarea
          value={question}
          rows={1}
          onChange={(e) => {
            setQuestion(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            selectedVideo
              ? `Ask about "${selectedVideo.doc_name}"…`
              : "Process a video first"
          }
          disabled={!selectedDocId || isStreaming}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-slate-100 placeholder:text-slate-600 leading-relaxed min-h-[22px] max-h-[120px] caret-red-400 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!question.trim() || !selectedDocId || isStreaming}
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-red-500 hover:bg-red-400 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </button>
      </div>

      <p className="flex-shrink-0 text-center text-[11px] text-slate-700 -mt-2">
        Enter to send · Shift+Enter for new line
      </p>

      <TokenLimitModal
        isOpen={showModal}
        onClose={closeModal}
        used={used}
        limit={limit}
      />
    </div>
  );
}
