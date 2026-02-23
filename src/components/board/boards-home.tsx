"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import type { BoardDto } from "@/lib/serializers";

type BoardsHomeProps = {
  initialBoards: BoardDto[];
  userEmail: string;
};

export function BoardsHome({ initialBoards, userEmail }: BoardsHomeProps) {
  const router = useRouter();
  const [boards, setBoards] = useState(initialBoards);
  const [boardName, setBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function createBoard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!boardName.trim()) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/boards", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: boardName.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not create board");
      }

      const payload = (await response.json()) as { board: BoardDto };
      setBoards((previous) => [payload.board, ...previous]);
      setBoardName("");
      router.push(`/boards/${payload.board.id}`);
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create board",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function logout() {
    setIsLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <main className="boards-shell">
      <header className="boards-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-[var(--text)]">Story Maps</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Signed in as {userEmail}</p>
        </div>
        <button className="secondary-btn" disabled={isLoggingOut} onClick={logout} type="button">
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </button>
      </header>

      <section className="boards-create-card">
        <h2 className="text-lg font-medium text-[var(--text)]">Create a new map</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Start from a clean board and shape your skeleton, MVP, and lovable lanes.
        </p>
        <form className="mt-4 flex flex-wrap items-center gap-3" onSubmit={createBoard}>
          <input
            className="input min-w-[260px] flex-1"
            onChange={(event) => setBoardName(event.target.value)}
            placeholder="Example: Onboarding revamp"
            value={boardName}
          />
          <button className="primary-btn" disabled={isCreating} type="submit">
            {isCreating ? "Creating..." : "Create board"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-[var(--text)]">Your maps</h2>
        {boards.length === 0 ? (
          <div className="empty-state mt-3">No boards yet. Create your first map above.</div>
        ) : (
          <div className="boards-grid mt-3">
            {boards.map((board) => (
              <Link className="board-tile" href={`/boards/${board.id}`} key={board.id}>
                <div>
                  <p className="text-base font-medium text-[var(--text)]">{board.name}</p>
                  {board.description ? (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{board.description}</p>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--text-muted)]">No description</p>
                  )}
                </div>
                <p className="mt-4 text-xs text-[var(--text-soft)]">
                  Updated {new Date(board.updatedAt).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
