import DashboardIcon from '@mui/icons-material/InsightsOutlined';
import BoardIcon from '@mui/icons-material/ViewKanbanOutlined';
import FieldsIcon from '@mui/icons-material/TuneOutlined';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import { AppBar, Box, Button, IconButton, Stack, Toolbar, Tooltip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { ME } from '../graphql/documents';
import type { User } from '../graphql/types';
import { request } from '../lib/api';
import { useAuth } from '../lib/auth';

const NAV = [
  { to: '/board', label: 'Pipeline', icon: <BoardIcon fontSize="small" /> },
  { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon fontSize="small" /> },
  { to: '/fields', label: 'Fields', icon: <FieldsIcon fontSize="small" /> },
];

export function AppShell() {
  const { logout } = useAuth();
  const me = useQuery({ queryKey: ['me'], queryFn: () => request<{ me: User }>(ME) });

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" color="inherit" sx={{ borderBottom: '1px solid #e3e7f0' }} elevation={0}>
        <Toolbar sx={{ gap: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Box component="img" src="/favicon.svg" alt="" sx={{ width: 26, height: 26 }} />
            <Typography variant="h6">Dealflow</Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} component="nav" sx={{ flex: 1 }}>
            {NAV.map((item) => (
              <Button
                key={item.to}
                component={NavLink}
                to={item.to}
                startIcon={item.icon}
                color="inherit"
                sx={{ color: 'text.secondary', '&.active': { color: 'primary.main', bgcolor: 'rgba(31,79,216,0.08)' } }}
              >
                {item.label}
              </Button>
            ))}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {me.data?.me.name}
          </Typography>
          <Tooltip title="Sign out">
            <IconButton onClick={logout} aria-label="Sign out">
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
