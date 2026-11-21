import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Gamepad2,
  Package,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { ROUTES } from '../../configuration/routes';
import { AdminLayout } from '../../layouts/AdminLayout';
import { apiClient } from '../../services/apiClient';
import type { AdminOverviewResponse } from '../../types/api';
import { formatInrPrice } from '../../utilities/orderDraft';

const STATUS_BADGE_MAP: Record<string, string> = {
  Pending: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  'Payment Pending': 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  'Payment Verified': 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  Processing: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  'Awaiting Delivery': 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
  Completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Failed: 'text-red-300 bg-red-500/10 border-red-500/30',
  Cancelled: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
  'Refund Pending': 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  Refunded: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
};

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .getAdminOverview()
      .then(setData)
      .catch((err) =>
        setErrorMsg(err instanceof Error ? err.message : 'Unable to load dashboard.')
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout title="Dashboard">
      {loading ? (
        <div className="bg-[#111118] border border-white/[0.08] rounded-xl p-8 text-sm text-zinc-400">
          Loading store telemetry and database statistics...
        </div>
      ) : errorMsg || !data ? (
        <div
          role="alert"
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-sm text-red-200"
        >
          {errorMsg || 'Dashboard data unavailable.'}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-white">Store Overview</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Real-time counts from PostgreSQL across catalog games, packages, customer orders,
                and platform security controls.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                to={ROUTES.ADMIN_GAMES}
                className="px-4 py-2 rounded-lg bg-violet-600 text-xs font-semibold text-white hover:bg-violet-500 transition-colors whitespace-nowrap"
              >
                Manage Games
              </Link>
              <Link
                to={ROUTES.ADMIN_ORDERS}
                className="px-4 py-2 rounded-lg border border-white/[0.14] text-xs font-medium text-zinc-200 hover:bg-white/[0.05] transition-colors whitespace-nowrap"
              >
                View All Orders
              </Link>
            </div>
          </div>

          {/* Real Database Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <StatCard label="Total Games" value={data.stats.totalGames} Icon={Gamepad2} />
            <StatCard
              label="Active Games"
              value={data.stats.activeGames}
              accent="text-emerald-400"
              Icon={CheckCircle2}
            />
            <StatCard label="Total Packages" value={data.stats.totalPackages} Icon={Package} />
            <StatCard label="Total Orders" value={data.stats.totalOrders} Icon={ShoppingBag} />
            <StatCard
              label="Pending Orders"
              value={data.stats.pendingOrders}
              accent="text-amber-300"
              Icon={ShoppingBag}
            />
            <StatCard
              label="Completed Orders"
              value={data.stats.completedOrders}
              accent="text-emerald-400"
              Icon={CheckCircle2}
            />
            <StatCard label="Total Customers" value={data.stats.totalCustomers} Icon={Users} />
          </div>

          {/* Recent Orders & Recently Added Games */}
          <div className="grid lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-[#111118] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-white">Recent Orders</h3>
                <Link
                  to={ROUTES.ADMIN_ORDERS}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap"
                >
                  <span>All Orders</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              {data.recentOrders.length === 0 ? (
                <div className="p-8 text-sm text-zinc-400 text-center">
                  No customer orders have been placed yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/[0.08] text-zinc-400">
                      <tr>
                        <th className="py-3 px-4 font-medium">Order ID</th>
                        <th className="py-3 px-4 font-medium">Game / Package</th>
                        <th className="py-3 px-4 font-medium">Customer</th>
                        <th className="py-3 px-4 font-medium text-right">Amount</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {data.recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-mono text-white whitespace-nowrap">
                            {order.orderNumber}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-zinc-100">{order.gameTitle}</div>
                            <div className="text-zinc-400">{order.packageName}</div>
                          </td>
                          <td className="py-3 px-4 text-zinc-300">
                            <div className="truncate max-w-[140px]">{order.customerName}</div>
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-right text-white whitespace-nowrap">
                            {formatInrPrice(order.totalInr)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                                STATUS_BADGE_MAP[order.displayOrderStatus] ||
                                'text-zinc-300 border-white/[0.12]'
                              }`}
                            >
                              {order.displayOrderStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="lg:col-span-5 bg-[#111118] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-white">Recently Added Games</h3>
                <Link
                  to={ROUTES.ADMIN_GAMES}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap"
                >
                  <span>Manage Catalog</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
              {data.recentGames.length === 0 ? (
                <div className="p-8 text-sm text-zinc-400 text-center">No games added yet.</div>
              ) : (
                <ul className="divide-y divide-white/[0.06]">
                  {data.recentGames.map((game) => (
                    <li
                      key={game.id}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-[#09090E] border border-white/[0.08] shrink-0 flex items-center justify-center">
                          {game.coverImageUrl ? (
                            <img
                              src={game.coverImageUrl}
                              alt={game.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Gamepad2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {game.title}
                          </div>
                          <div className="text-xs text-zinc-400 truncate">
                            {game.category}
                            {game.isFeatured ? ' · Featured' : ''}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-xs font-medium whitespace-nowrap ${
                          game.isActive ? 'text-emerald-400' : 'text-zinc-500'
                        }`}
                      >
                        {game.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Phase 1 Platform Foundation & Security Strip */}
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-[#111118] border border-white/[0.08] rounded-xl p-5 space-y-2">
              <div className="text-xs text-zinc-400">PostgreSQL Engine</div>
              <div className="text-lg font-semibold text-white font-mono">
                {data.database.engine === 'postgres' ? 'Supabase PG' : 'Local PostgreSQL'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Connected · {data.database.migrationsApplied.length} migrations</span>
              </div>
            </div>

            <div className="bg-[#111118] border border-white/[0.08] rounded-xl p-5 space-y-2">
              <div className="text-xs text-zinc-400">Core Tables &amp; RLS</div>
              <div className="text-lg font-semibold text-white font-mono tabular-nums">
                {data.database.coreTablesPresent} / {data.database.coreTablesExpected}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Database className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                  {data.database.rlsEnabledTables} tables RLS enforced
                </span>
              </div>
            </div>

            <div className="bg-[#111118] border border-white/[0.08] rounded-xl p-5 space-y-2">
              <div className="text-xs text-zinc-400">Razorpay Readiness</div>
              <div className="text-lg font-semibold text-white uppercase">
                {data.paymentGateway.mode} Mode
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-400 tabular-nums">
                <span>
                  {data.paymentGateway.checklistCompletedCount} /{' '}
                  {data.paymentGateway.checklistTotalCount} checks
                </span>
                <Link to={ROUTES.ADMIN_SETTINGS} className="text-violet-400 hover:text-violet-300">
                  Configure
                </Link>
              </div>
            </div>

            <div className="bg-[#111118] border border-white/[0.08] rounded-xl p-5 space-y-2">
              <div className="text-xs text-zinc-400">Admin Security</div>
              <div className="text-lg font-semibold text-white font-mono tabular-nums">
                {data.security.auditLogCount} Audit Events
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">Signup locked · Server-only keys</span>
              </div>
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="bg-[#111118] border border-white/[0.08] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Recent Admin Audit Logs</h3>
              <span className="text-xs text-zinc-400 tabular-nums">
                Latest {data.recentAuditLogs.length} entries
              </span>
            </div>
            {data.recentAuditLogs.length === 0 ? (
              <div className="p-8 text-sm text-zinc-400 text-center">No audit events logged yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/[0.08] text-zinc-400">
                    <tr>
                      <th className="py-3 px-5 font-medium">Timestamp</th>
                      <th className="py-3 px-5 font-medium">Role</th>
                      <th className="py-3 px-5 font-medium">Action</th>
                      <th className="py-3 px-5 font-medium">Resource</th>
                      <th className="py-3 px-5 font-medium">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.recentAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-5 font-mono tabular-nums text-zinc-400 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-5 text-zinc-300">{log.actor_role}</td>
                        <td className="py-3 px-5 font-mono text-white">{log.action}</td>
                        <td className="py-3 px-5 text-zinc-400">
                          {log.resource_type}
                          {log.resource_id ? ` · ${log.resource_id}` : ''}
                        </td>
                        <td className="py-3 px-5 font-mono tabular-nums text-zinc-400">
                          {log.ip_address || 'local'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function StatCard({
  label,
  value,
  accent = 'text-white',
  Icon,
}: {
  label: string;
  value: number;
  accent?: string;
  Icon: typeof Gamepad2;
}) {
  return (
    <div className="bg-[#111118] border border-white/[0.08] rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="truncate">{label}</span>
        <Icon className="h-3.5 w-3.5 text-zinc-500 shrink-0" aria-hidden="true" />
      </div>
      <div className={`font-mono tabular-nums text-2xl font-bold ${accent}`}>
        {value.toLocaleString('en-IN')}
      </div>
    </div>
  );
}
