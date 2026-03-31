<script lang="ts">
  import { onMount } from 'svelte'
  import { prefs } from '$lib/stores/prefs'
  import '../app.css'
  import 'overlayscrollbars/overlayscrollbars.css'
  import { useOverlayScrollbars } from 'overlayscrollbars-svelte'
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()

  let mounted = $state(false)

  const [initBodyScrollbars] = useOverlayScrollbars({
    defer: true,
    options: {
      scrollbars: { autoHide: 'leave', autoHideDelay: 300 },
    },
  })

  onMount(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved !== null) {
      $prefs.darkMode = saved === 'true'
    } else {
      $prefs.darkMode = window.matchMedia(
        '(prefers-color-scheme: dark)',
      ).matches
    }
    mounted = true

    initBodyScrollbars({
      target: document.body,
      cancel: { body: false },
    })
  })

  $effect(() => {
    if (mounted && typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', $prefs.darkMode)
      localStorage.setItem('darkMode', String($prefs.darkMode))

      // Update theme-color meta for iPhone status bar
      const themeColor = $prefs.darkMode ? '#222221' : '#f1f1ee'
      let meta = document.querySelector(
        'meta[name="theme-color"]',
      ) as HTMLMetaElement | null
      if (meta) {
        meta.setAttribute('content', themeColor)
        // Remove media attr so it applies unconditionally
        meta.removeAttribute('media')
      }
      // Remove second theme-color meta if present
      const allThemeMeta = document.querySelectorAll('meta[name="theme-color"]')
      allThemeMeta.forEach((el, i) => {
        if (i > 0) el.remove()
      })
    }
  })
</script>

<div
  class="min-h-screen"
  style="background: linear-gradient(to right, var(--color-bg-1) 65%, var(--color-bg-2) 65%);"
>
  {@render children()}
</div>
