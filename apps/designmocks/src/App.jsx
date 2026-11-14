import { verifiedRoleCheck } from './account-identity.js';
import { Contact, OperatorDetails } from './Contact.jsx';
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { brand, exams, money } from "./config.js";
import { Art, Arrow, Spark, Stimulus, ChoiceArt } from "./Art.jsx";
import {
  sampleQuestions,
  sampleReport,
  restoreSample,
  SAMPLE_STORAGE,
} from "./sample.mjs";
import { Workspace, Attempt, AttemptSyncPreview } from "./Workspace.jsx";
import {Purchase} from "./Purchase.jsx";
import { PortalModule, DeferredModule } from "./PortalShell.jsx";
import {postLaunchPreview}from "./launch-scope.js";
import {
  CandidateProfile,
  CandidateProfilePreview,
} from "./CandidateProfile.jsx";
import { TopicPractice, TopicPracticePreview } from "./TopicPractice.jsx";
import { ExamMocks, ExamMocksPreview } from "./ExamMocks.jsx";
import { AllIndia, AllIndiaHighlights, AllIndiaPreview } from "./AllIndia.jsx";
import { QuestionReportPreview } from "./QuestionReport.jsx";
import { Learn, LearnPreview } from "./Learn.jsx";
import { LearnProgrammePage, LearnProgrammePreview } from "./learn/LearnProgramme.jsx";
import { Community, CommunityPreview } from "./Community.jsx";
import { DrawingUploadsPreview } from "./DrawingUploads.jsx";
import { DrawingReviewMediaPreview } from "./DrawingReviewMedia.jsx";
import { DrawingReviewLifecyclePreview } from "./DrawingReviewQueue.jsx";
import { CommunityModerationPreview } from "./CommunityModeration.jsx";
import { AiQuestionDraftingPreview } from "./AiQuestionDrafting.jsx";
import { OperationalHealthPreview } from "./OperationalHealth.jsx";
import { LaunchReadinessPreview } from "./LaunchReadiness.jsx";
import { QuestionDraftExportPreview } from "./QuestionDraftExport.jsx";
import { AttemptInsightsPreview } from "./AttemptInsights.jsx";
import { AccountPrivacyPanel, AccountPrivacyPreview } from "./AccountPrivacy.jsx";
import { ExamPartTransitionPreview } from "./ExamPartTransition.jsx";
import { useAuthState } from "./useAuth.js";
import { clearDeviceAnswers } from "./attempt-answer-journal.js";
import { authCallbackMessage } from "./authConfiguration.mjs";
import { StagingAccessMessage, StagingPortalGate, useStagingPortalAccess } from "./StagingPortal.jsx";
import {
  platform,
  portalReady,
  authReady,
  testLoginMode,
  stagingPortalMode,
  checkoutReady,
  publishedNotices,
  googleLogin,
} from "./platform.js";

const PortalPreview = import.meta.env.DEV
  ? React.lazy(() => import("./PortalPreview.jsx"))
  : null;
const Admin = React.lazy(() => import("./Admin.jsx").then(module => ({ default: module.Admin })));
const DrawingReviewerWorkspace = React.lazy(() => import("./DrawingReviewerWorkspace.jsx").then(module => ({ default: module.DrawingReviewerWorkspace })));
const IntakeExtractionPreview = import.meta.env.DEV ? React.lazy(() => import("./Admin.jsx").then(module => ({ default: module.IntakeExtractionPreview }))) : null;
const BugReport = React.lazy(() => import("./BugReport.jsx").then(module => ({ default: module.BugReport })));
const PurchaseHistory = React.lazy(() => import("./PurchaseHistory.jsx"));

