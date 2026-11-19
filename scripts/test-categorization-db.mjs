import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const container = `grocery-category-test-${process.pid}`
function run(args, input = '', onOutput = () => {}) {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] })
  const done = new Promise((resolve, reject) => {
    let output = ''
    let error = ''
    child.stdout.on('data', chunk => { output += chunk; onOutput(output) })
    child.stderr.on('data', chunk => { error += chunk })
    child.on('error', reject)
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(error || `docker exited ${code}`)))
  })
  child.stdin.on('error', () => {})
  child.stdin.end(input)
  return done
}
const sql = (text, onOutput) => run(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], text, onOutput)
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const list = '83000000-0000-0000-0000-000000000001'
const userA = '82000000-0000-0000-0000-000000000001'
const userB = '82000000-0000-0000-0000-000000000002'
const session = user => `set role authenticated; select set_config('request.jwt.claim.sub','${user}',false);`
let created = false
try {
  await run(['run', '--rm', '-d', '--name', container, '--network', 'none', '-e', 'POSTGRES_PASSWORD=isolated-test-only', 'postgres:16-alpine'])
  created = true
  for (let attempt = 0; ; attempt++) {
    try { await run(['exec', container, 'pg_isready', '-U', 'postgres']); break }
    catch (error) { if (attempt === 29) throw error; await pause(500) }
  }
  await sql(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema public, auth to authenticated, anon;
    alter default privileges in schema public grant all on tables to authenticated;
    create publication supabase_realtime;
  `)
  await sql(await readFile(path.join(root, 'lib/db/schema.sql'), 'utf8'))
  // Also exercise the incremental migration on an existing schema.
  await sql(await readFile(path.join(root, 'lib/db/migrations/007_auto_categorization.sql'), 'utf8'))
  await sql(await readFile(path.join(root, 'lib/db/tests/007_auto_categorization.sql'), 'utf8'))
  await sql(await readFile(path.join(root, 'lib/db/migrations/009_text_import.sql'), 'utf8'))
  await sql(await readFile(path.join(root, 'lib/db/tests/009_text_import.sql'), 'utf8'))
  console.log('PASS: PostgreSQL memory, normalization, rollback, preservation and RLS scenarios')
  await sql(`
    insert into public.households(id) values('81000000-0000-0000-0000-000000000001');
    insert into public.users(id,email,household_id) values
      ('${userA}','race-a@invalid.test','81000000-0000-0000-0000-000000000001'),
      ('${userB}','race-b@invalid.test','81000000-0000-0000-0000-000000000001');
    insert into public.lists(id,name,type,household_id) values
      ('${list}','race','supermarket','81000000-0000-0000-0000-000000000001');
  `)
  async function twoSessions(firstQuery, secondQuery) {
    let signal
    const held = new Promise(resolve => { signal = resolve })
    const first = sql(`begin; ${session(userA)}
      ${firstQuery}
      select 'LOCK_HELD'; select pg_sleep(3); commit;`, output => {
        if (output.includes('LOCK_HELD')) signal()
      })
    await Promise.race([held, first.then(() => { throw new Error('Lock marker missing') })])
    const second = sql(`set application_name = 'grocery-race-B'; ${session(userB)}
      ${secondQuery}`)
    const observeContention = async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const waiting = await sql("select exists(select from pg_stat_activity where application_name='grocery-race-B' and wait_event_type='Lock');")
        if (waiting === 't') return
        await pause(50)
      }
      throw new Error('Second session was not observed waiting for the lock')
    }
    const [, output] = await Promise.all([first, second, observeContention()])
    return JSON.parse(output.split('\n').at(-1))
  }
  const manualSave = name => `select public.save_supermarket_item('${list}','${name}',null,'manual','milk');`
  const race = (name, mode, section) => twoSessions(manualSave(name),
    `select public.save_supermarket_item('${list}','${name}',null,'${mode}',${section},null,'dry','v1');`)
  const batch = name => `select public.import_grocery_items('${list}',gen_random_uuid(),
    '[{"name":"${name}","mode":"auto","sectionId":"milk"}]');`
  for (const [name, first] of [
    ['manual-then-import', manualSave('manual-then-import')],
    ['import-then-import', batch('import-then-import')],
    ['direct-then-import', `insert into public.items(list_id,name,created_by_user_id)
       values ('${list}','direct-then-import','${userA}');`],
  ]) {
    const result = await twoSessions(first, batch(name))
    assert.equal(result.status, 'conflict')
    assert.equal(result.conflicts[0].name, name)
    assert.equal(await sql(`select count(*) from public.items where list_id='${list}' and name='${name}';`), '1')
  }
  console.log('PASS: manual, direct and batch writes racing with import')
  const auto = await race('race-auto', 'auto', 'null')
  assert.equal(auto.item.section_id, 'milk')
  assert.equal(auto.source, 'remembered')
  const manual = await race('race-manual', 'manual', "'sauces'")
  assert.equal(manual.item.section_id, 'sauces')
  const after = await sql(`${session(userA)}select public.save_supermarket_item('${list}','race-manual',null,'auto');`)
  assert.equal(JSON.parse(after.split('\n').at(-1)).item.section_id, 'sauces')
  console.log('PASS: two concurrent PostgreSQL sessions, absent memory row, auto/manual and manual/manual ordering')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Database checks failed')
  process.exitCode = 1
} finally {
  if (created) await run(['rm', '-f', container]).catch(() => {})
}
