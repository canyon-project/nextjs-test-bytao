#!/usr/bin/env node
// @ts-check
/**
 * Publish the built `next` package as `nextjs-test-bytao` to npm.
 * Run after: pnpm install && pnpm run build
 * Requires: NPM_TOKEN
 */

const path = require('path')
const fs = require('fs')
const execa = require('execa')

const cwd = process.cwd()
const NEXT_PKG = path.join(cwd, 'packages', 'next')
const PUBLISH_DIR = path.join(cwd, '.publish-nextjs-test-bytao')
const CUSTOM_NAME = 'nextjs-test-bytao'

function cpRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    if (name === 'node_modules' || name === '.next') continue
    const srcPath = path.join(src, name)
    const destPath = path.join(dest, name)
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      cpRecursive(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function rmRecursive(dir) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) rmRecursive(p)
    else fs.unlinkSync(p)
  }
  fs.rmdirSync(dir)
}

;(async () => {
  if (!process.env.NPM_TOKEN) {
    console.error('NPM_TOKEN is required')
    process.exit(1)
  }

  if (!fs.existsSync(NEXT_PKG)) {
    console.error('packages/next not found. Run pnpm run build first.')
    process.exit(1)
  }

  const pkgJsonPath = path.join(NEXT_PKG, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
  const originalName = pkg.name

  console.log(`Publishing as "${CUSTOM_NAME}" (from ${originalName}@${pkg.version})`)

  rmRecursive(PUBLISH_DIR)
  cpRecursive(NEXT_PKG, PUBLISH_DIR)

  const publishPkgPath = path.join(PUBLISH_DIR, 'package.json')
  const publishPkg = JSON.parse(fs.readFileSync(publishPkgPath, 'utf-8'))
  publishPkg.name = CUSTOM_NAME
  fs.writeFileSync(publishPkgPath, JSON.stringify(publishPkg, null, 2) + '\n')

  try {
    await execa(
      'npm',
      [
        'publish',
        PUBLISH_DIR,
        '--access',
        'public',
        '--ignore-scripts',
        '--tag',
        process.env.NPM_PUBLISH_TAG || 'canary',
      ],
      { stdio: 'inherit', cwd }
    )
    console.log(`Published ${CUSTOM_NAME}@${publishPkg.version}`)
  } finally {
    rmRecursive(PUBLISH_DIR)
  }
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
