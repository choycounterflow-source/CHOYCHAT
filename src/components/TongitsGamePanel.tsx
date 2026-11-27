import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Coins,
  Crown,
  Flame,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  Shuffle,
  Sparkles,
  Swords,
  Timer,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import tongitsTableFeltUrl from '../assets/images/tongits_table_felt_1795806670456.jpg';

type Suit = '♠' | '♥' | '♦' | '♣' | '🃏';
type GameVariant = 'regular' | 'butasan' | 'regular_joker' | 'butasan_joker';

interface PlayingCard {
  id: string;
  suit: Suit;
  rank: number; // 1=A, 2..10, 11=J, 12=Q, 13=K, 14=Joker
  label: string;
  isJoker?: boolean;
}

interface MeldGroup {
  id: string;
  cards: PlayingCard[];
  type: 'set' | 'quadro' | 'run' | 'royal_flush';
}

interface TableChatMsg {
  id: string;
  sender: string;
  text: string;
  time: string;
}

interface TongitsGamePanelProps {
  currentUser: {
    id: string;
    name: string;
  };
  playerCoins: number;
  onCoinsChange: (delta: number, reason: string) => void;
  onRecordAdminTong?: (amount: number, source: string) => void;
  onOpenTopUp?: () => void;
  onExit?: () => void;
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANK_LABELS: Record<number, string> = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'JKR',
};
const BET_STAKES = [1, 2, 3, 4, 5, 10] as const;
const QUICK_EMOJIS = ['😂', '🔥', '😎', '👏', '♠️', '♥️', '🍀', '💸'];

function getCardPoints(card: PlayingCard): number {
  if (card.isJoker) return 0;
  if (card.rank === 1) return 1;
  if (card.rank >= 10) return 10;
  return card.rank;
}

function getAdminTongFee(bet: number): number {
  if (bet <= 2) return 0.5;
  if (bet <= 5) return 1.0;
  return 2.0;
}

function buildDeck(includeJokers: boolean): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: `${suit}_${rank}_${Math.random().toString(36).slice(2, 6)}`,
        suit,
        rank,
        label: RANK_LABELS[rank],
      });
    }
  }
  if (includeJokers) {
    deck.push(
      { id: `JKR_1_${Math.random().toString(36).slice(2, 6)}`, suit: '🃏', rank: 14, label: 'JKR', isJoker: true },
      { id: `JKR_2_${Math.random().toString(36).slice(2, 6)}`, suit: '🃏', rank: 14, label: 'JKR', isJoker: true }
    );
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function validateMeld(cards: PlayingCard[]): MeldGroup['type'] | null {
  if (cards.length < 3) return null;
  const nonJokers = cards.filter((c) => !c.isJoker);
  const jokerCount = cards.length - nonJokers.length;
  if (nonJokers.length === 0) return null;

  // Check Set / Quadro (same rank, distinct suits)
  const sameRank = nonJokers.every((c) => c.rank === nonJokers[0].rank);
  const distinctSuits = new Set(nonJokers.map((c) => c.suit)).size === nonJokers.length;
  if (sameRank && distinctSuits && cards.length <= 4) {
    return cards.length === 4 ? 'quadro' : 'set';
  }

  // Check Straight Flush / Run (same suit, consecutive ranks using jokers as wildcards)
  const sameSuit = nonJokers.every((c) => c.suit === nonJokers[0].suit);
  if (sameSuit) {
    const sortedRanks = [...nonJokers].map((c) => c.rank).sort((a, b) => a - b);
    const hasDup = sortedRanks.some((r, idx) => idx > 0 && r === sortedRanks[idx - 1]);
    if (!hasDup) {
      let gapsNeeded = 0;
      for (let i = 1; i < sortedRanks.length; i++) {
        gapsNeeded += sortedRanks[i] - sortedRanks[i - 1] - 1;
      }
      if (gapsNeeded <= jokerCount) {
        return cards.length >= 5 ? 'royal_flush' : 'run';
      }
    }
  }
  return null;
}

function playCardTone(kind: 'drop' | 'draw' | 'meld' | 'fight' | 'win', muted: boolean): void {
  if (muted || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const tones: Record<typeof kind, number[]> = {
      drop: [440, 554.37],
      draw: [392],
      meld: [523.25, 659.25, 783.99],
      fight: [330, 440, 587.33],
      win: [523.25, 659.25, 783.99, 1046.5],
    };
    tones[kind].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'drop' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.24);
    });
    setTimeout(() => ctx.close().catch(() => {}), 700);
  } catch {
    // Ignore audio errors
  }
}

