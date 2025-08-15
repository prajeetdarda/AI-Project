"use client"; // because we'll use state and interactivity

import TicTacToe from "@/features/games/components/TicTacToe";

export default function TicTacToePage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Tic-Tac-Toe</h1>
      <TicTacToe />
    </div>
  );
}