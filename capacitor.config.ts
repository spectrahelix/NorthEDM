import type { CapacitorConfig } from "@capacitor/cli";

// The native shell loads the live NorthEDM site (SSR stays on Vercel); native
// plugins (push/camera/geolocation) are added on top. `webDir` is just the
// offline fallback bundle.
const config: CapacitorConfig = {
  appId: "com.northedm.app",
  appName: "NorthEDM",
  webDir: "www",
  server: {
    url: "https://www.northedm.com",
    androidScheme: "https",
  },
};

export default config;
