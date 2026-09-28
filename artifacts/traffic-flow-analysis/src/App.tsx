import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  FileSpreadsheet,
  Gauge,
  Info,
  LoaderCircle,
  Menu,
  Network,
  Search,
  Sparkles,
  Table2,
  Target,
  Upload,
  X,
} from 'lucide-react';
import {
  getGetAnalysisSummaryQueryKey,
  getGetModelResultsQueryKey,
  getGetRagSourcesQueryKey,
  useGetAnalysisSummary,
  useGetModelResults,
  useGetRagSources,
  useHealthCheck,
  useLoadDemoDataset,
  usePredictTraffic,
  useQueryRag,
  useTrainModels,
  useUploadDataset,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();
const rawClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const hasClerk = Boolean(
  rawClerkKey &&
  (rawClerkKey.startsWith('pk_test_') || rawClerkKey.startsWith('pk_live_')),
);
const clerkPubKey = hasClerk
  ? publishableKeyFromHost(window.location.hostname, rawClerkKey)
  : '';
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const formatNumber = (value: number | undefined) =>
  typeof value === 'number' ? new Intl.NumberFormat('en-US').format(value) : '—';

const formatPercent = (value: number | undefined) =>
  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';

const titleCase = (value: string) =>
  value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const errorText = (error: unknown) => {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'The service did not return a usable response. Try again.';
};

function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-foreground/10 ${className}`} />;
}

function SectionKicker({ icon: Icon, children }: { icon: typeof Activity; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
      <Icon size={13} strokeWidth={2.2} />
      <span>{children}</span>
    </div>
  );
}

function TrafficMark() {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className="h-[21px] w-[21px]" fill="none">
      <path d="M8 29C10.8 22.2 13.2 17.5 17.1 13.8C20.1 11 24 9.4 29 8" stroke="currentColor" strokeWidth="4.8" strokeLinecap="round" />
      <path d="M8 29C10.8 22.2 13.2 17.5 17.1 13.8C20.1 11 24 9.4 29 8" stroke="rgba(255,255,255,.62)" strokeWidth="1.2" strokeDasharray="3.2 3.2" strokeLinecap="round" />
      <path d="M6 11h8M6 7h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AuthLoading() {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="flex items-center gap-3 text-sm font-semibold text-foreground">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        Preparing your workspace
      </div>
    </div>
  );
}

function PublicLanding() {
  return (
    <div className="grain paper-grid min-h-[100dvh] bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-10">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar text-sidebar-primary-foreground shadow-lg">
            <TrafficMark />
          </span>
          <span>
            <span className="block text-sm font-extrabold tracking-tight">flow / lab</span>
            <span className="font-mono-ui mt-0.5 block text-[9px] uppercase tracking-[0.17em] text-muted-foreground">Traffic analytics</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="rounded-lg px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
          <Link href="/sign-up" className="rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5">Create account</Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-10 md:px-10 md:pb-24 md:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
        <div>
          <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
            <Activity size={13} />
            <span>Traffic flow analysis workspace</span>
          </div>
          <h1 className="max-w-3xl font-display text-6xl leading-[.93] tracking-[-.045em] md:text-8xl">
            Read the road
            <span className="block text-primary">before the model.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            Profile real traffic datasets, compare classification models, and turn predictions into explanations you can inspect. Built for careful academic inference.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-[0_12px_24px_hsl(164_38%_27%_/_0.18)] transition-transform hover:-translate-y-0.5">
              Start an analysis
              <ChevronRight size={16} />
            </Link>
            <Link href="/sign-in" className="rounded-lg border border-card-border bg-card px-5 py-3.5 text-sm font-bold text-foreground transition-colors hover:bg-secondary">I already have an account</Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-5 text-[11px] text-muted-foreground">
            {['CSV + XLSX profiling', 'Five model comparison', 'Grounded traffic sources'].map((item) => (
              <span key={item} className="flex items-center gap-2"><Check size={14} className="text-primary" />{item}</span>
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden rounded-[28px] border border-sidebar-border bg-sidebar p-7 text-sidebar-foreground shadow-[0_24px_80px_hsl(207_38%_17%_/_0.18)] md:p-10">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[28px] border-sidebar-primary/15" />
          <div className="absolute -bottom-20 -left-14 h-64 w-64 rounded-full border border-sidebar-primary/20" />
          <div className="relative">
            <div className="font-mono-ui text-[10px] uppercase tracking-[0.18em] text-sidebar-primary">01 / The workspace</div>
            <div className="mt-20 max-w-sm font-display text-4xl leading-tight md:text-5xl">From raw observations to defensible classification.</div>
            <div className="mt-10 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/70 p-4"><Database size={17} className="text-sidebar-primary" /><div className="mt-8 text-xs font-bold">Profile first</div><div className="mt-1 text-[11px] leading-4 text-sidebar-foreground/55">See the data before choosing a target.</div></div>
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/70 p-4"><BrainCircuit size={17} className="text-sidebar-primary" /><div className="mt-8 text-xs font-bold">Explain clearly</div><div className="mt-1 text-[11px] leading-4 text-sidebar-foreground/55">Keep model output and retrieved facts distinct.</div></div>
            </div>
          </div>
        </div>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-card-border px-6 py-5 text-[10px] text-muted-foreground md:flex-row md:items-center md:justify-between md:px-10">
        <span>Flow Lab · traffic analytics for careful inference</span>
        <span className="font-mono-ui">Machine learning + retrieval-grounded context</span>
      </footer>
    </div>
  );
}

function Panel({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-2xl border border-card-border bg-card shadow-[0_14px_40px_hsl(207_38%_17%_/_0.045)] ${className}`}>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: 'ready' | 'working' | 'quiet' | 'error' }) {
  const config = {
    ready: { label: 'API ready', color: 'bg-[#77b8a0]' },
    working: { label: 'Working', color: 'bg-[#e2a746] pulse-dot' },
    quiet: { label: 'Awaiting data', color: 'bg-foreground/25' },
    error: { label: 'Connection issue', color: 'bg-[#d66a58]' },
  }[status];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent px-3 py-1.5 text-[11px] font-semibold text-sidebar-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${config.color}`} />
      {config.label}
    </span>
  );
}

function AuthControls() {
  if (!hasClerk) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 font-mono-ui text-[10px] font-bold text-primary">
          Local Workspace
        </span>
      </div>
    );
  }
  return <ClerkAuthControls />;
}

function ClerkAuthControls() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded || !user) return null;
  const name = user.firstName || user.primaryEmailAddress?.emailAddress || 'Researcher';
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-[11px] font-bold text-foreground">{name}</div>
        <div className="font-mono-ui text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Signed in</div>
      </div>
      <button
        type="button"
        onClick={() => signOut({ redirectUrl: basePath || '/' })}
        className="rounded-lg border border-card-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}

function Sidebar({
  datasetName,
  isDemo,
  onLoadDemo,
  loadingDemo,
}: {
  datasetName?: string;
  isDemo?: boolean;
  onLoadDemo: () => void;
  loadingDemo: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = [
    { href: '#overview', icon: Activity, label: 'Overview' },
    { href: '#profile', icon: Table2, label: 'Dataset profile' },
    { href: '#models', icon: BarChart3, label: 'Model comparison' },
    { href: '#predict', icon: Target, label: 'Prediction' },
    { href: '#insights', icon: BrainCircuit, label: 'AI insights' },
    { href: '#history', icon: Clock3, label: 'Audit history' },
  ];
  return (
    <aside className="sidebar-shell md:sticky md:top-0 md:h-dvh md:w-[244px] md:shrink-0">
      <div className="flex items-center justify-between px-5 py-5 md:block md:px-6 md:py-7">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-[11px] bg-sidebar-primary text-sidebar-primary-foreground">
            <TrafficMark />
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-sidebar-primary" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight">flow / lab</div>
            <div className="font-mono-ui mt-0.5 text-[9px] uppercase tracking-[0.17em] text-sidebar-foreground/55">Traffic analytics</div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Toggle navigation"
          data-testid="button-toggle-navigation"
          className="rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar-accent md:hidden"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      <div className={`${mobileOpen ? 'block' : 'hidden'} px-4 pb-5 md:block md:px-4`}>
        <div className="mb-7 rounded-xl border border-sidebar-border bg-sidebar-accent/55 p-3.5">
          <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/55">
            <span>Active study</span>
            <span className="font-mono-ui text-sidebar-primary">{isDemo ? 'DEMO' : datasetName ? 'LIVE' : '—'}</span>
          </div>
          <div className="truncate text-sm font-semibold text-sidebar-foreground">{datasetName || 'No dataset loaded'}</div>
          <div className="mt-1 text-[11px] leading-4 text-sidebar-foreground/55">
            {datasetName ? 'Profile and models stay in this workspace.' : 'Load a demo or upload a CSV to begin.'}
          </div>
        </div>
        <nav aria-label="Workspace sections" className="space-y-1">
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/40">Workspace</div>
          {links.map(({ href, icon: Icon, label }) => (
            <a
              href={href}
              key={href}
              data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}
              onClick={() => setMobileOpen(false)}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[12px] font-semibold text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <Icon size={15} strokeWidth={1.8} className="text-sidebar-foreground/45 transition-colors group-hover:text-sidebar-primary" />
              {label}
              {label === 'Overview' && <ChevronRight size={14} className="ml-auto opacity-40" />}
            </a>
          ))}
        </nav>
        <div className="my-8 h-px bg-sidebar-border" />
        <button
          type="button"
          data-testid="button-load-demo-sidebar"
          onClick={onLoadDemo}
          disabled={loadingDemo}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold text-sidebar-foreground/68 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:cursor-wait disabled:opacity-50"
        >
          {loadingDemo ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} className="text-sidebar-primary" />}
          {loadingDemo ? 'Loading demo…' : 'Load demo dataset'}
        </button>
        <div className="mt-10 flex items-center gap-2 px-3 text-[10px] text-sidebar-foreground/38">
          <BookOpen size={13} />
          <span>For careful inference</span>
        </div>
      </div>
    </aside>
  );
}

function DataIntake({
  onFile,
  onDemo,
  loadingUpload,
  loadingDemo,
  error,
}: {
  onFile: (file: File) => void;
  onDemo: () => void;
  loadingUpload: boolean;
  loadingDemo: boolean;
  error?: unknown;
}) {
  return (
    <Panel className="overflow-hidden border-primary/20 bg-[#f4f2e9]">
      <div className="grid md:grid-cols-[1.1fr_.9fr]">
        <div className="border-b border-card-border p-6 md:border-b-0 md:border-r md:p-8">
          <SectionKicker icon={Upload}>Bring your own data</SectionKicker>
          <h2 className="max-w-md font-display text-3xl leading-[1.05] text-foreground md:text-[2.55rem]">Start with the road as it is.</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
             Upload a CSV or XLSX with traffic observations. Flow Lab profiles the columns first, so every modeling choice stays visible.
          </p>
          <label
            htmlFor="dataset-file"
            data-testid="button-upload-dataset"
            className="mt-6 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-primary/45 bg-card px-4 py-3.5 transition-colors hover:border-primary hover:bg-primary/[.04]"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {loadingUpload ? <LoaderCircle size={17} className="animate-spin" /> : <FileSpreadsheet size={17} />}
              </span>
              <span>
                <span className="block text-sm font-bold">{loadingUpload ? 'Reading your dataset…' : 'Choose a CSV or XLSX file'}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">Kaggle-style files · up to your API limit</span>
              </span>
            </span>
            <ChevronRight size={17} className="text-primary" />
            <input
              id="dataset-file"
              type="file"
               accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              data-testid="input-dataset-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onFile(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
          {error ? (
            <div data-testid="status-upload-error" className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{errorText(error)}</span>
            </div>
          ) : null}
        </div>
        <div className="relative flex flex-col justify-between overflow-hidden p-6 md:p-8">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border-[20px] border-accent/15" />
          <div className="absolute -bottom-20 -left-8 h-44 w-44 rounded-full border-[1px] border-primary/20" />
          <div>
            <SectionKicker icon={Sparkles}>No file? Use a known route</SectionKicker>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">Explore the full workspace with a small, traffic-focused demonstration dataset.</p>
          </div>
          <button
            type="button"
            data-testid="button-load-demo"
            onClick={onDemo}
            disabled={loadingDemo}
            className="relative mt-7 flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
          >
            {loadingDemo ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loadingDemo ? 'Preparing dataset…' : 'Load the demo dataset'}
          </button>
        </div>
      </div>
    </Panel>
  );
}

function Overview({
  profile,
  training,
  latestPrediction,
  loading,
}: {
  profile?: any;
  training?: any;
  latestPrediction?: any;
  loading: boolean;
}) {
  const stats = [
    { label: 'Rows observed', value: profile ? formatNumber(profile.rows) : '—', icon: Database },
    { label: 'Features', value: profile ? formatNumber(Math.max(0, profile.columns - 1)) : '—', icon: Network },
    { label: 'Best accuracy', value: training ? formatPercent(training.metrics?.[0]?.accuracy) : '—', icon: Gauge },
    { label: 'Latest confidence', value: latestPrediction ? formatPercent(latestPrediction.confidence) : '—', icon: Target },
  ];
  return (
    <div id="overview" className="rise-in-delay">
      <div className="mb-6 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div>
          <SectionKicker icon={Activity}>Traffic flow analysis workspace</SectionKicker>
          <h1 className="max-w-3xl font-display text-[2.9rem] leading-[.97] tracking-[-.03em] text-foreground sm:text-[4.1rem]">
            Read the road
            <br />
            <span className="text-primary">before the model.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[14px] leading-6 text-muted-foreground">
            A quiet place to move from raw observations to defensible traffic classifications. Profile what you have, train what you can explain, and keep the evidence close.
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-primary/20 bg-primary p-5 text-primary-foreground">
          <div className="flex items-start justify-between">
            <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-primary-foreground/60">Session note</div>
            <div className="h-2 w-2 rounded-full bg-sidebar-primary" />
          </div>
          <p className="mt-8 font-display text-[1.65rem] leading-[1.08]">“A model is only as useful as the question behind it.”</p>
          <div className="mt-5 flex items-center gap-2 text-[11px] text-primary-foreground/65">
            <span className="h-px w-6 bg-primary-foreground/40" /> Research workspace / 01
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }, index) => (
          <div key={label} data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`} className="interactive-card rounded-xl border border-card-border bg-card p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[11px] font-semibold">{label}</span>
              <Icon size={15} className={index === 2 ? 'text-accent' : 'text-primary/65'} />
            </div>
            {loading ? <SkeletonLine className="mt-3 h-8 w-20" /> : <div className="mt-2 font-mono-ui text-2xl font-medium tracking-tight text-foreground">{value}</div>}
            <div className="mt-2 text-[10px] text-muted-foreground/70">{index === 0 ? 'from active dataset' : index === 1 ? 'candidate predictors' : index === 2 ? 'leading classifier' : 'on latest inference'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfilePanel({ profile }: { profile?: any }) {
  const [showPreview, setShowPreview] = useState(false);
  if (!profile) {
    return (
      <Panel id="profile" className="p-6 md:p-8">
        <SectionKicker icon={Table2}>Dataset profile</SectionKicker>
        <div className="flex min-h-[170px] items-center justify-center rounded-xl border border-dashed border-card-border bg-background/55 p-8 text-center">
          <div>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary"><Database size={18} /></div>
            <p className="mt-3 text-sm font-bold">Your dataset profile will appear here</p>
            <p className="mt-1 text-xs text-muted-foreground">Load the demo or upload a CSV above to inspect its shape.</p>
          </div>
        </div>
      </Panel>
    );
  }
  const target = profile.possibleTarget || profile.targetCandidates?.[0] || 'Not identified';
  return (
    <Panel id="profile" className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionKicker icon={Table2}>Dataset profile</SectionKicker>
          <h2 data-testid="text-dataset-name" className="font-display text-3xl leading-none">{profile.name}</h2>
          <p className="mt-2 text-xs text-muted-foreground">{profile.isDemo ? 'Built-in demonstration dataset' : 'Uploaded dataset'} · ID <span className="font-mono-ui">{profile.datasetId}</span></p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold text-secondary-foreground">
          <Check size={13} /> Profile complete
        </div>
      </div>
      <div className="mt-7 grid gap-7 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Rows', formatNumber(profile.rows)],
              ['Columns', formatNumber(profile.columns)],
              ['Missing values', formatNumber(profile.missingValues)],
              ['Duplicate rows', formatNumber(profile.duplicateRows)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-background px-3.5 py-3">
                <div className="font-mono-ui text-[10px] uppercase tracking-[.1em] text-muted-foreground">{label}</div>
                <div className="mt-1 text-lg font-bold">{value}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-lg border border-primary/15 bg-primary/[.045] p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary"><Target size={13} /> Likely target</div>
            <div className="mt-2 font-mono-ui text-sm">{target}</div>
            <div className="mt-1 text-[11px] leading-4 text-muted-foreground">Candidate targets: {(profile.targetCandidates || []).join(', ') || 'none detected'}</div>
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-bold">Column signals</div>
            <div className="flex gap-3 text-[10px] text-muted-foreground">
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-primary" />numeric {profile.numericalFeatures?.length || 0}</span>
              <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-accent" />categorical {profile.categoricalFeatures?.length || 0}</span>
            </div>
          </div>
          <div className="max-h-[190px] overflow-auto rounded-lg border border-card-border scroll-thin">
            {(profile.columnNames || []).map((column: string, index: number) => {
              const isNumeric = profile.numericalFeatures?.includes(column);
              const isTarget = column === target;
              return (
                <div key={column} data-testid={`row-column-${index}`} className="flex items-center justify-between border-b border-card-border/70 px-3.5 py-2.5 last:border-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isNumeric ? 'bg-primary' : 'bg-accent'}`} />
                    <span className="truncate font-mono-ui text-[11px]">{column}</span>
                    {isTarget && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">target</span>}
                  </div>
                  <span className="ml-3 shrink-0 text-[10px] text-muted-foreground">{profile.dataTypes?.[column] || (isNumeric ? 'numeric' : 'text')}</span>
                </div>
              );
            })}
          </div>
          {profile.preview?.length > 0 && (
            <button type="button" data-testid="button-toggle-preview" onClick={() => setShowPreview((open) => !open)} className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline">
              {showPreview ? 'Hide row preview' : 'Inspect first rows'} <ChevronRight size={13} className={showPreview ? 'rotate-90' : ''} />
            </button>
          )}
        </div>
      </div>
      {showPreview && (
        <div className="mt-5 overflow-auto rounded-lg border border-card-border scroll-thin">
          <table className="min-w-full text-left text-[10px]">
            <thead className="bg-secondary/55 font-mono-ui uppercase text-muted-foreground">
              <tr>{(profile.columnNames || []).slice(0, 8).map((column: string) => <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>)}</tr>
            </thead>
            <tbody>
              {profile.preview.slice(0, 5).map((row: Record<string, unknown>, index: number) => (
                <tr key={index} className="border-t border-card-border/70">
                  {(profile.columnNames || []).slice(0, 8).map((column: string) => <td key={column} className="whitespace-nowrap px-3 py-2 text-muted-foreground">{String(row[column] ?? '—')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function TrainingPanel({
  profile,
  training,
  onTrain,
  isTraining,
  error,
}: {
  profile?: any;
  training?: any;
  onTrain: (target: string) => void;
  isTraining: boolean;
  error?: unknown;
}) {
  const [target, setTarget] = useState('');
  useEffect(() => {
    if (profile) setTarget(profile.possibleTarget || profile.targetCandidates?.[0] || profile.columnNames?.[profile.columns - 1] || '');
  }, [profile]);
  const metrics = training?.metrics || [];
  const importance = training?.featureImportance || [];
  return (
    <Panel id="models" className="overflow-hidden">
      <div className="border-b border-card-border p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionKicker icon={BarChart3}>Model comparison</SectionKicker>
            <h2 className="font-display text-3xl leading-none">Train with a visible trade-off.</h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Compare classifiers on the same held-out data. Speed and accuracy sit together here, not behind a single score.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              disabled={!profile || isTraining}
              data-testid="select-target-column"
              className="h-10 max-w-[190px] rounded-lg border border-input bg-background px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Choose target</option>
              {(profile?.targetCandidates?.length ? profile.targetCandidates : profile?.columnNames || []).map((column: string) => <option value={column} key={column}>{column}</option>)}
            </select>
            <button
              type="button"
              data-testid="button-train-models"
              disabled={!profile || !target || isTraining}
              onClick={() => onTrain(target)}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isTraining ? <LoaderCircle size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
              {isTraining ? 'Training…' : training ? 'Re-train models' : 'Train models'}
            </button>
          </div>
        </div>
        {error ? <div data-testid="status-training-error" className="mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"><AlertCircle size={14} />{errorText(error)}</div> : null}
      </div>
      {!training ? (
        <div className="flex min-h-[220px] items-center justify-center bg-background/40 p-8 text-center">
          <div>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-primary"><BarChart3 size={20} /></div>
            <p className="mt-3 text-sm font-bold">{profile ? 'Ready when you are' : 'Models need a dataset first'}</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{profile ? 'Choose a target column, then run the comparison. The API will return metrics, a confusion matrix, and feature signals.' : 'Your comparison table will stay empty until a profile is available.'}</p>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1.1fr_.9fr]">
          <div className="border-b border-card-border p-6 lg:border-b-0 lg:border-r md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold">Classifier readout</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Target: <span className="font-mono-ui">{training.targetColumn}</span></div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock3 size={12} /> {training.trainedAt ? new Date(training.trainedAt).toLocaleString() : 'recently'}</div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-card-border scroll-thin">
              <table className="min-w-[600px] w-full text-left text-[11px]">
                <thead className="bg-secondary/55 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2.5">Model</th><th className="px-3 py-2.5">Accuracy</th><th className="px-3 py-2.5">Precision</th><th className="px-3 py-2.5">Recall</th><th className="px-3 py-2.5">F1</th><th className="px-3 py-2.5">Time</th></tr></thead>
                <tbody>{metrics.map((metric: any) => (
                  <tr key={metric.name} data-testid={`row-model-${metric.name}`} className={`border-t border-card-border/70 ${metric.name === training.bestModel ? 'bg-primary/[.055]' : ''}`}>
                    <td className="px-3 py-3 font-semibold">{metric.name}{metric.name === training.bestModel && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">best</span>}</td>
                    <td className="px-3 py-3 font-mono-ui font-medium">{formatPercent(metric.accuracy)}</td><td className="px-3 py-3 font-mono-ui">{formatPercent(metric.precision)}</td><td className="px-3 py-3 font-mono-ui">{formatPercent(metric.recall)}</td><td className="px-3 py-3 font-mono-ui">{formatPercent(metric.f1)}</td><td className="px-3 py-3 font-mono-ui text-muted-foreground">{metric.trainingTimeMs}ms</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="mt-5 rounded-lg bg-primary p-4 text-primary-foreground">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-primary-foreground/65"><Check size={13} /> Leading result</div>
              <div className="mt-1 flex items-end justify-between gap-3"><div className="font-display text-2xl">{training.bestModel}</div><div className="font-mono-ui text-xl">{formatPercent(metrics.find((item: any) => item.name === training.bestModel)?.f1)} <span className="text-[10px] text-primary-foreground/65">F1</span></div></div>
            </div>
          </div>
          <div className="p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between"><div className="text-xs font-bold">What moved the decision</div><span className="font-mono-ui text-[10px] text-muted-foreground">feature importance</span></div>
            <div className="space-y-4">
              {importance.slice(0, 7).map((item: any, index: number) => (
                <div key={item.feature} data-testid={`feature-importance-${index}`}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]"><span className="truncate font-mono-ui">{item.feature}</span><span className={`flex shrink-0 items-center gap-1 text-[10px] ${item.direction?.toLowerCase().includes('negative') ? 'text-accent' : 'text-primary'}`}>{item.direction?.toLowerCase().includes('negative') ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}{titleCase(item.direction || 'positive')}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="metric-bar h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(3, item.importance * 100))}%` }} /></div>
                </div>
              ))}
              {!importance.length && <p className="text-xs text-muted-foreground">No feature importance returned for this run.</p>}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

function PredictionPanel({
  profile,
  prediction,
  onPredict,
  isPredicting,
  error,
}: {
  profile?: any;
  prediction?: any;
  onPredict: (features: Record<string, unknown>) => void;
  isPredicting: boolean;
  error?: unknown;
}) {
  const featureNames = useMemo(() => (profile?.numericalFeatures?.length ? profile.numericalFeatures : profile?.trafficColumns || []).filter((name: string) => name !== profile?.possibleTarget).slice(0, 6), [profile]);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!profile) return;
    const firstRow = profile.preview?.[0] || {};
    const initial: Record<string, string> = {};
    featureNames.forEach((name: string, index: number) => { initial[name] = String(firstRow[name] ?? (index === 0 ? '42' : index === 1 ? '18' : '0')); });
    setValues(initial);
  }, [profile, featureNames]);
  return (
    <Panel id="predict" className="overflow-hidden">
      <div className="border-b border-card-border p-6 md:p-8">
        <SectionKicker icon={Target}>Single-row prediction</SectionKicker>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="font-display text-3xl leading-none">Ask about one moment.</h2><p className="mt-2 max-w-lg text-xs leading-5 text-muted-foreground">Use observed feature values to see a traffic condition, confidence, and the factors that shaped the prediction.</p></div>
          {prediction && <div data-testid="status-prediction-model" className="rounded-full bg-secondary px-3 py-1.5 font-mono-ui text-[10px] text-secondary-foreground">{prediction.model}</div>}
        </div>
      </div>
      <div className="grid lg:grid-cols-[.9fr_1.1fr]">
        <div className="border-b border-card-border p-6 lg:border-b-0 lg:border-r md:p-8">
          {!profile ? (
            <div className="flex min-h-[190px] items-center justify-center text-center"><div><CircleHelp size={22} className="mx-auto text-muted-foreground" /><p className="mt-3 text-sm font-bold">No inputs yet</p><p className="mt-1 text-xs text-muted-foreground">Load and profile a dataset to expose its traffic features.</p></div></div>
          ) : (
            <>
              <div className="mb-4 text-xs font-bold">Observed values</div>
              <div className="space-y-3">
                {featureNames.map((name: string) => (
                  <label key={name} className="block"><span className="mb-1.5 block font-mono-ui text-[10px] text-muted-foreground">{name}</span><input type="text" inputMode="decimal" value={values[name] || ''} onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))} data-testid={`input-prediction-${name}`} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none transition-shadow focus:ring-2 focus:ring-ring" /></label>
                ))}
              </div>
              <button type="button" data-testid="button-run-prediction" disabled={isPredicting || !featureNames.length} onClick={() => onPredict(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value === '' || Number.isNaN(Number(value)) ? value : Number(value)])))} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-xs font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{isPredicting ? <LoaderCircle size={14} className="animate-spin" /> : <Target size={14} />}{isPredicting ? 'Calculating…' : 'Run prediction'}</button>
              {error && <div data-testid="status-prediction-error" className="mt-3 flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"><AlertCircle size={14} />{errorText(error)}</div>}
            </>
          )}
        </div>
        <div className="bg-primary/[.035] p-6 md:p-8">
          {!prediction ? (
            <div className="flex min-h-[250px] items-center justify-center text-center"><div><div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-primary/20 text-primary"><Gauge size={20} /></div><p className="mt-3 text-sm font-bold">Prediction output is intentionally quiet</p><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">Run an inference to see the returned condition and its supporting factors.</p></div></div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Predicted condition</div><div data-testid="text-predicted-condition" className="mt-2 font-display text-4xl leading-none">{prediction.condition}</div></div><div className="text-right"><div className="font-mono-ui text-3xl text-primary">{formatPercent(prediction.confidence)}</div><div className="text-[10px] text-muted-foreground">confidence</div></div></div>
              <div className="my-7 h-px bg-primary/15" />
              <div className="mb-3 flex items-center justify-between"><div className="text-xs font-bold">Factors in this prediction</div><Info size={14} className="text-muted-foreground" /></div>
              <div className="space-y-3">{(prediction.factors || []).slice(0, 6).map((factor: any) => <div key={factor.feature} className="flex items-center gap-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card font-mono-ui text-[10px] text-primary">{factor.direction?.toLowerCase().includes('negative') ? '−' : '+'}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-3 text-[11px]"><span className="truncate font-mono-ui">{factor.feature}</span><span className="font-mono-ui text-muted-foreground">{formatPercent(factor.importance)}</span></div><div className="mt-1 h-1 rounded-full bg-primary/10"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(4, factor.importance * 100))}%` }} /></div></div></div>)}</div>
              <div className="mt-6 rounded-lg border border-primary/15 bg-card/80 p-3 text-[11px] text-muted-foreground"><span className="font-bold text-foreground">Model context: </span>{Object.entries(prediction.inputSummary || {}).map(([key, value]) => `${key} ${value}`).join(' · ')}</div>
            </>
          )}
        </div>
      </div>
    </Panel>
  );
}

function ConfusionMatrix({ training }: { training?: any }) {
  if (!training?.confusionMatrix?.labels?.length) return null;
  const { labels, values } = training.confusionMatrix;
  const max = Math.max(...values.flat(), 1);
  return (
    <div className="mt-8 border-t border-card-border pt-6">
      <div className="mb-3 flex items-center justify-between"><div className="text-xs font-bold">Confusion matrix</div><div className="font-mono-ui text-[10px] text-muted-foreground">rows actual · columns predicted</div></div>
      <div className="overflow-auto scroll-thin"><table className="mx-auto text-center text-[10px]"><thead><tr><th className="p-2 text-left font-normal text-muted-foreground"> </th>{labels.map((label: string) => <th key={label} className="max-w-[90px] p-2 font-mono-ui font-normal text-muted-foreground">{label}</th>)}</tr></thead><tbody>{values.map((row: number[], rowIndex: number) => <tr key={rowIndex}><th className="p-2 text-right font-mono-ui font-normal text-muted-foreground">{labels[rowIndex]}</th>{row.map((cell, columnIndex) => <td key={columnIndex} className="p-1"><div className="flex h-10 min-w-12 items-center justify-center rounded-md font-mono-ui" style={{ backgroundColor: `hsl(var(--primary) / ${0.08 + (cell / max) * 0.72})`, color: cell / max > .48 ? 'hsl(var(--card))' : 'hsl(var(--foreground))' }}>{cell}</div></td>)}</tr>)}</tbody></table></div>
    </div>
  );
}

function InsightsPanel({ datasetId, prediction }: { datasetId?: string; prediction?: any }) {
  const rag = useQueryRag();
  const sourcesQuery = useGetRagSources({ query: { queryKey: getGetRagSourcesQueryKey() } });
  const [question, setQuestion] = useState('What should I look for when interpreting traffic congestion predictions?');
  const ask = () => { if (question.trim()) rag.mutate({ data: { question: question.trim(), datasetId: datasetId || null, prediction: prediction || null } }); };
  const answer = rag.data;
  return (
    <Panel id="insights" className="overflow-hidden border-primary/20">
      <div className="grid lg:grid-cols-[1.08fr_.92fr]">
        <div className="border-b border-card-border p-6 md:p-8 lg:border-b-0 lg:border-r">
          <SectionKicker icon={BrainCircuit}>Grounded AI insights</SectionKicker>
          <h2 className="font-display text-3xl leading-none">Ask the traffic literature.</h2>
          <p className="mt-2 max-w-lg text-xs leading-5 text-muted-foreground">Answers are retrieved from the workspace knowledge base and can use your active prediction as context. Treat them as a research starting point, not a verdict.</p>
          <div className="mt-6 flex gap-2 rounded-xl border border-input bg-background p-2 focus-within:ring-2 focus-within:ring-ring">
            <Search size={16} className="ml-2 mt-2.5 shrink-0 text-muted-foreground" />
            <textarea value={question} onChange={(event) => setQuestion(event.target.value)} data-testid="input-rag-question" rows={2} className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-xs leading-5 outline-none" placeholder="Ask about traffic flow, features, or interpretation…" />
            <button type="button" data-testid="button-query-rag" onClick={ask} disabled={rag.isPending || !question.trim()} className="self-end rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-45">{rag.isPending ? <LoaderCircle size={14} className="animate-spin" /> : 'Ask'}</button>
          </div>
          {rag.error && <div data-testid="status-rag-error" className="mt-3 flex gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"><AlertCircle size={14} />{errorText(rag.error)}</div>}
          {answer ? (
            <div data-testid="text-rag-answer" className="mt-6 rounded-xl bg-primary p-5 text-primary-foreground">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-primary-foreground/65"><Sparkles size={13} /> Retrieved answer</div>
              <p className="mt-3 text-sm leading-6">{answer.answer}</p>
              {!!answer.retrievedFacts?.length && <div className="mt-5 border-t border-primary-foreground/15 pt-4"><div className="mb-2 text-[10px] font-bold uppercase tracking-[.14em] text-primary-foreground/60">Facts used</div><ul className="space-y-1.5 text-[11px] leading-4 text-primary-foreground/80">{answer.retrievedFacts.slice(0, 4).map((fact: string) => <li key={fact} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sidebar-primary" />{fact}</li>)}</ul></div>}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-card-border p-5 text-xs leading-5 text-muted-foreground">The answer will show its sources and evidence here, alongside the model context used for retrieval.</div>
          )}
        </div>
        <div className="bg-background/45 p-6 md:p-8">
          <div className="flex items-center justify-between"><div><div className="text-xs font-bold">Knowledge base</div><div className="mt-1 text-[11px] text-muted-foreground">Available traffic references</div></div><BookOpen size={17} className="text-primary" /></div>
          <div className="mt-5 space-y-3">
            {sourcesQuery.isLoading && [1, 2, 3].map((item) => <div key={item} className="rounded-lg border border-card-border p-3"><SkeletonLine className="h-3 w-2/3" /><SkeletonLine className="mt-2 h-2 w-full" /><SkeletonLine className="mt-1 h-2 w-4/5" /></div>)}
            {!sourcesQuery.isLoading && sourcesQuery.error && <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">Could not load references. Queries can still be attempted.</div>}
            {!sourcesQuery.isLoading && !sourcesQuery.error && !(sourcesQuery.data || []).length && <div className="rounded-lg border border-dashed border-card-border p-4 text-xs text-muted-foreground">No references are indexed yet.</div>}
            {(sourcesQuery.data || []).slice(0, 5).map((source: any) => <div key={source.id} data-testid={`card-rag-source-${source.id}`} className="interactive-card rounded-lg border border-card-border bg-card p-3.5"><div className="flex items-start justify-between gap-3"><div className="text-xs font-bold leading-4">{source.title}</div><span className="shrink-0 rounded bg-secondary px-1.5 py-1 font-mono-ui text-[9px] text-muted-foreground">{source.topic}</span></div><p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{source.excerpt}</p></div>)}
          </div>
          {answer?.sources?.length ? <div className="mt-5 border-t border-card-border pt-4 text-[10px] text-muted-foreground"><span className="font-bold text-foreground">{answer.sources.length} references</span> informed this answer.</div> : null}
        </div>
      </div>
    </Panel>
  );
}

function HistoryPanel({ refreshKey }: { refreshKey?: number }) {
  const [tab, setTab] = useState<'predictions' | 'trainings' | 'rag'>('predictions');
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; provider: string } | null>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [trainings, setTrainings] = useState<any[]>([]);
  const [ragHistory, setRagHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, predsRes, trainRes, ragRes] = await Promise.all([
        fetch('/api/history/status').then((r) => r.json()).catch(() => null),
        fetch('/api/history/predictions').then((r) => r.json()).catch(() => null),
        fetch('/api/history/trainings').then((r) => r.json()).catch(() => null),
        fetch('/api/history/rag').then((r) => r.json()).catch(() => null),
      ]);
      if (statusRes) setDbStatus(statusRes);
      if (predsRes?.history) setPredictions(predsRes.history);
      if (trainRes?.history) setTrainings(trainRes.history);
      if (ragRes?.history) setRagHistory(ragRes.history);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  return (
    <Panel id="history" className="p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SectionKicker icon={Database}>Database & Audit History</SectionKicker>
          <h2 className="font-display text-2xl md:text-3xl">Persistent traffic audit trail.</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Logs all predictions, model evaluations, and research literature queries.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-card-border bg-secondary/50 px-3 py-1.5 text-[11px]">
            <span className={`h-2 w-2 rounded-full ${dbStatus?.connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="font-medium text-foreground">{dbStatus?.provider || 'Checking database...'}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
          >
            {loading ? <LoaderCircle size={13} className="animate-spin" /> : <Clock3 size={13} />}
            Refresh
          </button>
        </div>
      </div>

      {!dbStatus?.connected && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
          <Info size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="font-bold">Ready for your Supabase Database</div>
            <div className="mt-0.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
              The database schema and API endpoints are built and connected. Once you add your Supabase connection string (<code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono">DATABASE_URL</code>) to your <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono">.env</code> file, all records will automatically persist permanently.
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-card-border pb-3">
        <button
          type="button"
          onClick={() => setTab('predictions')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${tab === 'predictions' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
        >
          Predictions ({predictions.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('trainings')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${tab === 'trainings' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
        >
          Model Trainings ({trainings.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('rag')}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${tab === 'rag' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
        >
          RAG Literature Logs ({ragHistory.length})
        </button>
      </div>

      <div className="mt-5">
        {tab === 'predictions' && (
          predictions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-card-border p-6 text-center text-xs text-muted-foreground">
              No predictions logged yet. Run a prediction above to record an audit entry.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-card-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2.5 font-semibold">Timestamp</th>
                    <th className="pb-2.5 font-semibold">Predicted Condition</th>
                    <th className="pb-2.5 font-semibold">Confidence</th>
                    <th className="pb-2.5 font-semibold">Model Used</th>
                    <th className="pb-2.5 font-semibold">Top Factor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {predictions.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/30">
                      <td className="py-2.5 font-mono-ui text-[11px] text-muted-foreground">
                        {p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          {p.condition}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono-ui font-semibold">
                        {(p.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="py-2.5 text-muted-foreground">{p.model}</td>
                      <td className="py-2.5 font-mono-ui text-[11px] text-muted-foreground">
                        {Array.isArray(p.factors) && p.factors[0]?.feature ? p.factors[0].feature : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'trainings' && (
          trainings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-card-border p-6 text-center text-xs text-muted-foreground">
              No training runs logged yet. Train classifiers above to record a comparison.
            </div>
          ) : (
            <div className="space-y-3">
              {trainings.map((t) => (
                <div key={t.id} className="rounded-xl border border-card-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{t.bestModel}</span>
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono-ui text-[10px] font-bold text-primary">
                        Target: {t.targetColumn}
                      </span>
                    </div>
                    <span className="font-mono-ui text-[10px] text-muted-foreground">
                      {t.createdAt ? new Date(t.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  {Array.isArray(t.metrics) && (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {t.metrics.map((m: any) => (
                        <div key={m.name} className="rounded-lg bg-secondary/50 p-2 text-center">
                          <div className="truncate text-[10px] font-bold text-muted-foreground">{m.name}</div>
                          <div className="mt-1 font-mono-ui text-xs font-bold text-foreground">
                            F1: {(m.f1 * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'rag' && (
          ragHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-card-border p-6 text-center text-xs text-muted-foreground">
              No literature queries logged yet. Ask a question in the AI insights panel above.
            </div>
          ) : (
            <div className="space-y-3">
              {ragHistory.map((q) => (
                <div key={q.id} className="rounded-xl border border-card-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs font-bold text-foreground">“{q.question}”</div>
                    <span className="shrink-0 font-mono-ui text-[10px] text-muted-foreground">
                      {q.createdAt ? new Date(q.createdAt).toLocaleTimeString() : ''}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{q.answer}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </Panel>
  );
}

function Home() {
  const qc = useQueryClient();
  const [datasetId, setDatasetId] = useState('');
  const [profile, setProfile] = useState<any>();
  const [training, setTraining] = useState<any>();
  const [prediction, setPrediction] = useState<any>();
  const [historyKey, setHistoryKey] = useState(0);
  const health = useHealthCheck();
  const summary = useGetAnalysisSummary({ datasetId }, { query: { enabled: Boolean(datasetId), queryKey: getGetAnalysisSummaryQueryKey({ datasetId }) } });
  const modelResults = useGetModelResults({ datasetId }, { query: { enabled: Boolean(datasetId), queryKey: getGetModelResultsQueryKey({ datasetId }) } });
  const upload = useUploadDataset();
  const demo = useLoadDemoDataset();
  const train = useTrainModels();
  const predict = usePredictTraffic();

  useEffect(() => {
    if (summary.data?.profile) {
      setProfile(summary.data.profile);
      setTraining(summary.data.training || undefined);
      setPrediction(summary.data.latestPrediction || undefined);
    }
  }, [summary.data]);
  useEffect(() => { if (modelResults.data) setTraining(modelResults.data); }, [modelResults.data]);

  const activateProfile = (nextProfile: any) => {
    setProfile(nextProfile);
    setDatasetId(nextProfile.datasetId);
    setTraining(undefined);
    setPrediction(undefined);
    qc.invalidateQueries({ queryKey: getGetAnalysisSummaryQueryKey({ datasetId: nextProfile.datasetId }) });
    qc.invalidateQueries({ queryKey: getGetModelResultsQueryKey({ datasetId: nextProfile.datasetId }) });
    setHistoryKey((k) => k + 1);
  };
  const uploadFile = (file: File) => upload.mutate({ data: { file } }, { onSuccess: activateProfile });
  const loadDemo = () => demo.mutate(undefined, { onSuccess: activateProfile });
  const trainModels = (targetColumn: string) => train.mutate({ data: { datasetId, targetColumn, testSize: 0.2 } }, { onSuccess: (result) => { setTraining(result); qc.setQueryData(getGetModelResultsQueryKey({ datasetId }), result); setHistoryKey((k) => k + 1); } });
  const runPrediction = (features: Record<string, unknown>) => predict.mutate({ data: { datasetId, features } }, { onSuccess: (result) => { setPrediction(result); qc.setQueryData(getGetAnalysisSummaryQueryKey({ datasetId }), (old: any) => old ? { ...old, latestPrediction: result } : old); setHistoryKey((k) => k + 1); } });
  const healthStatus = health.isLoading ? 'working' : health.isError ? 'error' : health.data?.status ? 'ready' : 'quiet';

  return (
    <div className="grain app-shell flex flex-col md:flex-row">
      <Sidebar datasetName={profile?.name} isDemo={profile?.isDemo} onLoadDemo={loadDemo} loadingDemo={demo.isPending} />
      <main className="paper-grid min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-card-border bg-background/75 px-5 py-4 backdrop-blur md:px-10">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="font-mono-ui text-primary">01</span><span className="h-px w-5 bg-border" /><span>Analysis workspace</span></div>
           <div className="flex items-center gap-3"><StatusPill status={healthStatus as 'ready' | 'working' | 'quiet' | 'error'} /><AuthControls /></div>
        </header>
        <div className="mx-auto max-w-[1420px] space-y-6 px-5 py-8 md:px-10 md:py-12 xl:px-14">
          <Overview profile={profile} training={training} latestPrediction={prediction} loading={summary.isLoading || upload.isPending || demo.isPending} />
          <DataIntake onFile={uploadFile} onDemo={loadDemo} loadingUpload={upload.isPending} loadingDemo={demo.isPending} error={upload.error || demo.error} />
          <ProfilePanel profile={profile} />
          <TrainingPanel profile={profile} training={training} onTrain={trainModels} isTraining={train.isPending} error={train.error || modelResults.error} />
          <PredictionPanel profile={profile} prediction={prediction} onPredict={runPrediction} isPredicting={predict.isPending} error={predict.error} />
          {training && <Panel className="p-6 md:p-8"><SectionKicker icon={BarChart3}>Diagnostic detail</SectionKicker><h2 className="font-display text-2xl">Where the classifier hesitates.</h2><ConfusionMatrix training={training} /></Panel>}
          <InsightsPanel datasetId={datasetId} prediction={prediction} />
          <HistoryPanel refreshKey={historyKey} />
          <footer className="flex flex-col justify-between gap-3 border-t border-card-border pb-8 pt-4 text-[10px] text-muted-foreground sm:flex-row"><span>Flow Lab · traffic analytics for careful inference</span><span className="font-mono-ui">API {health.data?.status || 'checking'} · {new Date().getFullYear()}</span></footer>
        </div>
      </main>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="grain flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Home /> : <PublicLanding />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/workspace">
          <ProtectedWorkspace />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function ProtectedWorkspace() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Home /> : <Redirect to="/" />;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  if (!hasClerk) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Home />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();

  useEffect(() => {
    let previousUserId: string | null | undefined;
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId !== undefined && previousUserId !== userId) queryClient.clear();
      previousUserId = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={{
        theme: shadcn,
        cssLayerName: 'clerk',
        options: {
          logoPlacement: 'inside',
          logoLinkUrl: basePath || '/',
          logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
        },
        variables: {
          colorPrimary: '#b95647',
          colorForeground: '#173246',
          colorMutedForeground: '#6c7779',
          colorBackground: '#f8f6ef',
          colorInput: '#ffffff',
          colorInputForeground: '#173246',
          colorNeutral: '#d9ddd6',
          colorDanger: '#b95647',
          fontFamily: 'Manrope, sans-serif',
          borderRadius: '0.7rem',
        },
        elements: {
          rootBox: 'w-full flex justify-center',
          cardBox: 'bg-[#f8f6ef] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_24px_70px_rgba(23,50,70,.12)]',
          card: '!shadow-none !border-0 !bg-transparent !rounded-none',
          footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
          headerTitle: 'font-display text-3xl text-[#173246]',
          headerSubtitle: 'text-[#6c7779]',
          socialButtonsBlockButtonText: 'text-[#173246] font-semibold',
          formFieldLabel: 'text-[#173246] font-semibold',
          footerActionLink: 'text-[#b95647] font-semibold',
          footerActionText: 'text-[#6c7779]',
          dividerText: 'text-[#6c7779]',
          identityPreviewEditButton: 'text-[#b95647]',
          formFieldSuccessText: 'text-[#2d7665]',
          alertText: 'text-[#b95647]',
          logoBox: 'mb-3',
          logoImage: 'h-12 w-12 rounded-xl',
          socialButtonsBlockButton: 'border-[#d9ddd6] bg-white hover:bg-[#f2eee7]',
          formButtonPrimary: 'bg-[#b95647] hover:bg-[#9f493c] text-white',
          formFieldInput: 'border-[#d9ddd6] bg-white text-[#173246]',
          footerAction: 'border-t border-[#d9ddd6]',
          dividerLine: 'bg-[#d9ddd6]',
          alert: 'bg-[#f8e7e2] border-[#e6b4aa]',
          otpCodeFieldInput: 'border-[#d9ddd6] bg-white',
          formFieldRow: 'mb-4',
          main: 'px-2',
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to continue your traffic research' } },
        signUp: { start: { title: 'Create your account', subtitle: 'Set up your traffic analysis workspace' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;