import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Atom,
  Bean,
  CheckCircle2,
  ClipboardList,
  Crosshair,
  FileSearch,
  Hash,
  Heart,
  HeartPulse,
  KeyRound,
  Menu,
  Scale,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Wind,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useAuth } from "@/lib/auth-context";
import heroImage from "@/assets/landing/hero-clinical.jpg";
import trustImage from "@/assets/landing/trust-hospital.jpg";
import gallery1 from "@/assets/landing/gallery-1.jpg";
import gallery2 from "@/assets/landing/gallery-2.jpg";
import gallery3 from "@/assets/landing/gallery-3.jpg";
import gallery4 from "@/assets/landing/gallery-4.jpg";
import gallery5 from "@/assets/landing/gallery-5.jpg";
import gallery6 from "@/assets/landing/gallery-6.jpg";
import gallery7 from "@/assets/landing/gallery-7.jpg";
import gallery8 from "@/assets/landing/gallery-8.jpg";
import matchingImage from "@/assets/landing/matching-wide.jpg";

const PAGE_TITLE = "Secure Organ Donation Matching & Tamper Detection System";
const PAGE_DESCRIPTION =
  "A secure platform for donor and recipient management, compatibility matching, allocation workflows, and tamper-evident records with audit trails and permissioned blockchain verification.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: PAGE_TITLE },
      { name: "description", content: PAGE_DESCRIPTION },
      { name: "robots", content: "index, follow" },
      // Open Graph
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { property: "og:site_name", content: "OrganMatch" },
      // Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: PAGE_TITLE },
      { name: "twitter:description", content: PAGE_DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LandingPage,
});

/* ------------------------------------------------------------------ */
/* Subtle scroll-reveal wrapper                                        */
/* ------------------------------------------------------------------ */

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#overview", label: "Home" },
  { href: "#overview", label: "About" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#security", label: "Security" },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="OrganMatch home">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
        <HeartPulse className="h-5 w-5 text-primary-foreground" aria-hidden />
      </span>
      <span className="text-base font-semibold tracking-tight text-foreground">
        OrganMatch
      </span>
    </Link>
  );
}

function PrimaryButton({
  to,
  children,
  className = "",
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </Link>
  );
}

function SecondaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {children}
    </a>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      )}
      <h2 className="mt-2 text-3xl font-medium leading-snug tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-base leading-7 text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/login"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Sign In
          </Link>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-border bg-background lg:hidden">
          <nav aria-label="Mobile" className="mx-auto flex max-w-7xl flex-col px-4 py-4 sm:px-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4">
              <Link
                to="/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Sign In
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

const ORGAN_STRIP = [
  { icon: Heart, label: "Heart" },
  { icon: Wind, label: "Lungs" },
  { icon: Bean, label: "Kidney" },
  { icon: Activity, label: "Pancreas" },
];

