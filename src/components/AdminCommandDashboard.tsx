import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Cpu,
  Database,
  DollarSign,
  Eye,
  FileCheck2,
  HardDrive,
  Heart,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Sliders,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';

interface ActivityLogItem {
  id: string;
  category: string;
  actor: string;
  message: string;
  createdAt: string;
}

interface ErrorLogItem {
  id: string;
  source: string;
  severity: 'warning' | 'error' | 'critical';
  message: string;
  resolved: boolean;
  createdAt: string;
}

interface CommandDashboardResponse {
  generatedAt: string;
  analytics: {
    totalEarningsPhp: number;
    approvedTerminalPhp: number;
    completedOrderRevenuePhp: number;
    stripeConfigured: boolean;
    successfulBuys: number;
    totalOrdersCount: number;
    visitorCounter: {
      todayVisits: number;
      totalVisits: number;
      liveActiveTraffic: number;
      lastVisitAt?: string;
    };
    totalLikes: number;
    totalUsersCount: number;
    pendingKycCount: number;
    blogPostsCount: number;
    contactMessagesCount: number;
    activityLogs: ActivityLogItem[];
    errorLogs: ErrorLogItem[];
    unresolvedErrorCount: number;
  };
  system: {
    database: {
      status: 'connected' | 'fallback_local';
      storageMode: 'postgres' | 'memory';
      storageStatus: string;
      latencyMs: number;
      pool: {
        enabled: boolean;
        source: string;
        max: number;
        totalCount: number;
        idleCount: number;
        waitingCount: number;
      };
      cpuUsagePct: number;
      ramUsagePct: number;
      ramUsedMb: number;
      ramTotalMb: number;
    };
    backendServer: {
      status: string;
      nodeVersion: string;
      uptimeSeconds: number;
      processRssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      platform: string;
    };
    storageMonitor: {
      privateBucketName: string;
      privateBucketConfigured: boolean;
      publicBucketConfigured: boolean;
      privateBucketBytes: number;
      privateBucketFiles: number;
      foodImagesBytes: number;
      otherMediaBytes: number;
      totalStorageBytes: number;
      totalStorageGb: number;
      quotaGb: number;
    };
  };
}

interface CleanerResult {
  purgedErrorLogs: number;
  purgedActivityLogs: number;
  purgedAbandonedCarts: number;
  purgedTempFiles: number;
  purgedExpiredCookiesAndSessions: number;
  reclaimedBytes: number;
  cleanedAt: string;
}

interface AdminCommandDashboardProps {
  authToken?: string;
  onNavigateUserVerification: () => void;
  onNavigateFeatureToggles: () => void;
  onNavigateInvestSetup: () => void;
  onNavigateSecurityStudio: () => void;
}

function formatPhp(val: number): string {
  return `₱${(Number.isFinite(val) ? val : 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBytesToGbMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0.000 GB (0 KB)';
  const gb = bytes / 1024 ** 3;
  const mb = bytes / 1024 ** 2;
  if (gb >= 0.1) return `${gb.toFixed(3)} GB`;
  if (mb >= 1) return `${gb.toFixed(4)} GB (${mb.toFixed(1)} MB)`;
  return `${gb.toFixed(5)} GB (${Math.max(1, Math.round(bytes / 1024))} KB)`;
}

function formatUptime(sec: number): string {
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m ${sec % 60}s`;
}

