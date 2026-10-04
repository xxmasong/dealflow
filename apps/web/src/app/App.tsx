import { CssBaseline, LinearProgress, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { NotifierProvider } from '../components/Notifier';
import { LoginPage } from '../features/auth/LoginPage';
import { BoardPage } from '../features/board/BoardPage';
import { AuthProvider, useAuth } from '../lib/auth';
import { theme } from './theme';

// Charts are the heaviest dependency, so the dashboard loads on first visit.
const DashboardPage = lazy(() =>
  import('../features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const FieldsPage = lazy(() => import('../features/fields/FieldsPage').then((m) => ({ default: m.FieldsPage })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

function AppRoutes() {
  const { token } = useAuth();
  if (!token) return <LoginPage />;
  return (
    <Suspense fallback={<LinearProgress />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/board" element={<BoardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/fields" element={<FieldsPage />} />
          <Route path="*" element={<Navigate to="/board" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <NotifierProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </NotifierProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
