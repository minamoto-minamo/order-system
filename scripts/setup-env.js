import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'fs'
import { randomBytes } from 'crypto'

const files = [
  { src: 'env/backend.env.example', dest: 'env/backend.env' },
  { src: 'env/frontend.env.example', dest: 'env/frontend.env' },
]

for (const { src, dest } of files) {
  if (existsSync(dest)) {
    console.log(`skip: ${dest} already exists`)
    continue
  }
  copyFileSync(src, dest)
  console.log(`created: ${dest}`)
}

const secret = randomBytes(32).toString('hex')

const backendEnv = 'env/backend.env'
let content = readFileSync(backendEnv, 'utf8')
if (content.includes('your-random-secret-here')) {
  content = content.replace('your-random-secret-here', secret)
  writeFileSync(backendEnv, content)
  console.log('generated: JWT_SECRET in env/backend.env')
}
