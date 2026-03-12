import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('echarts') || id.includes('echarts-for-react')) {
            return 'vendor-echarts'
          }
          if (id.includes('antd') || id.includes('@ant-design') || id.includes('/rc-')) {
            return 'vendor-antd'
          }
          return undefined
        },
      },
    },
  },
})
