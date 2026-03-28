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
    }
  })
</script>

<div
  class="min-h-screen"
  style="background: linear-gradient(to right, var(--color-bg-1) 50%, var(--color-bg-2) 50%);"
>
  {@render children()}
</div>
