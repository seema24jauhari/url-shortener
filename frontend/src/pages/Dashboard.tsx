import React, { useState, useMemo, useRef, useEffect } from "react";
import type { MouseEvent } from "react";
import {
  Plus,
  X,
  Copy,
  Trash2,
  QrCode,
  ExternalLink,
  Search,
  Check,
  AlertCircle,
  Globe,
  MonitorSmartphone,
  MapPin,
  Link2,
  Clock,
  MousePointerClick,
  LogOut,
  Download,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";
import api, { setAccessToken } from "../api/axios";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/Toaster";

interface QrCodeModalProps {
  shortCode: string | null;
  onClose: () => void;
}

function QrCodeModal({ shortCode, onClose }: QrCodeModalProps) {
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!shortCode) {
      setQrSrc(null);
      return;
    }

    let objectUrl: string | null = null;

    const fetchQr = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/links/${shortCode}/qr`, {
          responseType: "blob", // important — response is a PNG, not JSON
        });
        objectUrl = URL.createObjectURL(res.data);
        setQrSrc(objectUrl);
      } catch (err: any) {
        if (
          err.response?.data.error == "Unauthorized" &&
          err.response?.status === 401
        ) {
          navigate("/");
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchQr();

    // cleanup: revoke the blob URL when shortCode changes or modal unmounts
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [shortCode]);

  if (!shortCode) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0F0E]/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl bg-[#FAFAF7] border border-[#E4E0D6] shadow-xl p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-[#0B0F0E]">QR code</p>
          <button
            onClick={onClose}
            className="text-[#8A867D] hover:text-[#0B0F0E] cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-lg border border-[#E4E0D6] bg-white p-4 inline-flex items-center justify-center w-56 h-56">
          {loading && <p className="text-xs text-[#8A867D]">Loading...</p>}
          {!loading && qrSrc && (
            <img
              src={qrSrc}
              alt={`QR code for ${shortCode}`}
              className="w-48 h-48"
            />
          )}
          {!loading && !qrSrc && (
            <p className="text-xs text-[#C4402E]">Couldn't load QR code</p>
          )}
        </div>

        {qrSrc && (
          <a
            href={qrSrc}
            download={`${shortCode}-qr.png`}
            className="cursor-pointer mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E4E0D6] px-3.5 py-2 text-sm font-medium text-[#0B0F0E] hover:bg-[#EFECE4] transition-colors"
          >
            <Download size={14} /> Download PNG
          </a>
        )}
      </div>
    </div>
  );
}

type LinkStatus = "active" | "expiring" | "expired";

type Link = {
  short_code: string;
  long_url: string;
  clicks?: number;
  expires_at: string | null;
  created_at?: string;
};

type ClickTrend = {
  day: string;
  clicks: number;
};

type CountryBreakdown = {
  country: string;
  clicks: number;
};

type Referrer = {
  source: string;
  pct: number;
};

type Device = {
  type: string;
  pct: number;
};

type CreateLink = Omit<Link, "status"> & {
  status: LinkStatus;
};

type StatusPillProps = {
  status: LinkStatus;
};

type CopyButtonProps = {
  value: string;
  showToast: (toast: {
    type: "success" | "error";
    message: string;
    description?: string;
  }) => void;
};

type CreateLinkModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (link: Link) => void;
  showToast: (toast: {
    type: "success" | "error";
    message: string;
    description?: string;
  }) => void;
};

type StatsPanelProps = {
  link: Link | null;
  setActiveLink: (link: Link | null) => void;
  showToast: (toast: {
    type: "success" | "error";
    message: string;
    description?: string;
  }) => void;
};

type EmptyStateProps = {
  onCreate: () => void;
};

const SHORTENER_DOMAIN = import.meta.env.VITE_SHORTENER_DOMAIN; // Replace with your actual domain

const dashboardSchema = z.object({
  url: z
    .string()
    .url("Enter a valid URL")
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return (
            ["http:", "https:"].includes(parsed.protocol) &&
            !["localhost", "127.0.0.1"].includes(parsed.hostname)
          );
        } catch {
          return false;
        }
      },
      { message: "URL must be http/https and not a local address" },
    ),
  alias: z
    .string()
    .min(8, "Alias must be at least 8 characters")
    .max(30, "Alias can't exceed 30 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Alias can only contain letters, numbers, hyphens, and underscores",
    )
    .optional(),
  expiry: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true; // optional field, empty is fine
        const date = new Date(val);
        return !isNaN(date.getTime());
      },
      { message: "Enter a valid date" },
    )
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // ignore time component
        return date >= today;
      },
      { message: "Expiry can't be in the past" },
    )
    .refine(
      (val) => {
        if (!val) return true;
        const date = new Date(val);
        const oneYearFromNow = new Date();
        oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
        return date <= oneYearFromNow;
      },
      { message: "Expiry can't be more than 1 year away" },
    ),
});

type DashboardForm = z.infer<typeof dashboardSchema>;

// ---------------------------------------------------------------------------

function StatusPill({ status }: StatusPillProps) {
  const styles: Record<LinkStatus, string> = {
    active: "bg-[#0F6B5C]/10 text-[#0F6B5C]",
    expiring: "bg-[#E8A33D]/15 text-[#8A5C10]",
    expired: "bg-[#C4402E]/10 text-[#C4402E]",
  };
  const label: Record<LinkStatus, string> = {
    active: "Active",
    expiring: "Expiring soon",
    expired: "Expired",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === "active"
            ? "bg-[#0F6B5C]"
            : status === "expiring"
              ? "bg-[#E8A33D]"
              : "bg-[#C4402E]"
        }`}
      />
      {label[status]}
    </span>
  );
}

