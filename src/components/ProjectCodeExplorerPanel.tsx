import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  Folder,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';

interface CodeCategory {
  id: string;
  label: string;
  folderPath: string;
  purpose: string;
  files: string[];
}

interface EnvGuideItem {
  key: string;
  category: string;
  sample: string;
  isSet: boolean;
  purpose: string;
}

interface ProjectCodeExplorerPanelProps {
  authToken?: string | null;
}

export const ProjectCodeExplorerPanel: React.FC<ProjectCodeExplorerPanelProps> = ({ authToken }) => {
  const [subView, setSubView] = useState<'code' | 'env_guide'>('code');
  const [categories, setCategories] = useState<CodeCategory[]>([]);
  const [envGuide, setEnvGuide] = useState<EnvGuideItem[]>([]);
  const [syncedAt, setSyncedAt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCatId, setSelectedCatId] = useState<string>('src_components');
  const [expandedInstructions, setExpandedInstructions] = useState<Record<string, boolean>>({});
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (authToken) h.Authorization = `Bearer ${authToken}`;
    return h;
  }, [authToken]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [treeRes, envRes] = await Promise.all([
        fetch('/api/admin/project-code/tree', { credentials: 'include', headers: getHeaders() }),
        fetch('/api/admin/project-code/env-guide', { credentials: 'include', headers: getHeaders() }),
      ]);
      if (treeRes.ok) {
        const treeData = await treeRes.json();
        setCategories(Array.isArray(treeData.categories) ? treeData.categories : []);
        setSyncedAt(treeData.syncedAt || new Date().toISOString());
      } else {
        const err = await treeRes.json().catch(() => ({}));
        setErrorMsg(err.error || 'Could not load project code tree.');
      }
      if (envRes.ok) {
        const envData = await envRes.json();
        setEnvGuide(Array.isArray(envData.envGuide) ? envData.envGuide : []);
      }
    } catch {
      setErrorMsg('Failed to sync workspace code tree.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleOpenFile = async (relPath: string) => {
    setSelectedFilePath(relPath);
    setLoadingFile(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/admin/project-code/file?path=${encodeURIComponent(relPath)}`,
        { credentials: 'include', headers: getHeaders() }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not read file.');
      }
      setFileContent(String(data.content || ''));
    } catch (err: unknown) {
      setFileContent('');
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load file preview.');
    } finally {
      setLoadingFile(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCategory = categories.find((c) => c.id === selectedCatId) || categories[0] || null;
  const filteredFiles = (activeCategory?.files || []).filter(
    (f) => !searchQuery.trim() || f.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );
  const filteredEnv = envGuide.filter(
    (item) =>
      !searchQuery.trim() ||
      item.key.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      item.purpose.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-extrabold text-emerald-950 dark:text-white flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[#FF5A1F]" />
            <span>AI Studio Project Code &amp; .env Key Guide (Auto-Synced)</span>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
            Every workspace folder organized by category with View/Hide instructions + live environment variable reference.
            {syncedAt ? ` · Last synced ${new Date(syncedAt).toLocaleTimeString()}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-emerald-100 dark:bg-emerald-900/60">
            <button
              type="button"
              onClick={() => setSubView('code')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                subView === 'code'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-emerald-900 dark:text-emerald-200'
              }`}
            >
              Project Folders &amp; Code
            </button>
            <button
              type="button"
              onClick={() => setSubView('env_guide')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                subView === 'env_guide'
                  ? 'bg-[#FF5A1F] text-white'
                  : 'text-emerald-900 dark:text-emerald-200'
              }`}
            >
              Key &amp; Value Guide ({envGuide.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-xs font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 px-4 py-2 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            subView === 'code'
              ? 'Search files inside selected folder category...'
              : 'Search environment key (e.g., DATABASE_URL, R2_PUBLIC_URL, STRIPE, SUPABASE, ADMIN_PIN)...'
          }
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-white"
        />
      </div>

      {/* VIEW 1: PROJECT FOLDERS & LIVE CODE VIEWER */}
      {subView === 'code' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Sidebar of Categorized Folders with View/Hide Instruction */}
          <div className="lg:col-span-4 space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {categories.map((cat) => {
              const isSelected = activeCategory?.id === cat.id;
              const isInstructionOpen = Boolean(expandedInstructions[cat.id]);
              return (
                <div
                  key={cat.id}
                  className={`rounded-xl border transition ${
                    isSelected
                      ? 'bg-emerald-900 text-white border-[#FF5A1F]'
                      : 'bg-white dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedCatId(cat.id)}
                    className="w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-300' : 'text-emerald-600 dark:text-emerald-400'}`} />
                      <span className="text-xs font-bold truncate">{cat.label}</span>
                    </div>
                    <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-emerald-200' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {cat.files.length} files
                    </span>
                  </button>
                  <div className="px-3.5 pb-2.5 space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedInstructions((prev) => ({
                          ...prev,
                          [cat.id]: !prev[cat.id],
                        }))
                      }
                      className={`text-[11px] font-bold inline-flex items-center gap-1 hover:underline ${
                        isSelected ? 'text-amber-300' : 'text-[#FF5A1F]'
                      }`}
                    >
                      {isInstructionOpen ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {isInstructionOpen ? 'Hide Instruction' : 'View Instruction'}
                    </button>
                    {isInstructionOpen && (
                      <div
                        className={`rounded-lg p-2.5 text-[11px] leading-relaxed ${
                          isSelected
                            ? 'bg-black/30 text-emerald-100'
                            : 'bg-emerald-50 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200'
                        }`}
                      >
                        {cat.purpose}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Pane: Files in Category + Live Code Preview */}
          <div className="lg:col-span-8 space-y-4">
            {activeCategory && (
              <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold text-emerald-950 dark:text-white">
                      {activeCategory.label}
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {activeCategory.purpose}
                    </p>
                  </div>
                </div>

                {filteredFiles.length === 0 ? (
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 py-3">
                    No files found in this folder category.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                    {filteredFiles.map((filePath) => {
                      const active = selectedFilePath === filePath;
                      return (
                        <button
                          key={filePath}
                          type="button"
                          onClick={() => void handleOpenFile(filePath)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5 border transition ${
                            active
                              ? 'bg-[#FF5A1F] text-white border-[#FF5A1F] font-bold'
                              : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800'
                          }`}
                        >
                          <FileCode2 className="w-3 h-3 shrink-0" />
                          <span>{filePath}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Live File Source Viewer */}
            <div className="rounded-2xl bg-slate-950 text-emerald-100 border border-emerald-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-900 border-b border-emerald-900 flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-amber-300 truncate">
                  {selectedFilePath || 'Select any file above to inspect live code'}
                </span>
                {fileContent && (
                  <button
                    type="button"
                    onClick={() => handleCopy('code_viewer', fileContent)}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white inline-flex items-center gap-1"
                  >
                    {copiedId === 'code_viewer' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedId === 'code_viewer' ? 'Copied' : 'Copy Code'}
                  </button>
                )}
              </div>
              <div className="p-4 max-h-[420px] overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre">
                {loadingFile ? (
                  <div className="flex items-center gap-2 text-emerald-300">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading file content...
                  </div>
                ) : fileContent ? (
                  fileContent
                ) : (
                  <span className="text-emerald-400/70">
                    Click any file chip above to inspect its live, up-to-date code. Private .env secret files are protected and never exposed here.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: COMPLETE KEY & VALUE .ENV GUIDE */}
      {subView === 'env_guide' && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-emerald-900 text-white p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              <div className="font-extrabold flex items-center gap-1.5 text-sm">
                <KeyRound className="w-4 h-4 text-amber-300" />
                Complete Environment Variables (Key = Value) &amp; Purpose Guide
              </div>
              <p className="text-emerald-200">
                Shows live server status (Configured / Not Set) without revealing secret values in browser memory.
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopy(
                  'env_template_all',
                  envGuide.map((item) => `# ${item.category}\n${item.key.split(' ')[0]}=`).join('\n')
                )
              }
              className="px-3.5 py-2 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              {copiedId === 'env_template_all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === 'env_template_all' ? 'Copied Template!' : 'Copy All Keys Template'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredEnv.map((item) => {
              const showInstr = expandedInstructions[`env_${item.key}`] !== false;
              return (
                <div
                  key={item.key}
                  className="rounded-xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-xs font-black text-emerald-950 dark:text-white break-all">
                        {item.key}=
                      </div>
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {item.category}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold uppercase shrink-0 ${
                        item.isSet ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {item.isSet ? 'CONFIGURED' : 'NOT SET'}
                    </span>
                  </div>

                  <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/50 px-2.5 py-1.5 font-mono text-[11px] text-emerald-800 dark:text-emerald-200 break-all">
                    Sample: {item.sample}
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedInstructions((prev) => ({
                          ...prev,
                          [`env_${item.key}`]: !showInstr,
                        }))
                      }
                      className="text-[11px] font-bold text-[#FF5A1F] inline-flex items-center gap-1 hover:underline"
                    >
                      {showInstr ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showInstr ? 'Hide Instruction' : 'View Instruction'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(`key_${item.key}`, `${item.key.split(' ')[0]}=`)}
                      className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 hover:underline"
                    >
                      {copiedId === `key_${item.key}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === `key_${item.key}` ? 'Copied' : 'Copy Key'}
                    </button>
                  </div>

                  {showInstr && (
                    <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed pt-1 border-t border-emerald-100 dark:border-emerald-900">
                      {item.purpose}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
