import React, { useEffect, useState } from 'react';
import { Gamepad2, Trophy, RotateCcw, Sparkles, Star, Award, Zap, Heart, Coins, Ticket, Flame, RefreshCw, CheckCircle2, History, Activity, BarChart3, ShieldAlert, TrendingUp, Clock, Megaphone, Delete, Layers } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TongitsGamePanel } from './TongitsGamePanel';
import type { UserDashboardData } from './UserDashboardPanels';

interface GamesPanelProps {
  currentUser: {
    id: string;
    name: string;
    role?: 'admin' | 'member';
  };
  theme: {
    cardBg: string;
    cardBorder: string;
    textMain: string;
    textMuted: string;
  };
  featureToggles?: {
    games?: boolean;
    swertresLive?: boolean;
    nbaHub?: boolean;
  };
  authToken?: string | null;
  onOwnDashboardUpdated?: (next: UserDashboardData) => void;
  onNavigatePaymentTerminal?: () => void;
  onPostSwertresBanner?: (bannerText: string) => Promise<void> | void;
}

interface SwertresTicket {
  id: string;
  drawTime: string;
  digits: string;
  betAmount: number;
  potentialWin: number;
  status: 'Pending' | 'Won' | 'Lost';
  createdAt: string;
}

interface NbaGame {
  id: string;
  homeTeam: string;
  homeScore: number;
  homeLogo: string;
  awayTeam: string;
  awayScore: number;
  awayLogo: string;
  status: 'Betting Open' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Halftime' | 'Final';
  clock: string;
  secondsRemaining: number;
  tipOffCountdownSec?: number;
}

interface NbaTeam {
  id: string;
  name: string;
  city: string;
  abbrev: string;
  color: string;
  fansSupported: number;
  totalTopupCoins: number;
}

interface TeamTopupTransaction {
  id: string;
  teamName: string;
  amount: number;
  date: string;
  user: string;
}

const INITIAL_GAMES: NbaGame[] = [
  {
    id: 'game-upcoming-1',
    homeTeam: 'Los Angeles Lakers',
    homeScore: 0,
    homeLogo: '💛💜',
    awayTeam: 'Golden State Warriors',
    awayScore: 0,
    awayLogo: '💙💛',
    status: 'Betting Open',
    clock: 'Starts in 01:48:20',
    secondsRemaining: 720,
    tipOffCountdownSec: 6500, // within 2 hours before play
  },
  {
    id: 'game-1',
    homeTeam: 'Boston Celtics',
    homeScore: 112,
    homeLogo: '☘️',
    awayTeam: 'Miami Heat',
    awayScore: 108,
    awayLogo: '🔥',
    status: 'Q4',
    clock: '02:14',
    secondsRemaining: 134,
  },
  {
    id: 'game-2',
    homeTeam: 'Chicago Bulls',
    homeScore: 98,
    homeLogo: '🐂',
    awayTeam: 'Milwaukee Bucks',
    awayScore: 95,
    awayLogo: '🦌',
    status: 'Q3',
    clock: '04:50',
    secondsRemaining: 290,
  },
  {
    id: 'game-4',
    homeTeam: 'Denver Nuggets',
    homeScore: 120,
    homeLogo: '🏔️',
    awayTeam: 'Phoenix Suns',
    awayScore: 115,
    awayLogo: '☀️',
    status: 'Final',
    clock: 'FINAL',
    secondsRemaining: 0,
  },
];

const INITIAL_TEAMS: NbaTeam[] = [
  { id: 'lal', city: 'Los Angeles', name: 'Lakers', abbrev: 'LAL', color: '#9333ea', fansSupported: 1420, totalTopupCoins: 28400 },
  { id: 'gsw', city: 'Golden State', name: 'Warriors', abbrev: 'GSW', color: '#f59e0b', fansSupported: 1350, totalTopupCoins: 27000 },
  { id: 'bos', city: 'Boston', name: 'Celtics', abbrev: 'BOS', color: '#059669', fansSupported: 980, totalTopupCoins: 19600 },
  { id: 'mia', city: 'Miami', name: 'Heat', abbrev: 'MIA', color: '#dc2626', fansSupported: 860, totalTopupCoins: 17200 },
  { id: 'mil', city: 'Milwaukee', name: 'Bucks', abbrev: 'MIL', color: '#15803d', fansSupported: 640, totalTopupCoins: 12800 },
  { id: 'den', city: 'Denver', name: 'Nuggets', abbrev: 'DEN', color: '#2563eb', fansSupported: 590, totalTopupCoins: 11800 },
];

