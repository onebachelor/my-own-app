import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLayout } from "./components/Layout";
import { ErrorState, Skeleton } from "./components/ui";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const TodayPage = lazy(() => import("./pages/TodayPage").then((module) => ({ default: module.TodayPage })));
const MediaPage = lazy(() => import("./pages/MediaPage").then((module) => ({ default: module.MediaPage })));
const DevelopmentPage = lazy(() => import("./pages/DevelopmentPage").then((module) => ({ default: module.DevelopmentPage })));
const ConsultingPage = lazy(() => import("./pages/ConsultingPage").then((module) => ({ default: module.ConsultingPage })));
const DietPage = lazy(() => import("./pages/DietPage").then((module) => ({ default: module.DietPage })));
const CalendarPage = lazy(() => import("./pages/CalendarPage").then((module) => ({ default: module.CalendarPage })));
const LearningPage = lazy(() => import("./pages/LearningPage").then((module) => ({ default: module.LearningPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage })));

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Skeleton lines={8} />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <div className="route-error"><ErrorState message="页面无法打开，请返回首页后重试。" /></div>,
    children: [
      { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
      { path: "today", element: <LazyPage><TodayPage /></LazyPage> },
      { path: "media", element: <LazyPage><MediaPage /></LazyPage> },
      { path: "development", element: <LazyPage><DevelopmentPage /></LazyPage> },
      { path: "consulting", element: <LazyPage><ConsultingPage /></LazyPage> },
      { path: "diet", element: <LazyPage><DietPage /></LazyPage> },
      { path: "calendar", element: <LazyPage><CalendarPage /></LazyPage> },
      { path: "learning", element: <LazyPage><LearningPage /></LazyPage> },
      { path: "settings", element: <LazyPage><SettingsPage /></LazyPage> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
