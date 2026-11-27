import React, { useState } from 'react';
import { Gamepad2, Trophy, RotateCcw, Sparkles, Star, Award, Zap, Heart, Coins } from 'lucide-react';

interface GamesPanelProps {
  theme: {
    cardBg: string;
    cardBorder: string;
    textMain: string;
    textMuted: string;
  };
}

export const GamesPanel: React.FC<GamesPanelProps> = ({ theme }) => {
  const [activeGame, setActiveGame] = useState<'menu' | 'tictactoe' | 'spinner' | 'reflex' | 'trivia'>('menu');

  // Tic Tac Toe State
  const [board, setBoard] = useState<Array<string | null>>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [tictactoeWinner, setTictactoeWinner] = useState<string | null>(null);

  // Spinner State
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [score, setScore] = useState<number>(100);

  // Reflex State
  const [reflexState, setReflexState] = useState<'idle' | 'wait' | 'ready' | 'result'>('idle');
  const [startTime, setStartTime] = useState<number>(0);
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [reflexTimer, setReflexTimer] = useState<any>(null);

  // Trivia State
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [triviaScore, setTriviaScore] = useState<number>(0);
  const [triviaAnswered, setTriviaAnswered] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const triviaQuestions = [
    {
      question: 'What can you do directly on Choy Chat when you feel hungry?',
      options: [
        'Order delicious food in FoodPlay',
        'Turn off your phone',
        'Delete your account',
        'Close the app forever'
      ],
      correct: 0,
    },
    {
      question: 'How do you keep in touch with loved ones on Choy Chat?',
      options: [
        'By sending carrier pigeons',
        'Using instant messaging and HD video calls',
        'Writing letters by hand',
        'Listening to radio static'
      ],
      correct: 1,
    },
    {
      question: 'Where are private KYC documents stored in Choy Chat?',
      options: [
        'Public bulletin boards',
        'A secure private Supabase bucket restricted to Admins only',
        'Social media feeds',
        'Shared chat rooms'
      ],
      correct: 1,
    },
  ];

  // Tic Tac Toe Logic
  const checkWinner = (squares: Array<string | null>) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return squares.every(Boolean) ? 'Draw' : null;
  };

  const handleTicTacToeClick = (index: number) => {
    if (board[index] || tictactoeWinner) return;
    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    const win = checkWinner(newBoard);
    if (win) {
      setTictactoeWinner(win);
    } else {
      setIsXNext(!isXNext);
    }
  };

  const resetTicTacToe = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setTictactoeWinner(null);
  };

  // Spinner Logic
  const spinWheel = () => {
    if (spinning || score < 10) return;
    setSpinning(true);
    setScore(score - 10);
    setSpinResult(null);
    setTimeout(() => {
      const rewards = ['🎉 50 Choy Coins!', '🍔 Free FoodPlay Voucher!', '⭐ Lucky Star Badge!', '🪙 20 Choy Coins!', '🔥 Bonus XP!'];
      const picked = rewards[Math.floor(Math.random() * rewards.length)];
      setSpinResult(picked);
      if (picked.includes('Coins')) setScore((s) => s + 50);
      setSpinning(false);
    }, 1500);
  };

  // Reflex Logic
  const startReflexTest = () => {
    setReflexState('wait');
    setReactionTime(null);
    const timeout = setTimeout(() => {
      setReflexState('ready');
      setStartTime(Date.now());
    }, Math.floor(Math.random() * 2000) + 1500);
    setReflexTimer(timeout);
  };

  const handleReflexClick = () => {
    if (reflexState === 'wait') {
      clearTimeout(reflexTimer);
      setReflexState('idle');
      alert('Too soon! Wait for the green signal.');
    } else if (reflexState === 'ready') {
      const elapsed = Date.now() - startTime;
      setReactionTime(elapsed);
      setReflexState('result');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 text-white flex items-center justify-center shadow-md">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-extrabold ${theme.textMain}`}>Choy Arcade & Games</h1>
            <p className={`text-sm ${theme.textMuted}`}>Play casual mini-games, test your reflexes, and win rewards!</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-amber-600 dark:text-amber-400 font-bold text-sm">
          <Coins className="w-4 h-4" />
          <span>{score} Choy Coins</span>
        </div>
      </div>

      {/* Game Selection Menu */}
      {activeGame === 'menu' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { id: 'tictactoe', title: 'Choy Tic-Tac-Toe', desc: 'Classic X and O strategy game against a friend.', icon: Trophy, color: 'from-blue-600 to-indigo-600' },
            { id: 'spinner', title: 'Lucky Prize Spinner', desc: 'Spin the wheel for Choy Coins & FoodPlay vouchers!', icon: Sparkles, color: 'from-purple-600 to-pink-600' },
            { id: 'reflex', title: 'Lightning Reflex Test', desc: 'Test how fast your fingers react when the light turns green.', icon: Zap, color: 'from-amber-500 to-orange-600' },
            { id: 'trivia', title: 'Choy Chat Knowledge Quiz', desc: 'Answer questions about messaging, video calls, & food.', icon: Award, color: 'from-emerald-600 to-teal-600' },
          ].map((game) => {
            const Icon = game.icon;
            return (
              <button
                key={game.id}
                type="button"
                onClick={() => setActiveGame(game.id as any)}
                className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} hover:border-emerald-500/50 shadow-sm text-left flex items-start gap-4 transition group`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${game.color} text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.textMain} group-hover:text-emerald-500 transition`}>{game.title}</h3>
                  <p className={`text-sm ${theme.textMuted} mt-1`}>{game.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 1. Tic Tac Toe */}
      {activeGame === 'tictactoe' && (
        <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg text-center space-y-6 max-w-md mx-auto`}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveGame('menu')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back to Arcade
            </button>
            <h2 className={`text-lg font-extrabold ${theme.textMain}`}>Tic-Tac-Toe</h2>
            <button
              type="button"
              onClick={resetTicTacToe}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>

          <div className="text-sm font-semibold">
            {tictactoeWinner ? (
              <span className={tictactoeWinner === 'Draw' ? 'text-amber-500' : 'text-emerald-500 font-bold text-base'}>
                {tictactoeWinner === 'Draw' ? '🤝 Game ended in a Draw!' : `🏆 Winner: Player ${tictactoeWinner}!`}
              </span>
            ) : (
              <span className={theme.textMuted}>Current Turn: <strong className="text-emerald-500">Player {isXNext ? 'X' : 'O'}</strong></span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 w-72 h-72 mx-auto">
            {board.map((cell, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTicTacToeClick(idx)}
                className={`w-full h-full rounded-xl border-2 text-3xl font-extrabold flex items-center justify-center transition ${
                  cell === 'X' ? 'text-blue-500 border-blue-500/30 bg-blue-500/10' : cell === 'O' ? 'text-pink-500 border-pink-500/30 bg-pink-500/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {cell}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. Lucky Prize Spinner */}
      {activeGame === 'spinner' && (
        <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg text-center space-y-6 max-w-md mx-auto`}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveGame('menu')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back to Arcade
            </button>
            <h2 className={`text-lg font-extrabold ${theme.textMain}`}>Lucky Prize Spinner</h2>
            <div />
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-tr from-purple-600/20 to-pink-600/20 border border-purple-500/30 flex flex-col items-center justify-center space-y-4">
            <div className={`w-24 h-24 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 text-white flex items-center justify-center shadow-lg ${spinning ? 'animate-spin' : ''}`}>
              <Sparkles className="w-10 h-10" />
            </div>
            {spinResult ? (
              <div className="text-xl font-extrabold text-emerald-500 animate-bounce">{spinResult}</div>
            ) : (
              <p className={`text-sm ${theme.textMuted}`}>Cost: 10 Choy Coins per spin</p>
            )}
            <button
              type="button"
              onClick={spinWheel}
              disabled={spinning || score < 10}
              className="px-6 py-3 rounded-xl bg-[#FF5A1F] text-white font-bold shadow-md hover:bg-[#e04d16] disabled:opacity-50 transition"
            >
              {spinning ? 'Spinning Wheel...' : 'Spin Now (Cost: 10 Coins)'}
            </button>
          </div>
        </div>
      )}

      {/* 3. Reflex Test */}
      {activeGame === 'reflex' && (
        <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg text-center space-y-6 max-w-md mx-auto`}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveGame('menu')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back to Arcade
            </button>
            <h2 className={`text-lg font-extrabold ${theme.textMain}`}>Lightning Reflex</h2>
            <div />
          </div>

          <div
            onClick={reflexState === 'idle' || reflexState === 'result' ? startReflexTest : handleReflexClick}
            className={`h-56 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition select-none p-6 ${
              reflexState === 'idle'
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : reflexState === 'wait'
                ? 'bg-amber-500 text-white animate-pulse'
                : reflexState === 'ready'
                ? 'bg-emerald-500 text-white animate-ping'
                : 'bg-purple-600 text-white'
            }`}
          >
            {reflexState === 'idle' && (
              <>
                <Zap className="w-12 h-12 mb-2" />
                <span className="text-xl font-bold">Tap Here to Start Test</span>
              </>
            )}
            {reflexState === 'wait' && <span className="text-xl font-bold">Wait for green...</span>}
            {reflexState === 'ready' && <span className="text-3xl font-extrabold">TAP NOW!</span>}
            {reflexState === 'result' && (
              <>
                <Trophy className="w-10 h-10 mb-2 text-yellow-300" />
                <span className="text-2xl font-extrabold">{reactionTime} ms</span>
                <p className="text-xs mt-1 text-white/80">Tap again to try for a faster score!</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 4. Trivia Quiz */}
      {activeGame === 'trivia' && (
        <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6 max-w-md mx-auto`}>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveGame('menu')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              ← Back to Arcade
            </button>
            <h2 className={`text-lg font-extrabold ${theme.textMain}`}>Choy Trivia Quiz</h2>
            <span className="text-xs font-bold text-emerald-500">Score: {triviaScore}</span>
          </div>

          {currentQuestion < triviaQuestions.length ? (
            <div className="space-y-4">
              <p className={`text-sm font-semibold ${theme.textMain}`}>
                Question {currentQuestion + 1} of {triviaQuestions.length}
              </p>
              <h3 className={`text-base font-bold ${theme.textMain}`}>
                {triviaQuestions[currentQuestion].question}
              </h3>
              <div className="space-y-2">
                {triviaQuestions[currentQuestion].options.map((opt, idx) => {
                  const isCorrect = idx === triviaQuestions[currentQuestion].correct;
                  const isSelected = selectedOption === idx;
                  let btnColor = 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800';
                  if (triviaAnswered) {
                    if (isCorrect) btnColor = 'bg-emerald-500 text-white border-emerald-500';
                    else if (isSelected && !isCorrect) btnColor = 'bg-red-500 text-white border-red-500';
                  }
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={triviaAnswered}
                      onClick={() => {
                        setSelectedOption(idx);
                        setTriviaAnswered(true);
                        if (idx === triviaQuestions[currentQuestion].correct) {
                          setTriviaScore((s) => s + 10);
                          setScore((s) => s + 20);
                        }
                      }}
                      className={`w-full p-3 rounded-xl border text-sm font-semibold text-left transition ${btnColor}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {triviaAnswered && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentQuestion((q) => q + 1);
                    setTriviaAnswered(false);
                    setSelectedOption(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition"
                >
                  Next Question →
                </button>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4 py-6">
              <Trophy className="w-12 h-12 text-yellow-500 mx-auto" />
              <h3 className={`text-xl font-extrabold ${theme.textMain}`}>Quiz Completed!</h3>
              <p className={`text-sm ${theme.textMuted}`}>You scored {triviaScore} points and earned 20 Choy Coins!</p>
              <button
                type="button"
                onClick={() => {
                  setCurrentQuestion(0);
                  setTriviaScore(0);
                  setTriviaAnswered(false);
                  setSelectedOption(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-[#FF5A1F] text-white font-bold hover:bg-[#e04d16] transition"
              >
                Play Again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
