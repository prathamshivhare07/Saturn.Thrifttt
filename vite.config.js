import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { emailOtpPlugin } from './server/email-otp-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), emailOtpPlugin()],
})


