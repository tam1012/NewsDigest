<script lang="ts">
  import { slideScaleFade } from '$lib/transitions/slideScaleFade'
  import { ChevronUp } from 'lucide-svelte'
  import CusButton from '$lib/components/ui/CusButton.svelte'

  type Props = {
    /**
     * The scroll container element to watch. Defaults to window (body scroll).
     * Pass an HTMLElement for custom scroll containers (e.g. OverlayScrollbars viewport).
     */
    scrollTarget?: HTMLElement | null
    /** Called when the button is clicked — caller decides how to scroll. */
    onScrollToTop: () => void
    class?: string
  }

  let {
    scrollTarget = null,
    onScrollToTop,
    class: className = '',
  }: Props = $props()

  // ── Peak-based visibility logic ──────────────────────────────────────────
  // Rules:
  //  1. Always hidden near the top (< MIN_SCROLL_PX).
  //  2. Track peak = highest scrollTop ever reached (resets near top).
  //  3. Visible only when scrollTop < peak - UP_DISTANCE_THRESHOLD.
  //     i.e. user scrolled UP at least UP_DISTANCE_THRESHOLD px from the peak.
  //  4. Hides again when user scrolls back down (scrollTop approaches peak again).
  //
  // This approach is mathematically impossible to trigger while scrolling DOWN
  // because scrollTop can never be < peak - threshold when peak is being updated.

  const MIN_SCROLL_PX = 150 // must be past this before button can appear
  const UP_DISTANCE_THRESHOLD = 250 // px scrolled up from peak to reveal button
  const DESKTOP_ALWAYS_SHOW_PX = 300 // px scrolled down to always show on desktop

  let visible = $state(false)
  let peakScrollTop = 0

  function resetTracking(scrollTop: number) {
    peakScrollTop = scrollTop
    visible = false
  }

  function onScroll(scrollTop: number) {
    const isNearTop = scrollTop < MIN_SCROLL_PX

    if (isNearTop) {
      peakScrollTop = scrollTop
      visible = false
      return
    }

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
    const desktopShow = isDesktop && scrollTop >= DESKTOP_ALWAYS_SHOW_PX

    if (scrollTop > peakScrollTop) {
      // Scrolling down — update peak, always hide unless on desktop past threshold
      peakScrollTop = scrollTop
      visible = desktopShow
      return
    }

    // Scrolling up — show if on desktop past threshold, OR if we've risen enough from the peak
    visible = desktopShow || scrollTop <= peakScrollTop - UP_DISTANCE_THRESHOLD
  }

  // ── Event wiring ─────────────────────────────────────────────────────────

  $effect(() => {
    const target = scrollTarget

    // Reset tracking whenever the target changes to avoid stale state
    resetTracking(target ? target.scrollTop : window.scrollY)

    if (target) {
      function handleElementScroll() {
        onScroll(target!.scrollTop)
      }
      target.addEventListener('scroll', handleElementScroll, { passive: true })
      return () => target.removeEventListener('scroll', handleElementScroll)
    } else {
      function handleWindowScroll() {
        onScroll(window.scrollY)
      }
      window.addEventListener('scroll', handleWindowScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleWindowScroll)
    }
  })
</script>

{#if visible}
  <div
    in:slideScaleFade={{
      duration: 280,
      startScale: 0.85,
      startOpacity: 0,
      slideFrom: 'bottom',
      slideDistance: '0.5rem',
    }}
    out:slideScaleFade={{
      duration: 200,
      startScale: 0.85,
      startOpacity: 0,
      slideFrom: 'bottom',
      slideDistance: '0.5rem',
    }}
    class="inline-flex z-50 {className}"
  >
    <CusButton
      onclick={onScrollToTop}
      title="Top page"
      aria-label="Top page"
      class="size-12 md:size-10"
    >
      <ChevronUp size={20} />
    </CusButton>
  </div>
{/if}
