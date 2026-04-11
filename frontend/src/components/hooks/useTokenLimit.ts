import { useState, useCallback } from "react";

type TokenLimitState = {
  showModal: boolean;
  used: number;
  limit: number;
};

export function useTokenLimit() {
  const [state, setState] = useState<TokenLimitState>({
    showModal: false,
    used: 0,
    limit: 10_000,
  });

  // Call this when you catch a 429 from the API
  const handleLimitError = useCallback((err: any) => {
    const detail = err?.response?.data?.detail ?? err?.detail;
    if (detail?.code === "TOKEN_LIMIT_EXCEEDED") {
      setState({
        showModal: true,
        used: detail.used ?? 0,
        limit: detail.limit ?? 10_000,
      });
      return true; // was a limit error
    }
    return false;
  }, []);

  // For fetch-based streaming (no axios), check HTTP 429
  const handleStreamLimitError = useCallback(async (response: Response) => {
    if (response.status === 429) {
      try {
        const body = await response.json();
        const detail = body?.detail;
        setState({
          showModal: true,
          used: detail?.used ?? 0,
          limit: detail?.limit ?? 10_000,
        });
      } catch {
        setState((s) => ({ ...s, showModal: true }));
      }
      return true;
    }
    return false;
  }, []);

  const closeModal = useCallback(
    () => setState((s) => ({ ...s, showModal: false })),
    []
  );

  return { ...state, handleLimitError, handleStreamLimitError, closeModal };
}