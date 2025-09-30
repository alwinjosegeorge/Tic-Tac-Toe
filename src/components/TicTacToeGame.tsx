import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type Player = 'X' | 'O' | null;
type GameStatus = 'playing' | 'won' | 'draw';
type GameMode = 'pvp' | 'pve'; // Player vs Player or Player vs AI

interface GameState {
  board: Player[];
  currentPlayer: Player;
  status: GameStatus;
  winner: Player;
  winningCells: number[];
  scores: { X: number; O: number; draws: number };
  mode: GameMode;
}

const INITIAL_STATE: GameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  status: 'playing',
  winner: null,
  winningCells: [],
  scores: { X: 0, O: 0, draws: 0 },
  mode: 'pve' // Default to Player vs AI
};

const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6] // diagonals
];

const Timer: React.FC<{ timeLeft: number; isActive: boolean }> = ({ timeLeft, isActive }) => {
  const isWarning = timeLeft <= 3;
  
  return (
    <div className={cn(
      "text-2xl font-bold px-4 py-2 rounded-lg transition-all duration-300",
      isWarning ? "text-timer-warning animate-timer-pulse" : "text-timer-normal",
      !isActive && "opacity-50"
    )}>
      {timeLeft}s
    </div>
  );
};

const GameCell: React.FC<{
  value: Player;
  onClick: () => void;
  isWinning: boolean;
  disabled: boolean;
}> = ({ value, onClick, isWinning, disabled }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || value !== null}
      className={cn(
        "aspect-square bg-game-grid border-2 border-game-hover/30 rounded-xl",
        "hover:bg-game-hover hover:border-game-hover/60 transition-all duration-200",
        "flex items-center justify-center text-4xl font-bold",
        "shadow-[var(--shadow-cell)] disabled:cursor-not-allowed",
        isWinning && "animate-winner-glow",
        !disabled && !value && "hover:shadow-lg hover:scale-105"
      )}
    >
      {value && (
        <span
          className={cn(
            "animate-cell-fill",
            value === 'X' ? "text-game-x" : "text-game-o"
          )}
        >
          {value}
        </span>
      )}
    </button>
  );
};