function Logo() {
  return (
    <div className="brand-lockup">
      <Link to="/" className="logo" aria-label="DMocks home">
        <span className="logo-symbol" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span>
          d<span>mocks</span>
          <b>.</b>
        </span>
      </Link>
      <a
        className="academy-byline"
        href="https://designexam.com/"
        target="_blank"
        rel="noreferrer"
      >
        by <span>Design Exam Academy</span>
      </a>
    </div>
  );
}
function Theme() {
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme === "dark",
  );
  return (
    <button
      className="theme icon-button"
      aria-label="Dark mode"
      role="switch"
      aria-checked={dark}
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.dataset.theme = next ? "dark" : "light";
        try {
          localStorage.setItem("designmocks-theme", next ? "dark" : "light");
        } catch {}
      }}
    >
      {dark ? (
        <span aria-hidden="true">☀</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M20 14A8 8 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />
        </svg>
      )}
    </button>
  );
}
function Button({ to, children, quiet = false, ...props }) {
  return to ? (
    <Link className={"button " + (quiet ? "quiet" : "")} to={to} {...props}>
      {children}
      <Arrow size={18} />
    </Link>
  ) : (
    <button className={"button " + (quiet ? "quiet" : "")} {...props}>
      {children}
      <Arrow size={18} />
    </button>
  );
}
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.4c2-1.8 2.9-4.4 2.9-7.7Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.8 0 5.2-.9 6.9-2.5l-3.4-2.6a6.3 6.3 0 0 1-9.4-3.3H2.6v2.7A10.4 10.4 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.1 13.6a6.2 6.2 0 0 1 0-3.2V7.7H2.6a10.2 10.2 0 0 0 0 8.6l3.5-2.7Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.1c1.6 0 2.9.5 4 1.6l3-3A10.1 10.1 0 0 0 2.6 7.7l3.5 2.7A6.2 6.2 0 0 1 12 6.1Z"
      />
    </svg>
  );
}
function Layout({ children }) {
  const [menu, setMenu] = useState(false);
  const location = useLocation();
  const menuRef = useRef();
  useEffect(() => {
    setMenu(false);
    if (location.hash) {
      requestAnimationFrame(() =>
        document.getElementById(location.hash.slice(1))?.scrollIntoView(),
      );
    } else {
      document.getElementById("main")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [location.pathname, location.hash]);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      {(!portalReady || stagingPortalMode) && (
        <div className="preview-strip">
          {stagingPortalMode ? "PRIVATE STAGING" : testLoginMode ? "PRIVATE SETUP" : "A FIRST LOOK"}{" "}
          <span>
            {stagingPortalMode ? "Portal acceptance for approved testers. Checkout is closed." :
              testLoginMode ? "Google sign-in is limited to approved testers. Purchases are closed." : "Explore the sample. Student sign-in and paid checkout are being connected."}
          </span>
        </div>
      )}
      <header
        className="header"
        onKeyDown={(e) => {
          if (e.key === "Escape" && menu) {
            setMenu(false);
            menuRef.current?.focus();
          }
        }}
      >
        <div className="wrap header-inner">
          <Logo />
          <nav
            className={menu ? "navigation is-open" : "navigation"}
            aria-label="Main navigation"
            id="navigation"
          >
            <NavLink to="/tests">Mock tests</NavLink>
            <Link to="/#how">How it works</Link>
            <Link to="/#report">Your report</Link>
            <NavLink to="/plans">The annual pass</NavLink>
            <NavLink to="/account" className="sign-in">
              Student sign in <Arrow size={16} />
            </NavLink>
          </nav>
          <div className="header-controls">
            <Theme />
            <button
              ref={menuRef}
              className="menu-button"
              aria-expanded={menu}
              aria-controls="navigation"
              onClick={() => setMenu(!menu)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setMenu(false);
                  menuRef.current?.focus();
                }
              }}
            >
              {menu ? "Close" : "Menu"}{" "}
              <span aria-hidden="true">{menu ? "×" : "☰"}</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex="-1">
        {children}
      </main>
      <footer>
        <div className="wrap footer-top">
          <div>
            <Logo />
            <p>
              A little practice.
              <br /> A clearer way forward.
            </p>
          </div>
          <div>
            <b>FIND YOUR FOCUS</b>
            <Link to="/tests/uceed">UCEED</Link>
            <Link to="/tests/nid">NID DAT</Link>
            <Link to="/tests/nift">NIFT</Link>
            <Link to="/tests/ceed">CEED</Link>
          </div>
          <div>
            <b>MAKE YOUR NEXT MOVE</b>
            <Link to="/sample">Try the sample</Link>
            <Link to="/plans">One-year pass</Link>
            <Link to="/account">Student sign in</Link>
            <Link to="/report">Report a problem</Link>
            <a href={brand.supportUrl} target="_blank" rel="noreferrer">
              Talk to the team <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="wrap academy-footer-note">
          <span>A little guidance beyond the mock?</span>
          <a
            href="https://designexam.com/courses/"
            target="_blank"
            rel="noreferrer"
          >
            Explore mentoring at Design Exam Academy <Arrow size={16} />
          </a>
        </div>
        <div className="wrap footer-bottom">
          <span>
            © {new Date().getFullYear()} DMocks. Stay curious.{" "}
            <Spark size={15} />
          </span>
          <p>
            Independent practice. No affiliation with the examination
            institutes.
          </p>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms & access</Link>
            <Link to="/refunds">Refunds</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
function HeroQuestion() {
  const [choice, setChoice] = useState(null);
  return (
    <div className="hero-art">
      <div className="hero-paper-back" />
      <div className="hero-paper-side" />
      <div className="hero-question">
        <div className="paper-top" aria-hidden="true">
          <span>THE PRACTICE ROOM</span>
          <span>01 / 05</span>
        </div>
        <h2>
          A little shift
          <br /> in <em>perspective.</em>
        </h2>
        <div className="hero-puzzle">
          <Stimulus kind="rotation" />
        </div>
        <p>Turn it 90° clockwise. Which one fits?</p>
        <div className="hero-options">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              aria-label={"Hero sample option " + String.fromCharCode(65 + i)}
              aria-pressed={choice === i}
              onClick={() => setChoice(i)}
              className={choice === i ? "selected" : ""}
            >
              <ChoiceArt kind="rotation" index={i} />
              <span>{String.fromCharCode(65 + i)}</span>
            </button>
          ))}
        </div>
        <div className="hero-feedback" aria-live="polite">
          {choice === null ? (
            <>
              <span className="small-dot" /> Go on. Trust your eye.
            </>
          ) : choice === 2 ? (
            <>
              <span className="small-dot" /> You found it. The whole shape turns
              together.
            </>
          ) : (
            <>
              <span className="small-dot orange" /> Follow the little square as
              the shape turns. Try again.
            </>
          )}
        </div>
      </div>
      <div className="hero-note">
        <Spark />
        <span>
          Less guessing.
          <br /> <b>More discovering.</b>
        </span>
      </div>
      <span className="hero-pencil" aria-hidden="true" />
    </div>
  );
}
function ExamCard({ exam, index = 0 }) {
  return (
    <article className={"exam-card exam-" + exam.id}>
      <div className="exam-art">
        <span className="exam-number" aria-hidden="true">
          0{index + 1} / {exam.level}
        </span>
        <Art kind={exam.art} />
        <span className="exam-art-label" aria-hidden="true">
          {exam.tag}
        </span>
      </div>
      <div className="exam-copy">
        <div className="exam-heading">
          <h3>{exam.name}</h3>
          <span>{exam.level}</span>
        </div>
        <p>{exam.description}</p>
        <span className="eyebrow">{["nid","nift"].includes(exam.id)?"Coming later":"Paid release under review"}</span>
        <Link className="text-link" to={"/tests/" + exam.id}>
          Explore {exam.name} <Arrow />
        </Link>
      </div>
    </article>
  );
}
function Catalogue({ full = false }) {
  const [filter, setFilter] = useState("all");
  const shown = exams.filter((e) => filter === "all" || e.category === filter);
  return (
    <section className="wrap section catalogue" id="catalogue">
      <div className="section-heading">
        <div>
          <span className="eyebrow">FOUR EXAMS. YOUR NEXT POSSIBILITY.</span>
          <h2>
            Find your focus.
            <br /> Make it <em>count.</em>
          </h2>
        </div>
        <div className="section-side">
          <p>
            A space to practise for the design entrance exam you’re working
            towards.
          </p>
          <div className="filters" role="group" aria-label="Filter exam level">
            {[
              ["all", "All exams"],
              ["undergraduate", "Undergraduate"],
              ["postgraduate", "Postgraduate"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" role="status">
        {shown.length} exam pathways shown
      </p>
      <div className="exam-grid">
        {shown.map((exam, i) => (
          <ExamCard key={exam.id} exam={exam} index={exams.indexOf(exam)} />
        ))}
      </div>
      {full && (
        <p className="catalogue-note">
          The sample shows the test experience using original questions. Full
          papers open after the separate student portal is activated.
        </p>
      )}
    </section>
  );
}
function ReportPreview() {
  const [tab, setTab] = useState("overview");
  return (
    <section className="report-section" id="report">
      <div className="wrap split report-split">
        <div>
          <span className="eyebrow">THE MARKS ARE JUST THE BEGINNING</span>
          <h2>
            Don’t just collect
            <br /> a score. Find your
            <br /> <em>next step.</em>
          </h2>
          <p>
            Notice what’s working. Find the gaps. Turn one attempt into a more
            focused next practice session.
          </p>
          <Button to="/sample" quiet>
            See it in the sample
          </Button>
        </div>
        <div className="report-preview">
          <div className="report-preview-top">
            <span>THE VIEW AFTER AN ATTEMPT</span>
            <span className="badge">Illustrative preview</span>
          </div>
          <div
            className="report-tabs"
            role="group"
            aria-label="Report preview view"
          >
            <button
              aria-pressed={tab === "overview"}
              onClick={() => setTab("overview")}
            >
              Your overview
            </button>
            <button
              aria-pressed={tab === "next"}
              onClick={() => setTab("next")}
            >
              What to practise
            </button>
          </div>
          {tab === "overview" ? (
            <>
              <div className="report-intro">
                <span className="report-spark">
                  <Spark size={32} />
                </span>
                <div>
                  <h3>See the whole picture.</h3>
                  <p>Section by section. Attempt by attempt.</p>
                </div>
              </div>
              {[
                ["Spatial thinking", 76, "green"],
                ["Observation", 88, "yellow"],
                ["Visual hierarchy", 58, "orange"],
              ].map(([title, width, tone]) => (
                <div className="skill-bar" key={title}>
                  <div>
                    <span>{title}</span>
                    <b>{width}%</b>
                  </div>
                  <i>
                    <span className={tone} style={{ width: width + "%" }} />
                  </i>
                </div>
              ))}
              <div className="report-callout">
                A useful question: what would you do differently next time?
              </div>
            </>
          ) : (
            <div className="practice-preview">
              <span className="eyebrow">YOUR NEXT 20 MINUTES</span>
              <h3>Look. Sketch. Compare.</h3>
              <ol>
                <li>
                  <b>5 min</b>
                  <span>Notice what catches your eye on three posters.</span>
                </li>
                <li>
                  <b>10 min</b>
                  <span>Rebuild one using just three sizes of type.</span>
                </li>
                <li>
                  <b>5 min</b>
                  <span>
                    Compare the order in which you read the information.
                  </span>
                </li>
              </ol>
              <p>A small, repeatable exercise beats another random attempt.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function PassPanel() {
  return (
    <section className="wrap section">
      <div className="pass-panel">
        <div>
          <span className="eyebrow">ONE PASS. ROOM TO GROW.</span>
          <h2>
            A year of practice.
            <br /> A little more <em>possibility.</em>
          </h2>
          <p>
            Your own preparation space, without joining a full coaching
            programme.
          </p>
          <div className="pass-chips">
            <span>Released papers only</span>
            <span>Timed objective practice</span>
          </div>
        </div>
        <div className="pass-price">
          <span>THE DMOCKS ANNUAL PASS</span>
          <div>
            {money(brand.price)}
            <small>/ year</small>
          </div>
          <p>
            One payment. 12 months of access.
            <br /> No automatic renewal.
          </p>
          <Button to="/plans">Explore the annual pass</Button>
        </div>
        <Spark size={110} />
      </div>
    </section>
  );
}
const faqs = [
  [
    "Do I need to join a coaching course?",
    "No. DMocks is a separate mock-test platform. The annual pass is for students who want to practise independently.",
  ],
  [
    "What does the ₹1,193 pass cover?",
    "Twelve months of access to the explicitly released paid papers shown before purchase, starting from a verified payment. One payment, no automatic renewal. Upcoming modules and unlisted exams are not included.",
  ],
  [
    "Can I try the experience first?",
    "Yes. The five-question sample is free and needs no sign-in. It uses original visual questions to show the timer, navigation, answer review and sample feedback. It is not a full-length exam mock.",
  ],
  [
    "Are the papers human-reviewed?",
    "Every sold paper must pass question, marking, timing, image and content-rights checks before release. The free sample uses separate original examples.",
  ],
  [
    "Are drawing reviews, lessons or rankings included?",
    "These are planned for a later release. The initial offer covers only the explicitly released assessment papers. No drawing, AI, Community, Learn or All India ranking service is promised with this launch.",
  ],
  [
    "Can I sign in and pay today?",
    "The annual-pass page shows which sign-in and payment options are available. You can explore the free sample at any time.",
  ],
];
function FAQs() {
  return (
    <section className="wrap section faq-section" id="faq">
      <div>
        <span className="eyebrow">GOOD QUESTIONS</span>
        <h2>
          A little clarity
          <br /> before you <em>begin.</em>
        </h2>
      </div>
      <div>
        {faqs.map(([q, a]) => (
          <details key={q}>
            <summary>
              {q}
              <span aria-hidden="true">+</span>
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
function Home() {
  return (
    <>
      <section className="wrap hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <i className="small-dot orange" /> DESIGN ENTRANCE PRACTICE / 2027
          </span>
          <h1>
            Make your
            <br /> next attempt
            <br /> <em>count.</em>
          </h1>
          <p>
            Mock tests for the way designers think.
            <br /> Practise with purpose. Review with clarity.
            <br /> Go into your exam a little more yourself.
          </p>
          <div className="hero-actions">
            <Button to="/tests">Find your mock test</Button>
            <Link to="/sample" className="sample-link">
              Try 5 sample questions <Arrow size={17} />
            </Link>
          </div>
          <div className="hero-proof">
            <span>
              <i />
              Original free sample
            </span>
            <span>Made for design aspirants</span>
          </div>
        </div>
        <HeroQuestion />
      </section>
      <div className="exam-ribbon wrap">
        <span>YOUR NEXT CHAPTER</span>
        {exams.map((e) => (
          <Link to={"/tests/" + e.id} key={e.id}>
            {e.name}
            <Arrow size={17} />
          </Link>
        ))}
      </div>
      <Catalogue />
      {postLaunchPreview&&<AllIndiaHighlights />}
      <section className="wrap section" id="how">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A BETTER PRACTICE LOOP</span>
            <h2>
              Less overthinking.
              <br /> More <em>doing.</em>
            </h2>
          </div>
          <p>
            Build the habit that makes the next attempt a little more
            considered.
          </p>
        </div>
        <div className="doing-grid">
          {[
            [
              "01",
              "Pick your paper.",
              "Choose the exam you’re preparing for. Make a little space in your day.",
              "space",
            ],
            [
              "02",
              "Give it your focus.",
              "Settle into a timed attempt. Work through one problem at a time.",
              "object",
            ],
            [
              "03",
              "Find your next step.",
              "Review the answers. Notice a pattern. Make your next practice count.",
              "report",
            ],
          ].map(([n, title, copy, art]) => (
            <article key={n}>
              <div>
                <Art kind={art} />
                <span>{n}</span>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <ReportPreview />
      <PassPanel />
      <FAQs />
      <section className="wrap final-cta">
        <Spark size={44} />
        <h2>
          One small attempt.
          <br /> A fresh <em>perspective.</em>
        </h2>
        <p>No sign-in. No perfect score needed. Just begin.</p>
        <Button to="/sample">Try the free sample</Button>
        <span>5 original questions · 6 minutes · Instant sample feedback</span>
      </section>
    </>
  );
}
function Tests() {
  return (
    <>
      <section className="wrap page-intro">
        <span className="eyebrow">THE PRACTICE ROOM</span>
        <h1>
          What are you
          <br /> working <em>towards?</em>
        </h1>
        <p>
          Choose your exam. Explore the practice. Begin with the free sample.
        </p>
      </section>
      <Catalogue full />
      <PassPanel />
    </>
  );
}
function ExamDetail() {
  const location = useLocation();
  const exam = exams.find((e) => location.pathname.endsWith("/" + e.id));
  if (!exam) return <NotFound />;
  return (
    <>
      <section className="wrap detail-hero split">
        <div>
          <Link className="back-link" to="/tests">
            ← All mock tests
          </Link>
          <span className="eyebrow">
            {exam.name} / {exam.level}
          </span>
          <h1>
            {exam.title.split(". ").map((s, i) => (
              <React.Fragment key={s}>
                {i ? <em>{s}</em> : s + "."}
                {!i && <br />}
              </React.Fragment>
            ))}
          </h1>
          <p>{exam.description}</p>
          <p className="notice">{["nid","nift"].includes(exam.id)?"This exam is coming later and is outside the initial annual-pass offer.":"The first paid offering is under review. Only its exact released paper and part will be included; a full two-part exam is not promised."}</p>
          <Button to="/sample">Try the experience sample</Button>
          <a
            className="source-link"
            href={exam.source}
            target="_blank"
            rel="noreferrer"
          >
            Official exam information ↗
          </a>
        </div>
        <div className={"detail-art exam-" + exam.id}>
          <Art kind={exam.art} />
          <span>{exam.tag}</span>
        </div>
      </section>
      <section className="wrap section">
        <span className="eyebrow">ABOUT THE EXAM</span>
        <div className="skills-grid">
          {exam.skills.map((s, i) => (
            <article key={s}>
              <span>0{i + 1}</span>
              <h2>{s}</h2>
              <p>
                {
                  [
                    "Look closely. Find connections. Make sense of what you see.",
                    "Break a problem down. Explore the possibilities. Check your assumptions.",
                    "Make your thinking visible and communicate an idea clearly.",
                  ][i]
                }
              </p>
            </article>
          ))}
        </div>
        <p className="catalogue-note">
          Exam routes and published papers are verified separately. The
          experience sample is a short demonstration, not a complete {exam.name}{" "}
          paper or a claim of an official exam pattern.
        </p>
      </section>
      <PassPanel />
    </>
  );
}
function Plans() {
  const { session } = useAuthState();
  const heading=useRef(null);
  return (
    <>
      <section className="wrap page-intro centered">
        <span className="eyebrow">ONE SIMPLE PASS</span>
        <h1 ref={heading} tabIndex={-1}>
          Your next year.
          <br /> More <em>possibilities.</em>
        </h1>
        <p>
          Mock-test practice that stands on its own.
          <br /> A single annual pass for your design preparation.
        </p>
      </section>
      <section className="wrap plan-layout">
        <div className="annual-card">
          <div className="annual-heading">
            <Spark />
            <span>THE ANNUAL PASS</span>
            <span className="badge">One payment</span>
          </div>
          <h2>
            All your practice.
            <br /> One place.
          </h2>
          <div className="annual-amount">
            {money(brand.price)}
            <span>/ one year</span>
          </div>
          <p className="annual-description">
            Access starts after a verified payment and lasts for 12 months. No
            automatic renewal.
          </p>
          <ul>
            {[
              "Only the explicitly released papers listed in the catalogue",
              "Adapted practice questions based on student recollections",
              "Timed attempts and saved progress",
              "Answer review after submission",
              "Your own student account",
            ].map((t) => (
              <li key={t}>
                <span aria-hidden="true">✓</span>
                {t}
              </li>
            ))}
          </ul>
          {!checkoutReady && (
            <div className="notice">
              {stagingPortalMode ? "Checkout is closed in staging." : "Paid access is not open in this preview. Explore the free sample while the separate sign-in and checkout are connected."}
            </div>
          )}
          {session && checkoutReady ? <Purchase actorId={session.user.id} headingRef={heading}/> : session ? (
            <button type="button" className="button full" disabled>Pay {money(brand.price)} with Razorpay <Arrow/></button>
          ) : (
            <Button to="/account?next=plans">Continue with Google <GoogleIcon/></Button>
          )}
          <Link className="sample-link" to="/sample">
            Try the sample first <Arrow size={17} />
          </Link>
          <div className="payment-note">
            <span>Google sign-in</span>
            <i />
            <span>Razorpay checkout</span>
          </div>
        </div>
        <div className="plan-aside">
          <Art kind="report" />
          <span className="eyebrow">A LITTLE DIRECTION GOES A LONG WAY</span>
          <h2>
            Attempt. Reflect.
            <br /> <em>Try again.</em>
          </h2>
          <p>
            You don’t need to practise everything at once. Start with one paper,
            then give your next session a clear purpose.
          </p>
          <Link to="/terms" className="text-link">
            Read the access terms <Arrow />
          </Link>
          <p className="academy-hint">
            Looking for mentor-led preparation?{" "}
            <a
              href="https://designexam.com/courses/"
              target="_blank"
              rel="noreferrer"
            >
              Meet Design Exam Academy <span aria-hidden="true">↗</span>
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
function Account() {
  const { session, loading, authError } = useAuthState();
  const stagingAccess = useStagingPortalAccess(session);
  const workspaceAvailable = portalReady && stagingAccess === "allowed";
  const accountId = session?.user.id;
  const [noticeReviewed, setNoticeReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("");
  const [reviewerAccountId, setReviewerAccountId] = useState(null);
  const [error, setError] = useState(() => authCallbackMessage(window.location.search, window.location.hash));
  const login = async () => {
    if (checkoutReady && !noticeReviewed) return;
    setBusy(true);
    setNoticeReviewed(false);
    setError("");
    try {
      await googleLogin();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  const refreshTestSession = async () => {
    setBusy(true);
    setSessionStatus("");
    try {
      const { error } = await platform.auth.refreshSession();
      if (error) throw error;
      setSessionStatus("Test session refreshed successfully.");
    } catch {
      setSessionStatus("Could not refresh the test session. Please sign in again.");
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    setBusy(true);
    setError("");
    setSessionStatus("");
    try {
      const { error } = await platform.auth.signOut({ scope: "local" });
      if (error) throw error;
      if (session?.user.id) clearDeviceAnswers(session.user.id);
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setReviewerAccountId(null);
    if (!postLaunchPreview || !accountId || !workspaceAvailable) return;
    const controller = new AbortController();
    verifiedRoleCheck(platform.auth, platform, accountId, "can_review_drawings", controller.signal).then(({ data, error }) => {
      if (!controller.signal.aborted && !error && data === true) setReviewerAccountId(accountId);
    }, () => {});
    return () => controller.abort();
  }, [accountId, workspaceAvailable]);
  return (
    <section className="wrap account-layout">
      <div>
        <span className="eyebrow">YOUR OWN PREPARATION SPACE</span>
        <h1>
          A little focus.
          <br /> A lot of <em>possibility.</em>
        </h1>
        <p>
          Your papers, your attempts, your next step.
          <br /> All in one student workspace.
        </p>
        <Art kind="ideas" />
      </div>
      <div className="account-card">
        <Spark size={34} />
        <h2>{session ? "Welcome back." : "Come on in."}</h2>
        <p>
            {session
            ? "Your Google account is connected."
            : stagingPortalMode ? "Sign in with an approved Google account for staging." :
              testLoginMode ? "Private Google sign-in check for approved testers." : "Sign in or create your account with Google."}
        </p>
        {loading ? (
          <p role="status">Checking your account…</p>
        ) : session ? (
          <>
            <p className="signed-in">Signed in as {session.user.email}</p>
            {testLoginMode && <p className="notice">Google sign-in succeeded. This is a private setup check. Public registration and purchases are closed; no paid access has been granted.</p>}
            {stagingPortalMode && <StagingAccessMessage access={stagingAccess} />}
            {(testLoginMode || stagingPortalMode) && <button className="button quiet" disabled={busy} onClick={refreshTestSession}>Refresh test session</button>}
            {sessionStatus && <p role="status">{sessionStatus}</p>}
            {workspaceAvailable && <Button to="/dashboard">{stagingPortalMode ? "Open staging workspace" : "Open your workspace"}</Button>}
            {postLaunchPreview && workspaceAvailable && reviewerAccountId === accountId && <Button to="/review/drawings" quiet>Review drawings</Button>}
            {workspaceAvailable && <Button to="/onboarding" quiet>
              Complete your profile
            </Button>}
            {workspaceAvailable && <Button to="/account/purchases" quiet>Purchase history</Button>}
            {checkoutReady && <Button to="/plans" quiet>
              View the annual pass
            </Button>}
            {workspaceAvailable && <AccountPrivacyPanel key={session.user.id} accountId={session.user.id}/>}
            <button
              className="text-button"
              disabled={busy}
              onClick={signOut}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <>
              {checkoutReady && (
                <label className="terms-checkbox">
                  <input
                    type="checkbox"
                    checked={noticeReviewed}
                    onChange={(e) => setNoticeReviewed(e.target.checked)}
                  />
                  <span>
                    I have read the <Link to="/terms">terms</Link> and{" "}
                    <Link to="/privacy">privacy notice</Link>.
                  </span>
                </label>
              )}
              <button
                className="google-button"
                disabled={!authReady || busy || (checkoutReady && !noticeReviewed)}
                onClick={login}
              >
                <GoogleIcon />
                {busy ? "Opening Google…" : stagingPortalMode ? "Sign in to staging with Google" : testLoginMode ? "Test Google sign-in" : "Continue with Google"}
              </button>
            </>
            {!authReady && (
              <div className="notice">
                Google sign-in is being connected for this new app. You can
                explore the full sample experience now.
              </div>
            )}
            {stagingPortalMode ? <p className="account-terms">Only approved testers can enter the staging workspace. Checkout is closed.</p> :
              testLoginMode ? <p className="account-terms">Only server-approved test accounts can complete this check. It does not accept draft purchase terms, create an order or unlock a paid pass.</p> : <p className="account-terms">
              {checkoutReady
                ? "Review the terms and privacy notice before continuing with Google. You can confirm a purchase separately in checkout."
                : "You can try the free sample without an account."}
            </p>}
            <div className="inline-links">
              <Link to="/terms">Terms & access</Link>
              <Link to="/privacy">Privacy</Link>
            </div>
            <Link className="sample-link" to="/sample">
              Explore without an account <Arrow size={16} />
            </Link>
          </>
        )}
        {(error || authError) && (
          <p className="error" role="alert">
            {error || authError}
          </p>
        )}
        <span className="account-footnote">
          A separate DMocks account. Your coaching enrolment is not required.
        </span>
      </div>
    </section>
  );
}
function readSample() {
  try {
    return restoreSample(localStorage.getItem(SAMPLE_STORAGE));
  } catch {
    return null;
  }
}
function Sample() {
  const navigate = useNavigate();
  const [state, setState] = useState(() => readSample());
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirm, setConfirm] = useState(false);
  const dialog = useRef();
  const questionTitle = useRef();
  useEffect(() => {
    if (questionTitle.current) {
      questionTitle.current?.focus({ preventScroll: true });
      questionTitle.current?.scrollIntoView({
        block: "start",
        behavior: "instant",
      });
    }
  }, [index]);
  const active = state?.status === "active";
  useEffect(() => {
    if (active) {
      document.getElementById("main")?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  useEffect(() => {
    if (state)
      try {
        localStorage.setItem(SAMPLE_STORAGE, JSON.stringify(state));
      } catch {}
  }, [state]);
  useEffect(() => {
    if (confirm && !dialog.current?.open) dialog.current?.showModal();
  }, [confirm]);
  const submit = () => {
    const finished = { ...state, status: "submitted", submittedAt: Date.now() };
    try {
      localStorage.setItem(SAMPLE_STORAGE, JSON.stringify(finished));
    } catch {}
    setState(finished);
    setConfirm(false);
    navigate("/sample/result", { state: { sample: finished } });
  };
  useEffect(() => {
    if (active && now >= state.deadline) submit();
  }, [now, active]);
  const start = () => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setNow(Date.now());
    setIndex(0);
    setState({
      status: "active",
      startedAt: Date.now(),
      deadline: Date.now() + 360000,
      answers: {},
      flagged: [],
    });
  };
  if (!active)
    return (
      <section className="wrap sample-start split">
        <div>
          <span className="eyebrow">A SMALL FIRST ATTEMPT</span>
          <h1>
            Meet the test.
            <br /> Trust your <em>eye.</em>
          </h1>
          <p>
            A short, original sample to explore how an attempt feels. No account
            or payment needed.
          </p>
          <ul className="sample-facts">
            <li>
              <b>05</b>
              <span>visual questions</span>
            </li>
            <li>
              <b>06</b>
              <span>minutes to explore</span>
            </li>
            <li>
              <Spark />
              <span>instant sample feedback</span>
            </li>
          </ul>
          <Button onClick={start}>
            {state?.status === "submitted"
              ? "Take the sample again"
              : "Begin the sample"}
          </Button>
          {state?.status === "submitted" && (
            <Link className="sample-link" to="/sample/result">
              View your last sample report <Arrow size={16} />
            </Link>
          )}
          <p className="sample-disclosure">
            This is an experience sample, not a full-length mock, official paper
            or prediction of your exam result. Each correct answer earns one
            point. There is no negative marking.
          </p>
        </div>
        <div className="sample-instructions">
          <Art kind="space" />
          <h2>A little orientation.</h2>
          <ol>
            <li>Choose one answer for each visual question.</li>
            <li>Move between questions or mark one to revisit.</li>
            <li>Your sample answers are saved on this device.</li>
            <li>Submit when you’re ready; the timer also submits at zero.</li>
          </ol>
        </div>
      </section>
    );
  const q = sampleQuestions[index],
    left = Math.max(0, Math.ceil((state.deadline - now) / 1000));
  const answer = (value) =>
    setState((s) => ({ ...s, answers: { ...s.answers, [q.id]: value } }));
  return (
    <section className="wrap sample-run">
      <div className="runner-top">
        <div>
          <span className="eyebrow">DMOCKS / EXPERIENCE SAMPLE</span>
          <h1>One question at a time.</h1>
        </div>
        <div
          className="timer"
          role="timer"
          aria-live="off"
          aria-label="Time remaining"
        >
          <span>
            {Math.floor(left / 60)
              .toString()
              .padStart(2, "0")}
            :{(left % 60).toString().padStart(2, "0")}
          </span>
          <small>remaining</small>
        </div>
      </div>
      <div className="runner-layout">
        <article className="question-panel">
          <div className="question-meta">
            <span>QUESTION {String(index + 1).padStart(2, "0")} / 05</span>
            <span>{q.topic}</span>
          </div>
          <h2 ref={questionTitle} tabIndex={-1} className="question-title">
            {q.title}
          </h2>
          <p>{q.instruction}</p>
          <div className="question-stimulus">
            <Stimulus kind={q.kind} />
          </div>
          <div className="answer-grid" role="group" aria-label="Answer choices">
            {[0, 1, 2, 3].map((i) => (
              <button
                className={state.answers[q.id] === i ? "chosen" : ""}
                key={i}
                aria-label={"Option " + String.fromCharCode(65 + i)}
                aria-pressed={state.answers[q.id] === i}
                onClick={() => answer(i)}
              >
                <span className="choice-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <ChoiceArt kind={q.kind} index={i} />
              </button>
            ))}
          </div>
          <div className="runner-actions">
            <button
              className="text-button"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              ← Previous
            </button>
            <button
              className="text-button"
              aria-pressed={state.flagged.includes(q.id)}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  flagged: s.flagged.includes(q.id)
                    ? s.flagged.filter((id) => id !== q.id)
                    : [...s.flagged, q.id],
                }))
              }
            >
              {state.flagged.includes(q.id)
                ? "Marked to revisit"
                : "Mark to revisit"}
            </button>
            {index < 4 ? (
              <Button onClick={() => setIndex(index + 1)}>Next question</Button>
            ) : (
              <Button onClick={() => setConfirm(true)}>Review & submit</Button>
            )}
          </div>
        </article>
        <aside className="question-palette">
          <h2>Your five questions.</h2>
          <div>
            {sampleQuestions.map((item, i) => (
              <button
                key={item.id}
                aria-label={
                  "Go to question " +
                  (i + 1) +
                  (state.answers[item.id] !== undefined ? ", answered" : "") +
                  (state.flagged.includes(item.id) ? ", marked to revisit" : "")
                }
                aria-current={i === index ? "step" : undefined}
                className={
                  (state.answers[item.id] !== undefined ? "answered " : "") +
                  (state.flagged.includes(item.id) ? "flagged" : "")
                }
                onClick={() => setIndex(i)}
              >
                {i + 1}
                {state.flagged.includes(item.id) && <i aria-hidden="true" />}
              </button>
            ))}
          </div>
          <p>{Object.keys(state.answers).length} of 5 answered</p>
          <span className="palette-key">
            <i /> Answered <b /> To revisit
          </span>
          <button className="button quiet" onClick={() => setConfirm(true)}>
            Submit sample <Arrow size={17} />
          </button>
          <small>
            Original sample questions. Your sample is stored only on this
            device.
          </small>
        </aside>
      </div>
      {confirm && (
        <dialog
          ref={dialog}
          onCancel={() => setConfirm(false)}
          className="submit-dialog"
        >
          <span className="eyebrow">A MOMENT TO CHECK</span>
          <h2>Ready for a fresh perspective?</h2>
          <p>
            You’ve answered {Object.keys(state.answers).length} of 5 questions.{" "}
            {state.flagged.length} marked to revisit.
          </p>
          <p>You can’t change this sample attempt after submitting.</p>
          <div>
            <Button onClick={submit}>Submit & see my sample report</Button>
            <button
              className="text-button"
              onClick={() => {
                dialog.current.close();
                setConfirm(false);
              }}
            >
              Back to the questions
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
function SampleResult() {
  const location = useLocation();
  const state = location.state?.sample ?? readSample();
  const [review, setReview] = useState(false);
  if (state?.status !== "submitted")
    return (
      <section className="wrap page-intro">
        <h1>
          Your first step
          <br /> starts <em>here.</em>
        </h1>
        <Button to="/sample">Try the sample</Button>
      </section>
    );
  const report = sampleReport(state.answers);
  const focus = report.focus.length ? report.focus : report.items.slice(0, 3);
  return (
    <section className="wrap section sample-result">
      <div className="result-title">
        <div>
          <span className="eyebrow">
            YOUR EXPERIENCE SAMPLE / FIVE QUESTIONS
          </span>
          <h1>
            A little insight.
            <br /> Your next <em>step.</em>
          </h1>
          <p>
            This is feedback on these five sample questions, not a
            design-ability diagnosis or exam prediction.
          </p>
        </div>
        <div className="sample-score">
          <span>
            {report.correct}
            <i>/5</i>
          </span>
          <p>correct in this sample</p>
          <Spark size={28} />
        </div>
      </div>
      <div className="result-grid">
        <article>
          <span className="eyebrow">A GLIMPSE OF YOUR ATTEMPT</span>
          <h2>What you noticed.</h2>
          {report.items.map((q) => (
            <div className="result-topic" key={q.id}>
              <span>{q.topic}</span>
              <b>
                {q.correct
                  ? "Correct"
                  : q.chosen === null
                    ? "Not answered"
                    : "Try again"}
              </b>
            </div>
          ))}
        </article>
        <article>
          <span className="eyebrow">PUT THE INSIGHT TO WORK</span>
          <h2>
            {report.focus.length
              ? "Give these a little attention."
              : "Keep the curiosity going."}
          </h2>
          {focus.map((q) => (
            <div className="next-exercise" key={q.id}>
              <h3>{q.topic}</h3>
              <p>{q.practice}</p>
            </div>
          ))}
        </article>
      </div>
      <div className="review-toggle">
        <h2>Curious about an answer?</h2>
        <button
          className="text-button"
          aria-expanded={review}
          onClick={() => setReview(!review)}
        >
          {review ? "Close answer review" : "Open answer review"}{" "}
          <span aria-hidden="true">{review ? "−" : "+"}</span>
        </button>
      </div>
      {review && (
        <div className="answer-review">
          {report.items.map((q, i) => (
            <article key={q.id}>
              <span className="eyebrow">
                QUESTION {i + 1} / {q.topic}
              </span>
              <h3>{q.title}</h3>
              <p>
                Your choice:{" "}
                {q.chosen === null
                  ? "Not answered"
                  : String.fromCharCode(65 + q.chosen)}{" "}
                · Correct choice: {String.fromCharCode(65 + q.answer)}
              </p>
              <p>{q.explanation}</p>
            </article>
          ))}
        </div>
      )}
      <div className="result-bottom">
        <Button to="/plans">Explore one year of practice</Button>
        <Button to="/sample" quiet>
          Try the sample again
        </Button>
      </div>
    </section>
  );
}
function Policies({ type }) {
  const privacy = type === "privacy";
  const refunds = type === "refunds";
  const refundTitle = "Cancellation and refunds.";
  if (publishedNotices) {
    return (
      <section className="wrap policy section">
        <span className="eyebrow">DMOCKS / CUSTOMER NOTICE</span>
        <h1>{refunds ? refundTitle : privacy ? "Privacy notice." : "Terms and purchase."}</h1>
        <p data-notice-version={publishedNotices.version}>Notice revision {publishedNotices.version.slice(-12)}.</p>
        <OperatorDetails />
        {publishedNotices.pages[type].map(({ heading, paragraph }) => (
          <section key={heading}>
            {!refunds && <h2>{heading}</h2>}
            <p>{paragraph}</p>
          </section>
        ))}
      </section>
    );
  }
  return (
    <section className="wrap policy section">
      <span className="eyebrow">DMOCKS / FIRST-LOOK PREVIEW</span>
      <h1>
        {refunds ? refundTitle : privacy
          ? "Your space. Your information."
          : "Clear access. A little clarity."}
      </h1>
      <div className="notice">
        Launch notice: the production student service and live payments are not
        active in this preview. The final purchase/refund policy and younger-student requirements must
        be published before registration and paid sales open.
      </div>
      <OperatorDetails />
      {refunds ? (
        <p>
          The final cancellation and refund policy will be available before paid checkout opens.
          For help with the preview, <Link to="/contact">contact the team</Link>.
        </p>
      ) : privacy ? (
        <>
          <h2>The sample</h2>
          <p>
            The original five-question sample saves answers, timing and its
            result in this browser’s local storage. It does not create a student
            account or transmit those sample answers to a server. Clearing
            browser storage removes them.
          </p>
          <h2>Student accounts</h2>
          <p>
            Once activated, Google sign-in will be used for a separate DMocks
            account. Only the basic Google account details required for sign-in
            will be requested. The production privacy notice will identify the
            operator, processors, retention periods, deletion process and any
            requirements for younger students before registration opens.
          </p>
          <h2>Payments</h2>
          <p>
            Payments will be handled by Razorpay. Card details will not be
            stored in the app. This preview does not take live payments.
          </p>
          <h2>Questions</h2>
          <p>
            <a href={brand.supportUrl} target="_blank" rel="noreferrer">
              Contact the team
            </a>{" "}
            about the preview.
          </p>
        </>
      ) : (
        <>
          <h2>The annual pass</h2>
          <p>
            The approved price is ₹1,193 for 12 calendar months of access to the explicitly released catalogue. It is
            one payment with no automatic renewal. The access period begins
            after the server verifies a successful payment. A checkout success
            screen alone does not grant access.
          </p>
          <h2>The experience sample</h2>
          <p>
            The five-question sample is free and uses original example
            questions. Its score describes that sample attempt only. It does not
            estimate admission chances or represent an official exam paper.
          </p>
          <h2>Before paid launch</h2>
          <p>
            The final scope of published papers, refund handling and applicable purchase terms will be
            confirmed before checkout opens. No refund promise or subscription
            policy should be inferred from this preview.
          </p>
          <h2>Independent preparation</h2>
          <p>
            DMocks is an independent practice platform and is not affiliated
            with NID, NIFT, IITs or their examinations.
          </p>
        </>
      )}
    </section>
  );
}
function NotFound() {
  return (
    <section className="wrap page-intro">
      <span className="eyebrow">A DIFFERENT TURN</span>
      <h1>
        This page took
        <br /> another <em>path.</em>
      </h1>
      <Button to="/">Back to the beginning</Button>
    </section>
  );
}

function ControlledLoginPortalNotice() {
  return <section className="wrap page-intro">
    <span className="eyebrow">CONTROLLED GOOGLE LOGIN</span>
    <h1>The workspace is <em>closed.</em></h1>
    <p>Use the account page to check Google sign-in, session refresh and sign-out.</p>
    <Button to="/account">Go to account</Button>
  </section>;
}

export default function App() {
  const location = useLocation();
  return (
    <Layout>
      <React.Suspense fallback={<p className="wrap" role="status">Opening your workspace…</p>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tests" element={<Tests />} />
        <Route path="/tests/:exam" element={<ExamDetail />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/account" element={<Account />} />
        <Route path="/account/callback" element={<Account />} />
        <Route element={stagingPortalMode ? <StagingPortalGate /> : testLoginMode ? <ControlledLoginPortalNotice /> : <Outlet />}>
          <Route path="/dashboard" element={<Workspace />} />
          <Route path="/onboarding" element={<CandidateProfile />} />
          <Route path="/account/purchases" element={<PurchaseHistory />} />
          <Route path="/dashboard/mocks" element={postLaunchPreview?<ExamMocks />:<Workspace catalogueOnly/>} />
          <Route path="/dashboard/all-india" element={postLaunchPreview?<AllIndia />:<DeferredModule module="all-india"/>} />
          <Route path="/dashboard/practice" element={postLaunchPreview?<TopicPractice />:<DeferredModule module="practice"/>} />
          <Route path="/dashboard/learn" element={postLaunchPreview?<Learn />:<DeferredModule module="learn"/>} />
          <Route path="/dashboard/learn/programme/:slug" element={postLaunchPreview?<LearnProgrammePage />:<DeferredModule module="learn"/>} />
          <Route path="/dashboard/community" element={postLaunchPreview?<Community />:<DeferredModule module="community"/>} />
          <Route path="/report" element={<BugReport />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/review/drawings" element={postLaunchPreview?<DrawingReviewerWorkspace />:<DeferredModule module="drawings"/>} />
          <Route path="/attempt/:id" element={<Attempt key={location.pathname} />} />
        </Route>
        {import.meta.env.DEV && (
          <Route
            path="/portal-preview/*"
            element={
              <React.Suspense
                fallback={
                  <p className="wrap" role="status">
                    Opening the portal preview…
                  </p>
                }
              >
                <PortalPreview />
              </React.Suspense>
            }
          />
        )}
        {import.meta.env.DEV && (
          <Route
            path="/profile-preview"
            element={<CandidateProfilePreview />}
          />
        )}
        {import.meta.env.DEV && (
          <Route
            path="/topic-practice-preview"
            element={<TopicPracticePreview />}
          />
        )}
        {import.meta.env.DEV && (
          <Route path="/exam-mocks-preview" element={<ExamMocksPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/all-india-preview" element={<AllIndiaPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route
            path="/question-report-preview"
            element={<QuestionReportPreview />}
          />
        )}
        {import.meta.env.DEV && (
          <Route path="/learn-preview" element={<LearnPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/learn-programme-preview/:slug?" element={<LearnProgrammePreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/community-preview" element={<CommunityPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route
            path="/drawing-uploads-preview"
            element={<DrawingUploadsPreview />}
          />
        )}
        {import.meta.env.DEV && (
          <Route path="/drawing-review-preview" element={<DrawingReviewMediaPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/drawing-review-lifecycle-preview" element={<DrawingReviewLifecyclePreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/community-moderation-preview" element={<CommunityModerationPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/ai-question-drafting-preview" element={<AiQuestionDraftingPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/operations-health-preview" element={<OperationalHealthPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/launch-readiness-preview" element={<LaunchReadinessPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/attempt-sync-preview" element={<AttemptSyncPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/intake-extraction-preview" element={<IntakeExtractionPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/question-draft-export-preview" element={<QuestionDraftExportPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/attempt-insights-preview" element={<AttemptInsightsPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/account-privacy-preview" element={<AccountPrivacyPreview />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/exam-part-transition-preview" element={<ExamPartTransitionPreview />} />
        )}

        <Route path="/sample" element={<Sample />} />
        <Route path="/sample/result" element={<SampleResult />} />
        <Route path="/privacy" element={<Policies type="privacy" />} />
          <Route path="/contact" element={<Contact />} />
        <Route path="/terms" element={<Policies type="terms" />} />
        <Route path="/refunds" element={<Policies type="refunds" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </React.Suspense>
    </Layout>
  );
}
