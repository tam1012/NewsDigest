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

  const MIN_SCROLL_PX = 300     // must be past this before button can appear
  const UP_DISTANCE_THRESHOLD = 150 // px scrolled up from peak to reveal button

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

    if (scrollTop > peakScrollTop) {
      // Scrolling down — update peak, always hide
      peakScrollTop = scrollTop
      visible = false
      return
    }

    // Scrolling up — show only once we've risen enough from the peak
    visible = scrollTop <= peakScrollTop - UP_DISTANCE_THRESHOLD
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
      title="Lên đầu trang"
      aria-label="Lên đầu trang"
      class="size-12 md:size-10"
    >
      <ChevronUp size={20} />
    </CusButton>
  </div>
{/if}
