import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wangwx0825.ainews',
  appName: 'AI News',
  webDir: 'public',
  server: {
    url: 'https://ai-news-application.vercel.app',
    cleartext: false,
  },
}

export default config
