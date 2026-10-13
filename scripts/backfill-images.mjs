// Legacy design-image backfill — re-encodes oversized originals through the
// SAME pipeline as fresh uploads (lib/imageTransform.js) into NEW storage
// keys, then (as a separate, reversible step) switches references.
//
// Modes (default = dry run, writes NOTHING):
//   node scripts/backfill-images.mjs                 dry run: per-object report + CSV
//   node scripts/backfill-images.mjs --execute       encode + upload new keys + verify (additive only)
//   node scripts/backfill-images.mjs --switch-refs   flip FIRST 5 verified rows (canary), then stop
//   node scripts/backfill-images.mjs --switch-refs --all   flip the remaining verified rows
//   node scripts/backfill-images.mjs --rollback      restore old URLs for all switched rows
//   node scripts/backfill-images.mjs --rollback --url <old_url>   restore one row
// Options: --limit N   --batch-size N (default 10)
//
// Runs locally as service_role (SUPABASE_SERVICE_ROLE_KEY from .env.local;
// no DATABASE_URL anywhere). Halts on the first failure of any kind.
// Originals are never overwritten or deleted.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { transformDesignImage, toUploadBody } from '../lib/imageTransform.js'

process.loadEnvFile(path.join(import.meta.dirname, '..', '.env.local'))
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const args = process.argv.slice(2)
const has = (f) => args.includes(f)
const opt = (f, d) => { const i = args.indexOf(f); return i >= 0 ? Number(args[i + 1]) : d }
const MODE = has('--rollback') ? 'rollback' : has('--switch-refs') ? 'switch' : has('--execute') ? 'execute' : 'dry'
const LIMIT = opt('--limit', Infinity)
const BATCH = opt('--batch-size', 10)
const CANARY = 5

// Verification thresholds
const PERCEPTUAL_SIZE = 64          // compare both images downscaled to 64x64 RGB
const PERCEPTUAL_MAX_MEAN_DIFF = 6  // mean abs per-channel delta (0-255); webp q85 + resize sits ~1-3 on healthy encodes
const ASPECT_TOLERANCE = 0.01       // 1% relative aspect drift max
const FLAG_BYTES = 400 * 1024       // dry-run flag: projected output above this
const FLAG_MIN_REDUCTION = 0.5      // dry-run flag: less than 50% smaller

const OUT_DIR = path.join(import.meta.dirname, 'output')
fs.mkdirSync(OUT_DIR, { recursive: true })

const die = (msg) => { console.error(`\nHARD STOP: ${msg}`); process.exit(1) }

const bucketKey = (url) => {
  const m = url.split('/storage/v1/object/public/', 1 + 1)
  if (m.length !== 2) return null
  const [bucket, ...rest] = m[1].split('/')
  return { bucket, key: rest.join('/') }
}

