import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Pencil, Search, ShieldCheck, Trash2, UserPlus, Users, Video, X } from 'lucide-react';

export interface GroupChatMemberPreview {
  id: string;
  name: string;
  avatar?: string;
}

export interface ChatGroupItem {
  id: string;
  name: string;
  memberIds: string[];
  members?: GroupChatMemberPreview[];
  createdById: string;
  createdByName: string;
  adminId?: string;
  adminName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveGroupCallItem {
  callId: string;
  roomId: string;
  groupName: string;
  hostUserId: string;
  hostUserName: string;
  startedAtMs: number;
  participantIds: string[];
  participantNames: string[];
  participantCount: number;
}

export interface SelectableMemberCandidate {
  id: string;
  name: string;
  avatar?: string;
  role?: 'admin' | 'member';
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: SelectableMemberCandidate[];
  currentUserId: string;
  onlineUsers: string[];
  defaultAvatar: string;
  onCreateGroup: (name: string, memberIds: string[]) => Promise<void>;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  candidates,
  currentUserId,
  onlineUsers,
  defaultAvatar,
  onCreateGroup,
}) => {
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const availableMembers = useMemo(
    () => candidates.filter((u) => u.id !== currentUserId),
    [candidates, currentUserId]
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableMembers;
    return availableMembers.filter((u) => u.name.toLowerCase().includes(q));
  }, [availableMembers, search]);

  if (!isOpen) return null;

  const toggleMember = (id: string) => {
    setError('');
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = groupName.trim();
    if (cleanName.length < 2) {
      setError('Please enter a group name (at least 2 characters).');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Select at least 1 member to start a group chat.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onCreateGroup(cleanName, selectedIds);
      setGroupName('');
      setSearch('');
      setSelectedIds([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create group chat.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create Group Chat"
    >
      <div
        className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-2xl bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700/80 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-900/70 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-emerald-950 dark:text-white truncate">
                Create Group Chat
              </h3>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                Chat &amp; start multi-person group video calls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-800 transition"
            aria-label="Close create group modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 space-y-3 border-b border-emerald-100 dark:border-emerald-900 shrink-0">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 mb-1.5">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => {
                  setGroupName(e.target.value);
                  setError('');
                }}
                maxLength={60}
                placeholder="e.g. Delivery Team, VIP Crew..."
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-sm font-semibold text-emerald-950 dark:text-white placeholder-emerald-600/60 dark:placeholder-emerald-400/70 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members..."
                  className="w-full min-h-[40px] pl-8 pr-3 py-1.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-white placeholder-emerald-600/60 dark:placeholder-emerald-400/70 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.length === availableMembers.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(availableMembers.map((u) => u.id));
                  }
                }}
                className="min-h-[40px] px-3 rounded-xl bg-emerald-100 dark:bg-emerald-900 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800 transition shrink-0"
              >
                {selectedIds.length === availableMembers.length && availableMembers.length > 0
                  ? 'Clear'
                  : 'Select All'}
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
              <span>Selected: {selectedIds.length + 1} members (including you)</span>
              <span>{availableMembers.length} available</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[160px] max-h-[300px]">
            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-700 dark:text-emerald-300">
                No matching members found.
              </div>
            ) : (
              filteredMembers.map((member) => {
                const checked = selectedIds.includes(member.id);
                const isOnline = onlineUsers.includes(member.name.trim().toLowerCase());
                const avatarUrl = member.avatar || defaultAvatar;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleMember(member.id)}
                    className={`w-full min-h-[48px] px-3 py-2 rounded-xl border flex items-center justify-between gap-3 text-left transition ${
                      checked
                        ? 'bg-emerald-100 dark:bg-emerald-800/80 border-emerald-500 text-emerald-950 dark:text-white'
                        : 'bg-white dark:bg-emerald-950/60 border-emerald-200/80 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-50 dark:hover:bg-emerald-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={avatarUrl}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover bg-emerald-900/20 border border-emerald-400/40"
                        />
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-emerald-950" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{member.name}</div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                          {isOnline ? 'Online now' : member.role === 'admin' ? 'Admin' : 'Member'}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 transition ${
                        checked
                          ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                          : 'border-emerald-300 dark:border-emerald-700 bg-transparent'
                      }`}
                    >
                      {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-700 text-[11px] font-semibold text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="p-4 border-t border-emerald-100 dark:border-emerald-900 flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-emerald-900 text-slate-800 dark:text-emerald-100 text-xs font-bold hover:bg-slate-200 dark:hover:bg-emerald-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !groupName.trim() || selectedIds.length === 0}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 shadow transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" /> Create Group
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface GroupMembersModalProps {
  group: ChatGroupItem | null;
  onClose: () => void;
  candidates: SelectableMemberCandidate[];
  currentUserId: string;
  isAdmin: boolean;
  onlineUsers: string[];
  defaultAvatar: string;
  onAddMembers: (groupId: string, memberIds: string[]) => Promise<void>;
  onRemoveMember: (groupId: string, memberId: string) => Promise<void>;
  onRenameGroup: (groupId: string, newName: string) => Promise<void>;
  onChangeGroupAdmin: (groupId: string, newAdminId: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onStartGroupCall: (groupId: string) => void;
}

export const GroupMembersModal: React.FC<GroupMembersModalProps> = ({
  group,
  onClose,
  candidates,
  currentUserId,
  isAdmin,
  onlineUsers,
  defaultAvatar,
  onAddMembers,
  onRemoveMember,
  onRenameGroup,
  onChangeGroupAdmin,
  onDeleteGroup,
  onStartGroupCall,
}) => {
  const [addingIds, setAddingIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [selectedNewAdminId, setSelectedNewAdminId] = useState('');
  const [confirmingAdminTransfer, setConfirmingAdminTransfer] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setIsEditingName(false);
    setNameDraft(group?.name || '');
    setSelectedNewAdminId('');
    setConfirmingAdminTransfer(false);
    setAddingIds([]);
    setActionError('');
  }, [group?.id, group?.name, group?.adminId]);

  if (!group) return null;

  const effectiveAdminId = group.adminId || group.createdById;
  const effectiveAdminName = group.adminName || group.createdByName;
  const canManage = isAdmin || effectiveAdminId === currentUserId;
  const candidateById = new Map(candidates.map((u) => [u.id, u]));
  const memberList = group.memberIds.map((id) => {
    const fromGroup = group.members?.find((m) => m.id === id);
    const fromCandidates = candidateById.get(id);
    return {
      id,
      name: fromGroup?.name || fromCandidates?.name || 'Member',
      avatar: fromGroup?.avatar || fromCandidates?.avatar || defaultAvatar,
    };
  });

  const nonMembers = candidates.filter((u) => !group.memberIds.includes(u.id));
  const transferableMembers = memberList.filter((m) => m.id !== effectiveAdminId);
  const pendingAdminMember = transferableMembers.find((m) => m.id === selectedNewAdminId) || null;

  const handleAddSelected = async () => {
    if (addingIds.length === 0) return;
    setBusy(true);
    setActionError('');
    try {
      await onAddMembers(group.id, addingIds);
      setAddingIds([]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to add members.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveGroupName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = nameDraft.trim();
    if (cleanName.length < 2) {
      setActionError('Group name must be at least 2 characters.');
      return;
    }
    if (cleanName === group.name.trim()) {
      setIsEditingName(false);
      setActionError('');
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await onRenameGroup(group.id, cleanName);
      setIsEditingName(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to rename group.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmAdminTransfer = async () => {
    if (!selectedNewAdminId) return;
    setBusy(true);
    setActionError('');
    try {
      await onChangeGroupAdmin(group.id, selectedNewAdminId);
      setSelectedNewAdminId('');
      setConfirmingAdminTransfer(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to change group admin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Group Details"
    >
      <div
        className="w-full max-w-md max-h-[88dvh] flex flex-col rounded-2xl bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-700/80 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3.5 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-900/70 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            {isEditingName ? (
              <form onSubmit={handleSaveGroupName} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => {
                    setNameDraft(e.target.value);
                    setActionError('');
                  }}
                  maxLength={60}
                  disabled={busy}
                  autoFocus
                  placeholder="Enter group name..."
                  aria-label="Edit group name"
                  className="flex-1 min-w-0 min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-emerald-950 border border-emerald-400 dark:border-emerald-600 text-xs font-bold text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={busy || nameDraft.trim().length < 2}
                  className="min-h-[40px] px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black shrink-0 transition"
                >
                  {busy ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setIsEditingName(false);
                    setNameDraft(group.name);
                    setActionError('');
                  }}
                  className="min-h-[40px] px-2.5 rounded-xl bg-white dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-bold shrink-0 transition"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-1.5 min-w-0">
                  <h3 className="text-sm font-black text-emerald-950 dark:text-white truncate">
                    {group.name}
                  </h3>
                  {canManage && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setNameDraft(group.name);
                        setActionError('');
                        setIsEditingName(true);
                      }}
                      title="Edit Group Name"
                      aria-label="Edit group name"
                      className="min-h-[40px] min-w-[40px] -my-1 flex items-center justify-center rounded-xl text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/70 dark:hover:bg-emerald-800 transition shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                  {memberList.length} members · Admin: {effectiveAdminName}
                </p>
              </>
            )}
          </div>
          {!isEditingName && (
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white dark:bg-emerald-900 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 shrink-0"
              aria-label="Close group details"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {actionError && (
            <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-700 text-[11px] font-semibold text-red-700 dark:text-red-300">
              {actionError}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              onStartGroupCall(group.id);
            }}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow transition"
          >
            <Video className="w-4 h-4" /> Start Group Video Call
          </button>

          <div className="space-y-1.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              Group Members ({memberList.length})
            </div>
            {memberList.map((m) => {
              const isOnline = onlineUsers.includes(m.name.trim().toLowerCase());
              const isGroupAdminMember = m.id === effectiveAdminId;
              const isSelf = m.id === currentUserId;
              const showLeaveOrRemove =
                (isSelf && (!isGroupAdminMember || memberList.length <= 1)) ||
                (canManage && !isGroupAdminMember && !isSelf);
              return (
                <div
                  key={m.id}
                  className="px-3 py-2 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/40 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={m.avatar}
                        alt=""
                        className="w-8 h-8 rounded-lg object-cover border border-emerald-400/40"
                      />
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white dark:border-emerald-950" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-emerald-950 dark:text-white truncate">
                        {m.name} {isSelf ? '(You)' : ''}
                      </div>
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                        {isGroupAdminMember ? 'Group Admin' : isOnline ? 'Online' : 'Member'}
                      </div>
                    </div>
                  </div>
                  {showLeaveOrRemove && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        setActionError('');
                        try {
                          await onRemoveMember(group.id, m.id);
                          if (isSelf) onClose();
                        } catch (err) {
                          setActionError(err instanceof Error ? err.message : 'Unable to update member.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/70 border border-red-300 dark:border-red-700 text-[11px] font-bold text-red-700 dark:text-red-300 hover:bg-red-100 transition shrink-0"
                    >
                      {isSelf ? 'Leave' : 'Remove'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {canManage && transferableMembers.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-emerald-100 dark:border-emerald-900">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Change Admin
                </div>
                <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 truncate">
                  Current: {effectiveAdminName}
                </span>
              </div>

              {!confirmingAdminTransfer ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedNewAdminId}
                    onChange={(e) => {
                      setSelectedNewAdminId(e.target.value);
                      setActionError('');
                    }}
                    disabled={busy}
                    aria-label="Select new group admin"
                    className="flex-1 min-w-0 min-h-[44px] px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select member...</option>
                    {transferableMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !selectedNewAdminId}
                    onClick={() => {
                      setActionError('');
                      setConfirmingAdminTransfer(true);
                    }}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black whitespace-nowrap shrink-0 transition"
                  >
                    Change Admin
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 space-y-2.5">
                  <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
                    Transfer group admin to <span className="font-black">{pendingAdminMember?.name}</span>?
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmingAdminTransfer(false)}
                      className="flex-1 min-h-[40px] px-3 rounded-xl bg-white dark:bg-emerald-900 border border-amber-300 dark:border-emerald-700 text-xs font-bold text-slate-800 dark:text-emerald-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleConfirmAdminTransfer()}
                      className="flex-1 min-h-[40px] px-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-black inline-flex items-center justify-center gap-1.5 transition"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Confirm Transfer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {canManage && nonMembers.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-emerald-100 dark:border-emerald-900">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5" /> Add Members
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {nonMembers.map((u) => {
                  const selected = addingIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() =>
                        setAddingIds((prev) =>
                          prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]
                        )
                      }
                      className={`w-full min-h-[44px] px-3 py-1.5 rounded-xl border flex items-center justify-between text-xs font-bold transition ${
                        selected
                          ? 'bg-emerald-100 dark:bg-emerald-800 border-emerald-500 text-emerald-950 dark:text-white'
                          : 'bg-white dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      }`}
                    >
                      <span className="truncate">{u.name}</span>
                      {selected && <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {addingIds.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAddSelected()}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition"
                >
                  Add {addingIds.length} Selected Member{addingIds.length > 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}

          {canManage && (
            <div className="pt-3 border-t border-emerald-100 dark:border-emerald-900">
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setActionError('');
                  try {
                    await onDeleteGroup(group.id);
                    onClose();
                  } catch (err) {
                    setActionError(err instanceof Error ? err.message : 'Unable to delete group chat.');
                  } finally {
                    setBusy(false);
                  }
                }}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-300 dark:border-red-700/80 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
              >
                <Trash2 className="w-4 h-4" /> Delete Group Chat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
