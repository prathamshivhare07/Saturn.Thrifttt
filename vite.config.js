import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { emailOtpPlugin } from './server/email-otp-plugin.js'

function glbStaticServerPlugin() {
  return {
    name: 'glb-static-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0]
        if (cleanUrl.toLowerCase() === '/models/hoodie.glb') {
          const filePath = path.resolve('public/models/hoodie.glb')
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'model/gltf-binary')
            return fs.createReadStream(filePath).pipe(res)
          }
        }
        if (cleanUrl.toLowerCase() === '/models/clothes_rack.glb') {
          const filePath = path.resolve('public/models/clothes_rack.glb')
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'model/gltf-binary')
            return fs.createReadStream(filePath).pipe(res)
          }
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emailOtpPlugin(), glbStaticServerPlugin()],
  server: {
    watch: {
      ignored: ['**/public/models/**', '**/public/frames/**', '**/public/frames2/**'],
    },
  },
})
