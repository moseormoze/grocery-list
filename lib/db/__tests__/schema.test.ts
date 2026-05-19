import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Database Schema', () => {
  let schemaContent: string;

  beforeAll(() => {
    const schemaPath = path.join(__dirname, '../schema.sql');
    schemaContent = fs.readFileSync(schemaPath, 'utf-8');
  });

  describe('Table Definitions', () => {
    it('should define households table', () => {
      expect(schemaContent).toContain('create table if not exists public.households');
      expect(schemaContent).toContain('id uuid default gen_random_uuid() primary key');
      expect(schemaContent).toContain('created_at timestamp with time zone');
    });

    it('should define users table with household foreign key', () => {
      expect(schemaContent).toContain('create table if not exists public.users');
      expect(schemaContent).toContain('email text not null');
      expect(schemaContent).toContain('name text');
      expect(schemaContent).toContain('household_id uuid not null');
      expect(schemaContent).toContain('constraint fk_household foreign key (household_id)');
      expect(schemaContent).toContain('constraint unique_email_household unique(email, household_id)');
    });

    it('should define lists table with type constraint', () => {
      expect(schemaContent).toContain('create table if not exists public.lists');
      expect(schemaContent).toContain('name text not null');
      expect(schemaContent).toContain("type text not null check(type in ('supermarket', 'pharmacy', 'house'))");
      expect(schemaContent).toContain('household_id uuid not null');
      expect(schemaContent).toContain('updated_at timestamp with time zone');
    });

    it('should define items table with all required fields', () => {
      expect(schemaContent).toContain('create table if not exists public.items');
      expect(schemaContent).toContain('list_id uuid not null');
      expect(schemaContent).toContain('name text not null');
      expect(schemaContent).toContain('qty text');
      expect(schemaContent).toContain('section_id text');
      expect(schemaContent).toContain('ticked boolean default false');
      expect(schemaContent).toContain('order_index integer default 0');
      expect(schemaContent).toContain('created_by_user_id uuid not null');
    });

    it('should define list_snapshots table for trip history', () => {
      expect(schemaContent).toContain('create table if not exists public.list_snapshots');
      expect(schemaContent).toContain('list_id uuid not null');
      expect(schemaContent).toContain('items_snapshot jsonb not null');
      expect(schemaContent).toContain('constraint fk_list foreign key (list_id)');
    });

    it('should define invite_tokens table with expiry', () => {
      expect(schemaContent).toContain('create table if not exists public.invite_tokens');
      expect(schemaContent).toContain('household_id uuid not null');
      expect(schemaContent).toContain('token_hash text not null');
      expect(schemaContent).toContain('consumed_by_user_id uuid');
      expect(schemaContent).toContain('expires_at timestamp with time zone not null');
      expect(schemaContent).toContain('constraint unique_token_hash unique(token_hash)');
    });

    it('should define categorizations_cache table', () => {
      expect(schemaContent).toContain('create table if not exists public.categorizations_cache');
      expect(schemaContent).toContain('item_name text not null');
      expect(schemaContent).toContain("list_type text not null check(list_type in ('supermarket', 'pharmacy', 'house'))");
      expect(schemaContent).toContain('section_id text not null');
      expect(schemaContent).toContain('constraint unique_categorization unique(item_name, list_type)');
    });
  });

  describe('Indexes', () => {
    it('should create indexes for common queries', () => {
      expect(schemaContent).toContain('create index if not exists idx_users_household');
      expect(schemaContent).toContain('create index if not exists idx_lists_household');
      expect(schemaContent).toContain('create index if not exists idx_items_list');
      expect(schemaContent).toContain('create index if not exists idx_items_ticked');
      expect(schemaContent).toContain('create index if not exists idx_invite_tokens_household');
      expect(schemaContent).toContain('create index if not exists idx_categorizations_type');
    });
  });

  describe('Row Level Security', () => {
    it('should enable RLS on all tables', () => {
      expect(schemaContent).toContain('alter table public.households enable row level security');
      expect(schemaContent).toContain('alter table public.users enable row level security');
      expect(schemaContent).toContain('alter table public.lists enable row level security');
      expect(schemaContent).toContain('alter table public.items enable row level security');
      expect(schemaContent).toContain('alter table public.list_snapshots enable row level security');
      expect(schemaContent).toContain('alter table public.invite_tokens enable row level security');
      expect(schemaContent).toContain('alter table public.categorizations_cache enable row level security');
    });

    it('should define RLS policies for households', () => {
      expect(schemaContent).toContain('create policy "users can view their household"');
    });

    it('should define RLS policies for users (household members)', () => {
      expect(schemaContent).toContain('create policy "users can view household members"');
      expect(schemaContent).toContain('create policy "users can insert themselves"');
    });

    it('should define RLS policies for lists (household access)', () => {
      expect(schemaContent).toContain('create policy "users can view household lists"');
      expect(schemaContent).toContain('create policy "users can create lists in their household"');
      expect(schemaContent).toContain('create policy "users can update their household lists"');
      expect(schemaContent).toContain('create policy "users can delete their household lists"');
    });

    it('should define RLS policies for items (list access)', () => {
      expect(schemaContent).toContain('create policy "users can view items in their lists"');
      expect(schemaContent).toContain('create policy "users can insert items in their lists"');
      expect(schemaContent).toContain('create policy "users can update items in their lists"');
      expect(schemaContent).toContain('create policy "users can delete items in their lists"');
    });

    it('should define RLS policies for list_snapshots', () => {
      expect(schemaContent).toContain('create policy "users can view snapshots of their lists"');
      expect(schemaContent).toContain('create policy "users can create snapshots for their lists"');
    });

    it('should define RLS policies for invite_tokens', () => {
      expect(schemaContent).toContain('create policy "users can view household invites"');
      expect(schemaContent).toContain('create policy "users can create invites for their household"');
    });

    it('should allow public read access to categorizations_cache', () => {
      expect(schemaContent).toContain('create policy "anyone can read cache"');
    });
  });

  describe('Realtime Setup', () => {
    it('should enable realtime for items, lists, and snapshots', () => {
      expect(schemaContent).toContain('alter publication supabase_realtime add table public.items');
      expect(schemaContent).toContain('alter publication supabase_realtime add table public.lists');
      expect(schemaContent).toContain('alter publication supabase_realtime add table public.list_snapshots');
    });
  });

  describe('Invite Token RPCs', () => {
    it('should define validate_invite_token as a security-definer function', () => {
      expect(schemaContent).toContain('create or replace function public.validate_invite_token');
      const fnBody = schemaContent
        .split('create or replace function public.validate_invite_token')[1]
        ?.split('create or replace function')[0] ?? '';
      expect(fnBody).toContain('security definer');
    });

    it('should define consume_invite_token as a security-definer function', () => {
      expect(schemaContent).toContain('create or replace function public.consume_invite_token');
      const fnBody = schemaContent
        .split('create or replace function public.consume_invite_token')[1]
        ?.split('create or replace function')[0] ?? '';
      expect(fnBody).toContain('security definer');
    });

    it('should return household_id, is_valid, and reason from validate_invite_token', () => {
      const fnBody = schemaContent
        .split('create or replace function public.validate_invite_token')[1]
        ?.split('create or replace function')[0] ?? '';
      expect(fnBody).toContain('household_id');
      expect(fnBody).toContain('is_valid');
      expect(fnBody).toContain('reason');
    });

    it('should classify validation failures as NOT_FOUND, CONSUMED, or EXPIRED', () => {
      const fnBody = schemaContent
        .split('create or replace function public.validate_invite_token')[1]
        ?.split('create or replace function')[0] ?? '';
      expect(fnBody).toContain('NOT_FOUND');
      expect(fnBody).toContain('CONSUMED');
      expect(fnBody).toContain('EXPIRED');
    });

    it('should lock the row in consume_invite_token to prevent double-consume', () => {
      const fnBody = schemaContent
        .split('create or replace function public.consume_invite_token')[1]
        ?.split('create or replace function')[0] ?? '';
      expect(fnBody.toLowerCase()).toContain('for update');
    });

    it('should revoke execute from anon and grant to authenticated for both RPCs', () => {
      expect(schemaContent).toContain('revoke execute on function public.validate_invite_token');
      expect(schemaContent).toContain('revoke execute on function public.consume_invite_token');
      expect(schemaContent).toContain('grant execute on function public.validate_invite_token');
      expect(schemaContent).toContain('grant execute on function public.consume_invite_token');
      expect(schemaContent).toContain('to authenticated');
      expect(schemaContent).toContain('from anon');
    });
  });
});
