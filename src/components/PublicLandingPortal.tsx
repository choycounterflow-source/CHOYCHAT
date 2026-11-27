import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Menu,
  Moon,
  Phone,
  ShieldCheck,
  Store,
  Sun,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  CustomerRegistrationForm,
  type CustomerRegistrationPayload,
} from './CustomerRegistrationForm';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

export interface PublicBlogPost {
  id: string;
  slug: string;
  title: string;
  category: 'Delivery Tips' | 'Restaurant Spotlight' | 'Rider Stories' | 'Safety & Privacy';
  excerpt: string;
  content: string;
  author: string;
  coverImage: string;
  readTimeMinutes: number;
  publishedAt: string;
}

export interface FeaturedFoodDish {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  sellerName: string;
  stock: number;
}

const FALLBACK_FEATURED_FOOD: FeaturedFoodDish[] = [
  {
    id: 'dish-inasal-combo',
    title: 'Charcoal Chicken Inasal & Garlic Rice',
    description: 'Smoky marinated quarter chicken grilled to order, served hot with garlic rice, chicken oil, and spiced vinegar.',
    price: 165,
    imageUrl: '/assets/images/hero_local_food_delivery_1795763680017.jpg',
    sellerName: 'Choy Chat Grill Kitchen',
    stock: 24,
  },
  {
    id: 'dish-crispy-sisig',
    title: 'Sizzling Crispy Pork Sisig Platter',
    description: 'Golden chopped pork belly tossed with calamansi, red onions, and chili, packed in a vented kraft box to stay crisp.',
    price: 210,
    imageUrl: '/assets/images/blog_packaging_tips_1795763682155.jpg',
    sellerName: 'Neighborhood Ulam House',
    stock: 18,
  },
  {
    id: 'dish-batchoy-special',
    title: 'Special La Paz Beef Batchoy Bowl',
    description: 'Rich slow-simmered broth packed separately from fresh miki noodles, chicharon bits, and toasted garlic.',
    price: 145,
    imageUrl: '/assets/images/blog_restaurant_kitchen_1795763680437.jpg',
    sellerName: 'Tita Nena Noodle Bar',
    stock: 30,
  },
  {
    id: 'dish-barkada-bilao',
    title: 'Choy Chat Barkada Pancit & Lumpia Bilao',
    description: 'Family-sized stir-fried pancit canton-bihon paired with 20 crispy pork lumpia shanghai—perfect for group chat orders.',
    price: 540,
    imageUrl: '/assets/images/blog_packaging_tips_1795763682155.jpg',
    sellerName: 'Kusina Lokal on Choy Chat',
    stock: 10,
  },
];

