import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createListWithTemplate } from '../lists';
import { supabase } from '../client';

vi.mock('../client', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('createListWithTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends all 46 vacation items through one atomic RPC call', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'list-1', name: 'יוון', type: 'vacation_abroad', household_id: 'hh-1' },
      error: null,
    } as never);

    const result = await createListWithTemplate({
      name: 'יוון',
      type: 'vacation_abroad',
      householdId: 'hh-1',
    });

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_list_with_items',
      expect.objectContaining({
        p_name: 'יוון',
        p_type: 'vacation_abroad',
        p_household_id: 'hh-1',
        p_items: expect.arrayContaining([
          expect.objectContaining({ name: 'דרכונים', section_id: 'documents_money' }),
        ]),
      })
    );
    const args = vi.mocked(supabase.rpc).mock.calls[0][1] as { p_items: unknown[] };
    expect(args.p_items).toHaveLength(46);
  });

  it('sends no seed items for existing list types', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ id: 'list-2', name: 'סופר', type: 'supermarket', household_id: 'hh-1' }],
      error: null,
    } as never);

    const result = await createListWithTemplate({
      name: 'סופר',
      type: 'supermarket',
      householdId: 'hh-1',
    });

    expect(result.success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_list_with_items',
      expect.objectContaining({ p_items: [] })
    );
  });

  it('returns a safe failure when the RPC fails or returns no list', async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: null, error: { message: 'transaction failed' } } as never)
      .mockResolvedValueOnce({ data: null, error: null } as never);

    const failed = await createListWithTemplate({
      name: 'יוון',
      type: 'vacation_abroad',
      householdId: 'hh-1',
    });
    const empty = await createListWithTemplate({
      name: 'יוון',
      type: 'vacation_abroad',
      householdId: 'hh-1',
    });

    expect(failed).toEqual({ success: false, error: 'transaction failed' });
    expect(empty.success).toBe(false);
  });

  it('returns a safe failure when the RPC throws', async () => {
    vi.mocked(supabase.rpc).mockRejectedValueOnce(new Error('offline'));

    const result = await createListWithTemplate({
      name: 'יוון',
      type: 'vacation_abroad',
      householdId: 'hh-1',
    });

    expect(result).toEqual({ success: false, error: 'offline' });
  });
});
