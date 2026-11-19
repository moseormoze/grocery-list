# Product Decisions

Locked decisions. Do not revisit without a new Discovery cycle.

> Most of this file is **open** at project start. Fill in as Discovery cycles close.

## Platform & Stack
| Decision | Value |
|---|---|
| Platform | Mobile-first web app (PWA), not native |
| Locale | Hebrew-first, RTL. English is not in MVP. |
| Hosting | TBD — likely Vercel |
| Database | TBD — likely Neon.tech (PostgreSQL) or Supabase |
| Realtime sync | TBD (Postgres LISTEN/NOTIFY, Supabase Realtime, Pusher, etc.) |
| Cost target | Under $5/month |

## Product Shape
| Decision | Value |
|---|---|
| Sharing model | Two users per list (MVP). Multi-user / multi-list deferred. |
| Built-in list types | Supermarket, pharmacy, house, and vacation abroad. Vacation abroad is pre-populated once; the other types start empty. |
| Auth | TBD — must support inviting a partner |
| Item structure | TBD — name only, or name + qty + category? |
| Check-off behavior | Supermarket, pharmacy, and house lists use the existing trip flow. In vacation-abroad lists, checked means packed; checked items remain until manually changed or the list is deleted. |
| Offline support | TBD — fully offline-first vs online-only |

## Visual & Interaction
| Decision | Value |
|---|---|
| Theme | TBD — defer to design tool (v0.dev) |
| Direction | RTL throughout |
| Font | TBD — must have strong Hebrew set (candidates: Rubik, Heebo, Assistant) |

## Open
| Question | Notes |
|---|---|
| Real-time vs eventual sync | What latency is acceptable? |
| Conflict resolution | What happens when both partners add "חלב" at the same second? |
| Item suggestions / autocomplete | Out of scope for MVP unless Discovery argues otherwise |
| Categories / sections | Defer until usage shows it's needed |