const FALLBACK_PUBLIC_ARTICLES: PublicBlogPost[] = [
  {
    id: 'blog_1',
    slug: 'welcome-to-choy-chat-message-loved-ones-video-call-and-order-foodplay',
    title: 'Welcome to Choy Chat: Message Loved Ones, HD Video Call, and Order in FoodPlay Directly When Hungry',
    category: 'Restaurant Spotlight',
    excerpt:
      'Choy Chat is your all-in-one community app where you message your loved ones, enjoy crystal-clear video calls, and order delicious meals directly in FoodPlay when you are hungry.',
    content:
      'Choy Chat was created to bring everyone closer together. Here, you can message your loved ones instantly, catch up face-to-face with HD video calls, share special moments on your newsfeed, and stay connected all day long.\n\nAnd when hunger strikes while chatting or working, you never have to leave the app! You can order in FoodPlay (Choy Chat Food Store) directly—selecting your favorite local comfort foods, sizzling dishes, and refreshing drinks for instant delivery straight to your doorstep.\n\nEverything you love is now in one seamless app: chat, video calls, group conversations, and direct food delivery with FoodPlay.',
    author: 'Choy Chat Editorial Team',
    coverImage: '/assets/images/hero_local_food_delivery_1795763680017.jpg',
    readTimeMinutes: 4,
    publishedAt: '2026-11-26T08:00:00.000Z',
  },
  {
    id: 'blog_2',
    slug: 'video-calls-and-food-delivery-on-choy-chat',
    title: 'Catch Up Over HD Video Call on Choy Chat, Then Order in FoodPlay When You Hunger',
    category: 'Delivery Tips',
    excerpt:
      'Connect face-to-face with friends and family using Choy Chat video calls, and when everyone gets hungry, order straight from FoodPlay together.',
    content:
      'Nothing beats seeing your loved ones smile across the screen. With Choy Chat’s built-in HD video calling, you can share stories, laugh together, and plan your day in real-time.\n\nWhen your conversation gets long and hunger kicks in, you can order in FoodPlay directly without switching apps. Browse local kitchens, pick your favorite meals, and enjoy hot food delivered while your chat continues.\n\nChoy Chat and FoodPlay make connecting with family and satisfying your cravings effortless.',
    author: 'Choy Chat Food Desk',
    coverImage: '/assets/images/blog_restaurant_kitchen_1795763680437.jpg',
    readTimeMinutes: 5,
    publishedAt: '2026-11-25T09:30:00.000Z',
  },
  {
    id: 'blog_3',
    slug: 'group-chats-and-foodplay-ordering-for-barkada',
    title: 'Group Chats, Video Calls, and Direct FoodPlay Ordering for the Whole Barkada',
    category: 'Restaurant Spotlight',
    excerpt:
      'Coordinate hangouts in Choy Chat group chats, start a video call, and order in FoodPlay directly when everyone is hungry.',
    content:
      'Planning a barkada get-together or family feast is easy with Choy Chat. Set up group chats, chat with everyone at once, or jump into a group video call.\n\nWhen the group gets hungry during your chat, you can order in FoodPlay directly from your favorite local kitchens. No need to argue about where to order or switch between different apps.\n\nFrom chatting and video calling to direct food delivery with FoodPlay, Choy Chat handles all your daily needs in one place.',
    author: 'Choy Chat Community Team',
    coverImage: '/assets/images/blog_packaging_tips_1795763682155.jpg',
    readTimeMinutes: 4,
    publishedAt: '2026-11-24T11:00:00.000Z',
  },
  {
    id: 'blog_4',
    slug: 'meet-the-riders-bringing-foodplay-meals-fast',
    title: 'Fast Delivery from FoodPlay While You Chat with Loved Ones on Choy Chat',
    category: 'Rider Stories',
    excerpt:
      'Our dedicated riders bring your FoodPlay orders fast while you enjoy messaging and video calling your loved ones on Choy Chat.',
    content:
      'While you are busy messaging your loved ones or catching up on video calls, our trusted delivery riders are making sure your FoodPlay orders arrive hot and fresh.\n\nWith verified accounts, secure chats, and insulated thermal boxes, Choy Chat and FoodPlay ensure every meal gets to your table safely and quickly.\n\nStay connected, chat all day, and order in FoodPlay whenever hunger strikes.',
    author: 'Choy Chat Rider Community',
    coverImage: '/assets/images/blog_delivery_rider_1795763682277.jpg',
    readTimeMinutes: 4,
    publishedAt: '2026-11-22T10:15:00.000Z',
  },
  {
    id: 'blog_5',
    slug: 'tips-for-smooth-choy-chat-experience-and-foodplay-ordering',
    title: 'Top Tips for Messaging Loved Ones and Ordering in FoodPlay on Choy Chat',
    category: 'Delivery Tips',
    excerpt:
      'Make the most of Choy Chat messaging, video calls, and direct FoodPlay food ordering with these simple tips.',
    content:
      'Get the best experience on Choy Chat by keeping your app updated. Send photos, voice notes, and make smooth video calls to your loved ones anytime.\n\nWhen you hunger during long conversations, tap over to FoodPlay to order fresh meals instantly with Choy Wallet cashless checkout.\n\nChat, call, and eat—all in one place with Choy Chat and FoodPlay.',
    author: 'Choy Chat Support',
    coverImage: '/assets/images/blog_packaging_tips_1795763682155.jpg',
    readTimeMinutes: 3,
    publishedAt: '2026-11-20T08:00:00.000Z',
  },
  {
    id: 'blog_6',
    slug: 'safe-messaging-and-secure-foodplay-ordering-on-choy-chat',
    title: 'Safe Messaging, Video Calls, and Secure FoodPlay Ordering on Choy Chat',
    category: 'Safety & Privacy',
    excerpt:
      'Enjoy secure messaging, private video calls, and safe FoodPlay food ordering backed by Choy Chat privacy protection.',
    content:
      'Your privacy and security matter. Choy Chat protects your conversations, video calls, and personal details while letting you interact freely with friends and family.\n\nWhen you order in FoodPlay directly, your payments and delivery details are secure, and your legal real name is safely protected in our encrypted vault.\n\nMessage your loved ones, enjoy video calls, and order in FoodPlay with complete peace of mind on Choy Chat.',
    author: 'Choy Chat Trust & Safety',
    coverImage: '/assets/images/hero_local_food_delivery_1795763680017.jpg',
    readTimeMinutes: 3,
    publishedAt: '2026-11-18T14:00:00.000Z',
  },
];

type PublicPageId = 'home' | 'blog' | 'about' | 'contact' | 'privacy' | 'auth';

interface PublicLandingPortalProps {
  resolvedTheme: 'light' | 'dark';
  toggleLightDark: () => void;
  needsAdminSetup: boolean;
  storageMode: 'postgres' | 'memory';
  storageStatus: string;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  authName: string;
  setAuthName: (val: string) => void;
  authPhone: string;
  setAuthPhone: (val: string) => void;
  authPin: string;
  setAuthPin: (val: string) => void;
  showAuthPin: boolean;
  setShowAuthPin: React.Dispatch<React.SetStateAction<boolean>>;
  authSubmitting: boolean;
  loginError: string;
  setLoginError: (val: string) => void;
  onLoginSubmit: (e: React.FormEvent) => Promise<void>;
  onFirstRunAdminSubmit: (e: React.FormEvent) => Promise<void>;
  onCustomerRegisterSubmit: (payload: CustomerRegistrationPayload) => Promise<void>;
}

