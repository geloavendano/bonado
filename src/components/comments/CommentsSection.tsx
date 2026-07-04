import { useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useAuth } from "@/context/AuthContext";
import { useComments, type CommentItem } from "@/hooks/useComments";
import type { TripMember } from "@/hooks/useTrip";
import { timeAgo } from "@/lib/timeAgo";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Highlights @Name tokens that match trip members. */
function renderBody(body: string, members: TripMember[]): ReactNode {
  const names = members
    .map((member) => escapeRegExp(member.name))
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return body;
  const parts = body.split(new RegExp(`@(${names.join("|")})`, "g"));
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={index} className="font-bold text-teal">
        @{part}
      </span>
    ) : (
      part
    ),
  );
}

interface ComposerProps {
  members: TripMember[];
  currentUserId?: string;
  initialBody?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (body: string, mentionIds: string[]) => Promise<boolean>;
  onCancel?: () => void;
}

function CommentComposer({
  members,
  currentUserId,
  initialBody,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: ComposerProps) {
  const [body, setBody] = useState(initialBody ?? "");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // members picked from the dropdown; filtered on submit to those still in the text
  const picked = useRef<Map<string, string>>(
    new Map(
      members
        .filter((member) => (initialBody ?? "").includes(`@${member.name}`))
        .map((member) => [member.id, member.name]),
    ),
  );

  const mentionable = members.filter((member) => member.id !== currentUserId);
  const suggestions =
    mentionQuery === null
      ? []
      : mentionable.filter((member) =>
          member.name.toLowerCase().includes(mentionQuery.toLowerCase()),
        );

  function refreshMentionQuery(value: string, caret: number) {
    const match = /(^|\s)@([^\s@]*)$/.exec(value.slice(0, caret));
    setMentionQuery(match ? match[2] : null);
  }

  function pickMention(member: TripMember) {
    const textarea = textareaRef.current;
    const caret = textarea?.selectionStart ?? body.length;
    const before = body.slice(0, caret).replace(/@[^\s@]*$/, `@${member.name} `);
    setBody(before + body.slice(caret));
    picked.current.set(member.id, member.name);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(before.length, before.length);
    });
  }

  async function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    const mentionIds = [...picked.current]
      .filter(([, name]) => trimmed.includes(`@${name}`))
      .map(([id]) => id);
    setSubmitting(true);
    const ok = await onSubmit(trimmed, mentionIds);
    setSubmitting(false);
    if (ok && !initialBody) {
      setBody("");
      picked.current.clear();
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={body}
        rows={2}
        placeholder={placeholder ?? "Add a comment… use @ to mention"}
        onChange={(event) => {
          setBody(event.target.value);
          refreshMentionQuery(
            event.target.value,
            event.target.selectionStart ?? event.target.value.length,
          );
        }}
        onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
        className="w-full resize-none rounded-[16px] bg-tile px-3.5 py-3 text-[13.5px] text-ink outline-none placeholder:text-faint"
      />
      {suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 -mt-1 max-h-[180px] overflow-y-auto rounded-[14px] bg-card py-1 shadow-[var(--shadow-floating)]">
          {suggestions.map((member) => (
            <button
              key={member.id}
              onPointerDown={(event) => {
                event.preventDefault();
                pickMention(member);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
            >
              <Avatar
                name={member.name}
                seed={member.id}
                avatarUrl={member.avatar_url}
                size={26}
              />
              <span className="truncate text-[13px] font-semibold">
                {member.name}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex items-center justify-end gap-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="rounded-pill px-3.5 py-2 text-[12.5px] font-semibold text-secondary"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => void handleSubmit()}
          disabled={!body.trim() || submitting}
          className="rounded-pill bg-teal px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  members,
  isOwn,
  isLast,
  onUpdate,
  onDelete,
}: {
  comment: CommentItem;
  members: TripMember[];
  isOwn: boolean;
  isLast: boolean;
  onUpdate: (body: string, mentionIds: string[]) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div
      className={
        "flex gap-3 py-3" + (isLast ? "" : " border-b border-hairline")
      }
    >
      <Avatar
        name={comment.author?.name ?? "Member"}
        seed={comment.author_id}
        avatarUrl={comment.author?.avatar_url}
        size={30}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-bold">
            {comment.author?.name ?? "Member"}
          </span>
          <span className="shrink-0 text-[10.5px] text-faint">
            {timeAgo(comment.created_at)}
            {comment.edited_at ? " · edited" : ""}
          </span>
        </div>
        {editing ? (
          <div className="mt-1.5">
            <CommentComposer
              members={members}
              currentUserId={comment.author_id}
              initialBody={comment.body}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={async (body, mentionIds) => {
                const ok = await onUpdate(body, mentionIds);
                if (ok) setEditing(false);
                return ok;
              }}
            />
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-snug">
            {renderBody(comment.body, members)}
          </p>
        )}
        {isOwn && !editing && (
          <div className="mt-1 flex items-center gap-3">
            {confirmingDelete ? (
              <>
                <button
                  onClick={() => void onDelete()}
                  className="text-[11.5px] font-bold text-owe"
                >
                  Delete comment
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-[11.5px] font-semibold text-secondary"
                >
                  Keep
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="text-[11.5px] font-bold text-teal"
                >
                  Edit
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="text-[11.5px] font-semibold text-secondary"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CommentsSectionProps {
  entryId?: string;
  settlementId?: string;
  members: TripMember[];
}

export function CommentsSection({
  entryId,
  settlementId,
  members,
}: CommentsSectionProps) {
  const { user } = useAuth();
  const {
    comments,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    error,
    addComment,
    updateComment,
    deleteComment,
  } = useComments({ entryId, settlementId });

  return (
    <>
      <SectionLabel>Comments</SectionLabel>
      <div className="rounded-[18px] bg-card px-4 py-3.5 shadow-[var(--shadow-card)]">
        <CommentComposer
          members={members}
          currentUserId={user?.id}
          submitLabel="Comment"
          onSubmit={addComment}
        />
        {error && <p className="mt-2 text-[12px] text-owe">{error}</p>}
        {!loading && comments.length === 0 && (
          <p className="py-3 text-center text-[12.5px] text-secondary">
            No comments yet. Start the conversation.
          </p>
        )}
        {comments.length > 0 && (
          <div className="mt-1">
            {comments.map((comment, index) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                members={members}
                isOwn={comment.author_id === user?.id}
                isLast={index === comments.length - 1}
                onUpdate={(body, mentionIds) =>
                  updateComment(comment.id, body, mentionIds)
                }
                onDelete={() => deleteComment(comment.id)}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="w-full py-2.5 text-center text-[12px] font-bold text-teal disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load earlier comments"}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
