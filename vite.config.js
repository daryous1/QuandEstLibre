import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Important: GitHub Pages project sites live under /REPOSITORY_NAME/
  base: '/Quandestlibre/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'QuandEstLibre',
        short_name: 'QuandEstLibre',
        lang: 'fr',
        start_url: '/Quandestlibre/',
        scope: '/Quandestlibre/',
        display: 'standalone',
        theme_color: '#176b50',
        background_color: '#f5f8f6',
        icons: [
          { src: '/Quandestlibre/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
})