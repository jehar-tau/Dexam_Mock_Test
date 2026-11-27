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
  useParams,
} from "react-router-dom";
import { brand, exams, money } from "./config.js";
import { Art, Arrow, Spark, Stimulus, ChoiceArt, describeChoice } from "./Art.jsx";
import { FeatureShowcase, FreePass, JoinLink, PublicPracticeOptions } from "./LandingFeatures.jsx";
import { SignReadingExercise } from "./SignReadingExercise.jsx";
import { LogoMotion } from "./LogoMotion.jsx";
import {
  sampleQuestions,
  sampleReport,
  restoreSample,
  SAMPLE_STORAGE,
  SAMPLE_DURATION_MS,
} from "./sample.mjs";
import { Workspace, Attempt, AttemptSyncPreview } from "./Workspace.jsx";
import { Theme } from "./ThemeToggle.jsx";
import { HomeFreePapers } from "./HomeFreePapers.jsx";
import { FreeSignupNotice } from './FreeSignupNotice.jsx';
import { takeReturn } from "./return-path.js";
import {Purchase} from "./Purchase.jsx";
import { PortalModule, DeferredModule } from "./PortalShell.jsx";
import {postLaunchPreview,studentModuleReleased}from "./launch-scope.js";
import { hostedStudentPreview, studentPreview } from "./student-preview.js";
import {
  CandidateProfile,
  CandidateProfilePreview,
} from "./CandidateProfile.jsx";
import { QuestionReportPreview } from "./QuestionReport.jsx";
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
  controlledPublicPortalMode,
  checkoutReady,
  publishedNotices,
  googleLogin,
} from "./platform.js";

const includeStudentPreview = import.meta.env.DEV || __DMOCKS_STAGING_REVIEW_PREVIEW__;

const PortalPreview = includeStudentPreview
  ? React.lazy(() => import("./PortalPreview.jsx"))
  : null;
const PapersPreview = includeStudentPreview
  ? React.lazy(() => import("./PapersPreview.jsx"))
  : null;
const DrawingTaskPreview = includeStudentPreview
  ? React.lazy(() => import("./DrawingTaskPreview.jsx"))
  : null;
const TopicPractice = React.lazy(() => import("./TopicPractice.jsx").then(module => ({ default: module.TopicPractice })));
const ExamMocks = React.lazy(() => import("./ExamMocks.jsx").then(module => ({ default: module.ExamMocks })));
const Papers = React.lazy(() => import("./Papers.jsx"));
const AllIndia = React.lazy(() => import("./AllIndia.jsx").then(module => ({ default: module.AllIndia })));
function LearnSignIn() {
  return <section className="wrap section">
    <h1>Sign in to <em>learn.</em></h1>
    <Link to="/account">Student sign in</Link>
  </section>;
}
const Learn = __DMOCKS_INCLUDE_LEARN__
  ? React.lazy(() => import("./Learn.jsx").then(module => ({ default: module.Learn }))) : LearnSignIn;
const LearnProgrammes = __DMOCKS_INCLUDE_LEARN__
  ? React.lazy(() => import("./Learn.jsx").then(module => ({ default: module.LearnProgrammes }))) : LearnSignIn;
const LearnProgrammePage = __DMOCKS_INCLUDE_LEARN__
  ? React.lazy(() => import("./learn/LearnProgramme.jsx").then(module => ({ default: module.LearnProgrammePage }))) : LearnSignIn;
const Community = React.lazy(() => import("./Community.jsx").then(module => ({ default: module.Community })));
const CommunityArticles = React.lazy(() => import("./CommunityArticles.jsx").then(module => ({ default: module.CommunityArticles })));
const CommunityEditor = React.lazy(() => import("./CommunityEditor.jsx").then(module => ({ default: module.CommunityEditor })));
const CommunityReader = React.lazy(() => import("./CommunityReader.jsx").then(module => ({ default: module.CommunityReader })));
const CommunitySaved = React.lazy(() => import("./CommunitySaved.jsx").then(module => ({ default: module.CommunitySaved })));
const AllIndiaHighlights = React.lazy(() => import("./AllIndia.jsx").then(module => ({ default: module.AllIndiaHighlights })));
const TopicPracticePreview = includeStudentPreview
  ? React.lazy(() => import("./TopicPractice.jsx").then(module => ({ default: module.TopicPracticePreview }))) : null;