export const TongitsGamePanel: React.FC<TongitsGamePanelProps> = ({
  currentUser,
  playerCoins,
  onCoinsChange,
  onRecordAdminTong,
  onOpenTopUp,
  onExit,
}) => {
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'fight_modal' | 'round_over'>('lobby');
  const [tableSeats, setTableSeats] = useState<2 | 3>(3);
  const [variant, setVariant] = useState<GameVariant>('regular');
  const [betAmount, setBetAmount] = useState<number>(1);
  const [tableNumber, setTableNumber] = useState<number>(101);
  const [soundMuted, setSoundMuted] = useState<boolean>(false);

  // Cards & Table State
  const [deck, setDeck] = useState<PlayingCard[]>([]);
  const [discardPile, setDiscardPile] = useState<PlayingCard[]>([]);
  const [p1Hand, setP1Hand] = useState<PlayingCard[]>([]);
  const [p2Hand, setP2Hand] = useState<PlayingCard[]>([]);
  const [p3Hand, setP3Hand] = useState<PlayingCard[]>([]);
  const [p1Melds, setP1Melds] = useState<MeldGroup[]>([]);
  const [p2Melds, setP2Melds] = useState<MeldGroup[]>([]);
  const [p3Melds, setP3Melds] = useState<MeldGroup[]>([]);

  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'rank' | 'suit'>('rank');
  const [autoSort, setAutoSort] = useState<boolean>(true);
  const [turnPlayer, setTurnPlayer] = useState<1 | 2 | 3>(1);
  const [hasDrawnThisTurn, setHasDrawnThisTurn] = useState<boolean>(true); // Dealer starts with 13 cards
  const [turnTimer, setTurnTimer] = useState<number>(45);
  const [fightTimer, setFightTimer] = useState<number>(15);
  const [fightChallenger, setFightChallenger] = useState<string>('');
  const [consecutiveWins, setConsecutiveWins] = useState<number>(0);
  const [hitpotPool, setHitpotPool] = useState<number>(25);
  const [tableMessage, setTableMessage] = useState<string>('Welcome to Tong-its! Select your table and deal.');
  const [roundSummary, setRoundSummary] = useState<{
    winner: string;
    reason: string;
    payoutText: string;
    adminTong: number;
    kingBonus: number;
    hitpotWon: boolean;
  } | null>(null);
  const [outOfCoinsAlert, setOutOfCoinsAlert] = useState<string | null>(null);

  // In-Table Sidebar & Chat Drawer
  const [isTableSidebarOpen, setIsTableSidebarOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [tableChat, setTableChat] = useState<TableChatMsg[]>([
    { id: 'sys_1', sender: 'Dealer', text: 'Good luck players! 45s per turn, 15s Fight decision.', time: 'Now' },
  ]);

  const botTimerRef = useRef<number | null>(null);

  const minEntryCoins = Math.max(100, betAmount * 100);
  const isJokerMode = variant === 'regular_joker' || variant === 'butasan_joker';
  const isButasanMode = variant === 'butasan' || variant === 'butasan_joker';

  const sortCards = (cards: PlayingCard[], mode: 'rank' | 'suit') => {
    const suitOrder: Record<Suit, number> = { '♠': 0, '♥': 1, '♦': 2, '♣': 3, '🃏': 4 };
    return [...cards].sort((a, b) => {
      if (mode === 'suit') {
        if (suitOrder[a.suit] !== suitOrder[b.suit]) return suitOrder[a.suit] - suitOrder[b.suit];
        return a.rank - b.rank;
      }
      if (a.rank !== b.rank) return a.rank - b.rank;
      return suitOrder[a.suit] - suitOrder[b.suit];
    });
  };

  const p1Points = useMemo(() => p1Hand.reduce((sum, c) => sum + getCardPoints(c), 0), [p1Hand]);
  const p2Points = useMemo(() => p2Hand.reduce((sum, c) => sum + getCardPoints(c), 0), [p2Hand]);
  const p3Points = useMemo(() => p3Hand.reduce((sum, c) => sum + getCardPoints(c), 0), [p3Hand]);

  const hasSpecialCardBonus = useMemo(() => {
    return p1Melds.some((m) => m.type === 'royal_flush' || m.type === 'quadro');
  }, [p1Melds]);

  const dealNewRound = (skipMinCheck = false) => {
    setOutOfCoinsAlert(null);
    if (!skipMinCheck && phase === 'lobby' && playerCoins < minEntryCoins) {
      setOutOfCoinsAlert(
        `Minimum coins required to join a ₱${betAmount} table is ${minEntryCoins} coins. Please top up first.`
      );
      return;
    }
    if (playerCoins <= 49) {
      setOutOfCoinsAlert("You're out of coins! Players with 49 coins or below cannot play. Top up coins to continue.");
      return;
    }

    const fresh = buildDeck(isJokerMode);
    const hand1 = fresh.splice(0, 13); // Player 1 starts with 13 cards (5 up, 8 down)
    const hand2 = fresh.splice(0, 12);
    const hand3 = tableSeats === 3 ? fresh.splice(0, 12) : [];

    setDeck(fresh);
    setDiscardPile([]);
    setP1Hand(autoSort ? sortCards(hand1, sortMode) : hand1);
    setP2Hand(hand2);
    setP3Hand(hand3);
    setP1Melds([]);
    setP2Melds([]);
    setP3Melds([]);
    setSelectedCardIds([]);
    setTurnPlayer(1);
    setHasDrawnThisTurn(true);
    setTurnTimer(45);
    setFightTimer(15);
    setRoundSummary(null);
    setPhase('playing');
    setTableMessage('Cards dealt! You start with 13 cards (5 up, 8 down). Group a meld or drop 1 card.');
    playCardTone('draw', soundMuted);
  };

  const countPlayerKings = (hand: PlayingCard[], melds: MeldGroup[]) => {
    const inHand = hand.filter((c) => c.rank === 13).length;
    const inMelds = melds.reduce((acc, m) => acc + m.cards.filter((c) => c.rank === 13).length, 0);
    return inHand + inMelds;
  };

  const finishRound = (winnerSeat: 1 | 2 | 3, reason: string, isFight = false, foldedByP1 = false) => {
    const adminTong = getAdminTongFee(betAmount);
    if (onRecordAdminTong) {
      onRecordAdminTong(adminTong, `Tong-its Table #${tableNumber} (₱${betAmount} bet)`);
    }

    const baseWinMultiplier = 5; // ₱1 bet -> ₱5 winning, ₱2 bet -> ₱10 winning
    const basePot = betAmount * baseWinMultiplier;
    const specialBonus =
      winnerSeat === 1 && p1Melds.some((m) => m.type === 'royal_flush' || m.type === 'quadro') ? basePot : 0;

    const winnerHand = winnerSeat === 1 ? p1Hand : winnerSeat === 2 ? p2Hand : p3Hand;
    const winnerMelds = winnerSeat === 1 ? p1Melds : winnerSeat === 2 ? p2Melds : p3Melds;
    const kingCount = countPlayerKings(winnerHand, winnerMelds);
    const kingBonus = kingCount * 5; // Winner collects ₱5 per King (including dropped melds)

    const loserPoints =
      winnerSeat === 1
        ? p2Points + (tableSeats === 3 ? p3Points : 0)
        : p1Points;
    const butasanCountPay = isButasanMode && isFight ? Math.round(loserPoints * betAmount * 0.5) : 0;

    let hitpotWon = false;
    let totalDelta = 0;

    if (winnerSeat === 1) {
      const nextStreak = consecutiveWins + 1;
      let hitpotGain = 0;
      if (nextStreak >= 2) {
        hitpotWon = true;
        hitpotGain = hitpotPool;
        setConsecutiveWins(0);
        setHitpotPool(betAmount * 25);
      } else {
        setConsecutiveWins(nextStreak);
        setHitpotPool((p) => p + betAmount * 5);
      }
      totalDelta = Math.max(1, basePot + specialBonus + kingBonus + butasanCountPay + hitpotGain - adminTong);
      onCoinsChange(totalDelta, `Tong-its Win (${reason})`);
      playCardTone('win', soundMuted);
    } else {
      setConsecutiveWins(0);
      setHitpotPool((p) => p + betAmount * 5);
      const lossAmount = foldedByP1 ? betAmount * 2 : basePot + (isButasanMode && isFight ? Math.round(p1Points * betAmount * 0.25) : 0);
      totalDelta = -Math.min(playerCoins, lossAmount);
      onCoinsChange(totalDelta, `Tong-its Round Loss (${reason})`);
    }

    const winnerName =
      winnerSeat === 1 ? currentUser.name : winnerSeat === 2 ? 'Player 2 (Lito)' : 'Player 3 (Mika)';

    setRoundSummary({
      winner: winnerName,
      reason,
      payoutText:
        totalDelta >= 0
          ? `+₱${totalDelta.toFixed(2)} credited`
          : `-₱${Math.abs(totalDelta).toFixed(2)} deducted`,
      adminTong,
      kingBonus,
      hitpotWon,
    });
    setPhase('round_over');
  };

  // 45s Turn Countdown Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    const id = window.setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          if (turnPlayer === 1) {
            // Auto-drop highest deadwood card if timer expires
            setP1Hand((curr) => {
              if (curr.length === 0) return curr;
              const sorted = [...curr].sort((a, b) => getCardPoints(b) - getCardPoints(a));
              const dropCard = sorted[0];
              setDiscardPile((dp) => [dropCard, ...dp]);
              playCardTone('drop', soundMuted);
              setTableMessage(`Time expired! Auto-dropped ${dropCard.label}${dropCard.suit}.`);
              setHasDrawnThisTurn(false);
              setTurnPlayer(2);
              return curr.filter((c) => c.id !== dropCard.id);
            });
          }
          return 45;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, turnPlayer, soundMuted]);

  // 15s Fight Decision Countdown Timer (auto-fold if no decision)
  useEffect(() => {
    if (phase !== 'fight_modal') return;
    const id = window.setInterval(() => {
      setFightTimer((prev) => {
        if (prev <= 1) {
          finishRound(2, 'Fight timer expired (Auto-Fold after 15s)', true, true);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Automated Bot Turns for Player 2 & Player 3
  useEffect(() => {
    if (phase !== 'playing' || turnPlayer === 1) return;
    botTimerRef.current = window.setTimeout(() => {
      if (deck.length === 0) {
        const scores = [
          { seat: 1 as const, pts: p1Points },
          { seat: 2 as const, pts: p2Points },
          ...(tableSeats === 3 ? [{ seat: 3 as const, pts: p3Points }] : []),
        ].sort((a, b) => a.pts - b.pts);
        finishRound(scores[0].seat, 'Deck empty — lowest card count wins!');
        return;
      }

      const drawn = deck[0];
      const nextDeck = deck.slice(1);
      setDeck(nextDeck);

      if (turnPlayer === 2) {
        const nextHand = [...p2Hand, drawn];
        // Drop highest point card
        const dropIdx = nextHand.reduce(
          (bestIdx, c, idx, arr) => (getCardPoints(c) > getCardPoints(arr[bestIdx]) ? idx : bestIdx),
          0
        );
        const dropped = nextHand.splice(dropIdx, 1)[0];
        setP2Hand(nextHand);
        setDiscardPile((dp) => [dropped, ...dp]);
        playCardTone('drop', soundMuted);
        setTableMessage(`Player 2 drew & dropped ${dropped.label}${dropped.suit} to center.`);

        if (nextHand.length === 0) {
          finishRound(2, 'Player 2 declared TONG-ITS!');
          return;
        }
        setTurnTimer(45);
        setTurnPlayer(tableSeats === 3 ? 3 : 1);
        if (tableSeats === 2) setHasDrawnThisTurn(false);
      } else if (turnPlayer === 3) {
        const nextHand = [...p3Hand, drawn];
        const dropIdx = nextHand.reduce(
          (bestIdx, c, idx, arr) => (getCardPoints(c) > getCardPoints(arr[bestIdx]) ? idx : bestIdx),
          0
        );
        const dropped = nextHand.splice(dropIdx, 1)[0];
        setP3Hand(nextHand);
        setDiscardPile((dp) => [dropped, ...dp]);
        playCardTone('drop', soundMuted);
        setTableMessage(
          `Player 3 dropped ${dropped.label}${dropped.suit} — Click center card to Eat (Kaon) or click Deck to Draw!`
        );
        if (nextHand.length === 0) {
          finishRound(3, 'Player 3 declared TONG-ITS!');
          return;
        }
        setTurnTimer(45);
        setHasDrawnThisTurn(false);
        setTurnPlayer(1);
      }
    }, 900);

    return () => {
      if (botTimerRef.current) window.clearTimeout(botTimerRef.current);
    };
  }, [phase, turnPlayer, deck, p2Hand, p3Hand, tableSeats, soundMuted, p1Points, p2Points, p3Points]);

  const handleDrawFromDeck = () => {
    if (phase !== 'playing' || turnPlayer !== 1 || hasDrawnThisTurn) return;
    if (deck.length === 0) {
      const scores = [
        { seat: 1 as const, pts: p1Points },
        { seat: 2 as const, pts: p2Points },
        ...(tableSeats === 3 ? [{ seat: 3 as const, pts: p3Points }] : []),
      ].sort((a, b) => a.pts - b.pts);
      finishRound(scores[0].seat, 'Deck empty — lowest deadwood count wins!');
      return;
    }
    const card = deck[0];
    setDeck((d) => d.slice(1));
    setP1Hand((prev) => {
      const next = [...prev, card];
      return autoSort ? sortCards(next, sortMode) : next;
    });
    setHasDrawnThisTurn(true);
    playCardTone('draw', soundMuted);
    setTableMessage(`Drew ${card.label}${card.suit} (13 cards: 5 up, 8 down). Meld or drop 1 card.`);
  };

  const handleEatCenterDiscard = () => {
    if (phase !== 'playing' || turnPlayer !== 1 || hasDrawnThisTurn || discardPile.length === 0) return;
    const topDiscard = discardPile[0];
    setDiscardPile((dp) => dp.slice(1));
    setP1Hand((prev) => {
      const next = [...prev, topDiscard];
      return autoSort ? sortCards(next, sortMode) : next;
    });
    setHasDrawnThisTurn(true);
    playCardTone('meld', soundMuted);
    setTableMessage(`Ate center card ${topDiscard.label}${topDiscard.suit}! Group your meld or drop a card.`);
  };

  const handleDropSelected = () => {
    if (phase !== 'playing' || turnPlayer !== 1 || !hasDrawnThisTurn) return;
    if (selectedCardIds.length !== 1) {
      setTableMessage('Select exactly 1 card to drop to Player 2.');
      return;
    }
    const card = p1Hand.find((c) => c.id === selectedCardIds[0]);
    if (!card) return;
    const remaining = p1Hand.filter((c) => c.id !== card.id);
    setP1Hand(remaining);
    setDiscardPile((dp) => [card, ...dp]);
    setSelectedCardIds([]);
    playCardTone('drop', soundMuted);
    if (remaining.length === 0) {
      finishRound(1, 'TONG-ITS! Emptied hand cleanly!');
      return;
    }
    setTableMessage(`Dropped ${card.label}${card.suit} to Player 2 (with chime).`);
    setHasDrawnThisTurn(false);
    setTurnTimer(45);
    setTurnPlayer(2);
  };

  const handleGroupMeld = () => {
    if (phase !== 'playing' || turnPlayer !== 1) return;
    const chosen = p1Hand.filter((c) => selectedCardIds.includes(c.id));
    const meldType = validateMeld(chosen);
    if (!meldType) {
      setTableMessage('Selected cards do not form a valid 3-of-a-kind, Quadro (4-of-a-kind), or Straight Flush.');
      return;
    }
    const newMeld: MeldGroup = {
      id: `m_${Date.now()}`,
      cards: sortCards(chosen, 'rank'),
      type: meldType,
    };
    const remaining = p1Hand.filter((c) => !selectedCardIds.includes(c.id));
    setP1Melds((prev) => [...prev, newMeld]);
    setP1Hand(remaining);
    setSelectedCardIds([]);
    playCardTone('meld', soundMuted);
    const labelMap: Record<MeldGroup['type'], string> = {
      set: '3-of-a-Kind Meld',
      quadro: '4-of-a-Kind (Quadro Bonus!)',
      run: 'Straight Flush Meld',
      royal_flush: '5-Card Royal Straight Flush (5× Bonus!)',
    };
    setTableMessage(`Dropped ${labelMap[meldType]}!`);
    if (remaining.length === 0) {
      finishRound(1, `TONG-ITS with ${labelMap[meldType]}!`);
    }
  };

  const handleUngroupLastMeld = () => {
    if (phase !== 'playing' || turnPlayer !== 1 || p1Melds.length === 0) return;
    const last = p1Melds[p1Melds.length - 1];
    setP1Melds((prev) => prev.slice(0, -1));
    setP1Hand((prev) => {
      const next = [...prev, ...last.cards];
      return autoSort ? sortCards(next, sortMode) : next;
    });
    setTableMessage('Ungrouped last meld back into your hand.');
  };

  const handleInitiateFight = () => {
    if (phase !== 'playing') return;
    if (p1Melds.length === 0 && !hasSpecialCardBonus) {
      setTableMessage('Drop at least 1 meld (or hold a Special Card) before calling Fight.');
      return;
    }
    setFightChallenger(currentUser.name);
    setFightTimer(15);
    setPhase('fight_modal');
    playCardTone('fight', soundMuted);
  };

  const handleResolveFight = (acceptFight: boolean) => {
    if (!acceptFight) {
      finishRound(2, 'Folded during Fight challenge', true, true);
      return;
    }
    const scores = [
      { seat: 1 as const, pts: p1Points },
      { seat: 2 as const, pts: p2Points },
      ...(tableSeats === 3 ? [{ seat: 3 as const, pts: p3Points }] : []),
    ].sort((a, b) => a.pts - b.pts);
    finishRound(
      scores[0].seat,
      `Fight Showdown (${currentUser.name}: ${p1Points} pts vs Opponents: ${p2Points}${tableSeats === 3 ? ` / ${p3Points}` : ''} pts)`,
      true,
      false
    );
  };

  const handleSwapCards = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setAutoSort(false);
    setP1Hand((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((c) => c.id === fromId);
      const toIdx = next.findIndex((c) => c.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      return next;
    });
  };

  const handleSendTableChat = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTableChat((prev) => [
      ...prev.slice(-30),
      {
        id: `c_${Date.now()}`,
        sender: currentUser.name,
        text: clean,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setChatInput('');
  };

  // Strict 2-row hand layout: 5 cards top row, remaining (7 or 8) bottom row
  const topRowCards = p1Hand.slice(0, 5);
  const bottomRowCards = p1Hand.slice(5);

  const renderCard = (card: PlayingCard, compact = false) => {
    const isRed = card.suit === '♥' || card.suit === '♦';
    const selected = selectedCardIds.includes(card.id);
    return (
      <button
        key={card.id}
        type="button"
        draggable
        onDragStart={() => setDraggedCardId(card.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => {
          if (draggedCardId) {
            handleSwapCards(draggedCardId, card.id);
            setDraggedCardId(null);
          }
        }}
        onClick={() => {
          setSelectedCardIds((prev) =>
            prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
          );
        }}
        className={`relative select-none rounded-lg border bg-white text-left shadow-md transition-transform duration-150 ${
          compact ? 'w-11 h-16 p-1' : 'w-12 h-[72px] sm:w-14 sm:h-20 p-1.5'
        } ${
          selected
            ? '-translate-y-2.5 border-amber-400 ring-2 ring-amber-400 shadow-amber-500/40'
            : 'border-slate-300 hover:-translate-y-1'
        } ${card.isJoker ? 'bg-gradient-to-br from-amber-100 to-rose-100' : ''}`}
        title="Click to select or drag onto another card to swap position"
      >
        <div
          className={`font-black leading-none text-xs sm:text-sm ${
            card.isJoker ? 'text-purple-700' : isRed ? 'text-rose-600' : 'text-slate-900'
          }`}
        >
          {card.label}
        </div>
        <div
          className={`text-base sm:text-xl leading-none mt-0.5 text-center ${
            card.isJoker ? 'text-purple-600' : isRed ? 'text-rose-600' : 'text-slate-900'
          }`}
        >
          {card.suit}
        </div>
        <div
          className={`absolute bottom-1 right-1 text-[9px] font-bold opacity-75 ${
            isRed ? 'text-rose-600' : 'text-slate-800'
          }`}
        >
          {card.label}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="rounded-2xl bg-emerald-950 text-white border border-emerald-700/80 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Crown className="w-4 h-4" />
            <span>TONG-ITS ARENA · COMING SOON (LIVE TABLE PREVIEW)</span>
          </div>
          <h2 className="text-lg font-extrabold tracking-tight mt-0.5">
            Choy Tong-its Real Deal · Table #{tableNumber}
          </h2>
          <p className="text-xs text-emerald-200/90 mt-0.5">
            2P / 3P · Regular, Butasan, Regular Joker &amp; Butasan Joker · Hitpot on 2 Straight Wins
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono tabular-nums">
            Coins: <strong className="text-amber-300">₱{playerCoins.toLocaleString()}</strong>
          </div>
          <button
            type="button"
            onClick={() => setSoundMuted((m) => !m)}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            title={soundMuted ? 'Unmute Card Tunes' : 'Mute Card Tunes'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setIsTableSidebarOpen(true)}
            className="px-3 py-2 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-bold flex items-center gap-1.5 shadow"
          >
            <Menu className="w-4 h-4" />
            <span>Table Menu</span>
          </button>
        </div>
      </div>

      {outOfCoinsAlert && (
        <div className="rounded-xl bg-rose-950/90 border border-rose-500/60 text-rose-100 p-3.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{outOfCoinsAlert}</span>
          </div>
          {onOpenTopUp && (
            <button
              type="button"
              onClick={onOpenTopUp}
              className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-extrabold text-xs"
            >
              Add Coins Now
            </button>
          )}
        </div>
      )}

      {/* LOBBY CONFIGURATION */}
      {phase === 'lobby' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-2">
                  1. Table Players
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([3, 2] as const).map((seats) => (
                    <button
                      key={seats}
                      type="button"
                      onClick={() => setTableSeats(seats)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                        tableSeats === seats
                          ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                          : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      {seats} Players Table
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-2">
                  2. Game Type
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'regular', label: 'Regular Game' },
                      { id: 'butasan', label: 'Butasan' },
                      { id: 'regular_joker', label: 'Regular Joker' },
                      { id: 'butasan_joker', label: 'Butasan Joker' },
                    ] as const
                  ).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setVariant(g.id)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition ${
                        variant === g.id
                          ? 'bg-emerald-700 text-white border-emerald-500'
                          : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-2">
                3. Betting Stake (Winning = 5× Bet · Min {minEntryCoins} Coins to Join)
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {BET_STAKES.map((stake) => (
                  <button
                    key={stake}
                    type="button"
                    onClick={() => setBetAmount(stake)}
                    className={`py-2.5 rounded-xl font-mono text-sm font-black border transition ${
                      betAmount === stake
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                        : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                    }`}
                  >
                    ₱{stake}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => dealNewRound(false)}
              className="w-full py-3.5 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <Play className="w-4 h-4" />
              Sit &amp; Deal Real Cards (₱{betAmount} Stake · Win ₱{betAmount * 5})
            </button>
          </div>

          {/* Payout & House Rules Table */}
          <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-5 text-xs space-y-2.5">
            <h3 className="text-sm font-extrabold text-emerald-950 dark:text-white flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Official Tong-its Payout Rules
            </h3>
            <ul className="space-y-1.5 text-emerald-800 dark:text-emerald-200">
              <li>• <strong>Base Win:</strong> ₱1 bet wins ₱5 · ₱2 bet wins ₱10 (5× stake).</li>
              <li>• <strong>Special Cards:</strong> 5-Card Straight Flush (Royal) &amp; 4-of-a-Kind (Quadro) pay 5× bonus + can Fight even on opponent draw!</li>
              <li>• <strong>Kings Bonus:</strong> Winner collects <strong>₱5 per King</strong> (including melds down).</li>
              <li>• <strong>Fight Rule:</strong> ₱5 payout on ₱1 bet (plus remaining deadwood count in <strong>Butasan</strong>). 15s Fight timer — auto-folds if expired.</li>
              <li>• <strong>Hitpot:</strong> Win <strong>2 consecutive rounds</strong> to claim the Hitpot (₱{hitpotPool}).</li>
              <li>• <strong>Admin Tong:</strong> ₱0.50 per game (₱1–₱2 bet) · ₱1.00 per game (₱3–₱5 bet).</li>
              <li>• <strong>Entry Rule:</strong> Min 100 coins for ₱1 table; 49 coins &amp; below shows Out of Coins.</li>
            </ul>
          </div>
        </div>
      )}

      {/* LIVE FULL-SCREEN PLAYABLE TABLE */}
      {(phase === 'playing' || phase === 'fight_modal' || phase === 'round_over') && (
        <div
          className="relative rounded-2xl overflow-hidden border-2 border-amber-900/80 shadow-2xl p-3 sm:p-5 text-white min-h-[540px] flex flex-col justify-between gap-3"
          style={{
            backgroundImage: `linear-gradient(rgba(3, 35, 22, 0.72), rgba(2, 24, 15, 0.86)), url(${tongitsTableFeltUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Top Bar: Opponents (Player 2 & Player 3) */}
          <div className={`grid gap-3 ${tableSeats === 3 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto w-full'}`}>
            <div
              className={`rounded-xl p-2.5 bg-black/45 border ${
                turnPlayer === 2 ? 'border-amber-400 ring-1 ring-amber-400' : 'border-white/15'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-bold">
                <span>Player 2 · Lito</span>
                <span className="font-mono text-amber-300">{p2Hand.length} cards</span>
              </div>
              <div className="flex items-center gap-0.5 mt-1.5 overflow-hidden">
                {p2Hand.slice(0, 8).map((c) => (
                  <div
                    key={c.id}
                    className="w-4 h-6 rounded-xs bg-gradient-to-br from-emerald-700 to-emerald-950 border border-amber-300/60"
                  />
                ))}
              </div>
            </div>

            {tableSeats === 3 && (
              <div
                className={`rounded-xl p-2.5 bg-black/45 border ${
                  turnPlayer === 3 ? 'border-amber-400 ring-1 ring-amber-400' : 'border-white/15'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Player 3 · Mika</span>
                  <span className="font-mono text-amber-300">{p3Hand.length} cards</span>
                </div>
                <div className="flex items-center gap-0.5 mt-1.5 overflow-hidden">
                  {p3Hand.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      className="w-4 h-6 rounded-xs bg-gradient-to-br from-emerald-700 to-emerald-950 border border-amber-300/60"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Center Table: Hitpot, Draw Pile, Clickable Center Discard, Turn Timer */}
          <div className="flex flex-col items-center gap-3 my-1">
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono">
              <span className="px-2.5 py-1 rounded-lg bg-black/50 border border-amber-400/50 text-amber-300 font-bold">
                Hitpot: ₱{hitpotPool} ({consecutiveWins}/2 Wins)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-black/50 border border-white/15">
                Stake: ₱{betAmount} · {variant.replace('_', ' ').toUpperCase()}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                  turnTimer <= 10 ? 'bg-rose-600 text-white' : 'bg-black/55 text-emerald-200'
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                {turnTimer}s
              </span>
            </div>

            <div className="flex items-center justify-center gap-6">
              {/* Clickable Draw Deck */}
              <button
                type="button"
                onClick={handleDrawFromDeck}
                disabled={turnPlayer !== 1 || hasDrawnThisTurn || phase !== 'playing'}
                className="group flex flex-col items-center gap-1 disabled:opacity-60"
              >
                <div className="w-16 h-24 rounded-xl bg-gradient-to-br from-emerald-800 to-emerald-950 border-2 border-amber-300 shadow-lg flex flex-col items-center justify-center group-hover:scale-105 transition">
                  <span className="text-[10px] font-bold text-amber-200">DRAW</span>
                  <span className="font-mono text-lg font-black text-white tabular-nums">{deck.length}</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-100">Tap to Draw</span>
              </button>

              {/* Clickable Center Discard (Eat / Kaon) */}
              <button
                type="button"
                onClick={handleEatCenterDiscard}
                disabled={turnPlayer !== 1 || hasDrawnThisTurn || discardPile.length === 0 || phase !== 'playing'}
                className="group flex flex-col items-center gap-1 disabled:opacity-75"
              >
                {discardPile.length > 0 ? (
                  <div className="w-16 h-24 rounded-xl bg-white border-2 border-amber-400 shadow-xl p-2 flex flex-col justify-between text-left group-hover:scale-105 transition">
                    <span
                      className={`font-black text-sm leading-none ${
                        discardPile[0].suit === '♥' || discardPile[0].suit === '♦'
                          ? 'text-rose-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {discardPile[0].label}
                    </span>
                    <span
                      className={`text-2xl text-center leading-none ${
                        discardPile[0].suit === '♥' || discardPile[0].suit === '♦'
                          ? 'text-rose-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {discardPile[0].suit}
                    </span>
                    <span className="text-[9px] font-extrabold text-amber-600 uppercase text-center">
                      Tap Eat
                    </span>
                  </div>
                ) : (
                  <div className="w-16 h-24 rounded-xl border-2 border-dashed border-white/30 bg-black/25 flex items-center justify-center text-[10px] text-white/60 text-center px-1">
                    Center Discard
                  </div>
                )}
                <span className="text-[10px] font-bold text-amber-200">
                  {discardPile.length > 0 ? 'Center Card (Kaon)' : 'Empty'}
                </span>
              </button>
            </div>

            <div className="px-3 py-1.5 rounded-lg bg-black/55 border border-white/10 text-[11px] text-center text-emerald-100 max-w-xl">
              {tableMessage}
            </div>

            {/* Player 1 Dropped Melds */}
            {p1Melds.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {p1Melds.map((meld) => (
                  <div
                    key={meld.id}
                    className="flex items-center gap-0.5 bg-black/45 px-2 py-1 rounded-xl border border-emerald-400/50"
                  >
                    {meld.cards.map((c) => (
                      <span
                        key={c.id}
                        className={`px-1.5 py-0.5 rounded bg-white text-[11px] font-black ${
                          c.suit === '♥' || c.suit === '♦' ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {c.label}
                        {c.suit}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player 1 Hand Area (Strict 5-up, 7/8-down layout + Controls) */}
          <div className="rounded-xl bg-black/50 border border-white/15 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-bold flex items-center gap-2">
                <span>Player 1 · {currentUser.name}</span>
                <span className="text-amber-300 font-mono">
                  ({p1Hand.length} cards · Auto-Count: {p1Points} pts)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const nextMode = sortMode === 'rank' ? 'suit' : 'rank';
                    setSortMode(nextMode);
                    setP1Hand((h) => sortCards(h, nextMode));
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold flex items-center gap-1"
                >
                  <Shuffle className="w-3 h-3" />
                  Sort ({sortMode === 'rank' ? 'Rank' : 'Suit'})
                </button>
                <button
                  type="button"
                  onClick={() => setAutoSort((a) => !a)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                    autoSort ? 'bg-emerald-500 text-slate-950' : 'bg-white/15 text-white'
                  }`}
                >
                  Auto Sort: {autoSort ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={handleGroupMeld}
                  disabled={selectedCardIds.length < 3 || turnPlayer !== 1}
                  className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-extrabold disabled:opacity-40 flex items-center gap-1"
                >
                  <Layers className="w-3 h-3" />
                  Group Meld
                </button>
                <button
                  type="button"
                  onClick={handleUngroupLastMeld}
                  disabled={p1Melds.length === 0 || turnPlayer !== 1}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold disabled:opacity-40"
                >
                  Ungroup
                </button>
              </div>
            </div>

            {/* Two-Row Hand Fan: 5 cards top row, 7 or 8 cards bottom row */}
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {topRowCards.map((card) => renderCard(card))}
              </div>
              {bottomRowCards.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  {bottomRowCards.map((card) => renderCard(card))}
                </div>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <button
                type="button"
                onClick={handleDrawFromDeck}
                disabled={turnPlayer !== 1 || hasDrawnThisTurn || phase !== 'playing'}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold disabled:opacity-40"
              >
                Draw Card
              </button>
              <button
                type="button"
                onClick={handleDropSelected}
                disabled={turnPlayer !== 1 || !hasDrawnThisTurn || selectedCardIds.length !== 1 || phase !== 'playing'}
                className="py-2.5 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white text-xs font-extrabold disabled:opacity-40"
              >
                Drop Card
              </button>
              <button
                type="button"
                onClick={handleInitiateFight}
                disabled={phase !== 'playing'}
                className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Swords className="w-3.5 h-3.5" />
                Fight (Draw)
              </button>
              <button
                type="button"
                onClick={() => finishRound(2, 'Player folded', true, true)}
                disabled={phase !== 'playing'}
                className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold disabled:opacity-40"
              >
                Fold
              </button>
            </div>
          </div>

          {/* 15-Second Fight Decision Modal */}
          {phase === 'fight_modal' && (
            <div className="absolute inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl bg-emerald-950 border border-amber-400 p-5 text-center space-y-4 shadow-2xl">
                <Swords className="w-9 h-9 text-amber-400 mx-auto" />
                <h3 className="text-lg font-black">FIGHT CHALLENGE!</h3>
                <p className="text-xs text-emerald-200">
                  {fightChallenger} called Fight! Decide within{' '}
                  <strong className="text-amber-300 font-mono text-sm">{fightTimer}s</strong> or auto-fold.
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleResolveFight(true)}
                    className="py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs"
                  >
                    Accept Fight
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveFight(false)}
                    className="py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs"
                  >
                    Fold Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Round Over Summary Modal */}
          {phase === 'round_over' && roundSummary && (
            <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-2xl bg-emerald-950 border border-emerald-500 p-5 text-center space-y-3 shadow-2xl">
                <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                <h3 className="text-lg font-black">{roundSummary.winner} Wins!</h3>
                <p className="text-xs text-emerald-200">{roundSummary.reason}</p>
                <div className="rounded-xl bg-black/40 p-3 text-xs space-y-1 font-mono">
                  <div className="text-amber-300 font-black text-base">{roundSummary.payoutText}</div>
                  {roundSummary.kingBonus > 0 && (
                    <div className="text-emerald-300">Kings Bonus Included: +₱{roundSummary.kingBonus}</div>
                  )}
                  {roundSummary.hitpotWon && (
                    <div className="text-amber-400 font-extrabold">2-WIN HITPOT JACKPOT CLAIMED!</div>
                  )}
                  <div className="text-emerald-300/80">Admin Tong Fee: ₱{roundSummary.adminTong.toFixed(2)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => dealNewRound(true)}
                    className="py-2.5 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Deal Next Round
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase('lobby')}
                    className="py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs"
                  >
                    Table Lobby
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IN-TABLE SIDEBAR DRAWER (Add Coin, Message + Emojis, Swap Table, Exit) */}
      {isTableSidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex justify-end"
          onClick={() => setIsTableSidebarOpen(false)}
        >
          <div
            className="w-full max-w-xs bg-emerald-950 text-white border-l border-emerald-700 h-full p-4 flex flex-col justify-between gap-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
                <div className="font-extrabold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Tong-its Table Menu</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTableSidebarOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsTableSidebarOpen(false);
                    if (onOpenTopUp) onOpenTopUp();
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  Add Coin / Top Up Wallet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTableNumber((n) => n + 1);
                    setIsTableSidebarOpen(false);
                    if (phase === 'playing') dealNewRound(true);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Swap Table
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTableSidebarOpen(false);
                    setPhase('lobby');
                    if (onExit) onExit();
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Exit Table
                </button>
              </div>

              {/* In-Table Chat Box with Default Quick Emojis */}
              <div className="rounded-xl bg-black/35 border border-emerald-800 p-3 space-y-2.5">
                <div className="text-xs font-bold flex items-center gap-1.5 text-emerald-200">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Table Chat &amp; Quick Emojis
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs pr-1">
                  {tableChat.map((m) => (
                    <div key={m.id} className="bg-white/10 rounded-lg px-2.5 py-1.5">
                      <span className="font-bold text-amber-300">{m.sender}: </span>
                      <span>{m.text}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => handleSendTableChat(em)}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/25 text-base flex items-center justify-center"
                    >
                      {em}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendTableChat(chatInput);
                  }}
                  className="flex gap-1.5"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type message..."
                    maxLength={120}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-emerald-900/70 border border-emerald-700 text-xs text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-[#FF5A1F] text-white"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>

            <div className="text-[10px] text-emerald-300/75 text-center">
              <Flame className="w-3 h-3 inline mr-1 text-amber-400" />
              Tong-its Real Deal · Auto-Synced Coins
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
