import React, { useState } from 'react';
import { Sparkles, Trophy, Ticket, Coins, RefreshCw, CheckCircle2, History, Flame } from 'lucide-react';

interface SwertresLivePanelProps {
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

interface SwertresTicket {
  id: string;
  drawTime: string;
  digits: string;
  betAmount: number;
  potentialWin: number;
  status: 'Pending' | 'Won' | 'Lost';
  createdAt: string;
}

export const SwertresLivePanel: React.FC<SwertresLivePanelProps> = ({ currentUser, theme }) => {
  const [selectedDraw, setSelectedDraw] = useState<'2:00 PM' | '5:00 PM' | '9:00 PM'>('5:00 PM');
  const [digit1, setDigit1] = useState<string>('7');
  const [digit2, setDigit2] = useState<string>('4');
  const [digit3, setDigit3] = useState<string>('2');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [userCoins, setUserCoins] = useState<number>(1000);
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
  const [notice, setNotice] = useState<string | null>(null);

  const randomPick = () => {
    setDigit1(String(Math.floor(Math.random() * 10)));
    setDigit2(String(Math.floor(Math.random() * 10)));
    setDigit3(String(Math.floor(Math.random() * 10)));
  };

  const handlePlaceBet = (e: React.FormEvent) => {
    e.preventDefault();
    if (betAmount <= 0) {
      alert('Please enter a valid bet amount.');
      return;
    }
    if (userCoins < betAmount) {
      alert('Insufficient Choy Coins balance! Top up your wallet first.');
      return;
    }

    setUserCoins((c) => c - betAmount);
    const combination = `${digit1}-${digit2}-${digit3}`;
    const potentialWin = betAmount * 400;

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
    setNotice(`Successfully placed bet ${combination} for ${selectedDraw} draw! Potential win: ₱${potentialWin.toLocaleString()}`);
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Banner */}
      <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-emerald-600/10 via-teal-500/10 to-transparent`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center shadow-md">
            <Ticket className="w-6 h-6" />
          </div>
          <div>
            <h1 className={`text-2xl font-extrabold ${theme.textMain}`}>Swertres Live (1₱ = 400₱ Win)</h1>
            <p className={`text-sm ${theme.textMuted}`}>Pick your 3 lucky digits, place your bet, and win 400x your amount on live draws!</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl text-amber-600 dark:text-amber-400 font-bold text-sm">
          <Coins className="w-4 h-4" />
          <span>{userCoins} Choy Coins</span>
        </div>
      </div>

      {notice && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Main Betting Box */}
      <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-6`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className={`text-lg font-extrabold ${theme.textMain} flex items-center gap-2`}>
              <Flame className="w-5 h-5 text-emerald-500" />
              Place Your 3-Digit Swertres Bet
            </h2>
            <p className={`text-xs ${theme.textMuted}`}>Guaranteed payout: 1 Peso bet wins 400 Pesos!</p>
          </div>

          {/* Draw Time Selector */}
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

        <form onSubmit={handlePlaceBet} className="space-y-6">
          {/* Digit Inputs & Random Generator */}
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
                    maxLength={1}
                    value={item.val}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      item.set(v);
                    }}
                    className="w-16 h-20 text-center text-3xl font-extrabold rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 text-emerald-950 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className={`text-[10px] font-bold uppercase mt-1 ${theme.textMuted}`}>Digit {idx + 1}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={randomPick}
              className="px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-2 hover:bg-emerald-500/20 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Lucky Pick (Random)
            </button>
          </div>

          {/* Bet Amount Selection */}
          <div className="space-y-2 max-w-md mx-auto">
            <label className={`block text-xs font-bold uppercase ${theme.textMuted}`}>Bet Amount (Pesos / Coins)</label>
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
          </div>

          {/* Summary & Submit */}
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

      {/* Ticket History */}
      <div className={`p-6 rounded-2xl border ${theme.cardBg} ${theme.cardBorder} shadow-lg space-y-4`}>
        <h3 className={`text-base font-extrabold ${theme.textMain} flex items-center gap-2`}>
          <History className="w-4 h-4 text-emerald-500" />
          My Swertres Tickets & Results
        </h3>
        <div className="space-y-3">
          {tickets.map((t) => (
            <div key={t.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-extrabold text-sm">
                  {t.digits}
                </div>
                <div>
                  <div className={`font-bold text-sm ${theme.textMain}`}>Draw: {t.drawTime}</div>
                  <div className={theme.textMuted}>Bet: ₱{t.betAmount} • Created: {t.createdAt}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={theme.textMuted}>Potential Win</div>
                  <div className="font-extrabold text-emerald-500">₱{t.potentialWin.toLocaleString()}</div>
                </div>
                <span className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                  t.status === 'Won' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : t.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                }`}>
                  {t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
