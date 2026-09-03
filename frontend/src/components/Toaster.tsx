import React, {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  ReactNode,
} from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Toast system — call `showToast({ type, message })` from anywhere, including
// right after a modal's onClose(), e.g.:
//
//   function handleCreate(link: Link) {
//     setLinks(prev => [link, ...prev]);
//     setModalOpen(false);
//     showToast({ type: "success", message: `${link.short_code} created` });
//   }
// ---------------------------------------------------------------------------

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastInput {
  type?: ToastType;
  message: string;
  description?: string | null;
}

interface ToastItem extends ToastInput {
  id: string;
  type: ToastType;
}

type ShowToast = (toast: ToastInput) => void;

const ToastContext = createContext<ShowToast | null>(null);

const ICONS: Record<ToastType, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

interface ToastStyle {
  bg: string;
  border: string;
  icon: string;
  accent: string;
}

const STYLES: Record<ToastType, ToastStyle> = {
  success: { bg: "bg-white", border: "border-[#E4E0D6]", icon: "text-[#0F6B5C]", accent: "bg-[#0F6B5C]" },
  error:   { bg: "bg-white", border: "border-[#E4E0D6]", icon: "text-[#C4402E]", accent: "bg-[#C4402E]" },
  warning: { bg: "bg-white", border: "border-[#E4E0D6]", icon: "text-[#8A5C10]", accent: "bg-[#E8A33D]" },
  info:    { bg: "bg-white", border: "border-[#E4E0D6]", icon: "text-[#3E6FA8]", accent: "bg-[#3E6FA8]" },
};

interface ToastProps extends ToastItem {
  onDismiss: (id: string) => void;
}

function Toast({ id, type, message, description, onDismiss }: ToastProps) {
  const Icon = ICONS[type] ?? Info;
  const s = STYLES[type] ?? STYLES.info;

  useEffect(() => {
    const t = setTimeout(() => onDismiss(id), 4000);
    return () => clearTimeout(t);
  }, [id, onDismiss]);

  return (
    <div
      className={`relative overflow-hidden w-full max-w-sm rounded-lg border ${s.border} ${s.bg} shadow-lg pointer-events-auto animate-[toast-in_0.2s_ease-out]`}
      role="status"
    >
      <div className={`absolute left-0 top-0 h-full w-0.5 ${s.accent}`} />
      <div className="flex items-start gap-3 pl-4 pr-3 py-3">
        <Icon size={17} className={`${s.icon} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#0B0F0E]">{message}</p>
          {description && (
            <p className="text-xs text-[#8A867D] mt-0.5">{description}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(id)}
          className="shrink-0 text-[#B3AFA5] hover:text-[#0B0F0E] transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback<ShowToast>(({ type = "info", message, description }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, description }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <Toast key={t.id} {...t} onDismiss={dismiss} />
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

