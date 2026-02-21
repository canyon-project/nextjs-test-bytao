#!/usr/bin/env node
// @ts-check
/**
 * Publish the built @next/swc package (packages/next-swc with native/ filled)
 * under a custom name to npm.
 *
 * Prerequisites:
 * - pnpm install at repo root
 * - Native binaries in packages/next-swc/native/ (from workflow build-native
 *   artifacts or local: cd packages/next-swc && npm run build-native-release)
 *
 * Required env:
 * - NPM_TOKEN
 *
 * Optional env:
 * - NPM_PACKAGE_NAME  e.g. @canyon-project/swc (default: next-swc-bytao)
 * - NPM_PUBLISH_TAG   e.g. canary (default: canary)
 * - GITHUB_REPOSITORY for repository field in published package.json
 */

const path = require('path')
const fs = require('fs')
const execa = require('execa')

const cwd = process.cwd()
const NEXT_SWC_PKG = path.join(cwd, 'packages', 'next-swc')
const CUSTOM_NAME = process.env.NPM_PACKAGE_NAME || 'next-swc-bytao'
const PUBLISH_DIR = path.join(
  cwd,
  '.publish-swc-' + CUSTOM_NAME.replace(/^@/, '').replace(/\//g, '-')
)

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

  if (!fs.existsSync(NEXT_SWC_PKG)) {
    console.error('packages/next-swc not found.')
    process.exit(1)
  }

  const nativeDir = path.join(NEXT_SWC_PKG, 'native')
  if (!fs.existsSync(nativeDir)) {
    console.error('packages/next-swc/native not found. Build native binaries first.')
    process.exit(1)
  }
  const nodeFiles = fs.readdirSync(nativeDir).filter((f) => f.endsWith('.node'))
  if (nodeFiles.length === 0) {
    console.error('packages/next-swc/native has no .node files. Build native binaries first.')
    process.exit(1)
  }

  const pkgJsonPath = path.join(NEXT_SWC_PKG, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'))
  const originalName = pkg.name

  console.log(
    `Publishing as "${CUSTOM_NAME}" (from ${originalName}@${pkg.version}), ${nodeFiles.length} native binary(ies)`
  )

  rmRecursive(PUBLISH_DIR)
  cpRecursive(NEXT_SWC_PKG, PUBLISH_DIR)

  const publishPkgPath = path.join(PUBLISH_DIR, 'package.json')
  const publishPkg = JSON.parse(fs.readFileSync(publishPkgPath, 'utf-8'))
  publishPkg.name = CUSTOM_NAME
  publishPkg.private = false
  publishPkg.repository = {
    "type": "git",
    "url": "git+https://github.com/canyon-project/nextjs-test-bytao.git"
  }
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