function Hero() {
  return (
    <section id="overview" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Secure Organ Donation Platform
          </p>
          <h1 className="mt-4 text-4xl font-medium leading-tight tracking-tight text-foreground sm:text-5xl">
            Connecting compatible recipients with secure, accountable organ allocation.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
            A secure platform for donor and recipient management, compatibility matching, allocation
            workflows, and tamper-evident records.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryButton to="/login">Sign In</PrimaryButton>
            <SecondaryButton href="#how-it-works">Explore the Platform</SecondaryButton>
          </div>
        </Reveal>
        <Reveal>
          <figure>
            <img
              src={heroImage}
              alt="Two doctors in white coats reviewing a patient chart together at a hospital nurses station"
              width={1536}
              height={1152}
              className="h-auto w-full rounded-lg border border-border object-cover"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              Secure coordination across healthcare organizations
            </figcaption>
          </figure>
        </Reveal>
      </div>
      {/* Lower information strip */}
      <div className="border-t border-border bg-muted/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-4 py-6 sm:px-6">
          <span className="text-sm font-medium text-muted-foreground">4 Supported Organs</span>
          {ORGAN_STRIP.map((organ) => (
            <span
              key={organ.label}
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <organ.icon className="h-4 w-4 text-primary" aria-hidden />
              {organ.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Intro() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading
            title="Built for transparency, security and informed allocation."
            description="The platform combines compatibility-based donor–recipient matching with role-based access control, audit trails, tamper detection and permissioned blockchain records."
          />
        </Reveal>
        <Reveal className="mt-12">
          <img
            src={trustImage}
            alt="A medical team in scrubs and white coats reviewing patient charts together around a hospital conference table"
            width={1920}
            height={1088}
            loading="lazy"
            className="h-auto w-full rounded-lg border border-border object-cover"
          />
        </Reveal>
      </div>
    </section>
  );
}

const GALLERY = [
  {
    src: gallery1,
    alt: "Doctor seated at a desk reviewing a printed patient chart",
    caption: "Reviewing patient information",
  },
  {
    src: gallery2,
    alt: "Hospital coordinator working with medical records at a workstation",
    caption: "Coordinating donation records",
  },
  {
    src: gallery3,
    alt: "Three medical professionals in scrubs discussing a case in a hospital corridor",
    caption: "Clinical team collaboration",
  },
  {
    src: gallery4,
    alt: "Healthcare professional reviewing documents on a monitor in a clinical office",
    caption: "Secure medical data review",
  },
  {
    src: gallery5,
    alt: "Transplant coordinator on the phone writing notes at a nursing station",
    caption: "Coordinating between hospitals",
  },
  {
    src: gallery6,
    alt: "Two surgeons in scrubs reviewing medical imaging scans on a light display",
    caption: "Clinical case review",
  },
  {
    src: gallery7,
    alt: "Gloved medical courier loading an insulated organ transport cooler into a vehicle",
    caption: "Time-critical organ transport",
  },
  {
    src: gallery8,
    alt: "Hospital administrator presenting to a clinical team around a conference table",
    caption: "Oversight and governance",
  },
];

function Gallery() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  // Slowly advance one card at a time; pauses on hover/focus/touch and
  // respects prefers-reduced-motion.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      if (pausedRef.current) return;
      const card = el.querySelector("figure");
      if (!card) return;
      const step = card.clientWidth + 24; // gap-6
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: "smooth" });
    }, 3200);

    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="border-b border-border bg-muted/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading title="Designed around the people who manage organ donation." />
        </Reveal>
        <Reveal className="mt-10">
          <div
            ref={scrollRef}
            className="scrollbar-thin -mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6"
            role="region"
            aria-label="Healthcare photography gallery"
            tabIndex={0}
            onPointerEnter={() => (pausedRef.current = true)}
            onPointerLeave={() => (pausedRef.current = false)}
            onFocus={() => (pausedRef.current = true)}
            onBlur={() => (pausedRef.current = false)}
            onTouchStart={() => (pausedRef.current = true)}
            onTouchEnd={() => (pausedRef.current = false)}
          >
            {GALLERY.map((item) => (
              <figure key={item.src} className="w-72 shrink-0 snap-start sm:w-80">
                <img
                  src={item.src}
                  alt={item.alt}
                  width={1024}
                  height={768}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-lg border border-border object-cover"
                />
                <figcaption className="mt-3 text-sm text-muted-foreground">
                  {item.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const PROBLEM_COLUMNS = [
  {
    step: "01",
    icon: Crosshair,
    title: "Compatibility",
    body: "Identify eligible recipients using defined compatibility and priority criteria.",
  },
  {
    step: "02",
    icon: FileSearch,
    title: "Accountability",
    body: "Record who created, changed, approved, or attempted to modify important records.",
  },
  {
    step: "03",
    icon: ShieldCheck,
    title: "Integrity",
    body: "Use permissioned blockchain records and verification mechanisms to strengthen data integrity.",
  },
];

function Problem() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading title="Organ donation requires more than a matching algorithm." />
        </Reveal>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {PROBLEM_COLUMNS.map((col) => (
            <Reveal key={col.step}>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-primary">{col.step}</span>
                <col.icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{col.title}</h3>
              <p className="mt-2 text-base leading-7 text-muted-foreground">{col.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const HOW_STEPS = [
  {
    step: "01",
    title: "Register",
    body: "Donors, recipients and organs are registered by authorized organizations.",
  },
  {
    step: "02",
    title: "Evaluate",
    body: "The system applies eligibility and compatibility rules.",
  },
  {
    step: "03",
    title: "Rank",
    body: "Eligible recipients receive a compatibility score and ranked position.",
  },
  { step: "04", title: "Review", body: "Authorized personnel review the recommended matches." },
  { step: "05", title: "Allocate", body: "An authorized allocation decision is recorded." },
  { step: "06", title: "Verify", body: "Transactions and record history can be verified." },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-border bg-muted/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading title="How the platform works" />
        </Reveal>
        <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-6">
          {HOW_STEPS.map((item, i) => (
            <Reveal key={item.step}>
              <li className="relative border-l-2 border-border pl-5 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pt-5">
                <span
                  className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-primary lg:-top-[5px] lg:left-0"
                  aria-hidden
                />
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {item.step}
                </p>
                <h3 className="mt-1.5 text-base font-semibold text-foreground">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{item.body}</p>
                {i < HOW_STEPS.length - 1 && <span className="sr-only">then</span>}
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

const SCORE_BARS = [
  { label: "Blood Compatibility", value: 25, max: 25 },
  { label: "Medical Suitability", value: 28, max: 30 },
  { label: "Tissue / HLA", value: 22, max: 25 },
  { label: "Priority", value: 20, max: 20 },
];

function Matching() {
  return (
    <section id="matching" className="scroll-mt-20 border-b border-border">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        {/* Interface mockup */}
        <Reveal>
          <div
            className="rounded-lg border border-border bg-card p-6"
            role="img"
            aria-label="Example of the matching interface showing donor D001 and recipient R104 with a compatibility score of 95 percent, ranked first"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Donor
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">D001</p>
                <p className="text-sm text-muted-foreground">Kidney · Blood Group O+</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Recipient
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">R104</p>
              </div>
            </div>
            <div className="space-y-4 py-5">
              {SCORE_BARS.map((bar) => (
                <div key={bar.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground">{bar.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {bar.value} / {bar.max}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${Math.round((bar.value / bar.max) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Compatibility Score
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">95%</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                Rank #1
              </span>
            </div>
          </div>
        </Reveal>
        {/* Explanation */}
        <Reveal>
          <SectionHeading
            eyebrow="Matching"
            title="From eligibility to compatibility."
            description="Eligible recipients are evaluated using defined compatibility criteria before being ranked for authorized review."
          />
          <p className="mt-5 rounded-lg border border-border bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
            Compatibility scores support decision-making. They do not automatically determine
            clinical allocation.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function MatchingImage() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-20">
        <Reveal>
          <figure>
            <img
              src={matchingImage}
              alt="Medical professionals seated around a conference table reviewing patient documents and coordinating care decisions"
              width={1920}
              height={1088}
              loading="lazy"
              className="h-auto w-full rounded-lg border border-border object-cover"
            />
            <figcaption className="mt-3 text-sm text-muted-foreground">
              Clear information for informed decisions.
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}

const SECURITY_EVENT_ROWS: Array<[string, ReactNode]> = [
  ["User", "Dr. Kumar"],
  ["Role", "Doctor"],
  ["Operation", "DELETE"],
  ["Target", "Recipient R104"],
  [
    "Authorization",
    <span key="a" className="font-semibold text-destructive">
      DENIED
    </span>,
  ],
  [
    "Classification",
    <span key="c" className="font-semibold text-destructive">
      Internal Tampering
    </span>,
  ],
  ["Timestamp", "10:20 AM"],
  [
    "Status",
    <span key="s" className="inline-flex items-center gap-1.5 font-semibold text-foreground">
      <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Blocked
    </span>,
  ],
];

function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-20 border-b border-border bg-muted/60">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Tamper detection"
            title="Every important action leaves an accountable trail."
            description="Unauthorized operations are evaluated using identity, role and record-level permissions. Security events are recorded for investigation."
          />
        </Reveal>
        <Reveal>
          <div
            className="rounded-lg border border-border bg-card"
            role="img"
            aria-label="Example security audit record: Doctor Dr. Kumar attempted to delete recipient R104, authorization denied, classified as internal tampering, status blocked"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <p className="text-sm font-semibold text-foreground">Security Event</p>
              <span className="text-xs font-medium text-muted-foreground">Audit Interface</span>
            </div>
            <dl>
              {SECURITY_EVENT_ROWS.map(([label, value], i) => (
                <div
                  key={label}
                  className={`flex items-baseline justify-between gap-4 px-5 py-3 text-sm ${i % 2 === 0 ? "bg-muted/40" : ""}`}
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="text-right text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const TIMELINE = [
  {
    action: "Created",
    actor: "U101",
    role: "Hospital Coordinator",
    time: "09:30",
    tone: "neutral" as const,
  },
  {
    action: "Updated",
    actor: "U108",
    role: "Doctor",
    time: "10:12",
    detail: "Medical Status: Review → Suitable",
    tone: "neutral" as const,
  },
  {
    action: "Allocation Approved",
    actor: "U201",
    role: "Allocation Authority",
    time: "11:05",
    tone: "success" as const,
  },
  {
    action: "Delete Attempt",
    actor: "U108",
    role: "Doctor",
    time: "11:20",
    detail: "Result: DENIED",
    tone: "danger" as const,
  },
];

function AuditTimeline() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading
            title="Know who changed what."
            description="A complete activity history for every record — who acted, from which role, when, and with what result."
          />
        </Reveal>
        <Reveal className="mt-12 max-w-2xl">
          <ol className="relative border-l-2 border-border pl-6">
            {TIMELINE.map((entry, i) => (
              <li key={i} className="relative pb-8 last:pb-0">
                <span
                  className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-background ${
                    entry.tone === "danger"
                      ? "border-destructive"
                      : entry.tone === "success"
                        ? "border-success"
                        : "border-primary"
                  }`}
                  aria-hidden
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{entry.action}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{entry.time}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.actor} · {entry.role}
                </p>
                {entry.detail && (
                  <p
                    className={`mt-1.5 inline-block rounded-md px-2 py-1 text-xs font-medium ${
                      entry.tone === "danger"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {entry.detail}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

const LEDGER_FLOW = ["Application", "FastAPI", "Hyperledger Fabric", "Transaction Ledger"];

function BlockchainSection() {
  return (
    <section className="border-b border-border bg-muted/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Verifiable records"
            title="Permissioned records. Verifiable transactions."
            description="Hyperledger Fabric provides a permissioned transaction layer for trusted record verification and auditability."
          />
        </Reveal>

        <Reveal className="mt-10">
          {/* Simple architecture flow */}
          <div
            className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"
            aria-label="Record flow: Application to FastAPI to Hyperledger Fabric to Transaction Ledger"
          >
            {LEDGER_FLOW.map((node, i) => (
              <div key={node} className="flex flex-col items-center gap-2 sm:flex-1 sm:flex-row">
                <div className="w-full rounded-md border border-border bg-card px-4 py-3 text-center text-sm font-medium text-foreground sm:flex-1">
                  {node}
                </div>
                {i < LEDGER_FLOW.length - 1 && (
                  <>
                    <ArrowDown
                      className="h-4 w-4 shrink-0 text-muted-foreground sm:hidden"
                      aria-hidden
                    />
                    <ArrowRight
                      className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
                      aria-hidden
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-8 max-w-2xl">
          {/* Example transaction */}
          <div
            className="rounded-lg border border-border bg-card"
            role="img"
            aria-label="Example verified ledger transaction TX-10021 approving an allocation for recipient R104 by actor U201"
          >
            <div className="border-b border-border px-5 py-3.5">
              <p className="text-sm font-semibold text-foreground">Ledger Transaction</p>
            </div>
            <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
              {(
                [
                  ["Transaction ID", "TX-10021"],
                  ["Record", "Recipient R104"],
                  ["Operation", "Allocation Approval"],
                  ["Actor", "U201"],
                ] as Array<[string, string]>
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </dt>
                <dd className="mt-0.5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Verified
                  </span>
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const SECURITY_TECH = [
  {
    icon: KeyRound,
    title: "Identity",
    body: "Role-based and attribute-based access control.",
  },
  {
    icon: Hash,
    title: "Integrity",
    body: "Hash verification and tamper-evident transaction records.",
  },
  {
    icon: Atom,
    title: "Post-Quantum Security",
    body: "Post-quantum cryptographic mechanisms for future-resistant security research.",
  },
];

function SecurityTech() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading title="Security designed for long-term trust." />
        </Reveal>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          {SECURITY_TECH.map((item) => (
            <Reveal key={item.title}>
              <item.icon className="h-6 w-6 text-primary" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-base leading-7 text-muted-foreground">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const ORGANS = [
  {
    icon: Heart,
    name: "Heart",
    body: "Time-critical cardiac allocation with distance-aware matching and urgency scoring.",
  },
  {
    icon: Wind,
    name: "Lungs",
    body: "Single and bilateral lung matching with size and clinical suitability criteria.",
  },
  {
    icon: Bean,
    name: "Kidney",
    body: "The highest-volume allocation workflow, driven by HLA typing and waiting time.",
  },
  {
    icon: Activity,
    name: "Pancreas",
    body: "Specialized matching with strict viability windows and medical suitability checks.",
  },
];

function OrganTypes() {
  return (
    <section className="border-b border-border bg-muted/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading title="Supporting four major organ categories" />
        </Reveal>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {ORGANS.map((organ) => (
            <Reveal key={organ.name}>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card">
                <organ.icon className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 text-base font-semibold uppercase tracking-wide text-foreground">
                {organ.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{organ.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const ROLES = [
  { icon: Settings2, title: "Administrator", username: "admin", body: "System configuration and security oversight." },
  { icon: ClipboardList, title: "Hospital Coordinator", username: "hospital", body: "Donor and recipient registration." },
  { icon: Stethoscope, title: "Doctor", username: "doctor", body: "Medical information management." },
  { icon: Scale, title: "Allocation Authority", username: "transplant", body: "Match review and allocation decisions." },
  { icon: FileSearch, title: "Auditor", username: "auditor", body: "Independent audit and security verification." },
];

function Roles() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading
            title="Built for every organization involved."
            description="Each role sees and does exactly what its permissions allow — enforced on every request."
          />
        </Reveal>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {ROLES.map((role) => (
            <Reveal key={role.title} className="flex flex-col justify-between">
              <div>
                <role.icon className="h-6 w-6 text-primary" aria-hidden />
                <h3 className="mt-3 text-base font-semibold text-foreground">{role.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{role.body}</p>
              </div>
              <Link
                to="/login"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Sign in as {role.title} →
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchBox({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3 text-center">
      <p className="text-sm font-medium text-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Architecture() {
  return (
    <section id="technology" className="scroll-mt-20 border-b border-border bg-muted/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Architecture"
            title="A clear, verifiable system design."
            description="Thin boundaries between layers, with every request passing through access control before it can touch a record."
          />
        </Reveal>
        <Reveal className="mt-12">
          <div
            className="rounded-lg border border-border bg-card p-6 sm:p-8"
            role="img"
            aria-label="System architecture: users connect to a React frontend, then a FastAPI backend with PostgreSQL, a matching engine, RBAC and ABAC access control, and Hyperledger Fabric writing immutable transaction history, with a post-quantum cryptography security layer"
          >
            {/* Main pipeline */}
            <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
              {["Users", "React Frontend", "FastAPI Backend", "PostgreSQL"].map((node, i) => (
                <div key={node} className="flex flex-col items-center gap-2 lg:flex-1 lg:flex-row">
                  <div className="w-full lg:flex-1">
                    <ArchBox label={node} />
                  </div>
                  {i < 3 && (
                    <>
                      <ArrowDown
                        className="h-4 w-4 shrink-0 text-muted-foreground lg:hidden"
                        aria-hidden
                      />
                      <ArrowRight
                        className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block"
                        aria-hidden
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
            {/* Backend subsystems */}
            <div className="mt-2 flex justify-center">
              <ArrowDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ArchBox label="Matching Engine" sub="FastAPI" />
              <ArchBox label="RBAC + ABAC" sub="FastAPI" />
              <div className="flex flex-col items-center gap-2">
                <div className="w-full">
                  <ArchBox label="Hyperledger Fabric" sub="Fabric" />
                </div>
                <ArrowDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="w-full">
                  <ArchBox label="Immutable Transaction History" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-full">
                  <ArchBox label="PQC" sub="Research layer" />
                </div>
                <ArrowDown className="h-4 w-4 text-muted-foreground" aria-hidden />
                <div className="w-full">
                  <ArchBox label="Security Layer" />
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Statement() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
        <Reveal>
          <h2 className="text-3xl font-medium leading-snug tracking-tight text-foreground sm:text-4xl">
            Security and accountability at every step.
          </h2>
          <p className="mt-5 text-base leading-7 text-muted-foreground">
            Access is controlled according to user roles and permissions. Important actions are
            recorded through audit and transaction mechanisms to support transparency and integrity.
          </p>
          <p className="mt-6 inline-block rounded-full border border-border bg-muted/60 px-4 py-1.5 text-sm font-medium text-muted-foreground">
            Built for research and controlled institutional use.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-b border-border bg-muted/60">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
        <Reveal>
          <h2 className="text-3xl font-medium leading-snug tracking-tight text-foreground sm:text-4xl">
            Explore the secure organ donation platform.
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Review matching, allocation, audit and security workflows in one platform.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryButton to="/login">Sign In</PrimaryButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const FOOTER_PLATFORM = [
  { href: "#overview", label: "Overview" },
  { href: "#matching", label: "Matching" },
  { href: "#security", label: "Security" },
  { href: "#security", label: "Audit" },
];

const FOOTER_TECH = ["React", "FastAPI", "PostgreSQL", "Hyperledger Fabric"];

function Footer() {
  return (
    <footer className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              Secure matching. Accountable allocation. Verifiable records.
            </p>
          </div>
          <nav aria-label="Platform">
            <p className="text-sm font-semibold text-foreground">Platform</p>
            <ul className="mt-3 space-y-2.5">
              {FOOTER_PLATFORM.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-sm font-semibold text-foreground">Technology</p>
            <ul className="mt-3 space-y-2.5">
              {FOOTER_TECH.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <nav aria-label="Access">
            <p className="text-sm font-semibold text-foreground">Access</p>
            <ul className="mt-3 space-y-2.5">
              <li>
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © 2026 Secure Organ Donation System · Research Prototype
          </p>
          <div className="flex gap-6">
            {["Privacy", "Security", "Documentation"].map((item) => (
              <a
                key={item}
                href="#security"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <Intro />
        <Gallery />
        <Problem />
        <HowItWorks />
        <Matching />
        <MatchingImage />
        <SecuritySection />
        <AuditTimeline />
        <BlockchainSection />
        <SecurityTech />
        <OrganTypes />
        <Roles />
        <Architecture />
        <Statement />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
