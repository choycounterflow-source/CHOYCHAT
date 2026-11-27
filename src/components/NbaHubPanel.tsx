import React, { useState } from 'react';
import { Trophy, Flame, Shield, TrendingUp, Coins, Play, RefreshCw, CheckCircle2, Star, Activity, BarChart3, History } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface NbaHubPanelProps {
  currentUser: {
    id: string;
    name: string;
  };
  theme: {
    cardBg: string;
    cardBorder: string;
    textMain: string;
    textMuted: string;
  };
}

interface NbaGame {
  id: string;
  homeTeam: string;
  homeScore: number;
  homeLogo: string;
  awayTeam: string;
  awayScore: number;
  awayLogo: string;
  status: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Halftime' | 'Final';
  clock: string;
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
    id: 'game-1',
    homeTeam: 'Los Angeles Lakers',
    homeScore: 112,
    homeLogo: '💛💜',
    awayTeam: 'Golden State Warriors',
    awayScore: 108,
    awayLogo: '💙💛',
    status: 'Q4',
    clock: '2:14 remaining',
  },
  {
    id: 'game-2',
    homeTeam: 'Boston Celtics',
    homeScore: 98,
    homeLogo: '☘️',
    awayTeam: 'Miami Heat',
    awayScore: 95,
    awayLogo: '🔥',
    status: 'Q3',
    clock: '4:50 remaining',
  },
  {
    id: 'game-3',
    homeTeam: 'Chicago Bulls',
    homeScore: 74,
    homeLogo: '🐂',
    awayTeam: 'Milwaukee Bucks',
    awayScore: 82,
    awayLogo: '🦌',
    status: 'Halftime',
    clock: 'HT',
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

export const NbaHubPanel: React.FC<NbaHubPanelProps> = ({ currentUser, theme }) => {
  const [games, setGames] = useState<NbaGame[]>(INITIAL_GAMES);
  const [teams, setTeams] = useState<NbaTeam[]>(INITIAL_TEAMS);
  const [selectedTeam, setSelectedTeam] = useState<NbaTeam>(INITIAL_TEAMS[0]);
  const [topupAmount, setTopupAmount] = useState<number>(100);
  const [userCoins, setUserCoins] = useState<number>(500);
  const [transactions, setTransactions] = useState<TeamTopupTransaction[]>([
    {
      id: 'tx-1',
      teamName: 'Los Angeles Lakers',
      amount: 250,
      date: 'Today, 2:15 PM',
      user: currentUser.name || 'Choy User',
    },
    {
      id: 'tx-2',
      teamName: 'Golden State Warriors',
      amount: 100,
      date: 'Yesterday, 8:40 PM',
      user: currentUser.name || 'Choy User',
    },
  ]);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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
          return {
            ...g,
            homeScore: g.homeScore + homeAdd,
            awayScore: g.awayScore + awayAdd,
          };
        })
      );
      setRefreshing(false);
    }, 800);
  };

  const handleTeamTopup = (e: React.FormEvent) => {
    e.preventDefault();
    if (userCoins < topupAmount) {
      alert('Insufficient Choy Coins balance! Top up your Choy Wallet first.');
      return;
    }
    setUserCoins((c) => c - topupAmount);
    const teamFullName = `${selectedTeam.city} ${selectedTeam.name}`;
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

    setSuccessNotice(`Successfully supported ${teamFullName} with ${topupAmount} Choy Coins! Transaction recorded.`);
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const chartData = TEAM_HISTORY_DATA[selectedTeam.id] || TEAM_HISTORY_DATA['lal'];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-orange-600/10 via-amber-500/10 to-transparent`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-600 text-white flex items-center justify-center shadow-md">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-extrabold ${theme.textMain}`}>NBA Live Scores & Team Topup Hub</h1>
            <p className={`text-sm ${theme.textMuted}`}>Track live game scores, win probabilities, performance trends, and transaction history!</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-amber-600 dark:text-amber-400 font-bold text-sm">
            <Coins className="w-4 h-4" />
            <span>{userCoins} Choy Coins</span>
          </div>
          <button
            type="button"
            onClick={refreshScores}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-2 shadow transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Scores
          </button>
        </div>
      </div>

      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Main Grid: Live Scores on Left, Team Topup & Recharts on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Live NBA Games (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-extrabold ${theme.textMain} flex items-center gap-2`}>
              <Flame className="w-5 h-5 text-orange-500" />
              Live NBA Match Scores & Win Probability
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse">
              ● LIVE UPDATES
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {games.map((g) => {
              const { homeProb, awayProb } = calculateWinProbability(g.homeScore, g.awayScore, g.status);
              return (
                <div key={g.id} className={`p-4 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-sm space-y-3.5`}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-300">
                      {g.status} • {g.clock}
                    </span>
                    <span className="text-emerald-500 font-bold">NBA Official Feed</span>
                  </div>

                  <div className="space-y-2">
                    {/* Away Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{g.awayLogo}</span>
                        <span className={`text-sm font-bold ${theme.textMain}`}>{g.awayTeam}</span>
                      </div>
                      <span className={`text-lg font-extrabold ${theme.textMain}`}>{g.awayScore}</span>
                    </div>

                    {/* Home Team */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{g.homeLogo}</span>
                        <span className={`text-sm font-bold ${theme.textMain}`}>{g.homeTeam}</span>
                      </div>
                      <span className={`text-lg font-extrabold ${theme.textMain}`}>{g.homeScore}</span>
                    </div>
                  </div>

                  {/* Win Probability Indicator */}
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
                      <div
                        className="bg-blue-500 h-full transition-all duration-500"
                        style={{ width: `${awayProb}%` }}
                        title={`${g.awayTeam} Win Probability: ${awayProb}%`}
                      />
                      <div
                        className="bg-purple-600 h-full transition-all duration-500"
                        style={{ width: `${homeProb}%` }}
                        title={`${g.homeTeam} Win Probability: ${homeProb}%`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recharts Performance Trend for Selected Team */}
          <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
                <BarChart3 className="w-5 h-5 text-orange-500" />
                {selectedTeam.city} {selectedTeam.name} — Last 10 Games Win Probability Trend
              </h3>
              <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                {selectedTeam.abbrev} Performance
              </span>
            </div>

            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis dataKey="game" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="winProbability"
                    name="Win Probability (%)"
                    stroke={selectedTeam.color}
                    strokeWidth={3}
                    dot={{ r: 4, fill: selectedTeam.color }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Team Topup & Fan Support (1 col) */}
        <div className="space-y-4">
          <h2 className={`text-lg font-extrabold ${theme.textMain} flex items-center gap-2`}>
            <Star className="w-5 h-5 text-amber-500" />
            Topup for Team
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

              <div>
                <label className={`block text-xs font-bold uppercase mb-1.5 ${theme.textMuted}`}>Topup Coin Amount</label>
                <div className="grid grid-cols-3 gap-2">
                  {[50, 100, 250, 500, 1000, 2500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopupAmount(amt)}
                      className={`py-2 rounded-xl border text-xs font-bold transition ${
                        topupAmount === amt
                          ? 'bg-orange-600 text-white border-orange-600'
                          : `${theme.cardBorder} ${theme.textMain} hover:bg-slate-100 dark:hover:bg-slate-800`
                      }`}
                    >
                      {amt} Coins
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  Topup {topupAmount} Coins for {selectedTeam.name}
                </button>
              </div>
            </form>
          </div>

          {/* Fan Leaderboard */}
          <div className={`p-5 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-sm space-y-3`}>
            <h3 className={`text-sm font-extrabold ${theme.textMain} flex items-center gap-2`}>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Team Fan Leaderboard
            </h3>
            <div className="space-y-2">
              {teams
                .sort((a, b) => b.totalTopupCoins - a.totalTopupCoins)
                .map((t, index) => (
                  <div key={t.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200 dark:border-slate-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-400">#{index + 1}</span>
                      <span className={`font-bold ${theme.textMain}`}>{t.city} {t.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-amber-500 font-bold">{t.totalTopupCoins} Coins</span>
                      <span className="text-slate-400">({t.fansSupported} fans)</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-4`}>
        <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
          <History className="w-5 h-5 text-orange-500" />
          Team Top-Up & Credit Transaction History
        </h3>
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div key={tx.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-extrabold">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <div className={`font-bold text-sm ${theme.textMain}`}>{tx.teamName} Top-Up</div>
                  <div className={theme.textMuted}>User: {tx.user} • {tx.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={theme.textMuted}>Amount</div>
                  <div className="font-extrabold text-amber-500">+{tx.amount} Coins</div>
                </div>
                <span className="px-3 py-1 rounded-full font-bold text-[11px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Completed
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
