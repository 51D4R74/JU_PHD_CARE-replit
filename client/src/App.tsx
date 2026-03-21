import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/onboarding-state";
import PanicButton from "@/components/panic-button";
import DevToolbar from "@/components/dev-toolbar";

// ── Lazy-loaded pages ─────────────────────────────

const LoginPage = lazy(() => import("@/pages/login"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const CheckInPage = lazy(() => import("@/pages/checkin"));
const DenunciaPage = lazy(() => import("@/pages/denuncia"));
const MissionCenterPage = lazy(() => import("@/pages/missions"));
const SupportCenterPage = lazy(() => import("@/pages/support"));
const MeuCuidadoPage = lazy(() => import("@/pages/meu-cuidado"));
const ReportPage = lazy(() => import("@/pages/report"));
const TeamChallengePage = lazy(() => import("@/pages/team-challenge"));
const RHDashboardPage = lazy(() => import("@/pages/rh-dashboard"));
const AdminPage = lazy(() => import("@/pages/admin"));
const OnboardingPage = lazy(() => import("@/components/onboarding"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const ChatPage = lazy(() => import("@/pages/chat-page"));

// ── Loading skeleton ──────────────────────────────

function PageSkeleton() {
  return (
    <div className="min-h-screen gradient-sunrise flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function canAccessCapability(user: { role: string; capabilities: string[] } | null, capability: string | undefined): boolean {
  if (!capability) {
    return true;
  }
  return user?.role === "rh" || user?.capabilities.includes(capability) === true;
}

function defaultAuthenticatedPath(user: { role: string; capabilities: string[] } | null): string {
  if (user?.role === "rh") {
    return "/rh";
  }
  if (canAccessCapability(user, "control_plane:read")) {
    return "/admin";
  }
  return "/dashboard";
}

function ProtectedRoute({ component: Component, requireRole, requireCapability }: Readonly<{ component: React.LazyExoticComponent<() => JSX.Element>; requireRole?: string; requireCapability?: string }>) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Redirect to="/" />;
  if (requireRole && user?.role !== requireRole) return <Redirect to="/dashboard" />;
  if (!canAccessCapability(user ?? null, requireCapability)) return <Redirect to="/dashboard" />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

// Prevents authenticated users from landing on the login page
// Redirects to onboarding if first-run, otherwise to role-appropriate dashboard
function AuthRoute({ component: Component }: Readonly<{ component: React.LazyExoticComponent<() => JSX.Element> }>) {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    if (!hasCompletedOnboarding() && user?.role !== "rh") {
      return <Redirect to="/onboarding" />;
    }
    return <Redirect to={defaultAuthenticatedPath(user ?? null)} />;
  }
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <AuthRoute component={LoginPage} />}</Route>
      <Route path="/onboarding">
        {() => <ProtectedRoute component={OnboardingPage} />}
      </Route>
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/checkin">
        {() => <ProtectedRoute component={CheckInPage} />}
      </Route>
      <Route path="/denuncia">
        {() => <ProtectedRoute component={DenunciaPage} />}
      </Route>
      <Route path="/missions">
        {() => <ProtectedRoute component={MissionCenterPage} />}
      </Route>
      <Route path="/support">
        {() => <ProtectedRoute component={SupportCenterPage} />}
      </Route>
      <Route path="/meu-cuidado">
        {() => <ProtectedRoute component={MeuCuidadoPage} />}
      </Route>
      <Route path="/report">
        {() => <ProtectedRoute component={ReportPage} />}
      </Route>
      <Route path="/team">
        {() => <ProtectedRoute component={TeamChallengePage} />}
      </Route>
      <Route path="/settings">
        {() => <ProtectedRoute component={SettingsPage} />}
      </Route>
      <Route path="/chat">
        {() => <ProtectedRoute component={ChatPage} />}
      </Route>
      <Route path="/rh">
        {() => <ProtectedRoute component={RHDashboardPage} requireRole="rh" />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPage} requireCapability="control_plane:read" />}
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

function App() {
  const { isAuthenticated, validateSession } = useAuth();

  // On mount, validate localStorage user against server session.
  // Clears stale client state if session expired.
  useEffect(() => {
    if (isAuthenticated) {
      validateSession().catch(console.error);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        {isAuthenticated && <PanicButton />}
        {process.env.NODE_ENV !== "production" && <DevToolbar />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