const TEAM_HISTORY_DATA: Record<string, Array<{ game: string; winProbability: number; scoreMargin: number }>> = {
  lal: [
    { game: 'G1', winProbability: 52, scoreMargin: -2 },
    { game: 'G2', winProbability: 65, scoreMargin: +5 },
    { game: 'G3', winProbability: 48, scoreMargin: -4 },
    { game: 'G4', winProbability: 72, scoreMargin: +8 },
    { game: 'G5', winProbability: 58, scoreMargin: +2 },
    { game: 'G6', winProbability: 80, scoreMargin: +12 },
    { game: 'G7', winProbability: 45, scoreMargin: -6 },
    { game: 'G8', winProbability: 68, scoreMargin: +6 },
    { game: 'G9', winProbability: 75, scoreMargin: +10 },
    { game: 'G10', winProbability: 82, scoreMargin: +14 },
  ],
  gsw: [
    { game: 'G1', winProbability: 60, scoreMargin: +4 },
    { game: 'G2', winProbability: 55, scoreMargin: +1 },
    { game: 'G3', winProbability: 78, scoreMargin: +10 },
    { game: 'G4', winProbability: 42, scoreMargin: -8 },
    { game: 'G5', winProbability: 70, scoreMargin: +7 },
    { game: 'G6', winProbability: 62, scoreMargin: +3 },
    { game: 'G7', winProbability: 85, scoreMargin: +15 },
    { game: 'G8', winProbability: 50, scoreMargin: 0 },
    { game: 'G9', winProbability: 72, scoreMargin: +9 },
    { game: 'G10', winProbability: 78, scoreMargin: +11 },
  ],
  bos: [
    { game: 'G1', winProbability: 70, scoreMargin: +8 },
    { game: 'G2', winProbability: 75, scoreMargin: +10 },
    { game: 'G3', winProbability: 60, scoreMargin: +3 },
    { game: 'G4', winProbability: 82, scoreMargin: +14 },
    { game: 'G5', winProbability: 68, scoreMargin: +6 },
    { game: 'G6', winProbability: 79, scoreMargin: +11 },
    { game: 'G7', winProbability: 88, scoreMargin: +18 },
    { game: 'G8', winProbability: 65, scoreMargin: +5 },
    { game: 'G9', winProbability: 80, scoreMargin: +12 },
    { game: 'G10', winProbability: 84, scoreMargin: +16 },
  ],
  mia: [
    { game: 'G1', winProbability: 50, scoreMargin: 0 },
    { game: 'G2', winProbability: 58, scoreMargin: +3 },
    { game: 'G3', winProbability: 45, scoreMargin: -5 },
    { game: 'G4', winProbability: 62, scoreMargin: +4 },
    { game: 'G5', winProbability: 55, scoreMargin: +1 },
    { game: 'G6', winProbability: 70, scoreMargin: +7 },
    { game: 'G7', winProbability: 48, scoreMargin: -3 },
    { game: 'G8', winProbability: 60, scoreMargin: +2 },
    { game: 'G9', winProbability: 68, scoreMargin: +6 },
    { game: 'G10', winProbability: 72, scoreMargin: +8 },
  ],
  mil: [
    { game: 'G1', winProbability: 65, scoreMargin: +6 },
    { game: 'G2', winProbability: 70, scoreMargin: +8 },
    { game: 'G3', winProbability: 52, scoreMargin: -1 },
    { game: 'G4', winProbability: 75, scoreMargin: +10 },
    { game: 'G5', winProbability: 80, scoreMargin: +13 },
    { game: 'G6', winProbability: 58, scoreMargin: +2 },
    { game: 'G7', winProbability: 72, scoreMargin: +9 },
    { game: 'G8', winProbability: 82, scoreMargin: +14 },
    { game: 'G9', winProbability: 60, scoreMargin: +4 },
    { game: 'G10', winProbability: 77, scoreMargin: +11 },
  ],
  den: [
    { game: 'G1', winProbability: 72, scoreMargin: +9 },
    { game: 'G2', winProbability: 78, scoreMargin: +12 },
    { game: 'G3', winProbability: 65, scoreMargin: +5 },
    { game: 'G4', winProbability: 85, scoreMargin: +16 },
    { game: 'G5', winProbability: 70, scoreMargin: +7 },
    { game: 'G6', winProbability: 82, scoreMargin: +13 },
    { game: 'G7', winProbability: 60, scoreMargin: +3 },
    { game: 'G8', winProbability: 88, scoreMargin: +19 },
    { game: 'G9', winProbability: 75, scoreMargin: +10 },
    { game: 'G10', winProbability: 80, scoreMargin: +12 },
  ],
};

