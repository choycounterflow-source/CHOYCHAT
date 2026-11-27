import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { UserDashboardData } from './UserDashboardPanels';

export interface DtrSubscriptionState {
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'none' | 'trialing' | 'active' | 'cancelled';
  paymentMethod: 'stripe_card' | 'gcash';
  paymentDetails: string;
  trialStartedAt?: string;
  trialEndsAt?: string;
  nextBillingAt?: string;
  autoDeduct: boolean;
  lastBilledAt?: string;
  cancelledAt?: string;
}

export interface DtrEmployeeRecord {
  id: string;
  completeName: string;
  dateHired: string;
  position?: string;
  dailyRate: number;
  // months[YYYY-MM][dayNumber '1'..'31'][categoryKey] = hours
  months: Record<string, Record<string, Record<string, number>>>;
  updatedAt: string;
}

interface EmployeeDtrPanelProps {
  currentUser: {
    id: string;
    name: string;
    role: 'admin' | 'member';
  };
  authToken?: string | null;
  onOwnDashboardUpdated?: (next: UserDashboardData) => void;
}

// Official Caraga Region (Region XIII) DOLE Default Minimum Daily Wage Rate (editable per employee/sheet)
const CARAGA_DEFAULT_DAILY_RATE = 435;

interface DtrCategorySpec {
  key: string;
  label: string;
  fullName: string;
  multiplier: number; // Multiplier on hourly rate (dailyRate / 8)
}

const DTR_CATEGORIES: DtrCategorySpec[] = [
  { key: 'RH', label: 'RH', fullName: 'Regular Hours', multiplier: 1.0 },
  { key: 'OT', label: 'OT', fullName: 'Regular Overtime', multiplier: 1.25 },
  { key: 'ND', label: 'ND', fullName: 'Night Differential (+10%)', multiplier: 0.1 },
  { key: 'NDOT', label: 'NDOT', fullName: 'Night Diff Overtime', multiplier: 1.375 },
  { key: 'RHD', label: 'RHD', fullName: 'Regular Holiday Duty', multiplier: 2.0 },
  { key: 'RHDOT', label: 'RHDOT', fullName: 'Regular Holiday OT', multiplier: 2.6 },
  { key: 'RHDND', label: 'RHDND', fullName: 'Regular Holiday ND', multiplier: 2.2 },
  { key: 'RHDNDOT', label: 'RHDNDOT', fullName: 'Regular Holiday ND OT', multiplier: 2.86 },
  { key: 'RD', label: 'RD', fullName: 'Rest Day Duty', multiplier: 1.3 },
  { key: 'RDOT', label: 'RDOT', fullName: 'Rest Day OT', multiplier: 1.69 },
  { key: 'RDND', label: 'RDND', fullName: 'Rest Day ND', multiplier: 1.43 },
  { key: 'RDNDOT', label: 'RDNDOT', fullName: 'Rest Day ND OT', multiplier: 1.859 },
  { key: 'RDRHD', label: 'RDRHD', fullName: 'Rest Day + Reg Holiday', multiplier: 2.6 },
  { key: 'RDRHDOT', label: 'RDRHDOT', fullName: 'Rest Day + Reg Holiday OT', multiplier: 3.38 },
  { key: 'RDRHDND', label: 'RDRHDND', fullName: 'Rest Day + Reg Holiday ND', multiplier: 2.86 },
  { key: 'RDRHDNDOT', label: 'RDRHDNDOT', fullName: 'Rest Day + Reg Holiday ND OT', multiplier: 3.718 },
  { key: 'SP', label: 'SP HOL', fullName: 'Special Holiday Duty', multiplier: 1.3 },
  { key: 'SPOT', label: 'SPOT', fullName: 'Special Holiday OT', multiplier: 1.69 },
  { key: 'OPND', label: 'OPND', fullName: 'Special Holiday ND', multiplier: 1.43 },
  { key: 'SPNDOT', label: 'SPNDOT', fullName: 'Special Holiday ND OT', multiplier: 1.859 },
  { key: 'RDSP', label: 'RDSP', fullName: 'Rest Day + Special Holiday', multiplier: 1.5 },
  { key: 'RDSPOT', label: 'RDSPOT', fullName: 'Rest Day + Spec Hol OT', multiplier: 1.95 },
  { key: 'RDSPND', label: 'RDSPND', fullName: 'Rest Day + Spec Hol ND', multiplier: 1.65 },
  { key: 'RDSPNDOT', label: 'RDSPNDOT', fullName: 'Rest Day + Spec Hol ND OT', multiplier: 2.145 },
  { key: 'SIL', label: 'SIL', fullName: 'Service Incentive Leave', multiplier: 1.0 },
  { key: 'ML', label: 'MAT LV', fullName: 'Maternity Leave', multiplier: 1.0 },
  { key: 'PL', label: 'PAT LV', fullName: 'Paternity Leave', multiplier: 1.0 },
];

