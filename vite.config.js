import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Important: GitHub Pages project sites live under /REPOSITORY_NAME/
  base: '/QuandEstLibre/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'QuandEstLibre',
        short_name: 'QuandEstLibre',
        lang: 'fr',
        start_url: '/QuandEstLibre/',
        scope: '/QuandEstLibre/',
        display: 'standalone',
        theme_color: '#4C0297',
        background_color: '#FFFCF4',
        icons: [
          { src: '/QuandEstLibre/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
})