import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Note: This import is resolved relative to this config file by Vite, not the CWD
import packageJson from './package.json'

// https://vite.dev/config/
export default defineConfig({
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