export const GamesPanel: React.FC<GamesPanelProps> = ({
  currentUser,
  theme,
  featureToggles,
  authToken,
  onOwnDashboardUpdated,
  onNavigatePaymentTerminal,
  onPostSwertresBanner,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'arcade' | 'swertres' | 'nba' | 'tongits'>('arcade');

  // Tic Tac Toe State
  const [board, setBoard] = useState<Array<string | null>>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [tictactoeWinner, setTictactoeWinner] = useState<string | null>(null);
  const [arcadeGame, setArcadeGame] = useState<'menu' | 'tictactoe' | 'spinner' | 'reflex' | 'trivia'>('menu');

  // Spinner State
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [spinning, setSpinning] = useState<boolean>(false);
  const [score, setScore] = useState<number>(() => {
    const saved = localStorage.getItem(`choy_user_coins_${currentUser.id}`);
    return saved ? Number(saved) : 0;
  });

  React.useEffect(() => {
    localStorage.setItem(`choy_user_coins_${currentUser.id}`, String(score));
  }, [score, currentUser.id]);

  // Real Betting Ledger State
  const [realBets, setRealBets] = useState<Array<{
    id: string;
    userId: string;
    userName: string;
    gameType: 'swertres' | 'nba';
    gameId: string;
    gameTitle: string;
    matchup?: string;
    selection: string;
    stake: number;
    adminTong?: number;
    odds: number;
    potentialWin: number;
    status: 'Pending' | 'Won' | 'Lost';
    createdAt: string;
  }>>(() => {
    const saved = localStorage.getItem('choy_real_bets');
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  React.useEffect(() => {
    localStorage.setItem('choy_real_bets', JSON.stringify(realBets));
  }, [realBets]);

  const recordAdminTong = (amount: number, source: string, stake?: number) => {
    try {
      const existing = JSON.parse(localStorage.getItem('choy_admin_tong_ledger') || '[]');
      const next = [
        {
          id: `tong-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          source,
          amount: Math.round(amount * 100) / 100,
          stake,
          detail: `${source} (${currentUser.name})`,
          createdAt: new Date().toISOString(),
        },
        ...(Array.isArray(existing) ? existing : []),
      ].slice(0, 300);
      localStorage.setItem('choy_admin_tong_ledger', JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

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

  // Swertres State
  const [selectedDraw, setSelectedDraw] = useState<'2:00 PM' | '5:00 PM' | '9:00 PM'>('5:00 PM');
  const [digit1, setDigit1] = useState<string>('7');
  const [digit2, setDigit2] = useState<string>('4');
  const [digit3, setDigit3] = useState<string>('2');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [tickets, setTickets] = useState<SwertresTicket[]>([
    {
      id: 'swt-101',
      drawTime: '2:00 PM',
      digits: '3-8-9',
      betAmount: 5,
      potentialWin: 2000,
      status: 'Lost',
      createdAt: 'Today, 1:30 PM',
    },
    {
      id: 'swt-102',
      drawTime: '5:00 PM',
      digits: '7-4-2',
      betAmount: 10,
      potentialWin: 4000,
      status: 'Pending',
      createdAt: 'Today, 2:10 PM',
    },
  ]);

  // NBA State
  const [games, setGames] = useState<NbaGame[]>(INITIAL_GAMES);
  const [teams, setTeams] = useState<NbaTeam[]>(INITIAL_TEAMS);
  const [selectedTeam, setSelectedTeam] = useState<NbaTeam>(INITIAL_TEAMS[0]);
  const [topupAmount, setTopupAmount] = useState<number>(100);
  const [transactions, setTransactions] = useState<TeamTopupTransaction[]>([
    {
      id: 'tx-1',
      teamName: 'Los Angeles Lakers',
      amount: 250,
      date: 'Today, 2:15 PM',
      user: currentUser.name || 'Choy User',
    },
  ]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showNbaKeypad, setShowNbaKeypad] = useState<boolean>(false);
  const [showSwertresKeypad, setShowSwertresKeypad] = useState<boolean>(false);
  const [swertresCountdownText, setSwertresCountdownText] = useState<string>('00:45:00');
  const [swertresNextDrawLabel, setSwertresNextDrawLabel] = useState<string>('5:00 PM');
  const [swertresLatestOfficialResult, setSwertresLatestOfficialResult] = useState<{
    drawTime: string;
    digits: string;
    publishedAt: string;
  }>(() => {
    try {
      const saved = localStorage.getItem('choy_swertres_latest_official');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      drawTime: '2:00 PM',
      digits: '4-8-2',
      publishedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  });
  const [publishingSwertres, setPublishingSwertres] = useState<boolean>(false);

  // Live 1-second ticker for NBA pre-game (2h before tip-off) + live game clocks + Swertres next-draw countdown
  useEffect(() => {
    const formatHms = (totalSec: number) => {
      const s = Math.max(0, totalSec);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const rem = s % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    };
    const tick = () => {
      const now = new Date();
      const draws = [
        { hour: 14, label: '2:00 PM' },
        { hour: 17, label: '5:00 PM' },
        { hour: 21, label: '9:00 PM' },
      ];
      let target = new Date(now);
      let label = '2:00 PM';
      let found = false;
      for (const d of draws) {
        const cand = new Date(now);
        cand.setHours(d.hour, 0, 0, 0);
        if (cand.getTime() > now.getTime()) {
          target = cand;
          label = d.label;
          found = true;
          break;
        }
      }
      if (!found) {
        target = new Date(now);
        target.setDate(target.getDate() + 1);
        target.setHours(14, 0, 0, 0);
        label = '2:00 PM (Tomorrow)';
      }
      const diffSec = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
      setSwertresCountdownText(formatHms(diffSec));
      setSwertresNextDrawLabel(label);

      setGames((prev) =>
        prev.map((g) => {
          if (g.status === 'Final') return g;
          if (g.status === 'Betting Open' && typeof g.tipOffCountdownSec === 'number') {
            const nextTip = Math.max(0, g.tipOffCountdownSec - 1);
            if (nextTip === 0) {
              return {
                ...g,
                status: 'Q1',
                tipOffCountdownSec: 0,
                secondsRemaining: 720,
                clock: '12:00',
              };
            }
            return {
              ...g,
              tipOffCountdownSec: nextTip,
              clock: `Starts in ${formatHms(nextTip)}`,
            };
          }
          const nextSec = Math.max(0, g.secondsRemaining - 1);
          const m = Math.floor(nextSec / 60);
          const s = nextSec % 60;
          return {
            ...g,
            secondsRemaining: nextSec,
            clock: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
          };
        })
      );
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handlePublishOfficialSwertresResult = async () => {
    const drawDigits = `${digit1 || '0'}-${digit2 || '0'}-${digit3 || '0'}`;
    setPublishingSwertres(true);
    const officialObj = {
      drawTime: selectedDraw,
      digits: drawDigits,
      publishedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSwertresLatestOfficialResult(officialObj);
    try {
      localStorage.setItem('choy_swertres_latest_official', JSON.stringify(officialObj));
    } catch {
      // ignore
    }

    let winnersCount = 0;
    let totalPayout = 0;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    const nextBets = await Promise.all(
      realBets.map(async (b) => {
        if (b.gameType === 'swertres' && b.gameId === selectedDraw && b.status === 'Pending') {
          const isWin = b.selection === drawDigits;
          if (isWin) {
            winnersCount += 1;
            totalPayout += b.potentialWin;
            if (b.userId === currentUser.id) {
              setScore((s) => s + b.potentialWin);
            } else {
              const key = `choy_user_coins_${b.userId}`;
              localStorage.setItem(key, String(Number(localStorage.getItem(key) || '0') + b.potentialWin));
            }
            try {
              const res = await fetch('/api/choy/games/credit-win', {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify({
                  targetUserId: b.userId,
                  amountPhp: b.potentialWin,
                  gameName: `Swertres ${selectedDraw}`,
                  reference: `${b.id}-${drawDigits}`,
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (res.ok && data.userDashboard && onOwnDashboardUpdated) {
                onOwnDashboardUpdated(data.userDashboard);
              }
            } catch {
              // ignore
            }
            return { ...b, status: 'Won' as const };
          }
          return { ...b, status: 'Lost' as const };
        }
        return b;
      })
    );
    setRealBets(nextBets);

    const bannerText = `🎯 OFFICIAL SWERTRES LIVE RESULT (${selectedDraw} Draw)\nWinning Digits: ${drawDigits}\nVerified Winners Auto-Credited to Wallet: ${winnersCount} · Total Payout: ₱${totalPayout.toLocaleString()}\n#SwertresLive #ChoyChat`;
    if (onPostSwertresBanner) {
      await onPostSwertresBanner(bannerText);
    }
    setPublishingSwertres(false);
    setNotice(
      `Official Swertres ${selectedDraw} result (${drawDigits}) posted to Newsfeed! ${winnersCount} winner(s) auto-credited ₱${totalPayout.toLocaleString()} to Wallet.`
    );
    setTimeout(() => setNotice(null), 6000);
  };

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
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
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
    if (win) setTictactoeWinner(win);
    else setIsXNext(!isXNext);
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
    setScore((s) => s - 10);
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

  // Swertres Real Bet Logic
  const handlePlaceSwertres = (e: React.FormEvent) => {
    e.preventDefault();
    if (betAmount <= 0) return;
    if (score < betAmount) {
      alert('Insufficient Choy Coins balance!');
      return;
    }
    const combination = `${digit1}-${digit2}-${digit3}`;
    const potentialWin = betAmount * 400;

    const confirmed = window.confirm(`Are you sure you want to place this Swertres bet?\n\nDraw: ${selectedDraw}\nCombination: ${combination}\nBet Stake: ₱${betAmount}\nPotential Win: ₱${potentialWin.toLocaleString()}`);
    if (!confirmed) return;

    setScore((s) => s - betAmount);

    const newTicket: SwertresTicket = {
      id: `swt-${Date.now()}`,
      drawTime: selectedDraw,
      digits: combination,
      betAmount,
      potentialWin,
      status: 'Pending',
      createdAt: 'Just now',
    };
    setTickets((prev) => [newTicket, ...prev]);

    const newRealBet = {
      id: `swt-real-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name || 'User',
      gameType: 'swertres' as const,
      gameId: selectedDraw,
      gameTitle: `Swertres ${selectedDraw} Draw`,
      selection: combination,
      stake: betAmount,
      odds: 400,
      potentialWin,
      status: 'Pending' as const,
      createdAt: 'Just now',
    };
    setRealBets((prev) => [newRealBet, ...prev]);

    setNotice(`Successfully placed real Swertres bet ${combination} for ₱${potentialWin.toLocaleString()} potential win!`);
    setTimeout(() => setNotice(null), 5000);
  };

  // NBA Team Betting & Topup Logic (Every ₱100 bet earns Admin ₱2 Kalas/Tong)
  const handleTeamTopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(topupAmount) || topupAmount <= 0) {
      setNotice('Please type a valid bet amount.');
      return;
    }
    if (score < topupAmount) {
      setNotice('Insufficient Choy Coins balance! Tap Top Up in Payment Terminal to add coins.');
      return;
    }
    const teamFullName = `${selectedTeam.city} ${selectedTeam.name}`;
    const adminKalas = Math.round(((topupAmount * 2) / 100) * 100) / 100;
    const netPoolStake = Math.round((topupAmount - adminKalas) * 100) / 100;
    const confirmed = window.confirm(
      `Are you sure you want to bet ₱${topupAmount.toLocaleString()} Coins on ${teamFullName}?\n\nAdmin Kalas/Tong (₱2 per ₱100): ₱${adminKalas.toFixed(2)}\nNet Match Pool Stake: ₱${netPoolStake.toFixed(2)}`
    );
    if (!confirmed) return;

    setScore((s) => s - topupAmount);
    setTeams((prev) =>
      prev.map((t) =>
        t.id === selectedTeam.id
          ? { ...t, fansSupported: t.fansSupported + 1, totalTopupCoins: t.totalTopupCoins + topupAmount }
          : t
      )
    );
    const newTx: TeamTopupTransaction = {
      id: `tx-${Date.now()}`,
      teamName: teamFullName,
      amount: topupAmount,
      date: 'Just now',
      user: currentUser.name || 'Choy User',
    };
    setTransactions((prev) => [newTx, ...prev]);

    const newRealBet = {
      id: `nba-real-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name || 'User',
      gameType: 'nba' as const,
      gameId: selectedTeam.id,
      gameTitle: `NBA Match Bet: ${teamFullName}`,
      matchup: teamFullName,
      selection: teamFullName,
      stake: topupAmount,
      adminTong: adminKalas,
      odds: 2.0,
      potentialWin: Math.round(netPoolStake * 2 * 100) / 100,
      status: 'Pending' as const,
      createdAt: 'Just now',
    };
    setRealBets((prev) => [newRealBet, ...prev]);
    recordAdminTong(adminKalas, `NBA (${teamFullName})`, topupAmount);

    setNotice(`Placed ₱${topupAmount.toLocaleString()} bet on ${teamFullName} (Admin Kalas: ₱${adminKalas.toFixed(2)})!`);
    setTimeout(() => setNotice(null), 5000);
  };

  const calculateWinProbability = (homeScore: number, awayScore: number, status: string) => {
    if (status === 'Final') {
      if (homeScore > awayScore) return { homeProb: 100, awayProb: 0 };
      if (homeScore < awayScore) return { homeProb: 0, awayProb: 100 };
      return { homeProb: 50, awayProb: 50 };
    }
    const diff = homeScore - awayScore;
    let homeProb = Math.round(50 + diff * 3.5);
    if (homeProb < 8) homeProb = 8;
    if (homeProb > 92) homeProb = 92;
    return { homeProb, awayProb: 100 - homeProb };
  };

  const refreshScores = () => {
    setRefreshing(true);
    setTimeout(() => {
      setGames((prev) =>
        prev.map((g) => {
          if (g.status === 'Final') return g;
          const homeAdd = Math.random() > 0.5 ? 2 : 3;
          const awayAdd = Math.random() > 0.5 ? 2 : 3;
          return { ...g, homeScore: g.homeScore + homeAdd, awayScore: g.awayScore + awayAdd };
        })
      );
      setRefreshing(false);
    }, 800);
  };

  const chartData = TEAM_HISTORY_DATA[selectedTeam.id] || TEAM_HISTORY_DATA['lal'];

  const isSwertresEnabled = featureToggles?.swertresLive !== false;
  const isNbaHubEnabled = featureToggles?.nbaHub !== false;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-transparent`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 text-white flex items-center justify-center shadow-md">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-extrabold ${theme.textMain}`}>Choy Games & Entertainment Hub</h1>
            <p className={`text-sm ${theme.textMuted}`}>Play arcade games, Swertres live (1₱=400₱ win), and NBA Live match scores & team topups!</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-amber-600 dark:text-amber-400 font-bold text-sm">
          <Coins className="w-4 h-4" />
          <span>{score} Choy Coins</span>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('arcade')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeSubTab === 'arcade'
              ? 'bg-purple-600 text-white shadow-sm'
              : `${theme.cardBg} ${theme.textMain} border ${theme.cardBorder} hover:bg-slate-100 dark:hover:bg-slate-800`
          }`}
        >
          <Gamepad2 className="w-4 h-4" />
          Arcade & Minigames
        </button>

        {isSwertresEnabled && (
          <button
            type="button"
            onClick={() => setActiveSubTab('swertres')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
              activeSubTab === 'swertres'
                ? 'bg-emerald-600 text-white shadow-sm'
                : `${theme.cardBg} ${theme.textMain} border ${theme.cardBorder} hover:bg-slate-100 dark:hover:bg-slate-800`
            }`}
          >
            <Ticket className="w-4 h-4" />
            Swertres Live (1₱ = 400₱ Win)
          </button>
        )}

        {isNbaHubEnabled && (
          <button
            type="button"
            onClick={() => setActiveSubTab('nba')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
              activeSubTab === 'nba'
                ? 'bg-orange-600 text-white shadow-sm'
                : `${theme.cardBg} ${theme.textMain} border ${theme.cardBorder} hover:bg-slate-100 dark:hover:bg-slate-800`
            }`}
          >
            <Trophy className="w-4 h-4" />
            NBA Live &amp; Betting Board
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveSubTab('tongits')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition ${
            activeSubTab === 'tongits'
              ? 'bg-amber-500 text-slate-950 shadow-sm'
              : `${theme.cardBg} ${theme.textMain} border ${theme.cardBorder} hover:bg-slate-100 dark:hover:bg-slate-800`
          }`}
        >
          <Layers className="w-4 h-4" />
          Tong-its (Coming Soon)
        </button>
      </div>

      {/* 1. ARCADE TAB */}
      {activeSubTab === 'arcade' && (
        <div className="space-y-6">
          {arcadeGame === 'menu' && (
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
                    onClick={() => setArcadeGame(game.id as any)}
                    className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} hover:border-purple-500/50 shadow-sm text-left flex items-start gap-4 transition group`}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-tr ${game.color} text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={`text-lg font-bold ${theme.textMain} group-hover:text-purple-500 transition`}>{game.title}</h3>
                      <p className={`text-sm ${theme.textMuted} mt-1`}>{game.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {arcadeGame === 'tictactoe' && (
            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg text-center space-y-6 max-w-md mx-auto`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setArcadeGame('menu')}
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
                  <span className={theme.textMuted}>Current Turn: <strong className="text-purple-500">Player {isXNext ? 'X' : 'O'}</strong></span>
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

          {arcadeGame === 'spinner' && (
            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg text-center space-y-6 max-w-md mx-auto`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setArcadeGame('menu')}
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
                  className="px-6 py-3 rounded-xl bg-purple-600 text-white font-bold shadow-md hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  {spinning ? 'Spinning Wheel...' : 'Spin Now (Cost: 10 Coins)'}
                </button>
              </div>
            </div>
          )}

          {arcadeGame === 'reflex' && (
            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg text-center space-y-6 max-w-md mx-auto`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setArcadeGame('menu')}
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

          {arcadeGame === 'trivia' && (
            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6 max-w-md mx-auto`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setArcadeGame('menu')}
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
                    className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition"
                  >
                    Play Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. SWERTRES TAB */}
      {activeSubTab === 'swertres' && (
        isSwertresEnabled ? (
          <div className="space-y-6">
            {/* Live Swertres Countdown & Official Result Banner Bar */}
            <div className={`p-4 sm:p-5 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-sm bg-gradient-to-r from-emerald-600/10 via-teal-500/10 to-transparent flex flex-col md:flex-row md:items-center justify-between gap-4`}>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Swertres Live Draw Countdown · Next: {swertresNextDrawLabel}
                  </div>
                  <div className={`text-2xl font-mono font-black tabular-nums ${theme.textMain}`}>
                    {swertresCountdownText}
                  </div>
                  <div className={`text-[11px] ${theme.textMuted}`}>
                    Official Result auto-posts to Newsfeed banner &amp; auto-credits winners&apos; Cash Wallet!
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-center">
                  <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-300">
                    Legit Official Result ({swertresLatestOfficialResult.drawTime})
                  </div>
                  <div className="text-xl font-mono font-black tracking-[0.25em] text-emerald-600 dark:text-emerald-300">
                    {swertresLatestOfficialResult.digits}
                  </div>
                </div>
                {currentUser.role === 'admin' && (
                  <button
                    type="button"
                    disabled={publishingSwertres}
                    onClick={() => void handlePublishOfficialSwertresResult()}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 shadow transition disabled:opacity-50"
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>{publishingSwertres ? 'Posting...' : 'Publish Result & Credit Winners'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6`}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className={`text-lg font-extrabold ${theme.textMain} flex items-center gap-2`}>
                    <Flame className="w-5 h-5 text-emerald-500" />
                    Place Your 3-Digit Swertres Bet (1₱ = 400₱ Win)
                  </h2>
                  <p className={`text-xs ${theme.textMuted}`}>Guaranteed payout: 1 Peso bet wins 400 Pesos! Auto-credited to your Wallet.</p>
                </div>

                <div className="flex items-center gap-2">
                  {(['2:00 PM', '5:00 PM', '9:00 PM'] as const).map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setSelectedDraw(time)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        selectedDraw === time
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {time} Draw
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handlePlaceSwertres} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div className="flex items-center gap-3">
                    {[
                      { val: digit1, set: setDigit1 },
                      { val: digit2, set: setDigit2 },
                      { val: digit3, set: setDigit3 },
                    ].map((item, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          value={item.val}
                          onChange={(e) => item.set(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-16 h-20 text-center text-3xl font-extrabold rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
                        />
                        <span className={`text-[10px] font-bold uppercase mt-1 ${theme.textMuted}`}>Digit {idx + 1}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDigit1(String(Math.floor(Math.random() * 10)));
                      setDigit2(String(Math.floor(Math.random() * 10)));
                      setDigit3(String(Math.floor(Math.random() * 10)));
                    }}
                    className="px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-2 hover:bg-emerald-500/20 transition"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Lucky Pick
                  </button>
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <div className="flex items-center justify-between">
                    <label className={`block text-xs font-bold uppercase ${theme.textMuted}`}>Type or Tap Bet Amount (Pesos)</label>
                    <button
                      type="button"
                      onClick={() => setShowSwertresKeypad((v) => !v)}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      {showSwertresKeypad ? 'Hide Keypad' : 'Show Number Keypad'}
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={betAmount === 0 ? '' : String(betAmount)}
                    onFocus={() => setShowSwertresKeypad(true)}
                    onChange={(e) => setBetAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                    placeholder="Type bet amount..."
                    className={`w-full px-3.5 py-2.5 rounded-xl border ${theme.cardBorder} ${theme.cardBg} ${theme.textMain} font-mono text-base font-black`}
                  />
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 5, 10, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setBetAmount(amt)}
                        className={`py-2 rounded-xl border text-xs font-bold transition ${
                          betAmount === amt
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : `border-slate-300 dark:border-slate-700 ${theme.textMain} hover:bg-slate-100 dark:hover:bg-slate-800`
                        }`}
                      >
                        ₱{amt}
                      </button>
                    ))}
                  </div>
                  {showSwertresKeypad && (
                    <div className="grid grid-cols-3 gap-1.5 pt-2">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'BACK'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            if (k === 'CLR') setBetAmount(0);
                            else if (k === 'BACK') setBetAmount((prev) => Math.floor(prev / 10));
                            else setBetAmount((prev) => Number(`${prev === 0 ? '' : prev}${k}`));
                          }}
                          className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white font-mono font-bold text-sm transition flex items-center justify-center"
                        >
                          {k === 'BACK' ? <Delete className="w-4 h-4" /> : k}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 max-w-md mx-auto">
                  <div>
                    <div className={`text-xs ${theme.textMuted}`}>Potential Win (400x):</div>
                    <div className="text-xl font-extrabold text-emerald-500">₱{(betAmount * 400).toLocaleString()}</div>
                  </div>
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-md transition"
                  >
                    Place Bet (₱{betAmount})
                  </button>
                </div>
              </form>
            </div>

            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6`}>
              <div className="space-y-3">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <Trophy className="w-5 h-5 text-emerald-500" />
                  Swertres Winning Rate &amp; Payout Rate Table
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Bet Type</th>
                        <th className="py-2.5 px-3">Match Condition</th>
                        <th className="py-2.5 px-3">Winning Rate / Payout Multiplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      <tr>
                        <td className="py-3 px-3 font-bold text-emerald-600">Direct 3-Digit</td>
                        <td className="py-3 px-3">Exact order match (e.g., 7-4-2)</td>
                        <td className="py-3 px-3 font-extrabold text-emerald-500">400x (₱1 win ₱400)</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-3 font-bold text-blue-600">Rambolito (Boxed)</td>
                        <td className="py-3 px-3">Any digit order match (Permutation)</td>
                        <td className="py-3 px-3 font-extrabold text-blue-500">66x to 200x payout rate</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <History className="w-4 h-4 text-emerald-500" />
                  Complete Swertres Betting Amount Table ({realBets.filter(b => b.gameType === 'swertres').length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2 px-3">Player / User</th>
                        <th className="py-2 px-3">Draw Time</th>
                        <th className="py-2 px-3">Combination</th>
                        <th className="py-2 px-3">Bet Stake</th>
                        <th className="py-2 px-3">Potential Win</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {realBets.filter(b => b.gameType === 'swertres').length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">No Swertres bets placed yet.</td>
                        </tr>
                      ) : (
                        realBets.filter(b => b.gameType === 'swertres').map((b) => (
                          <tr key={b.id} className={theme.textMain}>
                            <td className="py-2.5 px-3 font-bold">{b.userName}</td>
                            <td className="py-2.5 px-3">{b.gameTitle}</td>
                            <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-500">{b.selection}</td>
                            <td className="py-2.5 px-3 font-bold">₱{b.stake}</td>
                            <td className="py-2.5 px-3 font-extrabold text-emerald-500">₱{b.potentialWin.toLocaleString()}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                b.status === 'Won' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : b.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                              }`}>
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Swertres Probability Guide & Last Week All Results */}
            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6`}>
              <div className="space-y-3">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <BarChart3 className="w-5 h-5 text-emerald-500" />
                  Swertres Probability Result Guide Table
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Combination Range</th>
                        <th className="py-2.5 px-3">Probability Index</th>
                        <th className="py-2.5 px-3">Hot / Cold Status</th>
                        <th className="py-2.5 px-3">Expected Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      <tr className={theme.textMain}>
                        <td className="py-2.5 px-3 font-mono font-bold">000 - 333</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-500">14.2% (Moderate)</td>
                        <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold">Warm</span></td>
                        <td className="py-2.5 px-3 font-bold">400x</td>
                      </tr>
                      <tr className={theme.textMain}>
                        <td className="py-2.5 px-3 font-mono font-bold">334 - 666</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-500">18.5% (High)</td>
                        <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">Hot 🔥</span></td>
                        <td className="py-2.5 px-3 font-bold">400x</td>
                      </tr>
                      <tr className={theme.textMain}>
                        <td className="py-2.5 px-3 font-mono font-bold">667 - 999</td>
                        <td className="py-2.5 px-3 font-semibold text-emerald-500">12.1% (Balanced)</td>
                        <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 font-bold">Cold ❄️</span></td>
                        <td className="py-2.5 px-3 font-bold">400x</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <History className="w-4 h-4 text-emerald-500" />
                  Last Week All Swertres Draw Results (Past 7 Days)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">2:00 PM Draw</th>
                        <th className="py-2 px-3">5:00 PM Draw</th>
                        <th className="py-2 px-3">9:00 PM Draw</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {[
                        { date: 'Yesterday', d2: '4-8-2', d5: '7-1-9', d9: '3-5-6' },
                        { date: '2 Days Ago', d2: '1-9-0', d5: '8-4-3', d9: '2-7-5' },
                        { date: '3 Days Ago', d2: '6-2-8', d5: '3-0-4', d9: '9-1-7' },
                        { date: '4 Days Ago', d2: '5-7-1', d5: '2-8-6', d9: '4-3-0' },
                        { date: '5 Days Ago', d2: '9-3-5', d5: '6-9-2', d9: '1-8-4' },
                        { date: '6 Days Ago', d2: '2-4-7', d5: '5-1-0', d9: '8-6-9' },
                        { date: '7 Days Ago (Last Week)', d2: '8-5-3', d5: '4-7-1', d9: '6-2-0' },
                      ].map((row, idx) => (
                        <tr key={idx} className={theme.textMain}>
                          <td className="py-2.5 px-3 font-semibold">{row.date}</td>
                          <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{row.d2}</td>
                          <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{row.d5}</td>
                          <td className="py-2.5 px-3 font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{row.d9}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={`p-12 text-center rounded-2xl border ${theme.cardBg} ${theme.cardBorder} space-y-3`}>
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className={`text-lg font-bold ${theme.textMain}`}>Swertres Live is Disabled</h3>
            <p className={`text-sm ${theme.textMuted}`}>This game feature has been disabled by the administrator.</p>
          </div>
        )
      )}

      {/* 3. NBA HUB TAB */}
      {activeSubTab === 'nba' && (
        isNbaHubEnabled ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className={`text-lg font-extrabold ${theme.textMain} flex items-center gap-2`}>
                    <Flame className="w-5 h-5 text-orange-500" />
                    Live NBA Match Scores & Win Probability
                  </h2>
                  <button
                    type="button"
                    onClick={refreshScores}
                    disabled={refreshing}
                    className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {games.map((g) => {
                    const { homeProb, awayProb } = calculateWinProbability(g.homeScore, g.awayScore, g.status);
                    const homeBetTotal = realBets
                      .filter((b) => b.gameType === 'nba' && b.selection.toLowerCase().includes(g.homeTeam.toLowerCase()))
                      .reduce((s, b) => s + b.stake, 0);
                    const awayBetTotal = realBets
                      .filter((b) => b.gameType === 'nba' && b.selection.toLowerCase().includes(g.awayTeam.toLowerCase()))
                      .reduce((s, b) => s + b.stake, 0);
                    return (
                      <div key={g.id} className={`p-4 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-sm space-y-3.5`}>
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold ${
                              g.status === 'Betting Open'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                                : g.status === 'Final'
                                ? 'bg-slate-500/15 text-slate-500'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-300'
                            }`}
                          >
                            {g.status === 'Betting Open' ? '⏱ 2H PRE-GAME BETTING' : g.status} • {g.clock}
                          </span>
                          <span className="text-emerald-500 font-bold">
                            {g.status === 'Betting Open' ? 'Board Open' : g.status === 'Final' ? 'Final' : 'LIVE'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{g.awayLogo}</span>
                              <div>
                                <div className={`text-sm font-bold ${theme.textMain}`}>{g.awayTeam}</div>
                                <div className="text-[10px] font-mono text-sky-500 font-bold">Pool: ₱{awayBetTotal.toLocaleString()}</div>
                              </div>
                            </div>
                            <span className={`text-lg font-extrabold font-mono ${theme.textMain}`}>
                              {g.status === 'Betting Open' ? '—' : g.awayScore}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{g.homeLogo}</span>
                              <div>
                                <div className={`text-sm font-bold ${theme.textMain}`}>{g.homeTeam}</div>
                                <div className="text-[10px] font-mono text-purple-500 font-bold">Pool: ₱{homeBetTotal.toLocaleString()}</div>
                              </div>
                            </div>
                            <span className={`text-lg font-extrabold font-mono ${theme.textMain}`}>
                              {g.status === 'Betting Open' ? '—' : g.homeScore}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-blue-500">Away: {awayProb}%</span>
                            <span className={`flex items-center gap-1 ${theme.textMuted}`}>
                              <Activity className="w-3 h-3 text-orange-500" />
                              Win Probability
                            </span>
                            <span className="text-purple-500">Home: {homeProb}%</span>
                          </div>
                          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                            <div className="bg-blue-500 h-full" style={{ width: `${awayProb}%` }} />
                            <div className="bg-purple-600 h-full" style={{ width: `${homeProb}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-4`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                      <BarChart3 className="w-5 h-5 text-orange-500" />
                      {selectedTeam.city} {selectedTeam.name} — Last 10 Games Trend
                    </h3>
                  </div>

                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                        <XAxis dataKey="game" stroke="#64748b" fontSize={11} tickLine={false} />
                        <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', color: '#f8fafc', fontSize: '12px' }} />
                        <Line type="monotone" dataKey="winProbability" stroke={selectedTeam.color} strokeWidth={3} dot={{ r: 4, fill: selectedTeam.color }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className={`text-lg font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <Star className="w-5 h-5 text-amber-500" />
                  NBA Betting Slip (₱2 Kalas / ₱100)
                </h2>

                <div className={`p-5 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-sm space-y-4`}>
                  <form onSubmit={handleTeamTopup} className="space-y-4">
                    <div>
                      <label className={`block text-xs font-bold uppercase mb-1.5 ${theme.textMuted}`}>Select Your NBA Team</label>
                      <select
                        value={selectedTeam.id}
                        onChange={(e) => {
                          const t = teams.find((item) => item.id === e.target.value);
                          if (t) setSelectedTeam(t);
                        }}
                        className={`w-full p-2.5 rounded-xl border ${theme.cardBorder} ${theme.cardBg} ${theme.textMain} text-sm font-semibold focus:outline-none`}
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.city} {t.name} ({t.abbrev})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className={`block text-xs font-bold uppercase ${theme.textMuted}`}>Type Bet Amount (₱)</label>
                        <button
                          type="button"
                          onClick={() => setShowNbaKeypad((v) => !v)}
                          className="text-[11px] font-bold text-orange-500 hover:underline"
                        >
                          {showNbaKeypad ? 'Hide Keypad' : 'Number Keypad'}
                        </button>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={topupAmount === 0 ? '' : String(topupAmount)}
                        onFocus={() => setShowNbaKeypad(true)}
                        onChange={(e) => setTopupAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                        placeholder="Type bet amount..."
                        className={`w-full px-3.5 py-2.5 rounded-xl border ${theme.cardBorder} ${theme.cardBg} ${theme.textMain} font-mono text-lg font-black`}
                      />

                      {showNbaKeypad && (
                        <div className="grid grid-cols-3 gap-1.5 pt-1">
                          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'BACK'].map((k) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => {
                                if (k === 'CLR') setTopupAmount(0);
                                else if (k === 'BACK') setTopupAmount((prev) => Math.floor(prev / 10));
                                else setTopupAmount((prev) => Number(`${prev === 0 ? '' : prev}${k}`));
                              }}
                              className="h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-orange-600 hover:text-white font-mono font-bold text-sm transition flex items-center justify-center"
                            >
                              {k === 'BACK' ? <Delete className="w-4 h-4" /> : k}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {[50, 100, 250, 500, 1000, 2500].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setTopupAmount(amt)}
                            className={`py-2 rounded-xl border text-xs font-bold transition ${
                              topupAmount === amt ? 'bg-orange-600 text-white border-orange-600' : `${theme.cardBorder} ${theme.textMain} hover:bg-slate-100 dark:hover:bg-slate-800`
                            }`}
                          >
                            ₱{amt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] space-y-1">
                      <div className="flex justify-between font-bold text-amber-700 dark:text-amber-300">
                        <span>Admin Kalas / Tong (₱2 per ₱100):</span>
                        <span className="font-mono">₱{((topupAmount * 2) / 100).toFixed(2)}</span>
                      </div>
                      <div className={`flex justify-between font-semibold ${theme.textMuted}`}>
                        <span>Net Match Pool Stake:</span>
                        <span className="font-mono">₱{(topupAmount - (topupAmount * 2) / 100).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="pt-1">
                      <button
                        type="submit"
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
                      >
                        <Coins className="w-4 h-4" />
                        Place ₱{topupAmount.toLocaleString()} Bet on {selectedTeam.name}
                      </button>
                    </div>
                  </form>
                </div>

                <div className={`p-5 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-sm space-y-3`}>
                  <h3 className={`text-sm font-extrabold ${theme.textMain} flex items-center gap-2`}>
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Team Fan Leaderboard
                  </h3>
                  <div className="space-y-2">
                    {[...teams].sort((a, b) => b.totalTopupCoins - a.totalTopupCoins).map((t, index) => (
                      <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-400">#{index + 1}</span>
                          <span className={`font-bold ${theme.textMain}`}>{t.city} {t.name}</span>
                        </div>
                        <span className="text-amber-500 font-bold">{t.totalTopupCoins} Coins</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* NBA Winning Rate & Odds Table + Complete NBA Betting Ledger */}
            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6`}>
              <div className="space-y-3">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                  NBA Match Winning Rate &amp; Odds Table (Both Teams)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Team Name</th>
                        <th className="py-2.5 px-3">Fans Supported</th>
                        <th className="py-2.5 px-3">Total Pool Coins</th>
                        <th className="py-2.5 px-3">Dynamic Odds / Payout Multiplier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {teams.map((t) => {
                        const totalAll = teams.reduce((acc, curr) => acc + (curr.totalTopupCoins || 100), 0);
                        const oddsMult = ((totalAll / (t.totalTopupCoins || 100)) * 1.5).toFixed(2);
                        return (
                          <tr key={t.id} className={theme.textMain}>
                            <td className="py-3 px-3 font-bold flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                              {t.city} {t.name} ({t.abbrev})
                            </td>
                            <td className="py-3 px-3 font-semibold">{t.fansSupported} fans</td>
                            <td className="py-3 px-3 font-extrabold text-amber-500">{t.totalTopupCoins.toLocaleString()} Coins</td>
                            <td className="py-3 px-3 font-black text-orange-500">{oddsMult}x Payout</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <History className="w-4 h-4 text-orange-500" />
                  Complete NBA Match Betting Amount Table ({realBets.filter(b => b.gameType === 'nba').length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2 px-3">Player / User</th>
                        <th className="py-2 px-3">Match / Team</th>
                        <th className="py-2 px-3">Stake Amount</th>
                        <th className="py-2 px-3">Odds</th>
                        <th className="py-2 px-3">Potential Win</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {realBets.filter(b => b.gameType === 'nba').length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">No NBA match bets placed yet.</td>
                        </tr>
                      ) : (
                        realBets.filter(b => b.gameType === 'nba').map((b) => (
                          <tr key={b.id} className={theme.textMain}>
                            <td className="py-2.5 px-3 font-bold">{b.userName}</td>
                            <td className="py-2.5 px-3 font-semibold">{b.gameTitle}</td>
                            <td className="py-2.5 px-3 font-bold">{b.stake} Coins</td>
                            <td className="py-2.5 px-3 font-bold text-orange-500">{b.odds}x</td>
                            <td className="py-2.5 px-3 font-extrabold text-amber-500">{(b.potentialWin).toLocaleString()} Coins</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                                b.status === 'Won' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : b.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                              }`}>
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* NBA Probability Guide & Last Week All Results */}
            <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6`}>
              <div className="space-y-3">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                  NBA Win Probability &amp; Form Guide Table
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2.5 px-3">Team</th>
                        <th className="py-2.5 px-3">Recent Form (Last 10)</th>
                        <th className="py-2.5 px-3">Avg Win Probability</th>
                        <th className="py-2.5 px-3">Momentum Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {teams.map((t) => (
                        <tr key={t.id} className={theme.textMain}>
                          <td className="py-2.5 px-3 font-bold">{t.city} {t.name}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-orange-500">7W - 3L</td>
                          <td className="py-2.5 px-3 font-extrabold text-emerald-500">72.4%</td>
                          <td className="py-2.5 px-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">Strong Surge 🚀</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                  <History className="w-4 h-4 text-orange-500" />
                  Last Week All NBA Match Results (Past 7 Days)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                        <th className="py-2 px-3">Match Date</th>
                        <th className="py-2 px-3">Home Team &amp; Score</th>
                        <th className="py-2 px-3">Away Team &amp; Score</th>
                        <th className="py-2 px-3">Final Outcome</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {[
                        { date: 'Yesterday', home: 'Lakers (115)', away: 'Warriors (110)', outcome: 'Lakers Won (+5)' },
                        { date: '2 Days Ago', home: 'Celtics (108)', away: 'Heat (99)', outcome: 'Celtics Won (+9)' },
                        { date: '3 Days Ago', home: 'Bucks (122)', away: 'Bulls (118)', outcome: 'Bucks Won (+4)' },
                        { date: '4 Days Ago', home: 'Nuggets (112)', away: 'Suns (105)', outcome: 'Nuggets Won (+7)' },
                        { date: '5 Days Ago', home: 'Warriors (124)', away: 'Celtics (119)', outcome: 'Warriors Won (+5)' },
                        { date: '6 Days Ago', home: 'Heat (98)', away: 'Lakers (104)', outcome: 'Lakers Won (+6)' },
                        { date: '7 Days Ago (Last Week)', home: 'Bulls (110)', away: 'Nuggets (116)', outcome: 'Nuggets Won (+6)' },
                      ].map((row, idx) => (
                        <tr key={idx} className={theme.textMain}>
                          <td className="py-2.5 px-3 font-semibold">{row.date}</td>
                          <td className="py-2.5 px-3 font-bold text-purple-600 dark:text-purple-400">{row.home}</td>
                          <td className="py-2.5 px-3 font-bold text-blue-600 dark:text-blue-400">{row.away}</td>
                          <td className="py-2.5 px-3 font-extrabold text-emerald-500">{row.outcome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={`p-12 text-center rounded-2xl border ${theme.cardBg} ${theme.cardBorder} space-y-3`}>
            <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
            <h3 className={`text-lg font-bold ${theme.textMain}`}>NBA Hub is Disabled</h3>
            <p className={`text-sm ${theme.textMuted}`}>This NBA feature has been disabled by the administrator.</p>
          </div>
        )
      )}

      {/* 4. TONG-ITS TAB (COMING SOON · INTERACTIVE TABLE) */}
      {activeSubTab === 'tongits' && (
        <TongitsGamePanel
          currentUser={currentUser}
          playerCoins={score}
          onCoinsChange={(delta, reason) => {
            setScore((prev) => Math.max(0, Math.round((prev + delta) * 100) / 100));
            setNotice(reason);
            setTimeout(() => setNotice(null), 4000);
          }}
          onRecordAdminTong={(amount, source) => recordAdminTong(amount, `Tong-its: ${source}`)}
          onOpenTopUp={onNavigatePaymentTerminal}
          onExit={() => setActiveSubTab('arcade')}
        />
      )}
    </div>
  );
};