async function collectTargets() {
  const targets = [] // { table, column, rowId, oldUrl }
  const { data: designs, error: e1 } = await supabase.from('designs').select('id, image_url').not('image_url', 'is', null).limit(5000)
  if (e1) die(`designs fetch: ${e1.message}`)
  designs.forEach(d => targets.push({ table: 'designs', column: 'image_url', rowId: d.id, oldUrl: d.image_url }))
  const { data: dimgs, error: e2 } = await supabase.from('design_images').select('design_id, image_url').not('image_url', 'is', null).limit(5000)
  if (e2) die(`design_images fetch: ${e2.message}`)
  dimgs.forEach(d => targets.push({ table: 'design_images', column: 'image_url', rowId: d.design_id, oldUrl: d.image_url }))
  const { data: boards, error: e3 } = await supabase.from('moodboards').select('id, cover_image_url').not('cover_image_url', 'is', null).limit(5000)
  if (e3) die(`moodboards fetch: ${e3.message}`)
  boards.forEach(b => targets.push({ table: 'moodboards', column: 'cover_image_url', rowId: b.id, oldUrl: b.cover_image_url }))
  return targets.filter(t => bucketKey(t.oldUrl)?.bucket === 'designs' && !bucketKey(t.oldUrl).key.endsWith('.bf1.webp'))
}

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${res.status} ${url.slice(-50)}`)
  return Buffer.from(await res.arrayBuffer())
}

async function perceptualDiff(bufA, bufB) {
  const raw = (b) => sharp(b).resize(PERCEPTUAL_SIZE, PERCEPTUAL_SIZE, { fit: 'fill' }).removeAlpha().raw().toBuffer()
  const [a, b] = await Promise.all([raw(bufA), raw(bufB)])
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / a.length
}

async function analyze(source, output) {
  const [inMeta, outMeta] = await Promise.all([sharp(source).metadata(), sharp(output).metadata()])
  const inAspect = inMeta.width / inMeta.height
  const outAspect = outMeta.width / outMeta.height
  const aspectDrift = Math.abs(inAspect - outAspect) / inAspect
  const diff = await perceptualDiff(source, output)
  return { inMeta, outMeta, aspectDrift, diff }
}

function assertHealthy(label, { inMeta, outMeta, aspectDrift, diff }, outputBytes) {
  if (!outputBytes || outputBytes < 1024) die(`${label}: output is ${outputBytes} bytes — truncated/empty`)
  if (outMeta.format !== 'webp') die(`${label}: output format ${outMeta.format}, expected webp`)
  if (aspectDrift > ASPECT_TOLERANCE) die(`${label}: aspect drift ${(aspectDrift * 100).toFixed(2)}% (in ${inMeta.width}x${inMeta.height} → out ${outMeta.width}x${outMeta.height})`)
  if (diff > PERCEPTUAL_MAX_MEAN_DIFF) die(`${label}: perceptual mean diff ${diff.toFixed(2)} exceeds ${PERCEPTUAL_MAX_MEAN_DIFF} — output does not look like the source`)
}

const csvEscape = (s) => `"${String(s ?? '').replaceAll('"', '""')}"`
function writeCsv(file, header, rows) {
  fs.writeFileSync(file, [header.join(','), ...rows.map(r => r.map(csvEscape).join(','))].join('\n'))
  console.log(`CSV written: ${file}`)
}

async function inventoryAvatars() {
  const { data, error } = await supabase.from('profiles').select('id, avatar_url').not('avatar_url', 'is', null).limit(5000)
  if (error) { console.log('avatar inventory failed:', error.message); return }
  const sizes = []
  for (const p of data) {
    try {
      const res = await fetch(p.avatar_url, { method: 'HEAD' })
      sizes.push(Number(res.headers.get('content-length') || 0))
    } catch { sizes.push(-1) }
  }
  const ok = sizes.filter(s => s >= 0).sort((a, b) => a - b)
  const total = ok.reduce((a, b) => a + b, 0)
  const over = ok.filter(s => s > 500 * 1024)
  console.log(`\nAVATAR INVENTORY (report only, not transformed): ${ok.length} avatars, total ${(total / 1048576).toFixed(1)}MB, ` +
    `median ${(ok[Math.floor(ok.length / 2)] / 1024).toFixed(0)}KB, max ${(ok[ok.length - 1] / 1048576).toFixed(2)}MB, >500KB: ${over.length} (${(over.reduce((a, b) => a + b, 0) / 1048576).toFixed(1)}MB)`)
}

