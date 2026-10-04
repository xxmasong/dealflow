import { Alert, Snackbar } from '@mui/material';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Severity = 'success' | 'error' | 'info';
const NotifyContext = createContext<(message: string, severity?: Severity) => void>(() => {});

export function NotifierProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; severity: Severity; key: number } | null>(null);
  const notify = useCallback((message: string, severity: Severity = 'info') => {
    setState({ message, severity, key: Date.now() });
  }, []);

  return (
    <NotifyContext.Provider value={notify}>
      {children}
      <Snackbar
        key={state?.key}
        open={state !== null}
        autoHideDuration={4000}
        onClose={() => setState(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {state ? (
          <Alert severity={state.severity} variant="filled" onClose={() => setState(null)}>
            {state.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifyContext.Provider>
  );
}

export const useNotify = () => useContext(NotifyContext);
