import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
// Note: This import is resolved relative to this config file by Vite, not the CWD
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [
          // Enable React Compiler
          'babel-plugin-react-compiler',
        ],
      },
    }),
  ],
  define: {
    // Inject version info at build time
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
})
