export default function GamesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI Games</h1>
      <p className="mb-4 text-gray-600">
        Choose a game below to play with AI:
      </p>
      <ul className="space-y-2">
        <li>
          <a
            href="/games/tictactoe"
            className="text-blue-600 hover:underline"
          >
            Tic-Tac-Toe (Minimax AI)
          </a>
        </li>
        {/* Later we can add Chess, Connect 4, etc. */}
      </ul>
    </div>
  );
}