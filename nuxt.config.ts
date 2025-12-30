// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: false, // iframe-friendly SPA (no SSR mismatch)
  app: {
    head: {
      title: "Blink Maze",
      meta: [{ name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" }],
    },
  },
  css: ["~/assets/main.css"],
})