const ExamMocksPreview = includeStudentPreview
  ? React.lazy(() => import("./ExamMocks.jsx").then(module => ({ default: module.ExamMocksPreview }))) : null;
const AllIndiaPreview = includeStudentPreview
  ? React.lazy(() => import("./AllIndia.jsx").then(module => ({ default: module.AllIndiaPreview }))) : null;
const LearnPreview = includeStudentPreview
  ? React.lazy(() => import("./Learn.jsx").then(module => ({ default: module.LearnPreview }))) : null;
const LearnProgrammePreview = includeStudentPreview
  ? React.lazy(() => import("./learn/LearnProgramme.jsx").then(module => ({ default: module.LearnProgrammePreview }))) : null;
const MotionGallery = import.meta.env.DEV
  ? React.lazy(() => import("./MotionGallery.jsx")) : null;
const CommunityPreview = includeStudentPreview
  ? React.lazy(() => import("./Community.jsx").then(module => ({ default: module.CommunityPreview }))) : null;
const Admin = !__DMOCKS_STAGING_REVIEW_PREVIEW__ ? React.lazy(() => import("./Admin.jsx").then(module => ({ default: module.Admin }))) : null;
const DrawingReviewerWorkspace = !__DMOCKS_STAGING_REVIEW_PREVIEW__ ? React.lazy(() => import("./DrawingReviewerWorkspace.jsx").then(module => ({ default: module.DrawingReviewerWorkspace }))) : null;
const IntakeExtractionPreview = import.meta.env.DEV ? React.lazy(() => import("./Admin.jsx").then(module => ({ default: module.IntakeExtractionPreview }))) : null;
const BugReport = !__DMOCKS_STAGING_REVIEW_PREVIEW__ ? React.lazy(() => import("./BugReport.jsx").then(module => ({ default: module.BugReport }))) : null;
const PurchaseHistory = !__DMOCKS_STAGING_REVIEW_PREVIEW__ ? React.lazy(() => import("./PurchaseHistory.jsx")) : null;