export const TicTacToeGame: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isTimerActive, setIsTimerActive] = useState(true);
  const { toast } = useToast();

  const checkWinner = useCallback((board: Player[]): { winner: Player; winningCells: number[] } => {
    for (const combination of WINNING_COMBINATIONS) {
      const [a, b, c] = combination;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { winner: board[a], winningCells: combination };
      }
    }
    return { winner: null, winningCells: [] };
  }, []);

  const makeMove = useCallback((index: number, player: Player) => {
    setGameState(prev => {
      if (prev.board[index] || prev.status !== 'playing') return prev;

      const newBoard = [...prev.board];
      newBoard[index] = player;

      const { winner, winningCells } = checkWinner(newBoard);
      
      if (winner) {
        const newScores = { ...prev.scores };
        newScores[winner]++;
        
        // Dynamic toast messages based on game mode
        const getWinMessage = () => {
          if (prev.mode === 'pvp') {
            return {
              title: `Player ${winner} Wins! 🎉`,
              description: `Great game! Player ${winner} takes this round.`,
            };
          } else {
            return {
              title: winner === 'X' ? "You Won! 🎉" : "AI Won! 🤖",
              description: `Player ${winner} wins this round!`,
            };
          }
        };
        
        toast(getWinMessage());
        return {
          ...prev,
          board: newBoard,
          status: 'won' as GameStatus,
          winner,
          winningCells,
          scores: newScores
        };
      }

      if (newBoard.every(cell => cell !== null)) {
        const newScores = { ...prev.scores };
        newScores.draws++;
        toast({
          title: "It's a Draw! 🤝",
          description: "Great game! Try again.",
        });
        return {
          ...prev,
          board: newBoard,
          status: 'draw' as GameStatus,
          scores: newScores
        };
      }

      return {
        ...prev,
        board: newBoard,
        currentPlayer: player === 'X' ? 'O' : 'X'
      };
    });
  }, [checkWinner, toast]);

  const getBestMove = useCallback((board: Player[]): number => {
    // Simple AI strategy
    const availableMoves = board.map((cell, index) => cell === null ? index : null).filter(val => val !== null) as number[];
    
    // Check if AI can win
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'O';
      if (checkWinner(testBoard).winner === 'O') return move;
    }
    
    // Check if AI needs to block player
    for (const move of availableMoves) {
      const testBoard = [...board];
      testBoard[move] = 'X';
      if (checkWinner(testBoard).winner === 'X') return move;
    }
    
    // Take center if available
    if (board[4] === null) return 4;
    
    // Take corners
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
    
    // Take any available move
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
  }, [checkWinner]);

  // Timer logic
  useEffect(() => {
    if (!isTimerActive || gameState.status !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up - handle based on game mode
          if (gameState.mode === 'pve' && gameState.currentPlayer === 'X') {
            // In PvE mode, if player X times out, AI gets a free move
            const availableMoves = gameState.board.map((cell, index) => 
              cell === null ? index : null
            ).filter(val => val !== null) as number[];
            
            if (availableMoves.length > 0) {
              const randomMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
              makeMove(randomMove, 'O');
            }
          } else if (gameState.mode === 'pvp') {
            // In PvP mode, current player loses turn, switch to other player
            const availableMoves = gameState.board.map((cell, index) => 
              cell === null ? index : null
            ).filter(val => val !== null) as number[];
            
            if (availableMoves.length > 0) {
              const nextPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
              const randomMove = availableMoves[Math.floor(Math.random() * availableMoves.length)];
              makeMove(randomMove, nextPlayer);
            }
          }
          return 10; // Reset timer
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTimerActive, gameState.status, gameState.currentPlayer, gameState.board, gameState.mode, makeMove]);

  // AI move logic (only for PvE mode)
  useEffect(() => {
    if (gameState.mode === 'pve' && gameState.currentPlayer === 'O' && gameState.status === 'playing') {
      setIsTimerActive(false);
      const timeout = setTimeout(() => {
        const bestMove = getBestMove(gameState.board);
        makeMove(bestMove, 'O');
        setTimeLeft(10);
        setIsTimerActive(true);
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [gameState.currentPlayer, gameState.status, gameState.board, gameState.mode, getBestMove, makeMove]);

  // Reset timer when player changes (for both modes)
  useEffect(() => {
    if (gameState.status === 'playing') {
      // In PvE mode, only reset timer for player X or when switching from AI back to player
      // In PvP mode, reset timer for both players
      if (gameState.mode === 'pvp' || (gameState.mode === 'pve' && gameState.currentPlayer === 'X')) {
        setTimeLeft(10);
        setIsTimerActive(true);
      }
    }
  }, [gameState.currentPlayer, gameState.status, gameState.mode]);

  const resetGame = () => {
    setGameState(prev => ({
      ...INITIAL_STATE,
      scores: prev.scores,
      mode: prev.mode // Keep the current mode
    }));
    setTimeLeft(10);
    setIsTimerActive(true);
  };

  const resetScores = () => {
    setGameState(prev => ({
      ...INITIAL_STATE,
      mode: prev.mode // Keep the current mode
    }));
    setTimeLeft(10);
    setIsTimerActive(true);
  };

  const changeGameMode = (mode: GameMode) => {
    setGameState(prev => ({
      ...INITIAL_STATE,
      scores: prev.scores, // Keep existing scores
      mode
    }));
    setTimeLeft(10);
    setIsTimerActive(true);
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-game)] flex items-center justify-center p-4">
      <Card className="bg-[var(--gradient-card)] p-8 shadow-[var(--shadow-game)] border-game-grid max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Tic Tac Toe</h1>
          <p className="text-muted-foreground">
            {gameState.mode === 'pvp' ? 'Player vs Player' : 'Professional AI Challenge'}
          </p>
        </div>

        {/* Game Mode Selection */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={gameState.mode === 'pve' ? 'default' : 'outline'}
            onClick={() => changeGameMode('pve')}
            className="flex-1"
            disabled={gameState.status === 'playing' && (gameState.board.some(cell => cell !== null))}
          >
            vs AI
          </Button>
          <Button
            variant={gameState.mode === 'pvp' ? 'default' : 'outline'}
            onClick={() => changeGameMode('pvp')}
            className="flex-1"
            disabled={gameState.status === 'playing' && (gameState.board.some(cell => cell !== null))}
          >
            vs Player
          </Button>
        </div>

        {/* Score Board */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              {gameState.mode === 'pvp' ? 'Player X' : 'You (X)'}
            </div>
            <div className="text-2xl font-bold text-game-x">{gameState.scores.X}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Draws</div>
            <div className="text-2xl font-bold text-muted-foreground">{gameState.scores.draws}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              {gameState.mode === 'pvp' ? 'Player O' : 'AI (O)'}
            </div>
            <div className="text-2xl font-bold text-game-o">{gameState.scores.O}</div>
          </div>
        </div>

        {/* Game Status */}
        <div className="text-center mb-4">
          {gameState.status === 'playing' && (
            <div className="flex items-center justify-center gap-4">
              <span className="text-lg">
                {gameState.mode === 'pvp' 
                  ? `Player ${gameState.currentPlayer}'s Turn`
                  : (gameState.currentPlayer === 'X' ? "Your Turn" : "AI Thinking...")
                }
              </span>
              {/* Show timer for both players in PvP mode, only for player X in PvE mode */}
              {(gameState.mode === 'pvp' || (gameState.mode === 'pve' && gameState.currentPlayer === 'X')) && (
                <Timer timeLeft={timeLeft} isActive={isTimerActive} />
              )}
            </div>
          )}
          {gameState.status === 'won' && (
            <div className="text-lg font-bold">
              {gameState.mode === 'pvp' 
                ? `🎉 Player ${gameState.winner} Won!`
                : (gameState.winner === 'X' ? "🎉 You Won!" : "🤖 AI Won!")
              }
            </div>
          )}
          {gameState.status === 'draw' && (
            <div className="text-lg font-bold">🤝 It's a Draw!</div>
          )}
        </div>

        {/* Game Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {gameState.board.map((cell, index) => (
            <GameCell
              key={index}
              value={cell}
              onClick={() => makeMove(index, gameState.currentPlayer)}
              isWinning={gameState.winningCells.includes(index)}
              disabled={
                gameState.status !== 'playing' || 
                (gameState.mode === 'pve' && gameState.currentPlayer !== 'X')
              }
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <Button 
            onClick={resetGame} 
            variant="secondary" 
            className="flex-1"
          >
            New Game
          </Button>
          <Button 
            onClick={resetScores} 
            variant="outline" 
            className="flex-1"
          >
            Reset Scores
          </Button>
        </div>
      </Card>
    </div>
  );
};