const DTR_PLANS = [
  {
    id: 'starter' as const,
    name: 'Starter Plan',
    pricePhp: 299,
    limitLabel: 'Up to 20 Employees',
    maxEmployees: 20,
    audience: 'For small shops & local teams',
  },
  {
    id: 'pro' as const,
    name: 'Pro Plan',
    pricePhp: 799,
    limitLabel: 'Up to 50 Employees',
    maxEmployees: 50,
    audience: 'For growing businesses & branches',
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise Plan',
    pricePhp: 1299,
    limitLabel: 'Unlimited Employees',
    maxEmployees: Infinity,
    audience: 'For full operations & payroll teams',
  },
];

const DAYS_31 = Array.from({ length: 31 }, (_, i) => String(i + 1));

function formatPhp(n: number): string {
  return `₱${Number(n || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function computeEmployeeMonthPayroll(emp: DtrEmployeeRecord | null, monthKey: string) {
  const hourlyRate = (emp?.dailyRate || CARAGA_DEFAULT_DAILY_RATE) / 8;
  const monthGrid = emp?.months?.[monthKey] || {};
  const categoryHours: Record<string, number> = {};
  const categoryPay: Record<string, number> = {};
  const dayTotals: Record<string, number> = {};
  let totalManhours = 0;
  let grossWagePhp = 0;

  for (const day of DAYS_31) {
    let daySum = 0;
    for (const cat of DTR_CATEGORIES) {
      daySum += Number(monthGrid[day]?.[cat.key] || 0);
    }
    dayTotals[day] = Math.round(daySum * 100) / 100;
  }

  for (const cat of DTR_CATEGORIES) {
    let sumHrs = 0;
    for (const day of DAYS_31) {
      sumHrs += Number(monthGrid[day]?.[cat.key] || 0);
    }
    const roundedHrs = Math.round(sumHrs * 100) / 100;
    const pay = Math.round(roundedHrs * hourlyRate * cat.multiplier * 100) / 100;
    categoryHours[cat.key] = roundedHrs;
    categoryPay[cat.key] = pay;
    totalManhours = Math.round((totalManhours + roundedHrs) * 100) / 100;
    grossWagePhp = Math.round((grossWagePhp + pay) * 100) / 100;
  }

  return { hourlyRate, categoryHours, categoryPay, dayTotals, totalManhours, grossWagePhp };
}

export const EmployeeDtrPanel: React.FC<EmployeeDtrPanelProps> = ({
  currentUser,
  authToken,
  onOwnDashboardUpdated,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPlanModalView, setShowPlanModalView] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<DtrSubscriptionState | null>(null);
  const [employees, setEmployees] = useState<DtrEmployeeRecord[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Trial / Plan Onboarding Form
  const [chosenPlan, setChosenPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [paymentMethod, setPaymentMethod] = useState<'stripe_card' | 'gcash'>('stripe_card');
  const [paymentDetails, setPaymentDetails] = useState<string>('');
  const [startingTrial, setStartingTrial] = useState(false);
  const [cancellingSub, setCancellingSub] = useState(false);

  // Add Employee Form
  const [newName, setNewName] = useState('');
  const [newDateHired, setNewDateHired] = useState(() => new Date().toISOString().slice(0, 10));
  const [newPosition, setNewPosition] = useState('');
  const [newDailyRate, setNewDailyRate] = useState(String(CARAGA_DEFAULT_DAILY_RATE));

  // Safe Erase Modal ("confirm erase")
  const [eraseTarget, setEraseTarget] = useState<
    | { kind: 'clear_month'; empId: string; empName: string }
    | { kind: 'delete_employee'; empId: string; empName: string }
    | null
  >(null);
  const [eraseConfirmInput, setEraseConfirmInput] = useState('');

  // Keep latest callback in a ref so parent re-renders NEVER trigger a refetch loop
  const onOwnDashboardUpdatedRef = useRef(onOwnDashboardUpdated);
  useEffect(() => {
    onOwnDashboardUpdatedRef.current = onOwnDashboardUpdated;
  }, [onOwnDashboardUpdated]);

  const getHeaders = useCallback(
    (json = false): Record<string, string> => {
      const h: Record<string, string> = {
        'X-Requested-With': 'XMLHttpRequest',
      };
      if (json) h['Content-Type'] = 'application/json';
      if (authToken) h.Authorization = `Bearer ${authToken}`;
      return h;
    },
    [authToken]
  );

  const loadState = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/choy/dtr/state', {
        credentials: 'include',
        headers: getHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Could not load Employee DTR (HTTP ${res.status}).`);
      }
      const nextSub: DtrSubscriptionState | null = data.dtrSubscription || null;
      const list: DtrEmployeeRecord[] = Array.isArray(data.dtrEmployees) ? data.dtrEmployees : [];
      setSubscription(nextSub);
      if (nextSub?.plan) {
        setChosenPlan(nextSub.plan);
      }
      setEmployees(list);
      setHasUnsavedChanges(false);
      setSelectedEmpId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev;
        if (list.length === 0) return '';
        const sorted = [...list].sort((a, b) => a.completeName.localeCompare(b.completeName));
        return sorted[0].id;
      });
      if (data.ownDashboard && onOwnDashboardUpdatedRef.current) {
        onOwnDashboardUpdatedRef.current(data.ownDashboard);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not load Employee DTR data.');
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    void loadState();
  }, [loadState, currentUser.id]);

  const hasActiveAccess =
    isAdmin || (subscription !== null && (subscription.status === 'trialing' || subscription.status === 'active'));

  const activePlanId =
    subscription && (subscription.status === 'trialing' || subscription.status === 'active')
      ? subscription.plan
      : chosenPlan;

  const currentPlanMeta = DTR_PLANS.find((p) => p.id === activePlanId) || DTR_PLANS[0];
  const selectedPlanMeta = DTR_PLANS.find((p) => p.id === chosenPlan) || DTR_PLANS[0];

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.completeName.localeCompare(b.completeName)),
    [employees]
  );

  const activeEmployee = useMemo(
    () => sortedEmployees.find((e) => e.id === selectedEmpId) || sortedEmployees[0] || null,
    [sortedEmployees, selectedEmpId]
  );

  const persistEmployees = async (nextList: DtrEmployeeRecord[], successText: string): Promise<boolean> => {
    setSaving(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await fetch('/api/choy/dtr/save', {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(true),
        body: JSON.stringify({ employees: nextList }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save Employee DTR.');
      }
      setEmployees(Array.isArray(data.dtrEmployees) ? data.dtrEmployees : nextList);
      setHasUnsavedChanges(false);
      setNotice(successText);
      return true;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save Employee DTR.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStartTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setNotice(null);
    if (!paymentDetails.trim()) {
      setErrorMsg(
        paymentMethod === 'gcash'
          ? 'Please enter your GCash mobile number first.'
          : 'Please enter your Stripe Card holder name / last 4 digits first.'
      );
      return;
    }
    setStartingTrial(true);
    try {
      const res = await fetch('/api/choy/dtr/subscription', {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(true),
        body: JSON.stringify({
          plan: chosenPlan,
          paymentMethod,
          paymentDetails: paymentDetails.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to activate 30-day free trial.');
      setSubscription(data.dtrSubscription || null);
      setShowPlanModalView(false);
      if (data.ownDashboard && onOwnDashboardUpdatedRef.current) {
        onOwnDashboardUpdatedRef.current(data.ownDashboard);
      }
      setNotice(
        `30-Day Free Trial activated for ${selectedPlanMeta.name}! Due today: ₱0.00. You can cancel anytime before trial ends.`
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not activate free trial.');
    } finally {
      setStartingTrial(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancellingSub(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const res = await fetch('/api/choy/dtr/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: getHeaders(true),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not cancel subscription.');
      setSubscription(data.dtrSubscription || null);
      if (data.ownDashboard && onOwnDashboardUpdatedRef.current) {
        onOwnDashboardUpdatedRef.current(data.ownDashboard);
      }
      setNotice('Employee DTR subscription cancelled. ₱0.00 will be billed.');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to cancel subscription.');
    } finally {
      setCancellingSub(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanName = newName.trim();
    if (!cleanName) {
      setErrorMsg('Enter the employee Complete Name.');
      return;
    }
    const maxAllowed = isAdmin ? Infinity : currentPlanMeta.maxEmployees;
    if (employees.length >= maxAllowed) {
      setErrorMsg(
        `Your ${currentPlanMeta.name} allows up to ${maxAllowed} employees. Upgrade to Pro (50) or Enterprise (Unlimited).`
      );
      return;
    }
    const rateNum = Number(newDailyRate);
    const dailyRate = Number.isFinite(rateNum) && rateNum > 0 ? rateNum : CARAGA_DEFAULT_DAILY_RATE;
    const emp: DtrEmployeeRecord = {
      id: `emp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      completeName: cleanName,
      dateHired: newDateHired || new Date().toISOString().slice(0, 10),
      position: newPosition.trim() || undefined,
      dailyRate,
      months: {},
      updatedAt: new Date().toISOString(),
    };
    const nextList = [...employees, emp];
    const ok = await persistEmployees(nextList, `Added ${cleanName} (sorted alphabetically) and saved to cloud.`);
    if (ok) {
      setSelectedEmpId(emp.id);
      setNewName('');
      setNewPosition('');
    }
  };

  const handleHourCellChange = (day: string, catKey: string, rawVal: string) => {
    if (!activeEmployee) return;
    const parsed = rawVal === '' ? 0 : Math.max(0, Math.min(24, Number(rawVal) || 0));
    setHasUnsavedChanges(true);
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== activeEmployee.id) return emp;
        const currMonth = emp.months[selectedMonth] || {};
        const currDay = currMonth[day] || {};
        const nextDay = { ...currDay };
        if (parsed === 0) {
          delete nextDay[catKey];
        } else {
          nextDay[catKey] = parsed;
        }
        return {
          ...emp,
          months: {
            ...emp.months,
            [selectedMonth]: {
              ...currMonth,
              [day]: nextDay,
            },
          },
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const handleQuickFillRegularHours = () => {
    if (!activeEmployee) return;
    setHasUnsavedChanges(true);
    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id !== activeEmployee.id) return emp;
        const currMonth = { ...(emp.months[selectedMonth] || {}) };
        const [yrStr, moStr] = selectedMonth.split('-');
        const yr = Number(yrStr);
        const mo = Number(moStr);
        const daysInMonth = Number.isFinite(yr) && Number.isFinite(mo) ? new Date(yr, mo, 0).getDate() : 30;
        for (let d = 1; d <= daysInMonth; d++) {
          const dow = new Date(yr, mo - 1, d).getDay();
          if (dow === 0) continue; // Skip Sundays (Rest Day)
          const key = String(d);
          currMonth[key] = {
            ...(currMonth[key] || {}),
            RH: 8,
          };
        }
        return {
          ...emp,
          months: {
            ...emp.months,
            [selectedMonth]: currMonth,
          },
          updatedAt: new Date().toISOString(),
        };
      })
    );
    setNotice(`Filled 8 hrs Regular Hours (Mon–Sat) for ${activeEmployee.completeName} in ${selectedMonth}. Click Save DTR to keep changes.`);
  };

  const handleUpdateEmployeeRate = (rawRate: string) => {
    if (!activeEmployee) return;
    const n = Number(rawRate);
    if (!Number.isFinite(n) || n < 0) return;
    setHasUnsavedChanges(true);
    setEmployees((prev) =>
      prev.map((emp) => (emp.id === activeEmployee.id ? { ...emp, dailyRate: n } : emp))
    );
  };

  const handleConfirmErase = async () => {
    if (!eraseTarget) return;
    if (eraseConfirmInput.trim().toLowerCase() !== 'confirm erase') {
      setErrorMsg('You must type exact phrase "confirm erase" to proceed.');
      return;
    }
    let nextList = employees;
    if (eraseTarget.kind === 'clear_month') {
      nextList = employees.map((emp) => {
        if (emp.id !== eraseTarget.empId) return emp;
        const nextMonths = { ...emp.months };
        delete nextMonths[selectedMonth];
        return { ...emp, months: nextMonths, updatedAt: new Date().toISOString() };
      });
    } else if (eraseTarget.kind === 'delete_employee') {
      nextList = employees.filter((emp) => emp.id !== eraseTarget.empId);
      if (selectedEmpId === eraseTarget.empId) {
        setSelectedEmpId('');
      }
    }
    setEraseTarget(null);
    setEraseConfirmInput('');
    await persistEmployees(
      nextList,
      eraseTarget.kind === 'clear_month'
        ? `Erased ${selectedMonth} DTR hours for ${eraseTarget.empName}.`
        : `Deleted employee ${eraseTarget.empName} from DTR roster.`
    );
  };

  // Auto-calculate totals per category + Caraga wages for active employee & selected month
  const payrollCalc = useMemo(
    () => computeEmployeeMonthPayroll(activeEmployee, selectedMonth),
    [activeEmployee, selectedMonth]
  );

  const allEmployeesSummary = useMemo(
    () =>
      sortedEmployees.map((emp) => {
        const calc = computeEmployeeMonthPayroll(emp, selectedMonth);
        return {
          emp,
          totalManhours: calc.totalManhours,
          rhHours: calc.categoryHours.RH || 0,
          otHours: calc.categoryHours.OT || 0,
          grossWagePhp: calc.grossWagePhp,
        };
      }),
    [sortedEmployees, selectedMonth]
  );

  const totalCompanyPayrollPhp = useMemo(
    () =>
      Math.round(
        allEmployeesSummary.reduce((sum, item) => sum + item.grossWagePhp, 0) * 100
      ) / 100,
    [allEmployeesSummary]
  );

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading Employee DTR &amp; Caraga Payroll System...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-5 space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-[#0E4B1D] text-white p-5 border border-emerald-700 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-emerald-200 font-semibold">
            <CalendarClock className="w-4 h-4 text-[#FF5A1F]" />
            <span>Employee DTR &amp; Caraga Region Auto Wage Calculator</span>
          </div>
          <h2 className="text-xl font-extrabold mt-0.5 tracking-tight">
            31-Day All-Category Manhour &amp; Payroll Sheet
          </h2>
          <p className="text-xs text-emerald-200/90 mt-0.5">
            Alphabetical Employee Roster · Caraga Rate Auto-Compute · 30-Day Free Trial (₱0 Due Today)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {subscription && (subscription.status === 'trialing' || subscription.status === 'active') && (
            <div className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-mono">
              {currentPlanMeta.name} ({subscription.status === 'trialing' ? '30-Day Free Trial' : 'Active'}) ·{' '}
              {employees.length}/{currentPlanMeta.maxEmployees === Infinity ? '∞' : currentPlanMeta.maxEmployees}
            </div>
          )}
          {hasActiveAccess && (
            <button
              type="button"
              onClick={() => setShowPlanModalView((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold"
            >
              {showPlanModalView ? 'Back to DTR Sheet' : 'Plans & 30-Day Trial'}
            </button>
          )}
          {subscription && (subscription.status === 'trialing' || subscription.status === 'active') && (
            <button
              type="button"
              disabled={cancellingSub}
              onClick={handleCancelSubscription}
              className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
            >
              {cancellingSub ? 'Cancelling...' : 'Cancel Subscription Anytime'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl bg-emerald-100 dark:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 px-4 py-2.5 text-xs font-semibold flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="ml-2 font-bold">
            ✕
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl bg-rose-100 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200 px-4 py-2.5 text-xs font-semibold flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="ml-2 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* SUBSCRIPTION & 30-DAY FREE TRIAL GATE */}
      {(!hasActiveAccess || showPlanModalView) && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {DTR_PLANS.map((plan) => {
              const selected = chosenPlan === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setChosenPlan(plan.id)}
                  className={`text-left rounded-2xl p-5 border transition ${
                    selected
                      ? 'bg-emerald-900 text-white border-[#FF5A1F] ring-2 ring-[#FF5A1F]'
                      : 'bg-white dark:bg-emerald-950/70 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-white'
                  }`}
                >
                  <div className="text-xs font-semibold opacity-80">{plan.audience}</div>
                  <div className="text-lg font-extrabold mt-1">{plan.name}</div>
                  <div className="font-mono text-2xl font-black mt-2 tabular-nums">
                    ₱{plan.pricePhp.toLocaleString()}
                    <span className="text-xs font-normal opacity-80"> / month after 30-day trial</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-current/15 text-xs font-bold flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#FF5A1F]" />
                    <span>{plan.limitLabel}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <form
            onSubmit={handleStartTrial}
            className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-5 space-y-4 max-w-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 dark:border-emerald-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-emerald-950 dark:text-white">
                  Start 30-Day Free Trial — {selectedPlanMeta.name}
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Fill up your Card or GCash payment method first. Due today is <strong>₱0.00</strong>.
                </p>
              </div>
              <div className="text-right font-mono">
                <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Due Today</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">₱0.00</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('stripe_card')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'stripe_card'
                    ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                    : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Stripe Credit / Debit Card
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('gcash')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                  paymentMethod === 'gcash'
                    ? 'bg-[#007DFE] text-white border-[#007DFE]'
                    : 'bg-emerald-50 dark:bg-emerald-900/50 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                GCash Auto-Pay
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 dark:text-emerald-200 mb-1">
                {paymentMethod === 'gcash'
                  ? 'GCash Registered Mobile Number & Name'
                  : 'Cardholder Name & Last 4 Digits (Stripe Billing Profile)'}
              </label>
              <input
                type="text"
                value={paymentDetails}
                onChange={(e) => setPaymentDetails(e.target.value)}
                placeholder={
                  paymentMethod === 'gcash' ? 'e.g., 0917-123-4567 · Juan Dela Cruz' : 'e.g., Juan Dela Cruz · Visa •••• 4242'
                }
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
            </div>

            {paymentMethod === 'gcash' && (
              <a
                href={
                  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
                    ? 'intent://#Intent;scheme=gcash;package=com.globe.gcash.android;S.browser_fallback_url=https%3A%2F%2Fm.gcash.com%2Fgcash-login-web%2Findex.html;end'
                    : 'https://www.gcash.com/'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#007DFE] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open GCash App to verify account
              </a>
            )}

            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
              <ShieldCheck className="w-4 h-4 inline mr-1 text-emerald-600 dark:text-emerald-400" />
              <strong>Due today is ₱0.00.</strong> After your 30-day free trial ends, you will be billed{' '}
              <strong>₱{selectedPlanMeta.pricePhp.toLocaleString()}/month</strong> automatically unless you cancel.{' '}
              <strong>You can cancel anytime — no payment needed if you cancel before trial ends.</strong>
            </div>

            <button
              type="submit"
              disabled={startingTrial}
              className="w-full py-3 rounded-xl bg-[#FF5A1F] hover:bg-[#e54f18] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow disabled:opacity-50"
            >
              {startingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Proceed to 30-Day Free Trial (Due Today ₱0.00)
            </button>
          </form>
        </div>
      )}

      {/* ACTIVE DTR WORKSPACE */}
      {hasActiveAccess && !showPlanModalView && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Panel: Add Employee + Alphabetical Roster */}
          <div className="lg:col-span-3 space-y-4">
            <form
              onSubmit={handleAddEmployee}
              className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 space-y-3"
            >
              <div className="text-xs font-extrabold text-emerald-950 dark:text-white flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-[#FF5A1F]" />
                Add Employee (A–Z Sorted)
              </div>
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                  Complete Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Dela Cruz, Juan P."
                  required
                  className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                    Date Hired *
                  </label>
                  <input
                    type="date"
                    value={newDateHired}
                    onChange={(e) => setNewDateHired(e.target.value)}
                    required
                    className="w-full px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                    Caraga Rate/Day
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={newDailyRate}
                    onChange={(e) => setNewDailyRate(e.target.value)}
                    min={100}
                    step="0.5"
                    className="w-full px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                  />
                </div>
              </div>
              <input
                type="text"
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                placeholder="Position / Department (Optional)"
                className="w-full px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs text-emerald-950 dark:text-white"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 rounded-xl bg-[#0E4B1D] hover:bg-[#145e27] text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add &amp; Save Employee
              </button>
            </form>

            {/* Alphabetical List */}
            <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-extrabold text-emerald-950 dark:text-white">
                <span>Employees A–Z ({sortedEmployees.length})</span>
              </div>
              {sortedEmployees.length === 0 ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  No employees added yet. Add your first employee above to open the 31-day DTR grid.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {sortedEmployees.map((emp, idx) => {
                    const selected = activeEmployee?.id === emp.id;
                    return (
                      <div
                        key={emp.id}
                        className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 cursor-pointer transition ${
                          selected
                            ? 'bg-[#FF5A1F] text-white border-[#FF5A1F]'
                            : 'bg-emerald-50/70 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-white hover:bg-emerald-100 dark:hover:bg-emerald-900/70'
                        }`}
                        onClick={() => setSelectedEmpId(emp.id)}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {idx + 1}. {emp.completeName}
                          </div>
                          <div className={`text-[10px] font-mono ${selected ? 'text-white/85' : 'text-emerald-700 dark:text-emerald-300'}`}>
                            Hired: {emp.dateHired} · ₱{emp.dailyRate}/day
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEraseConfirmInput('');
                            setEraseTarget({
                              kind: 'delete_employee',
                              empId: emp.id,
                              empName: emp.completeName,
                            });
                          }}
                          className={`p-1.5 rounded-lg ${selected ? 'hover:bg-white/20' : 'hover:bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}
                          title="Delete employee (requires confirm erase)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: 31-Day All-Category Spreadsheet & Auto Wage Summary */}
          <div className="lg:col-span-9 space-y-4">
            {!activeEmployee ? (
              <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-10 text-center space-y-2">
                <CalendarClock className="w-10 h-10 text-emerald-500 mx-auto" />
                <div className="text-base font-extrabold text-emerald-950 dark:text-white">
                  Select or Add an Employee to Start DTR
                </div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300">
                  Enter daily manhours across all 31 days and 27 DOLE/Caraga payroll categories with instant wage computation.
                </p>
              </div>
            ) : (
              <>
                {/* Employee Toolbar & Live Caraga Wage KPI Strip */}
                <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-extrabold text-emerald-950 dark:text-white">
                        {activeEmployee.completeName}
                      </h3>
                      <div className="text-xs text-emerald-700 dark:text-emerald-300 flex flex-wrap items-center gap-2 mt-0.5">
                        <span>Date Hired: {activeEmployee.dateHired}</span>
                        <span>·</span>
                        <span>Caraga Hourly Rate: {formatPhp(payrollCalc.hourlyRate)}/hr</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs font-mono text-emerald-950 dark:text-white"
                      />
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-700 text-xs">
                        <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-200">Daily ₱:</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={activeEmployee.dailyRate}
                          onChange={(e) => handleUpdateEmployeeRate(e.target.value)}
                          className="w-16 bg-transparent font-mono font-bold text-emerald-950 dark:text-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleQuickFillRegularHours}
                        className="px-3 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/70 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-900 dark:text-emerald-100 text-xs font-bold"
                      >
                        Quick Fill 8h RH
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          persistEmployees(
                            employees,
                            `Saved ${activeEmployee.completeName}'s ${selectedMonth} DTR safely to cloud!`
                          )
                        }
                        className={`px-4 py-2 rounded-xl text-white text-xs font-extrabold flex items-center gap-1.5 shadow disabled:opacity-50 ${
                          hasUnsavedChanges
                            ? 'bg-[#FF5A1F] hover:bg-[#e54f18]'
                            : 'bg-[#0E4B1D] hover:bg-[#145e27]'
                        }`}
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {hasUnsavedChanges ? 'Save DTR *' : 'Save DTR'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEraseConfirmInput('');
                          setEraseTarget({
                            kind: 'clear_month',
                            empId: activeEmployee.id,
                            empName: activeEmployee.completeName,
                          });
                        }}
                        className="px-3 py-2 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Erase Month
                      </button>
                    </div>
                  </div>

                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-emerald-200/80 dark:border-emerald-800">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 p-3">
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Total Manhours</div>
                      <div className="text-lg font-mono font-black tabular-nums text-emerald-950 dark:text-white">
                        {payrollCalc.totalManhours.toFixed(2)} hrs
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 p-3">
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Regular Hours (RH)</div>
                      <div className="text-lg font-mono font-black tabular-nums text-emerald-950 dark:text-white">
                        {(payrollCalc.categoryHours.RH || 0).toFixed(2)} hrs
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 p-3">
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300">Caraga Daily Rate</div>
                      <div className="text-lg font-mono font-black tabular-nums text-emerald-950 dark:text-white">
                        {formatPhp(activeEmployee.dailyRate)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-emerald-900 text-white p-3">
                      <div className="text-[11px] text-emerald-200">Auto-Calculated Gross Pay</div>
                      <div className="text-lg font-mono font-black tabular-nums text-amber-300">
                        {formatPhp(payrollCalc.grossWagePhp)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 31-Day All-In-One Month Spreadsheet Grid */}
                <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                  <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-900/50 border-b border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-emerald-950 dark:text-white">
                      31-Day Manhour Matrix ({selectedMonth}) — Scroll horizontally for all 27 categories
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      {hasUnsavedChanges ? 'Unsaved changes — click Save DTR' : 'All changes synced'}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 z-20 bg-emerald-900 text-white">
                        <tr>
                          <th className="sticky left-0 z-30 bg-emerald-950 px-3 py-2 text-left font-bold border-r border-emerald-800 whitespace-nowrap">
                            Day
                          </th>
                          <th className="px-2 py-2 text-center font-bold border-r border-emerald-800 whitespace-nowrap bg-emerald-950/90 text-amber-300">
                            Day Hrs
                          </th>
                          {DTR_CATEGORIES.map((cat) => (
                            <th
                              key={cat.key}
                              title={`${cat.fullName} (${cat.multiplier}× hourly)`}
                              className="px-2 py-2 text-center font-bold border-r border-emerald-800 whitespace-nowrap min-w-[70px]"
                            >
                              <div>{cat.label}</div>
                              <div className="text-[9px] font-mono text-emerald-300 font-normal">
                                {cat.multiplier}×
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900">
                        {DAYS_31.map((day) => {
                          const dayRow = activeEmployee.months?.[selectedMonth]?.[day] || {};
                          const dayTotal = payrollCalc.dayTotals[day] || 0;
                          return (
                            <tr
                              key={day}
                              className="hover:bg-emerald-50/70 dark:hover:bg-emerald-900/30"
                            >
                              <td className="sticky left-0 z-10 bg-emerald-50 dark:bg-emerald-950 px-3 py-1.5 font-mono font-bold text-emerald-950 dark:text-emerald-100 border-r border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                Day {day}
                              </td>
                              <td className="px-2 py-1.5 text-center font-mono font-bold text-emerald-800 dark:text-amber-300 bg-emerald-50/50 dark:bg-emerald-900/30 border-r border-emerald-200 dark:border-emerald-800 tabular-nums">
                                {dayTotal > 0 ? dayTotal.toFixed(1) : '—'}
                              </td>
                              {DTR_CATEGORIES.map((cat) => {
                                const val = dayRow[cat.key];
                                return (
                                  <td
                                    key={cat.key}
                                    className="p-1 border-r border-emerald-100 dark:border-emerald-900/70"
                                  >
                                    <input
                                      type="number"
                                      inputMode="decimal"
                                      min={0}
                                      max={24}
                                      step="0.5"
                                      value={val === undefined || val === 0 ? '' : val}
                                      onChange={(e) => handleHourCellChange(day, cat.key, e.target.value)}
                                      placeholder="0"
                                      className="w-14 px-1.5 py-1 rounded-md bg-transparent focus:bg-emerald-100 dark:focus:bg-emerald-800 text-center font-mono tabular-nums text-emerald-950 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#FF5A1F]"
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-20 bg-emerald-950 text-white font-mono">
                        <tr className="border-t-2 border-amber-400">
                          <td className="sticky left-0 z-30 bg-emerald-950 px-3 py-2 font-bold border-r border-emerald-800 whitespace-nowrap">
                            TOTAL HRS
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-amber-300 border-r border-emerald-800 tabular-nums">
                            {payrollCalc.totalManhours.toFixed(1)}
                          </td>
                          {DTR_CATEGORIES.map((cat) => (
                            <td
                              key={cat.key}
                              className="px-2 py-2 text-center font-bold text-emerald-300 border-r border-emerald-800 tabular-nums"
                            >
                              {(payrollCalc.categoryHours[cat.key] || 0).toFixed(1)}
                            </td>
                          ))}
                        </tr>
                        <tr className="bg-emerald-900">
                          <td className="sticky left-0 z-30 bg-emerald-900 px-3 py-2 font-bold border-r border-emerald-800 whitespace-nowrap">
                            TOTAL ₱
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-amber-300 border-r border-emerald-800 tabular-nums whitespace-nowrap">
                            {formatPhp(payrollCalc.grossWagePhp)}
                          </td>
                          {DTR_CATEGORIES.map((cat) => (
                            <td
                              key={cat.key}
                              className="px-2 py-2 text-center font-bold text-amber-300 border-r border-emerald-800 tabular-nums whitespace-nowrap"
                            >
                              ₱{(payrollCalc.categoryPay[cat.key] || 0).toFixed(0)}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Category Breakdown Table */}
                <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
                  <div className="text-xs font-extrabold text-emerald-950 dark:text-white">
                    Category Wage Summary (Caraga Rate · Non-Zero &amp; Key Categories)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {DTR_CATEGORIES.filter(
                      (c) => (payrollCalc.categoryHours[c.key] || 0) > 0 || ['RH', 'OT', 'ND', 'RHD', 'RD'].includes(c.key)
                    ).map((cat) => (
                      <div
                        key={cat.key}
                        className="rounded-xl bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200/70 dark:border-emerald-800 p-2.5 text-xs"
                      >
                        <div className="font-bold text-emerald-950 dark:text-white">{cat.label}</div>
                        <div className="text-[10px] text-emerald-700 dark:text-emerald-300 truncate">{cat.fullName}</div>
                        <div className="font-mono text-xs font-extrabold text-emerald-800 dark:text-emerald-200 mt-1 tabular-nums">
                          {(payrollCalc.categoryHours[cat.key] || 0).toFixed(2)} hrs ·{' '}
                          <span className="text-[#FF5A1F] dark:text-amber-300">
                            {formatPhp(payrollCalc.categoryPay[cat.key] || 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Alphabetical All-Employees Payroll Summary */}
                {allEmployeesSummary.length > 0 && (
                  <div className="rounded-2xl bg-white dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-extrabold text-emerald-950 dark:text-white">
                        Alphabetical Monthly Payroll Summary ({selectedMonth})
                      </div>
                      <div className="text-xs font-mono font-black text-emerald-900 dark:text-amber-300">
                        Total Payroll: {formatPhp(totalCompanyPayrollPhp)}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-emerald-200 dark:border-emerald-800 text-left text-[11px] text-emerald-700 dark:text-emerald-300">
                            <th className="py-1.5 pr-3">Employee (A–Z)</th>
                            <th className="py-1.5 px-2">Date Hired</th>
                            <th className="py-1.5 px-2 text-right">Daily Rate</th>
                            <th className="py-1.5 px-2 text-right">RH Hrs</th>
                            <th className="py-1.5 px-2 text-right">OT Hrs</th>
                            <th className="py-1.5 px-2 text-right">Total Hrs</th>
                            <th className="py-1.5 pl-2 text-right">Gross Wage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100 dark:divide-emerald-900">
                          {allEmployeesSummary.map((row) => (
                            <tr
                              key={row.emp.id}
                              onClick={() => setSelectedEmpId(row.emp.id)}
                              className={`cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/40 ${
                                activeEmployee?.id === row.emp.id ? 'bg-emerald-50/90 dark:bg-emerald-900/50 font-bold' : ''
                              }`}
                            >
                              <td className="py-1.5 pr-3 text-emerald-950 dark:text-white">{row.emp.completeName}</td>
                              <td className="py-1.5 px-2 font-mono text-emerald-700 dark:text-emerald-300">{row.emp.dateHired}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{formatPhp(row.emp.dailyRate)}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{row.rhHours.toFixed(1)}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{row.otHours.toFixed(1)}</td>
                              <td className="py-1.5 px-2 text-right font-mono">{row.totalManhours.toFixed(1)}</td>
                              <td className="py-1.5 pl-2 text-right font-mono font-bold text-[#FF5A1F] dark:text-amber-300">
                                {formatPhp(row.grossWagePhp)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* TYPED "CONFIRM ERASE" SAFETY MODAL */}
      {eraseTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setEraseTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-emerald-950 border border-rose-400 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-extrabold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Confirm Erase Protection</span>
              </div>
              <button type="button" onClick={() => setEraseTarget(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              {eraseTarget.kind === 'clear_month'
                ? `You are about to erase all ${selectedMonth} manhour entries for ${eraseTarget.empName}.`
                : `You are about to permanently remove ${eraseTarget.empName} and their DTR sheets.`}{' '}
              To prevent accidental data loss, type <strong className="font-mono text-rose-600 dark:text-rose-400">confirm erase</strong> below:
            </p>
            <input
              type="text"
              value={eraseConfirmInput}
              onChange={(e) => setEraseConfirmInput(e.target.value)}
              placeholder='Type "confirm erase"'
              className="w-full px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/60 border border-rose-300 dark:border-rose-700 text-xs font-mono text-emerald-950 dark:text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEraseTarget(null)}
                className="px-4 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-xs font-bold text-emerald-900 dark:text-emerald-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={eraseConfirmInput.trim().toLowerCase() !== 'confirm erase'}
                onClick={handleConfirmErase}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold disabled:opacity-40"
              >
                Confirm Erase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