export const AdminCommandDashboard: React.FC<AdminCommandDashboardProps> = ({
  authToken,
  onNavigateUserVerification,
  onNavigateFeatureToggles,
  onNavigateInvestSetup,
  onNavigateSecurityStudio,
}) => {
  const [data, setData] = useState<CommandDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [cleanerBusy, setCleanerBusy] = useState(false);
  const [cleanerResult, setCleanerResult] = useState<CleanerResult | null>(null);
  const [resolvingErrorId, setResolvingErrorId] = useState<string | null>(null);

  // Quick Blog Publisher state
  const [showBlogComposer, setShowBlogComposer] = useState(false);
  const [blogTitle, setBlogTitle] = useState('');
  const [blogCategory, setBlogCategory] = useState<
    'Delivery Tips' | 'Restaurant Spotlight' | 'Rider Stories' | 'Safety & Privacy'
  >('Delivery Tips');
  const [blogExcerpt, setBlogExcerpt] = useState('');
  const [blogContent, setBlogContent] = useState('');
  const [blogCover, setBlogCover] = useState('/assets/images/hero_local_food_delivery_1795763680017.jpg');
  const [blogBusy, setBlogBusy] = useState(false);
  const [blogNotice, setBlogNotice] = useState('');

  const buildHeaders = useCallback(
    (json = false): Record<string, string> => {
      const h: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (json) h['Content-Type'] = 'application/json';
      if (authToken) h.Authorization = `Bearer ${authToken}`;
      return h;
    },
    [authToken]
  );

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch('/api/admin/command-dashboard', {
          headers: buildHeaders(),
          credentials: 'include',
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Failed to load Admin Dashboard.');
        setData(payload as CommandDashboardResponse);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load Admin Dashboard.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [buildHeaders]
  );

  useEffect(() => {
    void loadDashboard(false);
    const interval = window.setInterval(() => {
      void loadDashboard(true);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const handleRunCleaner = async () => {
    setCleanerBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/system/cleaner', {
        method: 'POST',
        headers: buildHeaders(true),
        credentials: 'include',
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'System cleaner failed.');
      setCleanerResult(payload as CleanerResult);
      await loadDashboard(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'System cleaner failed.');
    } finally {
      setCleanerBusy(false);
    }
  };

  const handleResolveError = async (id: string) => {
    setResolvingErrorId(id);
    try {
      const res = await fetch(`/api/admin/error-logs/${encodeURIComponent(id)}/resolve`, {
        method: 'POST',
        headers: buildHeaders(true),
        credentials: 'include',
      });
      if (res.ok) {
        await loadDashboard(true);
      }
    } finally {
      setResolvingErrorId(null);
    }
  };

  const handlePublishBlog = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlogBusy(true);
    setBlogNotice('');
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: buildHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          title: blogTitle.trim(),
          category: blogCategory,
          excerpt: blogExcerpt.trim(),
          content: blogContent.trim(),
          coverImage: blogCover,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to publish article.');
      setBlogTitle('');
      setBlogExcerpt('');
      setBlogContent('');
      setBlogNotice(`Published "${payload.post?.title}" to the public SEO Blog.`);
      setShowBlogComposer(false);
      await loadDashboard(true);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to publish blog article.');
    } finally {
      setBlogBusy(false);
    }
  };

  const storagePercent = data
    ? Math.min(100, (data.system.storageMonitor.totalStorageGb / Math.max(1, data.system.storageMonitor.quotaGb)) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 text-slate-100">
      {/* Top Bar Contract: Breadcrumb + Primary Actions */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-400">
            Admin Console / Command Homepage
          </div>
          <h2
            className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
          >
            Platform Operations &amp; Backend Control
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onNavigateUserVerification}
            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>
              User Verification{data && data.analytics.pendingKycCount > 0 ? ` (${data.analytics.pendingKycCount})` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const token = authToken || '';
              window.open(`/api/admin/export-all-values?token=${encodeURIComponent(token)}`, '_blank');
            }}
            className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
            title="Download complete database export of all app values and records"
          >
            <Database className="w-4 h-4" />
            <span>Export All Values (JSON)</span>
          </button>
          <button
            type="button"
            onClick={() => setShowBlogComposer((v) => !v)}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Publish Blog Article</span>
          </button>
          <button
            type="button"
            onClick={() => void loadDashboard(false)}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Dark Navigation Bar Linking Core Admin Workflows */}
      <nav
        aria-label="Admin Operations Quick Links"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <button
          type="button"
          onClick={onNavigateUserVerification}
          className="rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 p-3.5 text-left transition flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">User Verification (KYC)</div>
              <div className="text-[11px] text-slate-400 truncate">Private IDs &amp; Real Names</div>
            </div>
          </div>
          {data && data.analytics.pendingKycCount > 0 && (
            <span className="text-xs font-mono font-bold text-amber-400 tabular-nums shrink-0">
              {data.analytics.pendingKycCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onNavigateFeatureToggles}
          className="rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 p-3.5 text-left transition flex items-center gap-2.5"
        >
          <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">Feature Enable / Disable</div>
            <div className="text-[11px] text-slate-400 truncate">Toggle modules &amp; Coming Soon</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onNavigateInvestSetup}
          className="rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 p-3.5 text-left transition flex items-center gap-2.5"
        >
          <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">Invest Setup</div>
            <div className="text-[11px] text-slate-400 truncate">5%/day × 30d plans</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onNavigateSecurityStudio}
          className="rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 p-3.5 text-left transition flex items-center gap-2.5"
        >
          <Lock className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">Security Studio</div>
            <div className="text-[11px] text-slate-400 truncate">Backups, keys &amp; RLS rules</div>
          </div>
        </button>
      </nav>

      {errorMsg && (
        <div className="rounded-xl bg-rose-950/70 border border-rose-700/60 px-4 py-3 text-xs font-medium text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {blogNotice && (
        <div className="rounded-xl bg-emerald-950/80 border border-emerald-700/60 px-4 py-3 text-xs font-medium text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{blogNotice}</span>
        </div>
      )}

      {/* Optional Admin Blog Composer Drawer */}
      {showBlogComposer && (
        <form
          onSubmit={handlePublishBlog}
          className="rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Publish New Public Blog Article (SEO &amp; AdSense Friendly)
            </h3>
            <button
              type="button"
              onClick={() => setShowBlogComposer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Article Title</label>
              <input
                type="text"
                required
                value={blogTitle}
                onChange={(e) => setBlogTitle(e.target.value)}
                placeholder="e.g. Top 5 Late-Night Local Eats in Our Neighborhood"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <select
                  value={blogCategory}
                  onChange={(e) => setBlogCategory(e.target.value as typeof blogCategory)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Delivery Tips">Delivery Tips</option>
                  <option value="Restaurant Spotlight">Restaurant Spotlight</option>
                  <option value="Rider Stories">Rider Stories</option>
                  <option value="Safety & Privacy">Safety &amp; Privacy</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Cover Photo</label>
                <select
                  value={blogCover}
                  onChange={(e) => setBlogCover(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="/assets/images/hero_local_food_delivery_1795763680017.jpg">Local Food Counter</option>
                  <option value="/assets/images/blog_restaurant_kitchen_1795763680437.jpg">Neighborhood Chef</option>
                  <option value="/assets/images/blog_delivery_rider_1795763682277.jpg">Community Rider</option>
                  <option value="/assets/images/blog_packaging_tips_1795763682155.jpg">Food Packaging</option>
                </select>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Short Excerpt (SEO Summary)</label>
              <input
                type="text"
                value={blogExcerpt}
                onChange={(e) => setBlogExcerpt(e.target.value)}
                placeholder="One-sentence summary shown on the homepage and search snippets..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Article Body (separate paragraphs with a blank line)
              </label>
              <textarea
                required
                rows={4}
                value={blogContent}
                onChange={(e) => setBlogContent(e.target.value)}
                placeholder="Write helpful tips for local food customers, featured restaurants, or rider community highlights..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={blogBusy}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {blogBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Publish to Public Blog</span>
            </button>
          </div>
        </form>
      )}

      {loading && !data ? (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-10 flex items-center justify-center gap-3 text-slate-300 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
          <span>Loading platform analytics and system diagnostics...</span>
        </div>
      ) : data ? (
        <>
          {/* ================================================================ */}
          {/* SECTION 1: APP OVERVIEW ANALYTICS                                */}
          {/* ================================================================ */}
          <section aria-labelledby="admin-analytics-heading" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <h3
                  id="admin-analytics-heading"
                  className="text-base font-bold text-white"
                  style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                >
                  App Overview Analytics
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time revenue, completed food orders, traffic, likes, activity feed, and webhook alerts.
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono tabular-nums">
                {data.analytics.totalUsersCount} registered accounts · {data.analytics.blogPostsCount} published articles
              </div>
            </div>

            {/* 4 Primary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Earnings */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Total Earnings</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {formatPhp(data.analytics.totalEarningsPhp)}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                  <span>{data.analytics.stripeConfigured ? 'Stripe Connected' : 'Stripe Key Ready'}</span>
                  <span className="font-mono tabular-nums text-emerald-400">
                    Orders {formatPhp(data.analytics.completedOrderRevenuePhp)}
                  </span>
                </div>
              </div>

              {/* Successful Buys */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Successful Buys</span>
                  <ShoppingBag className="w-4 h-4 text-sky-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {data.analytics.successfulBuys.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  Completed food &amp; marketplace orders out of {data.analytics.totalOrdersCount} total
                </div>
              </div>

              {/* Visitor Counter */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Visitor Counter</span>
                  <Eye className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {data.analytics.visitorCounter.todayVisits.toLocaleString()}
                  <span className="text-xs font-sans font-normal text-slate-400 ml-1.5">today</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {data.analytics.visitorCounter.totalVisits.toLocaleString()} total · {data.analytics.visitorCounter.liveActiveTraffic} live active
                </div>
              </div>

              {/* Total Likes */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">Total Likes</span>
                  <Heart className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono tabular-nums">
                  {data.analytics.totalLikes.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-400">
                  Customer favorites &amp; dish ratings across community posts
                </div>
              </div>
            </div>

            {/* System Activity Log & Error Log (2-column balanced split) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              {/* System Activity Log */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">System Activity Log</h4>
                  </div>
                  <span className="text-xs text-slate-400 font-mono tabular-nums">
                    {data.analytics.activityLogs.length} events
                  </span>
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-800/80 pr-1">
                  {data.analytics.activityLogs.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      No activity logged yet. Registrations, orders, and cleanups appear here.
                    </p>
                  ) : (
                    data.analytics.activityLogs.map((log) => (
                      <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <span className="font-semibold text-white">{log.actor}</span>
                          <span className="text-slate-500 mx-1.5">·</span>
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                        <time className="text-[11px] text-slate-500 font-mono tabular-nums whitespace-nowrap shrink-0">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Error Log (Backend & Stripe Webhook Failures) */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      className={`w-4 h-4 ${
                        data.analytics.unresolvedErrorCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    />
                    <h4 className="text-sm font-semibold text-white">Error Log &amp; Stripe Webhooks</h4>
                  </div>
                  <span
                    className={`text-xs font-mono font-semibold tabular-nums ${
                      data.analytics.unresolvedErrorCount > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {data.analytics.unresolvedErrorCount > 0
                      ? `${data.analytics.unresolvedErrorCount} Needs Attention`
                      : '0 Active Errors'}
                  </span>
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-slate-800/80 pr-1">
                  {data.analytics.errorLogs.length === 0 ? (
                    <div className="py-6 text-center space-y-1">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                      <p className="text-xs font-medium text-slate-200">
                        No backend errors or Stripe webhook failures recorded.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Stripe webhook signature mismatches and server exceptions appear here immediately.
                      </p>
                    </div>
                  ) : (
                    data.analytics.errorLogs.map((err) => (
                      <div key={err.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 text-[11px] font-mono">
                            <span
                              className={
                                err.resolved
                                  ? 'text-slate-500'
                                  : err.severity === 'critical'
                                  ? 'text-rose-400 font-bold'
                                  : 'text-amber-400 font-semibold'
                              }
                            >
                              {err.source} · {err.resolved ? 'resolved' : err.severity}
                            </span>
                            <span className="text-slate-500">
                              {new Date(err.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className={err.resolved ? 'text-slate-500 line-through' : 'text-slate-200'}>
                            {err.message}
                          </p>
                        </div>
                        {!err.resolved && (
                          <button
                            type="button"
                            disabled={resolvingErrorId === err.id}
                            onClick={() => void handleResolveError(err.id)}
                            className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200 whitespace-nowrap shrink-0"
                          >
                            {resolvingErrorId === err.id ? '...' : 'Resolve'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================ */}
          {/* SECTION 2: SYSTEM & BACKEND MANAGEMENT TOOLS                     */}
          {/* ================================================================ */}
          <section aria-labelledby="admin-system-heading" className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <h3
                  id="admin-system-heading"
                  className="text-base font-bold text-white"
                  style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                >
                  System &amp; Backend Management Tools
                </h3>
                <p className="text-xs text-slate-400">
                  Live database connection health, Node.js runtime monitor, private bucket storage quota, and automated cleaner.
                </p>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                Private KYC Bucket: {data.system.storageMonitor.privateBucketName} (PRIVATE)
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Supabase / PostgreSQL Database Status */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">Supabase Database Status</h4>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      data.system.database.status === 'connected' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {data.system.database.status === 'connected' ? 'Live Connected' : 'Local Fallback'}
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-2 font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Query Ping</span>
                    <span>{data.system.database.latencyMs} ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Pool Connections</span>
                    <span>
                      {data.system.database.pool.totalCount} / {data.system.database.pool.max}
                    </span>
                  </div>
                </div>

                {/* CPU & RAM Usage Bars */}
                <div className="space-y-2.5 pt-2 border-t border-slate-800">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> Host CPU Load
                      </span>
                      <span className="font-mono tabular-nums text-slate-200">
                        {data.system.database.cpuUsagePct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.max(4, data.system.database.cpuUsagePct)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Host RAM Usage</span>
                      <span className="font-mono tabular-nums text-slate-200">
                        {data.system.database.ramUsedMb} / {data.system.database.ramTotalMb} MB ({data.system.database.ramUsagePct}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${Math.max(4, data.system.database.ramUsagePct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Backend Server Monitor */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-sky-400" />
                    <h4 className="text-sm font-semibold text-white">Backend Server Monitor</h4>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400">Operational</span>
                </div>

                <div className="rounded-lg bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-xs text-emerald-200 flex items-center justify-between">
                  <span>Node.js {data.system.backendServer.nodeVersion}</span>
                  <span className="font-mono tabular-nums">
                    Uptime {formatUptime(data.system.backendServer.uptimeSeconds)}
                  </span>
                </div>

                <div className="text-xs space-y-2 font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Process Memory (RSS)</span>
                    <span className="text-slate-200">{data.system.backendServer.processRssMb} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">V8 Heap Used / Total</span>
                    <span className="text-slate-200">
                      {data.system.backendServer.heapUsedMb} / {data.system.backendServer.heapTotalMb} MB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">OS Platform</span>
                    <span className="text-slate-200">{data.system.backendServer.platform}</span>
                  </div>
                </div>
              </div>

              {/* Storage Monitor (Private Bucket + Food Images) */}
              <div className="rounded-xl bg-slate-900 border border-slate-800 p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-semibold text-white">Storage Monitor</h4>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-slate-300">
                    {data.system.storageMonitor.totalStorageGb.toFixed(4)} / {data.system.storageMonitor.quotaGb} GB
                  </span>
                </div>

                <div>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${Math.max(2, storagePercent)}%` }}
                    />
                  </div>
                </div>

                <div className="text-xs space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Private Bucket (Valid IDs &amp; Real Photos)</span>
                    <span className="font-mono tabular-nums text-emerald-300 text-right">
                      {formatBytesToGbMb(data.system.storageMonitor.privateBucketBytes)} ({data.system.storageMonitor.privateBucketFiles} files)
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Food &amp; Marketplace Images</span>
                    <span className="font-mono tabular-nums text-slate-200 text-right">
                      {formatBytesToGbMb(data.system.storageMonitor.foodImagesBytes)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-400">Other App Media</span>
                    <span className="font-mono tabular-nums text-slate-200 text-right">
                      {formatBytesToGbMb(data.system.storageMonitor.otherMediaBytes)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage & Database Cleaner Tool */}
            <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-rose-400" />
                  <h4 className="text-sm font-bold text-white">Storage &amp; Database Cleaner Tool</h4>
                </div>
                <p className="text-xs text-slate-400 max-w-2xl">
                  Runs the scheduled maintenance job now to hard-delete abandoned guest carts, expired temporary cookies/sessions, stale chunked upload temp files, and resolved or expired error logs older than 30 days.
                </p>
                {cleanerResult && (
                  <p className="text-xs font-mono text-emerald-400 pt-1">
                    Last run {new Date(cleanerResult.cleanedAt).toLocaleTimeString()}: purged {cleanerResult.purgedErrorLogs} error logs,{' '}
                    {cleanerResult.purgedActivityLogs} old activity logs, {cleanerResult.purgedAbandonedCarts} abandoned carts,{' '}
                    {cleanerResult.purgedExpiredCookiesAndSessions} expired sessions, {cleanerResult.purgedTempFiles} temp files (
                    {Math.round(cleanerResult.reclaimedBytes / 1024)} KB reclaimed).
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={cleanerBusy}
                onClick={() => void handleRunCleaner()}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0 transition disabled:opacity-50"
              >
                {cleanerBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Run System Cleaner / Purge Expired Logs</span>
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};