async function main() {
  if (MODE === 'rollback') {
    const urlIdx = args.indexOf('--url')
    let q = supabase.from('image_backfill_map').select('*').not('switched_at', 'is', null)
    if (urlIdx >= 0) q = q.eq('old_url', args[urlIdx + 1])
    const { data: rows, error } = await q
    if (error) die(error.message)
    console.log(`rolling back ${rows.length} switched row(s)…`)
    for (const r of rows) {
      const { error: upErr } = await supabase.from(r.table_name).update({ [r.column_name]: r.old_url }).eq(r.column_name, r.new_url)
      if (upErr) die(`rollback ${r.old_url.slice(-40)}: ${upErr.message}`)
      const { error: mapErr } = await supabase.from('image_backfill_map').update({ switched_at: null }).eq('id', r.id)
      if (mapErr) die(`map unmark: ${mapErr.message}`)
      console.log(`restored ${r.table_name}.${r.column_name} ← ${r.old_url.slice(-50)}`)
    }
    console.log('rollback complete'); return
  }

  if (MODE === 'switch') {
    // Backstop: dump the whole map to disk BEFORE any flip
    const { data: fullMap, error: dumpErr } = await supabase.from('image_backfill_map').select('*')
    if (dumpErr) die(`map dump: ${dumpErr.message}`)
    writeCsv(path.join(OUT_DIR, `map-backup-${Date.now()}.csv`),
      Object.keys(fullMap[0] || { id: 1 }), fullMap.map(r => Object.values(r)))

    const { data: rows, error } = await supabase.from('image_backfill_map').select('*')
      .not('verified_at', 'is', null).is('switched_at', null).order('id')
    if (error) die(error.message)
    // --ids 1,2,3 flips exactly those map rows (deliberate canary selection);
    // otherwise first-5 canary / --all as before.
    const idsIdx = args.indexOf('--ids')
    const wanted = idsIdx >= 0 ? new Set(args[idsIdx + 1].split(',').map(Number)) : null
    const slice = wanted ? rows.filter(r => wanted.has(r.id)) : has('--all') ? rows : rows.slice(0, CANARY)
    if (wanted && slice.length !== wanted.size) die(`--ids matched ${slice.length} of ${wanted.size} requested rows (already switched or unknown id?)`)
    console.log(wanted
      ? `CANARY (deliberate): flipping ${slice.length} selected rows [${[...wanted].join(', ')}], then stopping…`
      : has('--all')
        ? `flipping ALL remaining ${slice.length} verified rows…`
        : `CANARY: flipping first ${slice.length} of ${rows.length} verified rows, then stopping for Sogol's live check…`)
    for (const r of slice) {
      const { error: upErr } = await supabase.from(r.table_name).update({ [r.column_name]: r.new_url }).eq(r.column_name, r.old_url)
      if (upErr) die(`flip ${r.old_url.slice(-40)}: ${upErr.message}`)
      const { error: mapErr } = await supabase.from('image_backfill_map').update({ switched_at: new Date().toISOString() }).eq('id', r.id)
      if (mapErr) die(`map mark: ${mapErr.message}`)
      console.log(`flipped ${r.table_name}.${r.column_name} → ${r.new_url.slice(-50)}`)
    }
    console.log(has('--all') ? 'all references switched' : 'canary complete — verify live, then run with --all')
    return
  }

  // dry / execute
  const targets = await collectTargets()
  const byUrl = new Map()
  for (const t of targets) { if (!byUrl.has(t.oldUrl)) byUrl.set(t.oldUrl, []); byUrl.get(t.oldUrl).push(t) }
  let urls = [...byUrl.keys()]

  if (MODE === 'execute') {
    const { data: done, error } = await supabase.from('image_backfill_map').select('old_url')
    if (error) die(`map read (has the SQL been run?): ${error.message}`)
    const doneSet = new Set((done || []).map(r => r.old_url))
    urls = urls.filter(u => !doneSet.has(u))
    console.log(`execute: ${urls.length} objects remaining (${doneSet.size} already encoded)`)
  }
  urls = urls.slice(0, LIMIT)

  const report = []
  const flagged = []
  let processed = 0
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH)
    for (const url of batch) {
      const { key } = bucketKey(url)
      const label = key.slice(-50)
      let source
      try { source = await fetchBytes(url) } catch (e) { die(`${label}: download failed — ${e.message}`) }
      let output
      try { output = await transformDesignImage(source) } catch (e) { die(`${label}: transform failed — ${e.message}`) }
      const health = await analyze(source, output)
      assertHealthy(label, health, output.length)

      const newKey = `${key}.bf1.webp`
      const reduction = 1 - output.length / source.length
      const flags = []
      if (output.length > FLAG_BYTES) flags.push(`output ${(output.length / 1024).toFixed(0)}KB > 400KB`)
      if (reduction < FLAG_MIN_REDUCTION) flags.push(`reduction only ${(reduction * 100).toFixed(0)}%`)
      if ((health.inMeta.width * health.inMeta.height) > 40e6) flags.push(`input ${health.inMeta.width}x${health.inMeta.height} (>40MP)`)
      if (flags.length) flagged.push({ key, flags })

      report.push([key, source.length, newKey, output.length, `${(reduction * 100).toFixed(1)}%`,
        `${health.inMeta.width}x${health.inMeta.height}`, `${health.outMeta.width}x${health.outMeta.height}`,
        health.diff.toFixed(2), flags.join('; ')])

      if (MODE === 'execute') {
        const { error: upErr } = await supabase.storage.from('designs')
          .upload(newKey, toUploadBody(output), { cacheControl: '3600', upsert: false, contentType: 'image/webp' })
        if (upErr && !`${upErr.message}`.includes('already exists')) die(`${label}: upload failed — ${upErr.message}`)
        const newUrl = supabase.storage.from('designs').getPublicUrl(newKey).data.publicUrl
        // Round-trip verification: what storage now serves must equal what we
        // encoded AND still perceptually match the source (the check that
        // would have caught the Vercel Buffer corruption).
        const served = await fetchBytes(newUrl)
        if (served.length !== output.length) die(`${label}: served ${served.length} bytes != uploaded ${output.length}`)
        const servedHealth = await analyze(source, served)
        assertHealthy(`${label} (round-trip)`, servedHealth, served.length)
        for (const ref of byUrl.get(url)) {
          const { error: mapErr } = await supabase.from('image_backfill_map').insert({
            table_name: ref.table, column_name: ref.column, row_id: ref.rowId,
            old_url: url, new_url: newUrl, old_bytes: source.length, new_bytes: output.length,
            in_w: health.inMeta.width, in_h: health.inMeta.height,
            out_w: health.outMeta.width, out_h: health.outMeta.height,
            perceptual_diff: health.diff, verified_at: new Date().toISOString(),
          })
          if (mapErr) die(`${label}: map insert — ${mapErr.message}`)
        }
        console.log(`encoded+verified ${label}  ${(source.length / 1048576).toFixed(2)}MB → ${(output.length / 1024).toFixed(0)}KB  diff ${health.diff.toFixed(2)}`)
      }
      processed++
      if (MODE === 'dry' && processed % 20 === 0) console.log(`dry run progress: ${processed}/${urls.length}`)
    }
  }

  const totalIn = report.reduce((a, r) => a + r[1], 0)
  const totalOut = report.reduce((a, r) => a + r[3], 0)
  console.log(`\n${MODE === 'dry' ? 'DRY RUN (nothing written)' : 'EXECUTE'} — ${processed} objects`)
  console.log(`total ${(totalIn / 1048576).toFixed(1)}MB → ${(totalOut / 1048576).toFixed(1)}MB (${((1 - totalOut / totalIn) * 100).toFixed(1)}% reduction)`)
  console.log(`reference rows covered: ${targets.length} (designs ${targets.filter(t => t.table === 'designs').length}, design_images ${targets.filter(t => t.table === 'design_images').length}, moodboards ${targets.filter(t => t.table === 'moodboards').length})`)
  if (flagged.length) {
    console.log(`\nFLAGGED (${flagged.length}):`)
    flagged.forEach(f => console.log(`  ${f.key.slice(-60)} — ${f.flags.join('; ')}`))
  } else {
    console.log('flagged: none')
  }
  writeCsv(path.join(OUT_DIR, `${MODE}-run-${Date.now()}.csv`),
    ['source_key', 'source_bytes', 'target_key', 'output_bytes', 'reduction', 'in_dims', 'out_dims', 'perceptual_diff', 'flags'], report)

  if (MODE === 'dry') await inventoryAvatars()
}

main().catch(e => die(e.stack || e.message))