function CopyButton({ value, showToast }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value);
        setCopied(true);
        showToast({
          type: "success",
          message: "Copied to clipboard",
          description: value,
        });
        setTimeout(() => setCopied(false), 1400);
      }}
      className="cursor-pointer inline-flex items-center justify-center h-7 w-7 rounded-md text-[#6B6862] hover:text-[#0B0F0E] hover:bg-[#EFECE4] transition-colors"
      title="Copy short link"
    >
      {copied ? (
        <Check size={14} className="text-[#0F6B5C]" />
      ) : (
        <Copy size={14} />
      )}
    </button>
  );
}

function DeleteLinkModal({
  confirmDelete,
  setConfirmDelete,
  handleDelete,
}: {
  confirmDelete: Link | null;
  setConfirmDelete: (link: Link | null) => void;
  handleDelete: (code: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F0E]/40 backdrop-blur-[2px]"
      onClick={() => setConfirmDelete(null)}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-[#FAFAF7] border border-[#E4E0D6] shadow-xl p-5"
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-[#0B0F0E]">
          Delete this link?
        </p>
        <p className="text-xs text-[#8A867D] mt-1.5">
          <span className="font-mono">
            {SHORTENER_DOMAIN}/{confirmDelete.short_code}
          </span>{" "}
          will stop redirecting immediately. This can't be undone.
        </p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={() => setConfirmDelete(null)}
            className="px-3.5 py-2 text-sm font-medium text-[#6B6862] hover:text-[#0B0F0E] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleDelete(confirmDelete.short_code)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#C4402E] text-white hover:bg-[#A9351F] transition-colors cursor-pointer"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateLinkModal({
  open,
  onClose,
  onCreate,
  showToast,
}: CreateLinkModalProps) {
  const [isUrlExists, setIsUrlExists] = useState(false);
  const [isAliasEmpty, setIsAliasEmpty] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    formState: { errors },
  } = useForm<DashboardForm>({
    resolver: zodResolver(dashboardSchema),
  });

  const onSubmit = async (data: DashboardForm) => {
    setIsSubmitting(true);
    let newLink: Link = {
      short_code: data.alias || Math.random().toString(36).slice(2, 9),
      long_url: data.url,
      expires_at: data.expiry || null,
    };
    try {
      let request = await api.post("/links/create-link", newLink);
      let response = await request.data;
      if (response.error) {
        setApiError(response.message || "Something went wrong");
        setIsSubmitting(false);
      } else {
        onCreate(response.data);
        setTimeout(() => {
          showToast({
            type: "success",
            message: "Link created",
            description: `${response.data.long_url} is live`,
          });
          handleCloseCreateLink();
          setIsSubmitting(false);
        }, 1400);
      }
    } catch (err: any) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (data.statusCode === 401 && data.error === "Unauthorized") {
        navigate("/");
        return;
      }

      if (status === 409) {
        setApiError("Email already exists");
      } else {
        setApiError(data?.message || "Something went wrong");
      }
      setIsSubmitting(false);
    }
  };

  const checkAliasExists = async (alias: string) => {
    if (alias.length > 0) {
      const response = await api.post(`/links/is-exists/${alias}`);
      const data = await response.data.data;
      if (!data.exists) {
        setIsUrlExists(false);
      } else {
        setIsUrlExists(true);
      }
    } else {
      setIsUrlExists(false);
    }
  };

  const handleCloseCreateLink = () => {
    reset();
    onClose();
    setApiError(null);
  };
  const debouncedCheckAlias = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      checkAliasExists(value.replace(/\s/g, "-"));
    }, 500); // 500ms after user stops typing
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-[#0B0F0E]/40 backdrop-blur-[2px]"
      onClick={handleCloseCreateLink}
    >
      <div
        className="w-full max-w-md rounded-xl bg-[#FAFAF7] border border-[#E4E0D6] shadow-xl"
        onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <button
            onClick={handleCloseCreateLink}
            className={`text-[#8A867D] hover:text-[#0B0F0E] cursor-pointer transition-colors flex justify-end`}
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pt-4 pb-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B6862] mb-1.5">
              Destination URL
            </label>
            <input
              autoFocus
              {...register("url")}
              placeholder="https://acme.com/campaigns/..."
              className="w-full rounded-lg border border-[#E4E0D6] bg-white px-3 py-2 text-sm font-mono text-[#0B0F0E] placeholder:text-[#B3AFA5] focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]/30 focus:border-[#0F6B5C]"
            />
            {errors.url && (
              <p className="flex items-center gap-1.5 text-xs text-[#C4402E] mt-1.5">
                <AlertCircle size={12} /> {errors.url.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B6862] mb-1.5">
              Custom alias (optional)
            </label>
            <div className="flex items-center rounded-lg border border-[#E4E0D6] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#0F6B5C]/30 focus-within:border-[#0F6B5C]">
              <span className="pl-3 text-sm font-mono text-[#B3AFA5]">
                {SHORTENER_DOMAIN}/
              </span>
              <input
                {...register("alias", {
                  onChange: (e) => {
                    const value = e.target.value;
                    setIsAliasEmpty(value.trim().length === 0);
                    trigger("alias");
                    debouncedCheckAlias(e.target.value);
                  },
                })}
                placeholder="autumn-launch"
                className="flex-1 py-2 pr-3 text-sm font-mono text-[#0B0F0E] placeholder:text-[#B3AFA5] focus:outline-none"
              />
            </div>
            {isUrlExists && (
              <p className="flex items-center gap-1.5 text-xs text-[#C4402E] mt-1.5">
                <AlertCircle size={12} /> This alias is already taken. Please
                choose another one.
              </p>
            )}
            {errors.alias && (
              <p className="flex items-center gap-1.5 text-xs text-[#C4402E] mt-1.5">
                <AlertCircle size={12} /> {errors.alias.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B6862] mb-1.5">
              Expires (optional)
            </label>
            <input
              type="date"
              {...register("expiry")}
              className="w-full rounded-lg border border-[#E4E0D6] bg-white px-3 py-2 text-sm text-[#0B0F0E] focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]/30 focus:border-[#0F6B5C]"
            />
            {errors.expiry && (
              <p className="flex items-center gap-1.5 text-xs text-[#C4402E] mt-1.5">
                <AlertCircle size={12} /> {errors.expiry.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#E4E0D6]">
          <button
            onClick={handleCloseCreateLink}
            className="px-3.5 py-2 text-sm font-medium text-[#6B6862] hover:text-[#0B0F0E] cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isUrlExists || isAliasEmpty || isSubmitting}
            className="cursor-pointer px-4 py-2 rounded-lg text-sm font-medium bg-[#0F6B5C] text-white hover:bg-[#0C5A4D] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Create link
          </button>
        </div>

        {apiError && (
          <div className="flex items-start gap-2  border border-[#C4402E]/20 bg-[#C4402E]/5 px-3 py-2.5">
            <AlertCircle size={14} className="text-[#C4402E] shrink-0 mt-0.5" />
            <p className="text-xs text-[#C4402E]">{apiError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatsPanel({ link, setActiveLink, showToast }: StatsPanelProps) {
  const [clickTrend, setClickTrend] = useState<ClickTrend[]>([]);
  const [countryBreakdown, setCountryBreakdown] = useState<CountryBreakdown[]>(
    [],
  );
  const [referrerBreakdown, setReferrerBreakdown] = useState<Referrer[]>([]);
  const [deviceBreakdown, setDeviceBreakdown] = useState<Device[]>([]);
  const [showQr, setShowQr] = useState(false); // ← new
  const navigate = useNavigate();

  const handleFetchStats = async (link: Link) => {
    try {
      const req = await api.post(`/links/${link.short_code}/stats`);
      const res = await req.data.data.stats;
      console.log("Fetched stats:", res); // Debugging line
      setClickTrend(res.click_trend);
      setCountryBreakdown(res.country_breakdown);
      setReferrerBreakdown(res.referrer_breakdown);
      setDeviceBreakdown(res.device_breakdown);
    } catch (err: any) {
      if (
        err.response?.data.error == "Unauthorized" &&
        err.response?.status === 401
      ) {
        navigate("/");
        return;
      }
      showToast({
        type: "error",
        message: "Couldn't fetch stats",
        description: "Please try again",
      });
    }
  };

  useEffect(() => {
    if (link) {
      handleFetchStats(link);
    }
  }, [link]);
  
  if (!link) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="flex-1 bg-[#0B0F0E]/30 backdrop-blur-[1px]"
        onClick={() => setActiveLink(null)}
      />
      <div className="w-full max-w-md bg-[#FAFAF7] border-l border-[#E4E0D6] h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#FAFAF7]/95 backdrop-blur border-b border-[#E4E0D6] px-6 py-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-mono text-[#0F6B5C]">{`${SHORTENER_DOMAIN}/${link.short_code}`}</p>
            <p className="text-xs text-[#8A867D] mt-1 truncate max-w-[280px]">
              {link.long_url}
            </p>
          </div>
          <button
            onClick={() => setActiveLink(null)}
            className="text-[#8A867D] hover:text-[#0B0F0E] mt-0.5 cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#E4E0D6] bg-white p-3">
              <p className="text-[11px] text-[#8A867D] mb-1">Total clicks</p>
              <p className="text-xl font-semibold text-[#0B0F0E] tabular-nums">
                {link.clicks}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E0D6] bg-white p-3">
              <p className="text-[11px] text-[#8A867D] mb-1">Created</p>
              <p className="text-sm font-medium text-[#0B0F0E] mt-1.5">
                {link.created_at}
              </p>
            </div>
            <div className="rounded-lg border border-[#E4E0D6] bg-white p-3">
              <p className="text-[11px] text-[#8A867D] mb-1">Expires</p>
              <p className="text-sm font-medium text-[#0B0F0E] mt-1.5">
                {link.expires_at || "Never"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#6B6862] mb-2">
              Clicks — last 7 days
            </p>
            <div className="rounded-lg border border-[#E4E0D6] bg-white p-3 h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={clickTrend}
                  margin={{ top: 5, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke="#EFECE4" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#8A867D" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#8A867D" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #E4E0D6",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="clicks"
                    stroke="#0F6B5C"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {countryBreakdown.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#6B6862] mb-2 flex items-center gap-1.5">
                <MapPin size={12} /> Top countries
              </p>
              <div className="rounded-lg border border-[#E4E0D6] bg-white p-3 h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={countryBreakdown}
                    margin={{ top: 5, right: 8, left: -24, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="country"
                      tick={{ fontSize: 11, fill: "#8A867D" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#8A867D" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: "1px solid #E4E0D6",
                      }}
                    />
                    <Bar
                      dataKey="clicks"
                      fill="#0F6B5C"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {(referrerBreakdown.length > 0 || deviceBreakdown.length > 0) && (
            <div className="grid grid-cols-2 gap-4">
              {referrerBreakdown.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#6B6862] mb-2 flex items-center gap-1.5">
                    <Globe size={12} /> Referrers
                  </p>
                  <div className="space-y-1.5">
                    {referrerBreakdown.map((r) => (
                      <div
                        key={r.source}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-24 text-[#6B6862] truncate">
                          {r.source}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#EFECE4] overflow-hidden">
                          <div
                            className="h-full bg-[#0F6B5C]"
                            style={{ width: `${r.pct}%` }}
                          />
                        </div>
                        <span className="w-7 text-right text-[#8A867D] tabular-nums">
                          {r.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {deviceBreakdown.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[#6B6862] mb-2 flex items-center gap-1.5">
                    <MonitorSmartphone size={12} /> Devices
                  </p>
                  <div className="space-y-1.5">
                    {deviceBreakdown.map((d) => (
                      <div
                        key={d.type}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="w-16 text-[#6B6862] truncate">
                          {d.type}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#EFECE4] overflow-hidden">
                          <div
                            className="h-full bg-[#E8A33D]"
                            style={{ width: `${d.pct}%` }}
                          />
                        </div>
                        <span className="w-7 text-right text-[#8A867D] tabular-nums">
                          {d.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setShowQr(true)}
              className="cursor-pointer flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E4E0D6] bg-white px-3 py-2 text-xs font-medium text-[#0B0F0E] hover:bg-[#EFECE4] transition-colors"
            >
              <QrCode size={13} /> QR code
            </button>
            <QrCodeModal
              shortCode={showQr ? link.short_code : null}
              onClose={() => setShowQr(false)}
            />
            <a
              href={`${SHORTENER_DOMAIN}/${link.short_code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#E4E0D6] bg-white px-3 py-2 text-xs font-medium text-[#0B0F0E] hover:bg-[#EFECE4] transition-colors"
            >
              <ExternalLink size={13} /> Visit
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-11 w-11 rounded-full bg-[#0F6B5C]/10 flex items-center justify-center mb-4">
        <Link2 size={18} className="text-[#0F6B5C]" />
      </div>
      <p className="text-sm font-medium text-[#0B0F0E]">No links yet</p>
      <p className="text-xs text-[#8A867D] mt-1 max-w-[240px]">
        Shorten your first campaign URL to start tracking clicks.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0F6B5C] text-white px-3.5 py-2 text-xs font-medium hover:bg-[#0C5A4D] transition-colors"
      >
        <Plus size={13} /> New short link
      </button>
    </div>
  );
}

export default function Dashboard() {
  const [links, setLinks] = useState<Link[]>([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeLink, setActiveLink] = useState<Link | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Link | null>(null);
  const [totalCount, setTotalCount] =useState<{'totalLinks':number, clickCount: number, activeCount: number}>({'totalLinks':0, clickCount: 0, activeCount: 0})
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState();

  const cursorRef = useRef<string>("");   
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);

  // keep refs in sync with state
  useEffect(() => { cursorRef.current = cursor; }, [cursor]);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);


  const sentinelRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  const showToast = useToast();

  const filtered = useMemo(() => {
    if (!query.trim()) return links;
    const q = query.toLowerCase();
    return links.filter(
      (l) =>
        l.short_code.toLowerCase().includes(q) ||
        l.long_url.toLowerCase().includes(q),
    );
  }, [links, query]);

  function handleCreate(link: Link) {
    setLinks((prev) => [link, ...prev]);
  }

  async function handleDelete(code: string) {
    console.log("Attempting to delete link with code:", code); // Debugging line
    try {
      const request = await api.delete(`/links/${code}`);
      const response = await request.data.data;
      console.log("Delete response:", response); // Debugging line
      setLinks((prev) => prev.filter((l) => l.short_code !== code));
      showToast({
        type: "success",
        message: "Link deleted",
        description: `${code} will no longer redirect`,
      });
      if (response.deleted) {
        setTimeout(() => {
          setConfirmDelete(null);
        }, 100);
        if (activeLink?.short_code === code) setActiveLink(null);
      }
    } catch (err: any) {
      if (
        err.response?.data.error == "Unauthorized" &&
        err.response?.status === 401
      ) {
        navigate("/");
        return;
      }
      showToast({
        type: "error",
        message: "Couldn't delete link",
        description: "Please try again",
      });
    }
  }

  const logout = async () => {
    await api.delete("/auth/logout");
    setAccessToken(null); // clear memory
    localStorage.removeItem("userName");
    localStorage.removeItem("userAvatar");
    window.location.href = "/";
  };

  const fetchLinks = async (cursorId?: string) => {
    if (loadingRef.current || !hasMoreRef.current) return;
    setLoading(true); // ← set BEFORE the request starts
    try {
      const url = cursorId
        ? `/links/list?cursor=${cursorId}&limit=5`
        : `/links/list?limit=5`;
      const response = await api.post(url, { page: page + 1 });
      const data = response.data.data;
      const newLinks = data.links;

      setLinks((prev) => [...prev, ...newLinks]);
      if (newLinks.length > 0) {
        setCursor(newLinks[newLinks.length - 1]._id);
        setPage((prev) => prev + 1);
        setHasMore(newLinks.length > 0);
        setTotalCount({'totalLinks':data.totalLinks, clickCount: data.clickCount, activeCount: data.activeCount})
      }
    } catch (err: any) {
      if (
        err.response?.data.error === "Unauthorized" &&
        err.response?.status === 401
      ) {
        navigate("/");
        return;
      }
    } finally {
      setLoading(false); // always runs, success or failure
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchLinks(cursorRef.current);
      }
    });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [page]);

  return (
    <div className="min-h-screen bg-[#FAFAF7] font-sans text-[#0B0F0E]">
      <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
          .font-sans { font-family: 'Inter', ui-sans-serif, system-ui, sans-serif; }
          .font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        `}</style>

      {/* Top bar */}
      <div className="border-b border-[#E4E0D6] bg-[#FAFAF7]/95 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-[#0F6B5C] flex items-center justify-center">
              <Link2 size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              trim.link
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#0F6B5C] text-white px-3.5 py-2 text-xs font-medium hover:bg-[#0C5A4D] transition-colors"
            >
              <Plus size={14} /> New link
            </button>
            <button
              onClick={() => {
                logout();
              }}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#E4E0D6] bg-white text-[#0B0F0E] px-3.5 py-2 text-xs font-medium hover:bg-[#EFECE4] transition-colors"
              title="Log out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg border border-[#E4E0D6] bg-white px-4 py-3.5">
            <p className="text-[11px] text-[#8A867D] flex items-center gap-1.5 mb-1">
              <Link2 size={11} /> Total links
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {totalCount.totalLinks}
            </p>
          </div>
          <div className="rounded-lg border border-[#E4E0D6] bg-white px-4 py-3.5">
            <p className="text-[11px] text-[#8A867D] flex items-center gap-1.5 mb-1">
              <MousePointerClick size={11} /> Total clicks
            </p>
            <p className="text-2xl font-semibold tabular-nums">{totalCount.clickCount}</p>
          </div>
          <div className="rounded-lg border border-[#E4E0D6] bg-white px-4 py-3.5">
            <p className="text-[11px] text-[#8A867D] flex items-center gap-1.5 mb-1">
              <Clock size={11} /> Active
            </p>
            <p className="text-2xl font-semibold tabular-nums">{totalCount.activeCount}</p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A867D]"
          />
          <input
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setQuery(e.target.value)
            }
            placeholder="Search by code, alias, or URL"
            className="w-full rounded-lg border border-[#E4E0D6] bg-white pl-9 pr-3 py-2.5 text-sm placeholder:text-[#B3AFA5] focus:outline-none focus:ring-2 focus:ring-[#0F6B5C]/30 focus:border-[#0F6B5C]"
          />
        </div>

        {filtered.length === 0 ? (
          links.length === 0 ? (
            <EmptyState onCreate={() => setModalOpen(true)} />
          ) : (
            <p className="text-center text-sm text-[#8A867D] py-16">
              No links match "{query}".
            </p>
          )
        ) : (
          <div className="rounded-lg border border-[#E4E0D6] bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-[#E4E0D6] bg-[#FAFAF7] text-[11px] font-medium text-[#8A867D]">
              <span>Link</span>
              <span className="w-20 text-right">Clicks</span>
              <span className="w-24">Status</span>
              <span className="w-24">Expires</span>
              <span className="w-16"></span>
            </div>
            {filtered.map((link) => {
              const shortUrl = `${SHORTENER_DOMAIN}/${link.short_code}`;
              return (
                <div
                  key={link.short_code}
                  onClick={() => setActiveLink(link)}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 border-b border-[#EFECE4] last:border-0 hover:bg-[#FAFAF7] cursor-pointer transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-[#0F6B5C] truncate">
                      {shortUrl}
                    </p>
                    <p className="text-xs text-[#8A867D] truncate mt-0.5">
                      {link.long_url}
                    </p>
                  </div>
                  <span className="w-20 text-right text-sm tabular-nums text-[#0B0F0E]">
                    {link.clicks}
                  </span>
                  <span className="w-24">
                    <StatusPill status={link.status} />
                  </span>
                  <span className="w-24 text-xs text-[#8A867D]">
                    {link.expires_at || "Never"}
                  </span>
                  <div className="w-16 flex items-center justify-end gap-0.5">
                    <CopyButton
                      value={`${SHORTENER_DOMAIN}/${link.short_code}`}
                      showToast={showToast}
                    />
                    <button
                      onClick={(e: MouseEvent<HTMLButtonElement>) => {
                        e.stopPropagation();
                        setConfirmDelete(link);
                      }}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[#8A867D] hover:text-[#C4402E] hover:bg-[#C4402E]/10 transition-colors cursor-pointer"
                      title="Delete link"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            <div ref={sentinelRef} style={{ height: 1 }} />{" "}
            {/* invisible trigger */}
          </div>
        )}
      </div>

      <CreateLinkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
        showToast={showToast}
      />
      <StatsPanel
        link={activeLink}
        setActiveLink={setActiveLink}
        showToast={showToast}
      />

      {/* Delete confirm */}
      {confirmDelete && (
        <DeleteLinkModal
          confirmDelete={confirmDelete}
          setConfirmDelete={setConfirmDelete}
          handleDelete={handleDelete}
        />
      )}
    </div>
  );
}
