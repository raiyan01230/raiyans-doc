import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  ErrorLogItem,
  ErrorMetricsSummary,
  PerformanceMetricsSummary,
  RequestLogItem,
  RequestMetricsSummary,
} from '../types';
import {
  Activity,
  AlertOctagon,
  Gauge,
  Radio,
  RefreshCw,
  CheckCircle2,
  Clock,
  Zap,
  Server,
  Filter,
  Search,
  Check,
} from 'lucide-react';

interface SystemHealthViewProps {
  onNotify?: (msg: string, type?: 'info' | 'error') => void;
}

export function SystemHealthView({ onNotify }: SystemHealthViewProps) {
  const [activeTab, setActiveTab] = useState<'requests' | 'performance' | 'errors'>('requests');
  const [loading, setLoading] = useState(true);

  // Requests state
  const [requests, setRequests] = useState<RequestLogItem[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<RequestMetricsSummary | null>(null);
  const [methodFilter, setMethodFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [requestSearch, setRequestSearch] = useState('');

  // Performance state
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetricsSummary | null>(null);

  // Errors state
  const [errors, setErrors] = useState<ErrorLogItem[]>([]);
  const [errorMetrics, setErrorMetrics] = useState<ErrorMetricsSummary | null>(null);
  const [errorStatusFilter, setErrorStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'requests') {
        const [reqs, metrics] = await Promise.all([
          api.getRequests(methodFilter, statusFilter, requestSearch),
          api.getRequestMetrics(),
        ]);
        setRequests(reqs.requests || []);
        setRequestMetrics(metrics);
      } else if (activeTab === 'performance') {
        const metrics = await api.getPerformanceMetrics();
        setPerformanceMetrics(metrics);
      } else if (activeTab === 'errors') {
        const [errs, metrics] = await Promise.all([
          api.getErrors(errorStatusFilter),
          api.getErrorMetrics(),
        ]);
        setErrors(errs.errors || []);
        setErrorMetrics(metrics);
      }
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Failed loading metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, methodFilter, statusFilter, errorStatusFilter]);

  const handleResolveError = async (errorId: string) => {
    try {
      await api.resolveError(errorId);
      onNotify?.(`Error ${errorId} marked as resolved`, 'info');
      await loadData();
    } catch (err: unknown) {
      onNotify?.(err instanceof Error ? err.message : 'Resolve failed', 'error');
    }
  };

  const getStatusBadge = (code: number) => {
    let color = 'bg-neutral-800 text-neutral-300';
    if (code >= 200 && code < 300) color = 'bg-emerald-950 text-emerald-300 border-emerald-800';
    else if (code >= 300 && code < 400) color = 'bg-sky-950 text-sky-300 border-sky-800';
    else if (code >= 400 && code < 500) color = 'bg-amber-950 text-amber-300 border-amber-800';
    else if (code >= 500) color = 'bg-red-950 text-red-300 border-red-800';

    return (
      <span className={`px-1.5 py-0.5 text-[10px] font-mono border rounded ${color}`}>
        {code}
      </span>
    );
  };

  const getMethodBadge = (method: string) => {
    let color = 'text-neutral-400';
    if (method === 'GET') color = 'text-sky-400';
    else if (method === 'POST') color = 'text-emerald-400';
    else if (method === 'PUT') color = 'text-amber-400';
    else if (method === 'DELETE') color = 'text-red-400';

    return <span className={`font-mono font-semibold text-[11px] ${color}`}>{method}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-1.5 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
              activeTab === 'requests'
                ? 'bg-neutral-800 text-neutral-100 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-sky-400" />
            <span>Request Stream</span>
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
              activeTab === 'performance'
                ? 'bg-neutral-800 text-neutral-100 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span>Performance & Latency</span>
          </button>

          <button
            onClick={() => setActiveTab('errors')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg transition-colors ${
              activeTab === 'errors'
                ? 'bg-neutral-800 text-neutral-100 font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
            <span>Error Monitoring</span>
          </button>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* TAB 1: REQUEST MONITORING */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Request Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Total Monitored</span>
              <span className="text-xl font-mono text-neutral-100 font-semibold">
                {requestMetrics?.totalRequestsRecorded || requests.length}
              </span>
              <span className="text-[10px] text-neutral-500 block mt-0.5">HTTP requests recorded</span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Rate (RPM)</span>
              <span className="text-xl font-mono text-neutral-100 font-semibold">
                {requestMetrics?.requestsPerMinute ?? 0}
              </span>
              <span className="text-[10px] text-neutral-500 block mt-0.5">Requests last 60s</span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Error Rate</span>
              <span className="text-xl font-mono text-neutral-100 font-semibold">
                {requestMetrics?.errorRatePercent ?? 0}%
              </span>
              <span className="text-[10px] text-neutral-500 block mt-0.5">4xx / 5xx responses</span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Status Distribution</span>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono">
                <span className="text-emerald-400">2xx: {requestMetrics?.statusDistribution['2xx'] ?? 0}</span>
                <span className="text-neutral-600">•</span>
                <span className="text-amber-400">4xx: {requestMetrics?.statusDistribution['4xx'] ?? 0}</span>
                <span className="text-neutral-600">•</span>
                <span className="text-red-400">5xx: {requestMetrics?.statusDistribution['5xx'] ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search route, IP, req ID..."
                value={requestSearch}
                onChange={e => setRequestSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadData()}
                className="w-full bg-neutral-900/80 border border-neutral-800 pl-8 pr-3 py-1.5 text-xs text-neutral-200 rounded-lg focus:outline-none focus:border-neutral-600 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-neutral-300 rounded-lg font-mono focus:outline-none"
              >
                <option value="all">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 px-2 py-1 text-xs text-neutral-300 rounded-lg font-mono focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="200">200 OK</option>
                <option value="201">201 Created</option>
                <option value="400">400 Bad Request</option>
                <option value="401">401 Unauthorized</option>
                <option value="403">403 Forbidden</option>
                <option value="404">404 Not Found</option>
                <option value="500">500 Server Error</option>
              </select>
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900/90 text-neutral-400 text-[11px] border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">METHOD</th>
                    <th className="py-2.5 px-3">ROUTE</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3">DURATION</th>
                    <th className="py-2.5 px-3">SIZE</th>
                    <th className="py-2.5 px-3">CLIENT IP</th>
                    <th className="py-2.5 px-3 text-right">TIMESTAMP (UTC)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        No requests recorded yet.
                      </td>
                    </tr>
                  ) : (
                    requests.map(r => (
                      <tr key={r.request_id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-2 px-3">{getMethodBadge(r.method)}</td>
                        <td className="py-2 px-3 text-neutral-200 font-medium truncate max-w-xs">{r.route}</td>
                        <td className="py-2 px-3">{getStatusBadge(r.status_code)}</td>
                        <td className="py-2 px-3 text-neutral-400">{r.duration_ms} ms</td>
                        <td className="py-2 px-3 text-neutral-400">
                          {r.response_size_bytes ? `${r.response_size_bytes} B` : '-'}
                        </td>
                        <td className="py-2 px-3 text-neutral-400">{r.ip_address}</td>
                        <td className="py-2 px-3 text-right text-neutral-500 whitespace-nowrap">
                          {new Date(r.timestamp).toISOString().substring(11, 19)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PERFORMANCE MONITORING */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {!performanceMetrics?.hasEnoughData ? (
            <div className="p-8 text-center bg-neutral-900/60 border border-neutral-800 rounded-xl space-y-2">
              <Zap className="w-8 h-8 text-neutral-500 mx-auto" />
              <h3 className="font-mono text-sm font-semibold text-neutral-200">
                Collecting Real Runtime Performance Samples
              </h3>
              <p className="text-xs text-neutral-400 max-w-md mx-auto">
                Accurate mathematical percentiles (Average, Median, P95) require at least 3 measured requests.
                Current samples collected: {performanceMetrics?.sampleCount || 0} / 3.
              </p>
            </div>
          ) : (
            <>
              {/* Latency Percentiles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase block">Average Latency</span>
                  <span className="text-2xl font-mono text-neutral-100 font-semibold">
                    {performanceMetrics.averageResponseTimeMs} ms
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">Mean response duration</span>
                </div>

                <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase block">Median (P50)</span>
                  <span className="text-2xl font-mono text-neutral-100 font-semibold">
                    {performanceMetrics.medianResponseTimeMs} ms
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">Typical request speed</span>
                </div>

                <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase block">95th Percentile (P95)</span>
                  <span className="text-2xl font-mono text-neutral-100 font-semibold">
                    {performanceMetrics.p95ResponseTimeMs} ms
                  </span>
                  <span className="text-[10px] text-neutral-500 block mt-0.5">Tail latency threshold</span>
                </div>
              </div>

              {/* Slowest Endpoints */}
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 space-y-3">
                <span className="font-mono text-xs font-semibold text-neutral-200 uppercase block">
                  Slowest Server Endpoints
                </span>

                <div className="divide-y divide-neutral-800/80 font-mono text-xs">
                  {performanceMetrics.slowestEndpoints.map((ep, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getMethodBadge(ep.method)}
                        <span className="text-neutral-200">{ep.endpoint}</span>
                        <span className="text-neutral-500 text-[11px]">({ep.count} calls)</span>
                      </div>
                      <span className="font-semibold text-neutral-300">{ep.avgDurationMs} ms</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: ERROR MONITORING */}
      {activeTab === 'errors' && (
        <div className="space-y-4">
          {/* Error Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Errors Today</span>
              <span className="text-xl font-mono text-neutral-100 font-semibold">
                {errorMetrics?.errorsToday ?? 0}
              </span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Errors This Week</span>
              <span className="text-xl font-mono text-neutral-100 font-semibold">
                {errorMetrics?.errorsThisWeek ?? 0}
              </span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Unresolved</span>
              <span className={`text-xl font-mono font-semibold ${
                (errorMetrics?.unresolvedCount ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {errorMetrics?.unresolvedCount ?? 0}
              </span>
            </div>

            <div className="bg-neutral-900/60 border border-neutral-800 p-4 rounded-xl">
              <span className="text-[10px] font-mono text-neutral-500 uppercase block">Error Frequency</span>
              <span className="text-xl font-mono text-neutral-100 font-semibold">
                {errorMetrics?.errorRatePercent ?? 0}%
              </span>
            </div>
          </div>

          {/* Filter */}
          <div className="flex justify-end">
            <select
              value={errorStatusFilter}
              onChange={e => setErrorStatusFilter(e.target.value as any)}
              className="bg-neutral-900 border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 rounded-lg font-mono focus:outline-none"
            >
              <option value="all">All Errors</option>
              <option value="unresolved">Unresolved Only</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Errors Stream Table */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-neutral-900/90 text-neutral-400 text-[11px] border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">SEVERITY</th>
                    <th className="py-2.5 px-3">ERROR ID</th>
                    <th className="py-2.5 px-3">TYPE</th>
                    <th className="py-2.5 px-3">MESSAGE</th>
                    <th className="py-2.5 px-3">ENDPOINT</th>
                    <th className="py-2.5 px-3">STATUS</th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                  {errors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                        <span>No application or server runtime errors recorded. System healthy.</span>
                      </td>
                    </tr>
                  ) : (
                    errors.map(err => (
                      <tr key={err.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] uppercase rounded border ${
                              err.severity === 'critical'
                                ? 'bg-red-950 text-red-300 border-red-800'
                                : err.severity === 'error'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                            }`}
                          >
                            {err.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-neutral-200">{err.error_id}</td>
                        <td className="py-2.5 px-3 text-neutral-400">{err.error_type}</td>
                        <td className="py-2.5 px-3 text-neutral-300 max-w-xs truncate" title={err.message}>
                          {err.message}
                        </td>
                        <td className="py-2.5 px-3 text-neutral-400">{err.endpoint || '-'}</td>
                        <td className="py-2.5 px-3">
                          {err.resolved ? (
                            <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Resolved</span>
                            </span>
                          ) : (
                            <span className="text-amber-400 text-[11px]">Unresolved</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {!err.resolved && (
                            <button
                              onClick={() => handleResolveError(err.id)}
                              className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-[11px]"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