function Logo() {
  return (
    <div className="brand-lockup">
      <Link to="/" className="logo" aria-label="DMocks home">
        <span className="logo-symbol has-motion" aria-hidden="true">
          <LogoMotion />
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
  const { session } = useAuthState();
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
      {(!portalReady || stagingPortalMode || (controlledPublicPortalMode && !session)) && (
        <div className="preview-strip">
          {__DMOCKS_STAGING_REVIEW_PREVIEW__ && hostedStudentPreview ? "OWNER REVIEW" : controlledPublicPortalMode ? "FREE PAPERS" : stagingPortalMode ? "PRIVATE STAGING" : testLoginMode ? "PRIVATE SETUP" : "A FIRST LOOK"}{" "}
          <span>
            {__DMOCKS_STAGING_REVIEW_PREVIEW__ && hostedStudentPreview ? "Explore the student experience with fictional examples. Sign-in and checkout are closed." :
              controlledPublicPortalMode ? "Sign in with Google to take free past papers. The annual pass is not on sale yet." :
              stagingPortalMode ? "Portal acceptance for approved testers. Checkout is closed." :
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
            <NavLink to="/papers">Papers</NavLink>
            <Link to="/#features">What’s inside</Link>
            <Link to="/#how">How it works</Link>
            <NavLink to="/plans">The annual pass</NavLink>
            <NavLink to={__DMOCKS_STAGING_REVIEW_PREVIEW__ && hostedStudentPreview ? "/portal-preview" : "/account"} className="sign-in">
              {__DMOCKS_STAGING_REVIEW_PREVIEW__ && hostedStudentPreview ? "Student preview" : "Student sign in"} <Arrow size={16} />
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
            <b>EXAM GUIDES</b>
            <Link to="/tests/uceed">UCEED</Link>
            <Link to="/tests/nid">NID DAT</Link>
            <Link to="/tests/nift">NIFT</Link>
            <Link to="/tests/ceed">CEED</Link>
          </div>
          <div>
            <b>MAKE YOUR NEXT MOVE</b>

            <Link to="/sample">Try the sample</Link>
            <Link to="/papers">Year-wise papers</Link>
            <Link to="/plans">One-year pass</Link>
            <Link to={__DMOCKS_STAGING_REVIEW_PREVIEW__ && hostedStudentPreview ? "/portal-preview" : "/account"}>
              {__DMOCKS_STAGING_REVIEW_PREVIEW__ && hostedStudentPreview ? "Student preview" : "Student sign in"}
            </Link>
            <Link to={session ? "/report" : "/contact"} state={session && location.pathname !== "/report" ? { reportFrom: location.pathname } : undefined}>Report a problem</Link>
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
          <span>WARM-UP</span>
        </div>
        <h2>
          A little shift
          <br /> in <em>perspective.</em>
        </h2>
        <div className="hero-puzzle">
          <div className="warmup-compass" aria-label="Facing north, turn a quarter-turn left" role="img"><span aria-hidden="true">↑</span> North</div>
        </div>
        <p>You face north and turn a quarter-turn left. Which direction do you face?</p>
        <div className="hero-options">
          {["North", "East", "South", "West"].map((direction, i) => (
            <button
              key={direction}
              aria-label={direction}
              aria-pressed={choice === i}
              onClick={() => setChoice(i)}
              className={choice === i ? "selected" : ""}
            >
              <b aria-hidden="true" className="warmup-direction">{["↑", "→", "↓", "←"][i]}</b>
              <span>{direction}</span>
            </button>
          ))}
        </div>
        <div className="hero-feedback" aria-live="polite">
          {choice === null ? (
            <>
              <span className="small-dot" /> Choose a direction.
            </>
          ) : choice === 3 ? (
            <>
              <span className="small-dot" /> West. On a north-up map, a left turn takes you west.
            </>
          ) : (
            <>
              <span className="small-dot orange" /> Point up, then rotate your finger left by 90°. Try again.
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
        <span className="eyebrow">Free past-year papers</span>
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
            Choose an exam for official preparation resources and the current DMocks offer.
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
          The free DMocks sample uses five original visual questions. Paid access covers only the papers listed when checkout opens.
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
    "Is it free to join?",
    "Student accounts are free when registration opens. The five-question sample is available now without an account.",
  ],
  [
    "What about Learn, Topic practice, All India mocks, Community and drawing review?",
    "They are all part of DMocks and are opening in stages. Anything marked Opening soon on this page is not open to students yet, and the annual pass covers only the released papers listed before you pay.",
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
function PortalHomeSections() {
  return (
    <>
      <div className="exam-ribbon wrap">
        <span>YOUR NEXT CHAPTER</span>
        {exams.map((e) => (
          <Link to={"/tests/" + e.id} key={e.id}>
            {e.name}
            <Arrow size={17} />
          </Link>
        ))}
      </div>
      <FeatureShowcase />
      <Catalogue />
      {postLaunchPreview && !stagingPortalMode && <AllIndiaHighlights />}
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
      <FreePass />
      <PassPanel />
      <FAQs />
    </>
  );
}

function PublicHomeSections() {
  return (
    <>
      <PublicPracticeOptions />
      <section className="wrap section" id="how">
        <div className="section-heading">
          <h2>How the free sample works</h2>
          <p>Start when you have six minutes. You can take the sample without an account.</p>
        </div>
        <div className="doing-grid">
          {[
            ["Start the timer", "Choose one answer for each visual question. Answers and flags are saved in this browser when device storage is available.", "space"],
            ["Check before submitting", "Return to flagged questions while time remains. Submit to finish early. If time runs out, the answers you saved are used.", "object"],
            ["Read your five-question report", "See your score out of five and a result for each question. Open answer review to read the explanations, then try one of the suggested practice exercises.", "report"],
          ].map(([title, text, art]) => (
            <article key={title}>
              <div><Art kind={art} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="wrap section faq-section" id="faq">
        <h2>Practice questions</h2>
        <div>
          <details>
            <summary>How is the sample scored?</summary>
            <p>Each correct answer earns one point. Incorrect and unanswered questions score zero. The score describes only this five-question sample.</p>
          </details>
          <details>
            <summary>Can I practise without a timer?</summary>
            <p>Yes. The <Link to="/practice/visual-hierarchy">visual hierarchy exercise</Link> is untimed and includes a worked explanation.</p>
          </details>
          <details>
            <summary>Can I buy a UCEED mock now?</summary>
            <p>Paid checkout is closed. The <Link to="/tests/uceed">UCEED Part A guide</Link> explains the planned paper and links to official past papers you can use now.</p>
          </details>
        </div>
      </section>
    </>
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
            Take complete UCEED, CEED, NID and NIFT past papers for free, timed like the real exam, with a worked solution for every question.
          </p>
          <div className="hero-actions">
            <Link to="/papers" className="button join-button">
              Browse free papers <Arrow size={17} />
            </Link>
            <Link to="/sample" className="sample-link">
              Try 5 sample questions <Arrow size={17} />
            </Link>
          </div>
          <div className="hero-proof">
            <span>
              <i />
              Free papers with full solutions
            </span>
            <span>Sample needs no sign-in</span>
          </div>
        </div>
        <HeroQuestion />
      </section>
      <HomeFreePapers />
      {portalReady || postLaunchPreview ? <PortalHomeSections /> : <PublicHomeSections />}
      <section className="wrap final-cta">
        <Spark size={44} />
        <h2>
          One small attempt.
          <br /> A fresh <em>perspective.</em>
        </h2>
        <div className="final-actions">
          {portalReady && <JoinLink />}
          <Link to="/sample" className={portalReady ? "sample-link" : "button join-button"}>
            Try the free sample <Arrow size={17} />
          </Link>
        </div>
        <span>5 original questions · 6 minutes · No sign-in for the sample</span>
      </section>
    </>
  );
}
function Tests() {
  return (
    <>
      <section className="wrap page-intro">
        <h1>Design entrance <em>mock tests and practice.</em></h1>
        <p>
          Choose a timed sample or work through a design exercise at your own pace. Both are free and open without an account.
        </p>
        <div className="discovery-actions">
          <Button to="/sample">Try the timed sample</Button>
          <Link className="text-link" to="/practice/visual-hierarchy">Try a visual hierarchy exercise <Arrow /></Link>
        </div>
      </section>
      <Catalogue full />
      <PassPanel />
    </>
  );
}
function ExamDetail() {
  const { exam: examId } = useParams();
  const exam = exams.find((item) => item.id === examId);
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
          <h1>{exam.title}</h1>
          <p>{exam.description}</p>
          <p className="notice">
            Free {exam.name} past papers are open on DMocks: take a complete paper with its original timer and marking, then review a worked solution for every question.
          </p>
          <div className="detail-actions">
            {exam.id === "nid" || exam.id === "nift" ? <>
              <Button to={"/papers/" + exam.id}>Browse free {exam.id.toUpperCase()} B.Des. papers</Button>
              <Button to={"/papers/" + exam.id + "?programme=mdes"} quiet>Browse free {exam.id.toUpperCase()} M.Des. papers</Button>
            </> : <Button to={"/papers/" + exam.id}>Browse free {exam.name} papers</Button>}
            <Button to="/sample" quiet>Try the free design practice sample</Button>
          </div>
          <p className="sample-disclosure">Five original visual questions, six minutes and feedback after submission. No account required.</p>
        </div>
        <div className={"detail-art exam-" + exam.id}>
          <Art kind={exam.art} />
          <span>{exam.tag}</span>
        </div>
      </section>
      <section className="wrap section exam-resources">
        <h2>{exam.resourceTitle}</h2>
        {exam.id === "uceed" && (
          <p>IIT Bombay’s UCEED 2027 Part A is a two-hour computer-based test with numerical-answer, multiple-select and multiple-choice questions. The DMocks sample uses single-choice questions and its own scoring.</p>
        )}
        <p>{exam.resource}</p>
        <ul>
          {exam.practiceSource && <li><a href={exam.practiceSource}>{exam.practiceLabel}</a></li>}
          <li><a href={exam.source}>{exam.sourceLabel}</a></li>
        </ul>
        <p className="source-date">Official resources checked <time dateTime="2026-11-21">21 November 2026</time>.</p>
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
          The DMocks <em>annual pass.</em>
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
              portalReady || postLaunchPreview
                ? "Adapted practice questions based on student recollections"
                : "The planned UCEED Part A Practice Mock 01 uses adapted questions based on student recollections",
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
              {controlledPublicPortalMode ? "Checkout is closed during controlled testing." : stagingPortalMode ? "Checkout is closed in staging." : "Paid access is not open in this preview. Explore the free sample while the separate sign-in and checkout are connected."}
            </div>
          )}
          {session && checkoutReady ? <Purchase actorId={session.user.id} headingRef={heading}/> : session ? (
            <button type="button" className="button full" disabled>Pay {money(brand.price)} with Razorpay <Arrow/></button>
          ) : authReady ? (
            <Button to="/account?next=plans">Continue with Google <GoogleIcon/></Button>
          ) : null}
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
  const [callbackStarted, setCallbackStarted] = useState(() =>
    window.location.pathname === "/account/callback" && new URLSearchParams(window.location.search).has("code"));
  const callbackFailure = callbackStarted && !loading && !session
    ? "Google sign-in could not be completed. Please try again."
    : "";
  const navigate = useNavigate();
  // After a fresh Google sign-in, return to the page the student came from.
  useEffect(() => {
    if ((!callbackStarted && window.location.pathname !== '/account/callback') || loading || !session) return;
    if ((stagingPortalMode || controlledPublicPortalMode) && stagingAccess !== "allowed") return;
    const to = takeReturn();
    if (to) navigate(to, { replace: true });
  }, [callbackStarted, loading, session, stagingAccess]);
  const login = async () => {
    if (checkoutReady && !noticeReviewed) return;
    setBusy(true);
    setNoticeReviewed(false);
    setCallbackStarted(false);
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
    setCallbackStarted(false);
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
            : controlledPublicPortalMode ? "Sign in or create your free account with Google." : stagingPortalMode ? "Sign in with an approved Google account for staging." :
              testLoginMode ? "Private Google sign-in check for approved testers." : "Sign in or create your account with Google."}
        </p>
        {loading ? (
          <p role="status">Checking your account…</p>
        ) : session ? (
          <>
            <p className="signed-in">Signed in as {session.user.email}</p>
            {testLoginMode && <p className="notice">Google sign-in succeeded. This is a private setup check. Public registration and purchases are closed; no paid access has been granted.</p>}
            {(stagingPortalMode || controlledPublicPortalMode) && <StagingAccessMessage access={stagingAccess} />}
            {(testLoginMode || stagingPortalMode) && <button className="button quiet" disabled={busy} onClick={refreshTestSession}>Refresh test session</button>}
            {sessionStatus && <p role="status">{sessionStatus}</p>}
            {workspaceAvailable && controlledPublicPortalMode && <Button to="/papers">Browse free papers</Button>}
            {workspaceAvailable && <Button to="/dashboard" quiet={controlledPublicPortalMode}>{stagingPortalMode ? "Open staging workspace" : "Open your workspace"}</Button>}
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
                {busy ? "Opening Google…" : stagingPortalMode ? "Sign in to staging with Google" : controlledPublicPortalMode ? "Continue with Google" : testLoginMode ? "Test Google sign-in" : "Continue with Google"}
              </button>
            </>
            {!authReady && (
              <div className="notice">
                Google sign-in is being connected for this new app. You can
                explore the full sample experience now.
              </div>
            )}
            {controlledPublicPortalMode ? <p className="account-terms">Free accounts are for students aged 18 or older. After Google sign-in, review the <Link to="/terms">Terms of Use</Link> and <Link to="/privacy">Privacy Notice</Link> before starting a paper.</p> : stagingPortalMode ? <p className="account-terms">Only approved testers can enter the staging workspace. Checkout is closed.</p> :
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
        {(error || authError || callbackFailure) && (
          <p className="error" role="alert">
            {error || authError || callbackFailure}
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
    const startedAt = Date.now();
    setNow(startedAt);
    setIndex(0);
    setState({
      status: "active",
      version: 2,
      startedAt,
      deadline: startedAt + SAMPLE_DURATION_MS,
      answers: {},
      flagged: [],
    });
  };
  if (!active)
    return (
      <section className="wrap sample-start split">
        <div>
          <h1>Free design entrance <em>practice sample.</em></h1>
          <p>
            Try visual questions on rotation, contrast, patterns, poster layout and observation. See your score and an explanation for each question after you submit. No account or payment required.
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
            Each correct answer earns one point out of five. Wrong or unanswered questions score zero. Full exam papers have their own formats and marking rules.
          </p>
        </div>
        <div className="sample-instructions">
          <Art kind="space" />
          <h2>How the sample works</h2>
          <ol>
            <li>Choose one answer for each visual question.</li>
            <li>Move between questions or mark one to revisit.</li>
            <li>Your sample answers are saved on this device.</li>
            <li>The timer continues if you refresh or leave. Your attempt submits at zero or when you return after time runs out.</li>
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
                aria-describedby={"choice-description-" + i}
                aria-pressed={state.answers[q.id] === i}
                onClick={() => answer(i)}
              >
                <span className="choice-letter">
                  {String.fromCharCode(65 + i)}
                </span>
                <ChoiceArt kind={q.kind} index={i} legacyRotation={state.version !== 2} />
                <span className="sr-only" id={"choice-description-" + i}>{describeChoice(q.kind, i, state.version !== 2)}</span>
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
  const report = sampleReport(state.answers, state.version ?? 1);
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
                · Correct choice: {q.id === "rotation" && (state.version ?? 1) === 1 ? "B or C (both showed the same shape)" : String.fromCharCode(65 + q.answer)}
              </p>
              <p>{q.explanation}</p>
            </article>
          ))}
        </div>
      )}
      <div className="result-bottom">
        <Button to="/papers">Take a full free paper</Button>
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
            <Link to="/contact">Contact the team</Link>{" "}
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
        <Route path="/papers" element={<FreeSignupNotice><Papers /></FreeSignupNotice>} />
        <Route path="/papers/:exam" element={<FreeSignupNotice><Papers /></FreeSignupNotice>} />
        <Route path="/practice/visual-hierarchy" element={<SignReadingExercise />} />
        <Route path="/tests/:exam" element={<ExamDetail />} />
        <Route path="/plans" element={<Plans />} />
        <Route path="/account" element={<FreeSignupNotice><Account /></FreeSignupNotice>} />
        <Route path="/account/callback" element={<FreeSignupNotice><Account /></FreeSignupNotice>} />
        {!__DMOCKS_STAGING_REVIEW_PREVIEW__ && <Route element={stagingPortalMode || controlledPublicPortalMode ? <FreeSignupNotice><StagingPortalGate /></FreeSignupNotice> : testLoginMode ? <ControlledLoginPortalNotice /> : <Outlet />}>
          <Route path="/dashboard" element={<Workspace />} />
          <Route path="/onboarding" element={<CandidateProfile />} />
          <Route path="/account/purchases" element={<PurchaseHistory />} />
          <Route path="/dashboard/mocks" element={studentModuleReleased('mocks')?<ExamMocks />:<Workspace catalogueOnly/>} />
          <Route path="/dashboard/all-india" element={studentModuleReleased('all-india')?<AllIndia />:<DeferredModule module="all-india"/>} />
          <Route path="/dashboard/practice" element={studentModuleReleased('practice')?<TopicPractice />:<DeferredModule module="practice"/>} />
          <Route path="/dashboard/learn" element={postLaunchPreview?<Learn />:<LearnProgrammes />} />
          <Route path="/dashboard/learn/programme/:slug" element={<LearnProgrammePage />} />
          <Route path="/dashboard/community" element={studentModuleReleased('community')?<Community />:<DeferredModule module="community"/>} />
          <Route path="/dashboard/community/articles" element={studentModuleReleased('community')?<CommunityArticles />:<DeferredModule module="community"/>} />
          <Route path="/dashboard/community/write" element={studentModuleReleased('community')?<CommunityEditor />:<DeferredModule module="community"/>} />
          <Route path="/dashboard/community/post/:id" element={studentModuleReleased('community')?<CommunityReader />:<DeferredModule module="community"/>} />
          <Route path="/dashboard/community/saved" element={studentModuleReleased('community')?<CommunitySaved />:<DeferredModule module="community"/>} />
          <Route path="/report" element={<BugReport />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/review/drawings" element={postLaunchPreview?<DrawingReviewerWorkspace />:<DeferredModule module="drawings"/>} />
          <Route path="/attempt/:id" element={<Attempt key={location.pathname} />} />
        </Route>}
        {includeStudentPreview && studentPreview && <>
          <Route path="/portal-preview/*" element={<PortalPreview />} />
          <Route path="/papers-preview" element={<PapersPreview />} />
          <Route path="/drawing-tasks-preview" element={<DrawingTaskPreview />} />
          <Route path="/profile-preview" element={<CandidateProfilePreview />} />
          <Route path="/topic-practice-preview" element={<TopicPracticePreview />} />
          <Route path="/topic-practice-preview/released" element={<TopicPracticePreview />} />
          <Route path="/exam-mocks-preview" element={<ExamMocksPreview />} />
          <Route path="/all-india-preview" element={<AllIndiaPreview />} />
          <Route path="/question-report-preview" element={<QuestionReportPreview />} />
          <Route path="/learn-preview" element={<LearnPreview />} />
          <Route path="/learn-programme-preview/:slug?" element={<LearnProgrammePreview />} />
          <Route path="/community-preview" element={<CommunityPreview />} />
          <Route path="/drawing-uploads-preview" element={<DrawingUploadsPreview />} />
        </>}
        {import.meta.env.DEV && (
          <Route path="/motion-preview" element={<MotionGallery />} />
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
