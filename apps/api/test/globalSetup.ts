import { execFileSync } from 'node:child_process'

// Hard guard: never migrate or truncate anything but the local docker test DB.
export default function setup() {
  const raw = process.env.DATABASE_URL ?? ''
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('DATABASE_URL for tests is missing or invalid')
  }
  const db = url.pathname.replace(/^\//, '')
  if (url.hostname !== 'localhost' || url.port !== '5433' || !db.endsWith('_test')) {
    throw new Error(`Refusing to run tests against ${url.hostname}:${url.port}/${db} (need localhost:5433/*_test)`)
  }

  // create the database if missing, through the same container the dev DB uses
  try {
    execFileSync('docker', ['exec', 'alacena-db', 'createdb', '-U', url.username, db], { stdio: 'pipe' })
  } catch {
    // already exists (or docker unavailable: migrate deploy below will surface a real error)
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: raw },
  })
}
