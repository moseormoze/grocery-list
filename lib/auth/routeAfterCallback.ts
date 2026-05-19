export type RouteContext = {
  hasUser: boolean;
  hasProfile: boolean;
  pendingInviteToken: string | null;
};

export type RouteDecision =
  | { kind: 'invite'; token: string }
  | { kind: 'name' }
  | { kind: 'lists' }
  | { kind: 'error'; reason: string };

export function routeAfterCallback(ctx: RouteContext): RouteDecision {
  if (!ctx.hasUser) return { kind: 'error', reason: 'no-user' };
  if (ctx.pendingInviteToken) return { kind: 'invite', token: ctx.pendingInviteToken };
  if (!ctx.hasProfile) return { kind: 'name' };
  return { kind: 'lists' };
}
