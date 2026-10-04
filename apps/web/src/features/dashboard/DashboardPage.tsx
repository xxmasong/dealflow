import {
  Box,
  Card,
  CardContent,
  Grid2 as Grid,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { REPORT } from '../../graphql/documents';
import type { PipelineReport } from '../../graphql/types';
import { request } from '../../lib/api';
import { formatMoney, formatPercent } from '../../lib/format';

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ mt: 0.5 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const [days, setDays] = useState(30);
  const report = useQuery({
    queryKey: ['report', days],
    queryFn: () => request<{ report: PipelineReport }>(REPORT, { days }),
    placeholderData: (previous) => previous,
  });
  const data = report.data?.report;

  const open = data?.stages.filter((s) => !s.stage.isWon && !s.stage.isLost) ?? [];
  const openValue = open.reduce((sum, s) => sum + s.amountCents, 0);
  const openCount = open.reduce((sum, s) => sum + s.dealCount, 0);
  const won = data?.stages.filter((s) => s.stage.isWon).reduce((sum, s) => sum + s.amountCents, 0) ?? 0;
  const moves = data?.activity.reduce((sum, a) => sum + a.moved, 0) ?? 0;

  return (
    <Stack spacing={3}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h5">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Built from the audit trail, so it reflects every move and edit.
          </Typography>
        </Box>
        <ToggleButtonGroup size="small" exclusive value={days} onChange={(_, v: number | null) => v && setDays(v)}>
          {[7, 30, 90].map((d) => (
            <ToggleButton key={d} value={d}>
              {d}d
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {!data ? (
        <Skeleton variant="rounded" height={420} />
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Kpi label="Open pipeline" value={formatMoney(openValue)} hint={`${openCount} open deals`} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Kpi label="Invested / won" value={formatMoney(won)} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Kpi label="Win rate" value={formatPercent(data.winRate)} hint="Won ÷ closed" />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Kpi label="Stage moves" value={String(moves)} hint={`Last ${days} days`} />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={650}>
                    Value by stage
                  </Typography>
                  <BarChart
                    height={300}
                    layout="horizontal"
                    yAxis={[{ scaleType: 'band', data: data.stages.map((s) => s.stage.name) }]}
                    xAxis={[{ valueFormatter: (v: number) => formatMoney(v * 100) }]}
                    series={[
                      {
                        data: data.stages.map((s) => s.amountCents / 100),
                        label: 'Deal value',
                        color: '#1f4fd8',
                        valueFormatter: (v) => formatMoney((v ?? 0) * 100),
                      },
                    ]}
                    margin={{ left: 110 }}
                    slotProps={{ legend: { hidden: true } }}
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={650}>
                    Activity
                  </Typography>
                  <BarChart
                    height={300}
                    xAxis={[{ scaleType: 'band', data: data.activity.map((a) => a.date.slice(5)) }]}
                    series={[
                      { data: data.activity.map((a) => a.created), label: 'Created', stack: 'all', color: '#0f8a6a' },
                      { data: data.activity.map((a) => a.moved), label: 'Moved', stack: 'all', color: '#1f4fd8' },
                      { data: data.activity.map((a) => a.edited), label: 'Edited', stack: 'all', color: '#9aa8c7' },
                    ]}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={650} gutterBottom>
                Stage flow, last {days} days
              </Typography>
              {data.flows.length === 0 ? (
                <Typography color="text.secondary">No stage changes in this period.</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>From</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell align="right">Deals</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.flows.map((f) => (
                      <TableRow key={`${f.fromStage}-${f.toStage}`}>
                        <TableCell>{f.fromStage ?? '–'}</TableCell>
                        <TableCell>{f.toStage}</TableCell>
                        <TableCell align="right">{f.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