export const PublicLandingPortal: React.FC<PublicLandingPortalProps> = ({
  resolvedTheme,
  toggleLightDark,
  needsAdminSetup,
  storageMode,
  storageStatus,
  authMode,
  setAuthMode,
  authName,
  setAuthName,
  authPhone,
  setAuthPhone,
  authPin,
  setAuthPin,
  showAuthPin,
  setShowAuthPin,
  authSubmitting,
  loginError,
  setLoginError,
  onLoginSubmit,
  onFirstRunAdminSubmit,
  onCustomerRegisterSubmit,
}) => {
  const [page, setPage] = useState<PublicPageId>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [articles, setArticles] = useState<PublicBlogPost[]>(FALLBACK_PUBLIC_ARTICLES);
  const [featuredFood, setFeaturedFood] = useState<FeaturedFoodDish[]>(FALLBACK_FEATURED_FOOD);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedArticle, setSelectedArticle] = useState<PublicBlogPost | null>(null);

  // Contact form state
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactStatus, setContactStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    // Record public visit for Admin Visitor Counter
    fetch('/api/public/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ path: '/' }),
    }).catch(() => {});

    // Load dynamic blog articles + live featured Food Store dishes
    fetch('/api/public/blog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.posts) && data.posts.length > 0) {
          const normalized: PublicBlogPost[] = data.posts.map((p: Record<string, unknown>) => ({
            id: String(p.id || ''),
            slug: String(p.slug || ''),
            title: String(p.title || ''),
            category: (p.category as PublicBlogPost['category']) || 'Delivery Tips',
            excerpt: String(p.excerpt || ''),
            content: Array.isArray(p.content)
              ? p.content.map((para) => String(para || '').trim()).filter(Boolean).join('\n\n')
              : String(p.content || ''),
            author: String(p.author || 'Choy Chat Editorial Team'),
            coverImage: String(p.coverImage || '/assets/images/hero_local_food_delivery_1795763680017.jpg').replace(
              /^\/src\/assets\/images\//,
              '/assets/images/'
            ),
            readTimeMinutes: Number(p.readTimeMinutes ?? p.readTimeMin ?? 4) || 4,
            publishedAt: String(p.publishedAt || new Date().toISOString()),
          }));
          setArticles(normalized);
        }
        if (data && Array.isArray(data.featuredFood) && data.featuredFood.length > 0) {
          setFeaturedFood(data.featuredFood as FeaturedFoodDish[]);
        }
      })
      .catch(() => {});
  }, []);

  const categories = ['All', 'Delivery Tips', 'Restaurant Spotlight', 'Rider Stories', 'Safety & Privacy'];

  const filteredArticles = useMemo(() => {
    if (selectedCategory === 'All') return articles;
    return articles.filter((a) => a.category === selectedCategory);
  }, [articles, selectedCategory]);

  const navigateTo = (target: PublicPageId, authDefault?: 'login' | 'register') => {
    setPage(target);
    setSelectedArticle(null);
    setMobileNavOpen(false);
    if (authDefault) {
      setAuthMode(authDefault);
      setLoginError('');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openArticle = (article: PublicBlogPost) => {
    setSelectedArticle(article);
    setPage('blog');
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus(null);
    setContactSubmitting(true);
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          subject: contactSubject.trim(),
          message: contactMessage.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not send your message. Please check all fields.');
      }
      setContactStatus({
        type: 'ok',
        text: data.message || 'Thank you! Your inquiry has been received by the Choy Chat support team.',
      });
      setContactName('');
      setContactEmail('');
      setContactSubject('');
      setContactMessage('');
    } catch (err: unknown) {
      setContactStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to send message.',
      });
    } finally {
      setContactSubmitting(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'Nov 2026';
    }
  };

  return (
    <div
      className="min-h-screen bg-[#FAF9F6] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col"
      style={{ fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif" }}
    >
      {/* Semantic Header — Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 h-16 bg-[#FAF9F6]/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left: Single-element brand wordmark */}
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0"
          >
            <span className="w-8 h-8 rounded-lg bg-[#0D4F2B] text-white font-extrabold text-sm flex items-center justify-center">
              C
            </span>
            <span
              className="text-lg font-extrabold tracking-tight text-slate-950 dark:text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              Choy Chat
            </span>
          </button>

          {/* Center: 5 single-line nav links */}
          <nav aria-label="Primary Navigation" className="hidden md:flex items-center gap-6">
            {(
              [
                { id: 'home', label: 'Home' },
                { id: 'blog', label: 'Blog' },
                { id: 'about', label: 'About Us' },
                { id: 'contact', label: 'Contact Us' },
                { id: 'privacy', label: 'Privacy & Terms' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 transition ${
                  page === item.id
                    ? 'text-[#0D4F2B] dark:text-emerald-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right: 1 Primary CTA + Theme Toggle / Mobile Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleLightDark}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigateTo('auth', needsAdminSetup ? undefined : 'login')}
              className="px-4 py-2 rounded-lg bg-[#0D4F2B] hover:bg-[#0A3E22] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition"
            >
              {needsAdminSetup ? 'Admin Setup' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label="Toggle Menu"
              className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileNavOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="md:hidden bg-[#FAF9F6] dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-1 shadow-lg"
          >
            {(
              [
                { id: 'home', label: 'Home' },
                { id: 'blog', label: 'Blog & Community Stories' },
                { id: 'about', label: 'About Us' },
                { id: 'contact', label: 'Contact Us' },
                { id: 'privacy', label: 'Privacy Policy & Terms of Service' },
                { id: 'auth', label: needsAdminSetup ? 'First-Run Admin Setup' : 'Sign In / Register' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                  page === item.id
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#0D4F2B] dark:text-emerald-300 font-semibold'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Semantic Main Content */}
      <main className="flex-1">
        {/* ================================================================ */}
        {/* HOME PAGE                                                        */}
        {/* ================================================================ */}
        {page === 'home' && (
          <>
            {/* Editorial Hero Section */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-6 space-y-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#0D4F2B] dark:text-emerald-400">
                    Local Food Delivery · Neighborhood Marketplace · Private Messaging
                  </p>
                  <h1
                    className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-slate-950 dark:text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                  >
                    Fresh meals from local kitchens, delivered with privacy first.
                  </h1>
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                    Choy Chat connects households, independent neighborhood restaurants, and trusted local riders in one fast web app. Order with a public Display Name while your legal verification stays encrypted and admin-only.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => navigateTo('auth', 'register')}
                      className="px-6 py-3 rounded-xl bg-[#EA580C] hover:bg-[#DC4F08] text-white text-sm font-bold inline-flex items-center gap-2 transition"
                    >
                      <span>Create Customer Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTo('blog')}
                      className="px-6 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-900 dark:text-white text-sm font-semibold inline-flex items-center gap-2 transition"
                    >
                      <BookOpen className="w-4 h-4 text-[#0D4F2B] dark:text-emerald-400" />
                      <span>Read Delivery Guides</span>
                    </button>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-3 gap-4 max-w-md">
                    <div>
                      <div className="text-xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums">
                        100%
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Private ID Vault</div>
                    </div>
                    <div>
                      <div className="text-xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums">
                        AES-256
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Encrypted Legal Names</div>
                    </div>
                    <div>
                      <div className="text-xl font-extrabold text-slate-950 dark:text-white font-mono tabular-nums">
                        {articles.length}+
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Local Food Guides</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <figure className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 shadow-sm">
                    <img
                      src="/assets/images/hero_local_food_delivery_1795763680017.jpg"
                      alt="Fresh local street food counter and delivery bags ready for neighborhood dispatch"
                      referrerPolicy="no-referrer"
                      className="w-full aspect-video object-cover"
                    />
                  </figure>
                </div>
              </div>
            </section>

            {/* Three Core Platform Pillars */}
            <section
              aria-labelledby="pillars-heading"
              className="bg-white dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800 py-14"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
                <div className="max-w-2xl space-y-2">
                  <h2
                    id="pillars-heading"
                    className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                  >
                    Built for everyday neighborhood ordering and community trust
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                    Every workflow in Choy Chat is engineered to keep local kitchens busy, riders supported, and customer identity data strictly protected.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="rounded-2xl bg-[#FAF9F6] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                    <Lock className="w-6 h-6 text-[#0D4F2B] dark:text-emerald-400" />
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                      Private ID &amp; Display Name Shield
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Restaurants and delivery riders only see your chosen Display Name. Your Valid ID and real profile photo are stored in a private bucket accessible solely by authorized administrators for fraud prevention.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#FAF9F6] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                    <Store className="w-6 h-6 text-[#EA580C]" />
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                      Independent Neighborhood Kitchens
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Order home-cooked dishes, grilled favorites, snacks, and local marketplace goods with transparent delivery fees and real-time order confirmation.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#FAF9F6] dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                    <Truck className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                    <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                      Community Riders &amp; Direct Chat
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      Coordinate gate landmarks, cashless wallet payments, and delivery timing directly in-app with community riders who know your streets.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Public SEO Blog & Featured Food Section on Homepage */}
            <section
              aria-labelledby="home-blog-heading"
              className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C]">
                    Choy Chat &amp; Food Journal
                  </p>
                  <h2
                    id="home-blog-heading"
                    className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                  >
                    Choy Chat Highlights, Must-Try Local Food &amp; Rider Stories
                  </h2>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">
                    Explore how Choy Chat connects neighborhood messaging with freshly cooked food delivery, featured local dishes, and community riders.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo('blog')}
                  className="text-sm font-semibold text-[#0D4F2B] dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  <span>Browse all {articles.length} articles</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Lead Choy Chat + Food Spotlight Article */}
              {articles[0] && (
                <article className="rounded-3xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 shadow-xs">
                  <button
                    type="button"
                    onClick={() => openArticle(articles[0])}
                    className="lg:col-span-6 block w-full overflow-hidden bg-slate-100 dark:bg-slate-800 text-left"
                  >
                    <img
                      src={articles[0].coverImage}
                      alt={articles[0].title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full min-h-[240px] aspect-[16/10] lg:aspect-auto object-cover hover:scale-[1.02] transition duration-300"
                    />
                  </button>
                  <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between space-y-5">
                    <div className="space-y-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-[#EA580C]">Choy Chat Spotlight</span>
                        <span className="mx-1.5">·</span>
                        <span className="font-semibold text-[#0D4F2B] dark:text-emerald-400">
                          {articles[0].category}
                        </span>
                        <span className="mx-1.5">·</span>
                        <time dateTime={articles[0].publishedAt}>{formatDate(articles[0].publishedAt)}</time>
                        <span className="mx-1.5">·</span>
                        <span>{articles[0].readTimeMinutes} min read</span>
                      </div>
                      <h3
                        className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-tight"
                        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                      >
                        <button
                          type="button"
                          onClick={() => openArticle(articles[0])}
                          className="text-left hover:text-[#0D4F2B] dark:hover:text-emerald-400 transition"
                        >
                          {articles[0].title}
                        </button>
                      </h3>
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                        {articles[0].excerpt}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => openArticle(articles[0])}
                        className="px-5 py-2.5 rounded-xl bg-[#0D4F2B] hover:bg-[#0A3E22] text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
                      >
                        <span>Read Choy Chat Feature</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateTo('auth', 'register')}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-slate-400 text-slate-800 dark:text-slate-200 text-xs font-semibold transition"
                      >
                        Order Food on Choy Chat
                      </button>
                    </div>
                  </div>
                </article>
              )}

              {/* Featured Food Showcase Strip */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3
                      className="text-xl font-bold text-slate-950 dark:text-white"
                      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                    >
                      Featured Food on Choy Chat
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                      Freshly cooked favorites available inside the Choy Chat Food Store after sign-in.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateTo('auth', 'register')}
                    className="text-xs font-semibold text-[#EA580C] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open Food Store</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {featuredFood.slice(0, 4).map((dish) => (
                    <article
                      key={dish.id}
                      className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col"
                    >
                      <img
                        src={dish.imageUrl}
                        alt={dish.title}
                        referrerPolicy="no-referrer"
                        className="w-full aspect-[4/3] object-cover bg-slate-100 dark:bg-slate-800"
                      />
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                            {dish.sellerName}
                          </div>
                          <h4 className="text-sm font-bold text-slate-950 dark:text-white leading-snug">
                            {dish.title}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                            {dish.description}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-sm font-extrabold text-[#0D4F2B] dark:text-emerald-400 font-mono tabular-nums">
                            ₱{Number(dish.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigateTo('auth', 'login')}
                            className="text-xs font-semibold text-[#EA580C] hover:underline"
                          >
                            Order now
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {/* Remaining Choy Chat & Food Blog Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.slice(1, 7).map((post) => (
                  <article
                    key={post.id}
                    className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <button
                      type="button"
                      onClick={() => openArticle(post)}
                      className="block w-full overflow-hidden bg-slate-100 dark:bg-slate-800 text-left"
                    >
                      <img
                        src={post.coverImage}
                        alt={post.title}
                        referrerPolicy="no-referrer"
                        className="w-full aspect-[4/3] object-cover hover:scale-[1.02] transition duration-300"
                      />
                    </button>
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-[#0D4F2B] dark:text-emerald-400">
                            {post.category}
                          </span>
                          <span className="mx-1.5">·</span>
                          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                          <span className="mx-1.5">·</span>
                          <span>{post.readTimeMinutes} min read</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-950 dark:text-white leading-snug">
                          <button
                            type="button"
                            onClick={() => openArticle(post)}
                            className="text-left hover:text-[#0D4F2B] dark:hover:text-emerald-400 transition"
                          >
                            {post.title}
                          </button>
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                          {post.excerpt}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openArticle(post)}
                        className="text-xs font-semibold text-[#0D4F2B] dark:text-emerald-400 inline-flex items-center gap-1 hover:underline"
                      >
                        <span>Read full article</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* Bottom Call to Action */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
              <div className="rounded-3xl bg-[#0D4F2B] text-white p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <h2
                    className="text-2xl sm:text-3xl font-bold tracking-tight"
                    style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                  >
                    Ready to order from your neighborhood favorites?
                  </h2>
                  <p className="text-sm sm:text-base text-emerald-100 leading-relaxed">
                    Create your privacy-protected customer account in under two minutes with a public Display Name, optional OTP-ready cellphone setup, and admin-only encrypted ID verification.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigateTo('auth', 'register')}
                    className="px-6 py-3 rounded-xl bg-white text-[#0D4F2B] hover:bg-emerald-50 font-bold text-sm transition"
                  >
                    Register Now
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateTo('auth', 'login')}
                    className="px-6 py-3 rounded-xl bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-400/40 text-white font-semibold text-sm transition"
                  >
                    Member Sign In
                  </button>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ================================================================ */}
        {/* BLOG LISTING & ARTICLE READER                                    */}
        {/* ================================================================ */}
        {page === 'blog' && (
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
            {selectedArticle ? (
              <article className="space-y-6">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4F2B] dark:text-emerald-400 hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to all articles</span>
                </button>

                <header className="space-y-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-[#0D4F2B] dark:text-emerald-400">
                      {selectedArticle.category}
                    </span>
                    <span className="mx-2">·</span>
                    <time dateTime={selectedArticle.publishedAt}>
                      {formatDate(selectedArticle.publishedAt)}
                    </time>
                    <span className="mx-2">·</span>
                    <span>{selectedArticle.readTimeMinutes} min read</span>
                    <span className="mx-2">·</span>
                    <span>By {selectedArticle.author}</span>
                  </div>
                  <h1
                    className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-tight"
                    style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                  >
                    {selectedArticle.title}
                  </h1>
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    {selectedArticle.excerpt}
                  </p>
                </header>

                <figure className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
                  <img
                    src={selectedArticle.coverImage}
                    alt={selectedArticle.title}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-[440px] object-cover"
                  />
                </figure>

                <div className="space-y-5 text-base leading-8 text-slate-800 dark:text-slate-200 max-w-3xl">
                  {selectedArticle.content.split(/\n\n+/).map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>

                <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Want to explore verified local kitchens in your neighborhood?
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateTo('auth', 'register')}
                    className="px-5 py-2.5 rounded-xl bg-[#0D4F2B] hover:bg-[#0A3E22] text-white text-sm font-semibold transition"
                  >
                    Join Choy Chat Free
                  </button>
                </div>
              </article>
            ) : (
              <>
                <header className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#EA580C]">
                    Choy Chat &amp; Local Food Journal
                  </p>
                  <h1
                    className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white"
                    style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                  >
                    Choy Chat Highlights, Fresh Local Food &amp; Community Delivery Stories
                  </h1>
                  <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl">
                    Discover how Choy Chat unites local messaging, group food ordering, neighborhood comfort dishes, and trusted community riders in one platform.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                          selectedCategory === cat
                            ? 'bg-[#0D4F2B] text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </header>

                {/* Choy Chat Food Highlights inside the Blog Page */}
                <section aria-labelledby="blog-food-menu-heading" className="space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2
                        id="blog-food-menu-heading"
                        className="text-xl font-bold text-slate-950 dark:text-white"
                        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                      >
                        Featured Food to Order on Choy Chat
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        Taste what local partner kitchens are cooking today inside the Choy Chat Food Store.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateTo('auth', 'register')}
                      className="text-xs font-semibold text-[#EA580C] hover:underline inline-flex items-center gap-1"
                    >
                      <span>Create Account to Order</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {featuredFood.slice(0, 4).map((dish) => (
                      <article
                        key={dish.id}
                        className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col"
                      >
                        <img
                          src={dish.imageUrl}
                          alt={dish.title}
                          referrerPolicy="no-referrer"
                          className="w-full aspect-[4/3] object-cover bg-slate-100 dark:bg-slate-800"
                        />
                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                          <div className="space-y-1">
                            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
                              {dish.sellerName}
                            </div>
                            <h3 className="text-sm font-bold text-slate-950 dark:text-white leading-snug">
                              {dish.title}
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {dish.description}
                            </p>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span className="text-sm font-extrabold text-[#0D4F2B] dark:text-emerald-400 font-mono tabular-nums">
                              ₱{Number(dish.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigateTo('auth', 'login')}
                              className="text-xs font-semibold text-[#EA580C] hover:underline"
                            >
                              Order
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredArticles.map((post) => (
                    <article
                      key={post.id}
                      className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col"
                    >
                      <button
                        type="button"
                        onClick={() => openArticle(post)}
                        className="block w-full overflow-hidden bg-slate-100 dark:bg-slate-800 text-left"
                      >
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          referrerPolicy="no-referrer"
                          className="w-full aspect-[4/3] object-cover"
                        />
                      </button>
                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-[#0D4F2B] dark:text-emerald-400">
                              {post.category}
                            </span>
                            <span>·</span>
                            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {post.readTimeMinutes} min
                            </span>
                          </div>
                          <h2 className="text-xl font-bold text-slate-950 dark:text-white leading-snug">
                            <button
                              type="button"
                              onClick={() => openArticle(post)}
                              className="text-left hover:text-[#0D4F2B] dark:hover:text-emerald-400 transition"
                            >
                              {post.title}
                            </button>
                          </h2>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            {post.excerpt}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openArticle(post)}
                          className="text-xs font-semibold text-[#0D4F2B] dark:text-emerald-400 inline-flex items-center gap-1 hover:underline"
                        >
                          <span>Read article</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ================================================================ */}
        {/* ABOUT US PAGE                                                    */}
        {/* ================================================================ */}
        {page === 'about' && (
          <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
            <header className="space-y-3 border-b border-slate-200 dark:border-slate-800 pb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0D4F2B] dark:text-emerald-400">
                About Choy Chat
              </p>
              <h1
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white"
                style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
              >
                Connecting local diners, neighborhood kitchens, and trusted riders safely.
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Choy Chat started with a simple goal: give local communities a dependable food ordering, marketplace, and group messaging platform that respects customer privacy and champions independent kitchens.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <article className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">Our Mission</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  We empower small family restaurants, local food stalls, and community riders with modern mobile-first ordering tools, transparent delivery fees, and reliable digital wallets—without hiding them behind impersonal call centers.
                </p>
              </article>

              <article className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3">
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">Privacy by Architecture</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Fraud prevention should never compromise your public privacy. Every customer uses a chosen Display Name for orders and feeds, while verification IDs and real names are encrypted at rest inside an Admin-only vault.
                </p>
              </article>
            </div>

            <article className="rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2">
              <img
                src="/assets/images/blog_restaurant_kitchen_1795763680437.jpg"
                alt="Local chef preparing fresh meals for community delivery"
                referrerPolicy="no-referrer"
                className="w-full h-full min-h-[240px] object-cover"
              />
              <div className="p-6 sm:p-8 flex flex-col justify-center space-y-3">
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                  Partnering with Local Kitchens &amp; Riders
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Are you a neighborhood restaurant owner or reliable delivery rider? Reach out via our Contact Us page to onboard your kitchen menu or join our local delivery fleet.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigateTo('contact')}
                    className="px-4 py-2.5 rounded-xl bg-[#0D4F2B] hover:bg-[#0A3E22] text-white text-xs font-semibold transition"
                  >
                    Contact Our Team
                  </button>
                </div>
              </div>
            </article>
          </section>
        )}

        {/* ================================================================ */}
        {/* CONTACT US PAGE                                                  */}
        {/* ================================================================ */}
        {page === 'contact' && (
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
            <header className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0D4F2B] dark:text-emerald-400">
                Contact Us
              </p>
              <h1
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white"
                style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
              >
                Get in touch with Choy Chat Support
              </h1>
              <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl">
                Questions about customer verification, restaurant onboarding, rider partnerships, or data privacy? Send us a message below.
              </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">Support Channels</h2>
                  <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-[#0D4F2B] dark:text-emerald-400 mt-1 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Email Support</div>
                        <div>support@choychat.local</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-[#0D4F2B] dark:text-emerald-400 mt-1 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Operations Hours</div>
                        <div>Monday – Sunday, 7:00 AM – 10:00 PM PHT</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-[#0D4F2B] dark:text-emerald-400 mt-1 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Service Area</div>
                        <div>Local Neighborhood Food Delivery &amp; Community Commerce Network</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7">
                <form
                  onSubmit={handleContactSubmit}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
                >
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">Send an Inquiry</h2>

                  {contactStatus && (
                    <div
                      className={`rounded-xl px-4 py-3 text-xs font-medium flex items-center gap-2 ${
                        contactStatus.type === 'ok'
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                          : 'bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{contactStatus.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Your Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Juan Dela Cruz"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email Address *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Topic
                    </label>
                    <input
                      id="contact-subject"
                      type="text"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      placeholder="Restaurant Partnership, Rider Application, or Account Support"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Message *
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={5}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="Tell us how we can help..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={contactSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[#0D4F2B] hover:bg-[#0A3E22] text-white text-sm font-semibold transition disabled:opacity-50"
                  >
                    {contactSubmitting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              </div>
            </div>
          </section>
        )}

        {/* ================================================================ */}
        {/* PRIVACY POLICY & TERMS OF SERVICE PAGE                           */}
        {/* ================================================================ */}
        {page === 'privacy' && (
          <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
            <header className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0D4F2B] dark:text-emerald-400">
                Legal &amp; Data Protection
              </p>
              <h1
                className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white"
                style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
              >
                Privacy Policy &amp; Terms of Service
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Effective Date: November 2026 · Choy Chat Local Food Delivery &amp; Community Commerce
              </p>
            </header>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                1. Private Storage of Valid IDs &amp; Real Profile Pictures
              </h2>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                When you register or verify your account for food ordering, any uploaded Valid ID and Real Profile Picture are stored inside a strictly PRIVATE storage bucket (<code>public = false</code>). Regular users, other customers, partner restaurants, and delivery riders have zero read or download access to these files. Only verified platform Administrators (<code>role = &apos;admin&apos;</code>) may access these records through authenticated server-side inspection strictly for fraud prevention and account safety.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                2. Separation of Public Display Name &amp; Encrypted Real Name
              </h2>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                Your chosen Display Name / Username is used across public feeds, chat rooms, restaurant order tickets, and delivery handoffs. Your legal Real Name is encrypted using AES-256-GCM at rest inside an Admin-only database column and is never shared publicly or disclosed to merchants and riders.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                3. Data Retention &amp; Automated Cleanup
              </h2>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                To minimize data retention and maintain lean server performance, Choy Chat routinely purges abandoned guest carts, expired session tokens and temporary cookies, and system error logs older than 30 days.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                4. Terms of Service &amp; Acceptable Use
              </h2>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                By creating an account on Choy Chat, you agree to provide accurate verification details when requested for ordering privileges, treat partner restaurants and delivery riders respectfully, honor confirmed food orders, and refrain from fraudulent disputes or unauthorized scraping. Accounts violating community safety standards may be suspended pending administrative review.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                5. Consent &amp; Contact for Privacy Requests
              </h2>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                You may request an update or deletion of your verification documents at any time by contacting our Privacy Team via the Contact Us page.
              </p>
            </section>
          </article>
        )}

        {/* ================================================================ */}
        {/* SIGN IN / CUSTOMER REGISTRATION / FIRST-RUN ADMIN SETUP          */}
        {/* ================================================================ */}
        {page === 'auth' && (
          <section className="max-w-lg mx-auto px-4 sm:px-6 py-10">
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-5">
              <div className="space-y-1.5 text-center">
                <h1
                  className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white"
                  style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
                >
                  {needsAdminSetup
                    ? 'First-Run Admin Setup'
                    : authMode === 'register'
                    ? 'Customer Registration'
                    : 'Sign In to Choy Chat'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {needsAdminSetup
                    ? 'Claim your primary Administrator account with your phone number and secret PIN.'
                    : authMode === 'register'
                    ? 'Use a public Display Name while keeping your Valid ID & Real Profile Photo private.'
                    : 'Enter your registered cellphone number and account PIN.'}
                </p>
              </div>

              {needsAdminSetup ? (
                <form onSubmit={onFirstRunAdminSubmit} className="space-y-4 text-xs">
                  {loginError && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200 text-center">
                      {loginError}
                    </div>
                  )}
                  {storageMode !== 'postgres' && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 leading-relaxed">
                      Storage status: {storageStatus}. Set <code>DATABASE_URL</code> in environment settings for permanent PostgreSQL persistence.
                    </div>
                  )}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admin Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Choy Admin"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admin Phone Number</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      placeholder="09XX XXX XXXX"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Create Admin PIN (min. 4 chars)</label>
                    <div className="relative">
                      <input
                        type={showAuthPin ? 'text' : 'password'}
                        required
                        minLength={4}
                        placeholder="Enter your secret PIN..."
                        value={authPin}
                        onChange={(e) => setAuthPin(e.target.value)}
                        className="w-full px-3.5 py-2.5 pr-10 bg-[#FAF9F6] dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAuthPin((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500"
                      >
                        {showAuthPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-3 rounded-xl bg-[#0D4F2B] hover:bg-[#0A3E22] text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{authSubmitting ? 'Setting up Admin...' : 'Claim Admin Account'}</span>
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200">
                    <span className="font-bold">Sign in by creating your account!</span> All profile information, real names, and verification details can be filled up inside your Profile section anytime.
                  </div>

                  <CustomerRegistrationForm
                    appName="Choy Chat"
                    submitting={authSubmitting}
                    errorMsg={loginError}
                    onSubmit={onCustomerRegisterSubmit}
                    onOpenPrivacyPolicy={() => navigateTo('privacy')}
                  />
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <PWAInstallButton fullWidth />
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Semantic Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div className="space-y-2.5">
            <div
              className="text-base font-extrabold text-slate-950 dark:text-white"
              style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            >
              Choy Chat
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Local food delivery, neighborhood marketplace, and privacy-first community messaging with admin-only encrypted ID protection.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Explore
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <button type="button" onClick={() => navigateTo('home')} className="hover:text-slate-950 dark:hover:text-white">
                  Home
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateTo('blog')} className="hover:text-slate-950 dark:hover:text-white">
                  Food &amp; Rider Blog
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateTo('about')} className="hover:text-slate-950 dark:hover:text-white">
                  About Us
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateTo('contact')} className="hover:text-slate-950 dark:hover:text-white">
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Trust &amp; Legal
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <li>
                <button type="button" onClick={() => navigateTo('privacy')} className="hover:text-slate-950 dark:hover:text-white">
                  Privacy Policy &amp; Terms of Service
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateTo('auth', 'register')} className="hover:text-slate-950 dark:hover:text-white">
                  Customer Registration
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigateTo('auth', 'login')} className="hover:text-slate-950 dark:hover:text-white">
                  Member &amp; Admin Sign In
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Install Web App
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Add Choy Chat to your home screen for quick ordering and notifications.
            </p>
            <div className="pt-1">
              <PWAInstallButton />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} Choy Chat. All rights reserved.
        </div>
      </footer>
      <OfflineIndicator />
    </div>
  );
};
