"use client";

import { useMemo, useState } from "react";

type Cell = "X" | "O" | null;
type Board = Cell[];
type Difficulty = "easy" | "medium" | "hard";

const LINES: number[][] = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

function getWinner(b: Board): Cell | "draw" | null {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  }
  return b.every(Boolean) ? "draw" : null;
}

function availableMoves(b: Board): number[] {
  const res: number[] = [];
  for (let i = 0; i < 9; i++) if (!b[i]) res.push(i);
  return res;
}

function minimax(
  board: Board,
  ai: "X" | "O",
  turn: "X" | "O",
  alpha = -Infinity,
  beta = Infinity
): number {
  const w = getWinner(board);
  if (w === ai) return 1;
  if (w && w !== "draw") return -1;
  if (w === "draw") return 0;

  const moves = availableMoves(board);

  if (turn === ai) {
    let best = -Infinity;
    for (const m of moves) {
      board[m] = turn;
      const score = minimax(board, ai, turn === "X" ? "O" : "X", alpha, beta);
      board[m] = null;
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      board[m] = turn;
      const score = minimax(board, ai, turn === "X" ? "O" : "X", alpha, beta);
      board[m] = null;
      best = Math.min(best, score);
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function bestMove(board: Board, ai: "X" | "O"): number | null {
  // small heuristic: center if open
  if (!board[4]) return 4;

  let bestScore = -Infinity;
  let move: number | null = null;
  for (const m of availableMoves(board)) {
    board[m] = ai;
    const score = minimax(board, ai, ai === "X" ? "O" : "X");
    board[m] = null;
    if (score > bestScore) {
      bestScore = score;
      move = m;
    }
  }
  return move;
}

function randomMove(board: Board): number | null {
  const moves = availableMoves(board);
  if (moves.length === 0) return null;
  const idx = Math.floor(Math.random() * moves.length);
  return moves[idx]!;
}

function pickMove(board: Board, ai: "X"|"O", difficulty: Difficulty): number | null {
  if (difficulty === "easy") return randomMove(board);
  if (difficulty === "hard") return bestMove(board, ai);
  // medium: 50/50
  return Math.random() < 0.5 ? bestMove(board, ai) : randomMove(board);
}

export default function TicTacToe() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [human, setHuman] = useState<"X" | "O">("X");
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const ai = useMemo<"X" | "O">(() => (human === "X" ? "O" : "X"), [human]);
  const w = getWinner(board);

  function humanMove(i: number) {
    if (board[i] || w) return;
    const next = board.slice();
    next[i] = human;

    // If human just won or it's a draw, stop.
    const afterHumanWinner = getWinner(next);
    if (afterHumanWinner) {
      setBoard(next);
      return;
    }

    // AI reply based on difficulty
    const reply = pickMove(next, ai, difficulty);
    if (reply !== null) next[reply] = ai;

    setBoard(next);
  }

  function reset(swap = false) {
    setBoard(Array(9).fill(null));
    if (swap) setHuman((h) => (h === "X" ? "O" : "X"));
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
        <div className="flex flex-col gap-2">
            <span className="text-sm text-gray-700">
                You are <b>{human}</b>, AI is <b>{ai}</b>.
            </span>

            {/* all controls on one line */}
            <div className="flex flex-col items-start gap-2">
                <label className="text-sm inline-flex items-center gap-1">
                Difficulty:
                <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                    className="border rounded px-2 py-1 text-sm"
                >
                    <option value="easy">Easy (random)</option>
                    <option value="medium">Medium (50% best)</option>
                    <option value="hard">Hard (optimal)</option>
                </select>
                </label>
                <div>
                    <button
                        onClick={() => reset(false)}
                        className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                        >
                        Reset
                    </button>
                    <button
                        onClick={() => reset(true)}
                        className="px-2 py-1 rounded border text-sm hover:bg-gray-50"
                        >
                        Reset &amp; Swap First Move
                    </button>
                </div>
                
            </div>
        </div>

        {/* Board (centered) */}
        <div className="grid grid-cols-3 gap-2 w-60">
            {board.map((cell, i) => (
                <button
                key={i}
                onClick={() => humanMove(i)}
                className="h-20 w-20 border rounded text-3xl font-semibold flex items-center justify-center hover:bg-gray-50"
                aria-label={`cell ${i}`}
                >
                {cell}
                </button>
            ))}
        </div>
      {/* Status */}
      <div className="text-sm">
        {w === "draw" && <span>It’s a draw.</span>}
        {w === "X" && <span>Winner: X</span>}
        {w === "O" && <span>Winner: O</span>}
        {!w && <span>Your move.</span>}
      </div>
    </div>
  );
}