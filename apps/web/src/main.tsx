import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Chain } from "./dashboard/Chain";
import { Home } from "./dashboard/Home";
import { Shell, type AppPage } from "./dashboard/Shell";
import { Logo } from "./components/Logo";
import { Landing } from "./pages/Landing";
import { Passport } from "./pages/Passport";
import { Brand, Certifier, Recycler, Spinner } from "./pages/Roles";
import { Verify } from "./pages/Verify";
import { run } from "./run";
import "./styles.css";

function useHashRoute(): string[] {
  const parse = () => (window.location.hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      // In-page anchors (#proof) are not routes.
      if (!window.location.hash.startsWith("#/") && window.location.hash !== "") return;
      setRoute(parse());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

const APP_PAGES: AppPage[] = ["home", "chain", "recycler", "spinner", "certifier", "brand", "passport", "verify"];

function Dashboard({ page }: { page: AppPage }) {
  const lot = String(run.passport.lotId);
  return (
    <Shell page={page}>
      <div key={page} className="rise">
        {page === "home" && <Home />}
        {page === "chain" && <Chain />}
        {page === "recycler" && <Recycler />}
        {page === "spinner" && <Spinner />}
        {page === "certifier" && <Certifier />}
        {page === "brand" && <Brand />}
        {page === "passport" && <Passport lotId={lot} verifyHref="#/app/verify" />}
        {page === "verify" && <Verify lotId={lot} embedded />}
      </div>
    </Shell>
  );
}

/** Pages a shopper reaches from the QR code: no dashboard chrome. */
function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-page items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <a href="#/app" className="text-sm text-muted hover:text-ink">Open the dashboard →</a>
        </div>
      </header>
      <main className="mx-auto max-w-page px-4 sm:px-6">{children}</main>
    </div>
  );
}

function App() {
  const [first = "", second] = useHashRoute();
  if (first === "app") {
    const page = (APP_PAGES as string[]).includes(second ?? "") ? (second as AppPage) : "home";
    return <Dashboard page={page} />;
  }
  if (first === "roles") return <Dashboard page={(APP_PAGES as string[]).includes(second ?? "") ? (second as AppPage) : "recycler"} />;
  if (first === "passport")
    return (
      <PublicPage>
        <Passport lotId={second ?? String(run.passport.lotId)} />
      </PublicPage>
    );
  if (first === "verify")
    return (
      <PublicPage>
        <Verify lotId={second ?? String(run.passport.lotId)} />
      </PublicPage>
    );
  return <Landing />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
