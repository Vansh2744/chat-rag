import { useState, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  Loader2,
  Send,
  ChevronDown,
  Sparkles,
  Bot,
  User,
} from "lucide-react";
import axios from "axios";
import { useCurrentUser } from "../context/userContext";
import { backendUrl } from "../../utils/backendUrl";
import { TokenLimitModal } from "../TokenLimitModal";
import { useTokenLimit } from "../hooks/useTokenLimit";

type UploadedFile = {
  id: string;
  doc_name: string;
  doc_id: string;
  source_type: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function ChatWithPDF() {
  const { user } = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const { showModal, used, limit, handleStreamLimitError, closeModal } =
    useTokenLimit();

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUploadedFiles = async () => {
    try {
      const { data } = await axios.get(
        `${backendUrl}/get-uploaded-files/${user?.id}`,
      );
      const pdfOnly = data.filter(
        (f: UploadedFile) => f.source_type === "pdf" || f.source_type == null,
      );
      setUploadedFiles(pdfOnly);
      if (pdfOnly.length > 0) setSelectedDocId(pdfOnly[0].doc_id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f?.type === "application/pdf") setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f?.type === "application/pdf") setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", user!.id);
      await axios.post(`${backendUrl}/upload-chat-pdf/`, formData);
      setFile(null);
      await fetchUploadedFiles();
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = async () => {
    if (!question.trim() || !selectedDocId || isStreaming) return;

    const userMsg: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const formData = new FormData();
      formData.append("question", userMsg.content);
      formData.append("user_id", user!.id);
      formData.append("doc_id", selectedDocId);

      const response = await fetch(`${backendUrl}/chat-with-pdf/`, {
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
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const { content } = JSON.parse(data);
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1].content += content;
                return updated;
              });
            } catch {}
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsStreaming(false);
    }
  };

  const selectedDoc = uploadedFiles.find((f) => f.doc_id === selectedDocId);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto w-full px-4 py-6">
      <div className="flex items-center justify-between flex-shrink-0">
        <h1 className="flex items-center gap-2.5 text-xl font-semibold text-zinc-100">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex-shrink-0">
            <Sparkles className="w-4 h-4 text-amber-950" />
          </span>
          PDF Chat
        </h1>

        {uploadedFiles.length > 0 && (
          <div className="relative">
            <select
              value={selectedDocId}
              onChange={(e) => {
                setSelectedDocId(e.target.value);
                setMessages([]);
              }}
              className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm pl-3 pr-8 py-2 rounded-xl cursor-pointer outline-none transition-colors hover:border-zinc-700 focus:border-amber-600/50 max-w-[220px] truncate"
            >
              {uploadedFiles.map((f) => (
                <option key={f.doc_id} value={f.doc_id}>
                  {f.doc_name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
        className={[
          "flex items-center gap-3 flex-shrink-0 rounded-xl border border-dashed px-4 py-3 cursor-pointer transition-all",
          dragOver
            ? "border-amber-500/40 bg-amber-950/20"
            : file
              ? "border-amber-600/30 bg-amber-950/10"
              : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700",
        ].join(" ")}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          Choose PDF
        </button>

        <span
          className={`text-sm flex-1 truncate ${file ? "text-zinc-300" : "text-zinc-600"}`}
        >
          {file ? file.name : "or drag & drop a PDF here"}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleUpload();
          }}
          disabled={!file || isUploading}
          className="flex items-center gap-1.5 text-xs font-medium text-amber-950 bg-gradient-to-br from-amber-400 to-amber-600 hover:opacity-90 px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" /> Upload
            </>
          )}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1 min-h-0">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 text-zinc-600">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800">
              <FileText className="w-7 h-7 text-zinc-700" />
            </div>
            <p className="text-lg font-medium text-zinc-500">
              {selectedDoc
                ? `Chat with "${selectedDoc.doc_name}"`
                : "No document selected"}
            </p>
            <p className="text-sm text-center max-w-xs leading-relaxed text-zinc-600">
              {selectedDoc
                ? "Ask anything — summaries, key facts, explanations, or comparisons."
                : "Upload a PDF above or select one from your library to get started."}
            </p>
            {selectedDoc && (
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                {[
                  "Summarise this document",
                  "What are the key takeaways?",
                  "List the main topics",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuestion(s)}
                    className="text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-300 px-3.5 py-1.5 rounded-full transition-colors"
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
              className={`flex gap-3 items-start ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={[
                  "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg mt-0.5",
                  msg.role === "assistant"
                    ? "bg-amber-950/40 border border-amber-600/20"
                    : "bg-zinc-800 border border-zinc-700",
                ].join(" ")}
              >
                {msg.role === "assistant" ? (
                  <Bot className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                )}
              </div>
              <div
                className={[
                  "max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tr-sm"
                    : "bg-zinc-900/80 border border-zinc-800 text-zinc-200 rounded-tl-sm",
                ].join(" ")}
              >
                {msg.content === "" &&
                msg.role === "assistant" &&
                isStreaming ? (
                  <div className="flex items-center gap-1 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-bounce [animation-delay:300ms]" />
                  </div>
                ) : (
                  <>
                    {msg.content}
                    {msg.role === "assistant" &&
                      isStreaming &&
                      i === messages.length - 1 &&
                      msg.content && (
                        <span className="inline-block w-0.5 h-3.5 bg-amber-500 ml-0.5 align-middle rounded-sm animate-pulse" />
                      )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex-shrink-0 flex items-end gap-2 bg-zinc-900 border border-zinc-800 focus-within:border-amber-600/30 rounded-2xl px-4 py-3 transition-colors">
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
            selectedDoc
              ? `Ask about "${selectedDoc.doc_name}"…`
              : "Select a PDF to start chatting"
          }
          disabled={!selectedDocId || isStreaming}
          className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-zinc-100 placeholder:text-zinc-600 leading-relaxed min-h-[22px] max-h-[120px] caret-amber-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!question.trim() || !selectedDocId || isStreaming}
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 hover:opacity-90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {isStreaming ? (
            <Loader2 className="w-4 h-4 text-amber-950 animate-spin" />
          ) : (
            <Send className="w-4 h-4 text-amber-950" />
          )}
        </button>
      </div>

      <p className="flex-shrink-0 text-center text-[11px] text-zinc-700 -mt-2">
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
