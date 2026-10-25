"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Database,
  BarChart2,
  ScrollText,
  Settings,
  Plus,
  RefreshCw,
  Loader2,
  Shield,
  Star,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  listUsers,
  addUser,
  updateUserRole,
  deactivateUser,
  getAdminAnalytics,
  getAuditLog,
} from "@/services/admin.service";
import { getKnowledgeStats, reEmbedAll } from "@/services/knowledge.service";
import { cn, qualityLevelColor, qualityLevelLabel, formatDateTime, timeAgo } from "@/lib/utils";
import type { UserRole, User, AuditLogEntry } from "@/types";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "proposal_writer", label: "Proposal Writer" },
  { value: "reviewer", label: "Reviewer" },
  { value: "viewer", label: "Viewer" },
];

export function AdminPortal() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Portal</h1>
        <p className="mt-1 text-slate-500">
          Manage users, knowledge bases, analytics, and audit logs.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="users">
            <Users className="mr-1.5 h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <Database className="mr-1.5 h-4 w-4" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart2 className="mr-1.5 h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollText className="mr-1.5 h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-4">
          <KnowledgeBaseTab />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <AnalyticsTab />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("proposal_writer");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
  });

  const addMutation = useMutation({
    mutationFn: () => addUser({ email: newEmail, role: newRole }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      setAddDialogOpen(false);
      setNewEmail("");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateUserRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const users: User[] = (data?.data as { items?: User[] })?.items ?? [];

  const roleColors: Record<UserRole, string> = {
    admin: "bg-purple-100 text-purple-700",
    proposal_writer: "bg-blue-100 text-blue-700",
    reviewer: "bg-green-100 text-green-700",
    viewer: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : (
        <Card>
          <div className="overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="px-4 py-3 font-semibold text-slate-700">User</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 hidden sm:table-cell">Role</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">Last Login</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user: User) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Select
                        value={user.role}
                        onValueChange={(role) =>
                          updateRoleMutation.mutate({ userId: user.id, role: role as UserRole })
                        }
                      >
                        <SelectTrigger className="h-8 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r.value} value={r.value} className="text-xs">
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-500">
                      {user.lastLoginAt ? timeAgo(user.lastLoginAt) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs"
                        onClick={() => deactivateMutation.mutate(user.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Deactivate
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add User Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Authorized User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email Address *</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="john@contoso.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Role *</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => addMutation.mutate()}
              disabled={!newEmail || addMutation.isPending}
              loading={addMutation.isPending}
            >
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Knowledge Base Tab ───────────────────────────────────────
function KnowledgeBaseTab() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["knowledge-stats"],
    queryFn: getKnowledgeStats,
  });

  const reEmbedMutation = useMutation({
    mutationFn: reEmbedAll,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge-stats"] }),
  });

  const stats = data?.data;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => reEmbedMutation.mutate()}
          disabled={reEmbedMutation.isPending}
        >
          <RefreshCw
            className={cn("mr-2 h-4 w-4", reEmbedMutation.isPending && "animate-spin")}
          />
          Re-embed All
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Quality levels */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Records by Quality Level
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {([5, 4, 3, 2, 1] as const).map((level) => {
                const count = stats.byQualityLevel[level] ?? 0;
                const total = stats.totalRecords || 1;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <Badge className={cn(qualityLevelColor(level), "shrink-0 w-28 justify-center text-xs")}>
                      {qualityLevelLabel(level)}
                    </Badge>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* By domain */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-indigo-500" />
                Records by Domain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(stats.byDomain ?? {}).map(([domain, count]) => (
                <div key={domain} className="flex items-center justify-between">
                  <Badge variant="secondary" className="capitalize">
                    {domain}
                  </Badge>
                  <span className="text-sm font-medium text-slate-700">{count as number}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card className="sm:col-span-2">
            <CardContent className="flex gap-6 p-4">
              <div>
                <p className="text-xs text-slate-500">Total Records</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalRecords}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Embeddings Generated</p>
                <p className="text-3xl font-bold text-indigo-600">{stats.embeddingsGenerated}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending Embedding</p>
                <p className="text-3xl font-bold text-orange-500">{stats.pendingEmbedding}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────
function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: getAdminAnalytics,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const analytics = data?.data;
  if (!analytics) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard label="Approval Rate" value={`${analytics.approvalRate?.toFixed(1) ?? 0}%`} />
      <StatCard label="Avg Score" value={analytics.averageScore?.toFixed(2) ?? "—"} />
      <StatCard label="Avg Generation Time" value={`${analytics.avgGenerationTimeMs ?? 0}ms`} />
      <StatCard label="Total Users" value={analytics.totalUsers ?? 0} />
      <StatCard label="Active This Week" value={analytics.activeUsersThisWeek ?? 0} />
      <StatCard label="Knowledge Records" value={analytics.totalKnowledgeRecords ?? 0} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────
function AuditLogTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: () => getAuditLog(),
  });

  const entries: AuditLogEntry[] = (data?.data as { items?: AuditLogEntry[] })?.items ?? [];

  const actionColors: Record<string, string> = {
    login: "bg-blue-100 text-blue-700",
    upload: "bg-green-100 text-green-700",
    export: "bg-purple-100 text-purple-700",
    delete: "bg-red-100 text-red-700",
    edit: "bg-orange-100 text-orange-700",
    approve: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
        </div>
      ) : (
        <ScrollArea className="h-[600px] rounded-xl border border-slate-200 bg-white">
          <div className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <div className="py-12 text-center text-slate-500">No audit entries found.</div>
            ) : (
              entries.map((entry: AuditLogEntry) => {
                const actionKey = Object.keys(actionColors).find((k) =>
                  entry.action.toLowerCase().includes(k)
                );
                const badgeClass = actionKey ? actionColors[actionKey] : "bg-slate-100 text-slate-600";
                return (
                  <div key={entry.id} className="flex items-start gap-4 px-4 py-3 hover:bg-slate-50">
                    <Shield className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-slate-900">{entry.userName}</p>
                        <Badge className={cn(badgeClass, "text-xs")}>{entry.action}</Badge>
                        <span className="text-xs text-slate-400 capitalize">
                          {entry.resourceType}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDateTime(entry.timestamp)}
                        {entry.ipAddress && ` · ${entry.ipAddress}`}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
