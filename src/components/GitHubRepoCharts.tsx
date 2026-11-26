import React, { useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FolderTree, GitCommitHorizontal, Users } from 'lucide-react';

export interface RepoCommitHistoryPoint {
  date: string;
  label: string;
  commits: number;
  uniqueAuthors: number;
}

export interface RepoContributorStat {
  login: string;
  avatar: string | null;
  contributions: number;
  htmlUrl: string | null;
}

export interface CommitDerivedContributor {
  name: string;
  login: string | null;
  avatar: string | null;
  commitCount: number;
  latestDate: string | null;
}

export interface RepoFolderStat {
  name: string;
  fileCount: number;
  totalBytes: number;
}

export interface RepoExtensionStat {
  ext: string;
  count: number;
  totalBytes?: number;
}

export interface RepoLanguageStat {
  name: string;
  bytes: number;
  percent: number;
}

export interface RepoCommitEntry {
  sha: string;
  authorName: string;
  authorLogin: string | null;
  date: string | null;
}

interface GitHubRepoChartsProps {
  repoFullName: string;
  branch: string;
  totalFiles: number;
  totalBytes: number;
  commits: RepoCommitEntry[];
  commitHistory?: RepoCommitHistoryPoint[];
  contributors: CommitDerivedContributor[];
  repoContributors?: RepoContributorStat[];
  topLevelFolders: RepoFolderStat[];
  extensions: RepoExtensionStat[];
  languages: RepoLanguageStat[];
  onSelectFolder?: (folderName: string) => void;
}

const CHART_PALETTE = ['#10b981', '#059669', '#f59e0b', '#06b6d4', '#14b8a6', '#6366f1', '#ec4899', '#84cc16'];

function formatKb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function truncateAxisLabel(value: string, max = 14): string {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

interface CustomTooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  payload?: Record<string, unknown>;
}

const CommitHistoryTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as { date?: string; commits?: number; uniqueAuthors?: number } | undefined;
  return (
    <div className="rounded-xl bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 shadow-lg px-3 py-2 text-xs space-y-1">
      <div className="font-bold text-emerald-950 dark:text-white font-mono">
        {row?.date || label}
      </div>
      <div className="flex items-center justify-between gap-4 text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
        <span>Commits</span>
        <span className="font-bold text-emerald-700 dark:text-emerald-300">{row?.commits ?? 0}</span>
      </div>
      {typeof row?.uniqueAuthors === 'number' && (
        <div className="flex items-center justify-between gap-4 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
          <span>Active Authors</span>
          <span className="font-bold text-amber-700 dark:text-amber-300">{row.uniqueAuthors}</span>
        </div>
      )}
    </div>
  );
};

const ContributorsTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as { displayName?: string; commits?: number; sharePct?: number } | undefined;
  return (
    <div className="rounded-xl bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 shadow-lg px-3 py-2 text-xs space-y-1">
      <div className="font-bold text-emerald-950 dark:text-white">
        {row?.displayName || label}
      </div>
      <div className="flex items-center justify-between gap-4 text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
        <span>Commits</span>
        <span className="font-bold text-emerald-700 dark:text-emerald-300">{row?.commits ?? 0}</span>
      </div>
      {typeof row?.sharePct === 'number' && (
        <div className="flex items-center justify-between gap-4 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
          <span>Share</span>
          <span className="font-bold">{row.sharePct}%</span>
        </div>
      )}
    </div>
  );
};

const FileStatsTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  mode: 'folders' | 'extensions' | 'languages';
}> = ({ active, payload, mode }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as {
    name?: string;
    fileCount?: number;
    totalBytes?: number;
    sharePct?: number;
    percent?: number;
  } | undefined;
  if (!row) return null;

  return (
    <div className="rounded-xl bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700 shadow-lg px-3 py-2 text-xs space-y-1">
      <div className="font-bold text-emerald-950 dark:text-white font-mono">{row.name}</div>
      {mode === 'languages' ? (
        <>
          <div className="flex items-center justify-between gap-4 text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
            <span>Share</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">{row.percent ?? 0}%</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
            <span>Code Volume</span>
            <span className="font-bold">{formatKb(row.totalBytes || 0)}</span>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
            <span>Files</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300">
              {(row.fileCount ?? 0).toLocaleString()} ({row.sharePct ?? 0}%)
            </span>
          </div>
          {typeof row.totalBytes === 'number' && row.totalBytes > 0 && (
            <div className="flex items-center justify-between gap-4 text-emerald-700 dark:text-emerald-300 font-mono tabular-nums">
              <span>Volume</span>
              <span className="font-bold">{formatKb(row.totalBytes)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export const GitHubRepoCharts: React.FC<GitHubRepoChartsProps> = ({
  repoFullName,
  branch,
  totalFiles,
  totalBytes,
  commits,
  commitHistory,
  contributors,
  repoContributors,
  topLevelFolders,
  extensions,
  languages,
  onSelectFolder,
}) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const areaGradientId = `ghCommitArea_${uid}`;
  const [commitView, setCommitView] = useState<'timeline' | 'contributors'>('timeline');
  const [contribScope, setContribScope] = useState<'all' | 'recent'>('all');
  const [fileView, setFileView] = useState<'folders' | 'extensions' | 'languages'>('folders');

  // Compute chronological commit history locally if server field wasn't supplied
  const timelineData = useMemo(() => {
    if (Array.isArray(commitHistory) && commitHistory.length > 0) {
      return commitHistory;
    }
    const dayMap = new Map<string, { date: string; commits: number; authors: Set<string> }>();
    for (const c of commits) {
      if (!c.date) continue;
      const d = new Date(c.date);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      const cur = dayMap.get(key) || { date: key, commits: 0, authors: new Set<string>() };
      cur.commits += 1;
      cur.authors.add(c.authorLogin || c.authorName);
      dayMap.set(key, cur);
    }
    return Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date: entry.date,
        label: new Date(`${entry.date}T00:00:00Z`).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        commits: entry.commits,
        uniqueAuthors: entry.authors.size,
      }));
  }, [commitHistory, commits]);

  const hasAllTimeContributors = Boolean(repoContributors && repoContributors.length > 0);
  const contributorChartData = useMemo(() => {
    const useAllTime = contribScope === 'all' && hasAllTimeContributors;
    if (useAllTime && repoContributors) {
      const top = repoContributors.slice(0, 8);
      const total = top.reduce((sum, c) => sum + c.contributions, 0) || 1;
      return top.map((c) => ({
        displayName: c.login,
        shortName: truncateAxisLabel(c.login, 12),
        commits: c.contributions,
        sharePct: Number(((c.contributions / total) * 100).toFixed(1)),
      }));
    }
    const topRecent = contributors.slice(0, 8);
    const total = topRecent.reduce((sum, c) => sum + c.commitCount, 0) || 1;
    return topRecent.map((c) => {
      const label = c.login || c.name;
      return {
        displayName: c.name,
        shortName: truncateAxisLabel(label, 12),
        commits: c.commitCount,
        sharePct: Number(((c.commitCount / total) * 100).toFixed(1)),
      };
    });
  }, [contribScope, hasAllTimeContributors, repoContributors, contributors]);

  interface FileChartDatum {
    name: string;
    shortName: string;
    totalBytes: number;
    fileCount?: number;
    sharePct?: number;
    percent?: number;
  }

  const folderChartData = useMemo<FileChartDatum[]>(() => {
    const safeTotal = totalFiles > 0 ? totalFiles : topLevelFolders.reduce((s, f) => s + f.fileCount, 0) || 1;
    return topLevelFolders.slice(0, 8).map((f) => ({
      name: f.name,
      shortName: truncateAxisLabel(f.name, 13),
      fileCount: f.fileCount,
      totalBytes: f.totalBytes,
      sharePct: Number(((f.fileCount / safeTotal) * 100).toFixed(1)),
    }));
  }, [topLevelFolders, totalFiles]);

  const extensionChartData = useMemo<FileChartDatum[]>(() => {
    const safeTotal = totalFiles > 0 ? totalFiles : extensions.reduce((s, e) => s + e.count, 0) || 1;
    return extensions.slice(0, 8).map((e) => ({
      name: e.ext,
      shortName: truncateAxisLabel(e.ext, 10),
      fileCount: e.count,
      totalBytes: e.totalBytes || 0,
      sharePct: Number(((e.count / safeTotal) * 100).toFixed(1)),
    }));
  }, [extensions, totalFiles]);

  const languageChartData = useMemo<FileChartDatum[]>(() => {
    return languages.slice(0, 8).map((l) => ({
      name: l.name,
      shortName: truncateAxisLabel(l.name, 12),
      percent: l.percent,
      totalBytes: l.bytes,
    }));
  }, [languages]);

  const totalWindowCommits = useMemo(
    () => timelineData.reduce((sum, d) => sum + d.commits, 0),
    [timelineData]
  );

  const activeFileDataset =
    fileView === 'folders'
      ? folderChartData
      : fileView === 'extensions'
        ? extensionChartData
        : languageChartData;

  return (
    <section
      aria-label="Repository Commit History and File Contribution Statistics"
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
    >
      {/* PANEL 1: REPOSITORY COMMIT HISTORY & CONTRIBUTORS */}
      <div className="bg-white dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xs min-w-0">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0">
                {commitView === 'timeline' ? (
                  <GitCommitHorizontal className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-emerald-950 dark:text-white truncate">
                  {commitView === 'timeline' ? 'Commit History' : 'Contributor Commit Share'}
                </h3>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 font-mono tabular-nums truncate">
                  {repoFullName} · {branch}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setCommitView('timeline')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  commitView === 'timeline'
                    ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950'
                    : 'text-emerald-800 hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white'
                }`}
              >
                Timeline
              </button>
              <button
                type="button"
                onClick={() => setCommitView('contributors')}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  commitView === 'contributors'
                    ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950'
                    : 'text-emerald-800 hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white'
                }`}
              >
                Contributors
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200/70 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
            {commitView === 'timeline' ? (
              <span>
                {totalWindowCommits.toLocaleString()} recent commits across {timelineData.length} active day
                {timelineData.length === 1 ? '' : 's'}
              </span>
            ) : (
              <>
                <span>
                  Top {contributorChartData.length} contributor{contributorChartData.length === 1 ? '' : 's'}
                </span>
                {hasAllTimeContributors && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setContribScope('all')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold transition ${
                        contribScope === 'all'
                          ? 'bg-emerald-200/80 dark:bg-emerald-800 text-emerald-950 dark:text-white'
                          : 'text-emerald-700 dark:text-emerald-300 hover:underline'
                      }`}
                    >
                      All-Time
                    </button>
                    <button
                      type="button"
                      onClick={() => setContribScope('recent')}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold transition ${
                        contribScope === 'recent'
                          ? 'bg-emerald-200/80 dark:bg-emerald-800 text-emerald-950 dark:text-white'
                          : 'text-emerald-700 dark:text-emerald-300 hover:underline'
                      }`}
                    >
                      Recent Branch
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="w-full h-64 sm:h-72 min-w-0 text-emerald-700 dark:text-emerald-300">
          {commitView === 'timeline' ? (
            timelineData.length === 0 ? (
              <div className="h-full rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50 flex items-center justify-center px-4 text-center text-xs text-emerald-700 dark:text-emerald-300">
                No dated commit history found on branch {branch}.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.38} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#10b98126" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="currentColor"
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={{ stroke: '#10b98140' }}
                    minTickGap={16}
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="currentColor"
                    tick={{ fontSize: 10, fill: 'currentColor' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CommitHistoryTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="commits"
                    name="Commits"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill={`url(#${areaGradientId})`}
                    activeDot={{ r: 5, fill: '#34d399', stroke: '#064e3b', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )
          ) : contributorChartData.length === 0 ? (
            <div className="h-full rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50 flex items-center justify-center px-4 text-center text-xs text-emerald-700 dark:text-emerald-300">
              No contributor commit statistics available yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={contributorChartData}
                layout="vertical"
                margin={{ top: 6, right: 18, left: 6, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#10b98126" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  stroke="currentColor"
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={{ stroke: '#10b98140' }}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={92}
                  stroke="currentColor"
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<ContributorsTooltip />} cursor={{ fill: '#10b98118' }} />
                <Bar dataKey="commits" name="Commits" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {contributorChartData.map((entry, idx) => (
                    <Cell key={entry.displayName} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* PANEL 2: FILE CONTRIBUTION STATISTICS */}
      <div className="bg-white dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl p-5 sm:p-6 flex flex-col justify-between gap-4 shadow-xs min-w-0">
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-amber-600 dark:text-amber-300 shrink-0">
                <FolderTree className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-emerald-950 dark:text-white truncate">
                  File Contribution Statistics
                </h3>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 font-mono tabular-nums truncate">
                  {totalFiles.toLocaleString()} files · {formatKb(totalBytes)} total
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setFileView('folders')}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  fileView === 'folders'
                    ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950'
                    : 'text-emerald-800 hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white'
                }`}
              >
                Folders
              </button>
              <button
                type="button"
                onClick={() => setFileView('extensions')}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  fileView === 'extensions'
                    ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950'
                    : 'text-emerald-800 hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white'
                }`}
              >
                Extensions
              </button>
              <button
                type="button"
                onClick={() => setFileView('languages')}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                  fileView === 'languages'
                    ? 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-slate-950'
                    : 'text-emerald-800 hover:text-emerald-950 dark:text-emerald-200 dark:hover:text-white'
                }`}
              >
                Languages
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-200/70 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
            <span>
              {fileView === 'folders'
                ? `Top ${folderChartData.length} modules by file count${onSelectFolder ? ' (click bar to filter browser)' : ''}`
                : fileView === 'extensions'
                  ? `Top ${extensionChartData.length} file types by volume`
                  : `Language distribution across ${languageChartData.length} detected languages`}
            </span>
          </div>
        </div>

        <div className="w-full h-64 sm:h-72 min-w-0 text-emerald-700 dark:text-emerald-300">
          {activeFileDataset.length === 0 ? (
            <div className="h-full rounded-xl border border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50 flex items-center justify-center px-4 text-center text-xs text-emerald-700 dark:text-emerald-300">
              No file contribution data found for this view.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeFileDataset}
                layout="vertical"
                margin={{ top: 6, right: 18, left: 6, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#10b98126" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={fileView === 'languages'}
                  stroke="currentColor"
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={{ stroke: '#10b98140' }}
                  unit={fileView === 'languages' ? '%' : ''}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={92}
                  stroke="currentColor"
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<FileStatsTooltip mode={fileView} />} cursor={{ fill: '#10b98118' }} />
                <Bar
                  dataKey={fileView === 'languages' ? 'percent' : 'fileCount'}
                  name={fileView === 'languages' ? 'Share %' : 'Files'}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={24}
                  onClick={(barData) => {
                    if (fileView === 'folders' && onSelectFolder && barData?.name) {
                      onSelectFolder(String(barData.name));
                    }
                  }}
                  className={fileView === 'folders' && onSelectFolder ? 'cursor-pointer' : ''}
                >
                  {activeFileDataset.map((entry, idx) => (
                    <Cell
                      key={String(entry.name)}
                      fill={CHART_PALETTE[(idx + (fileView === 'extensions' ? 2 : fileView === 'languages' ? 4 : 0)) % CHART_PALETTE.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );
};
