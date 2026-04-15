<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { RefreshCw } from 'lucide-svelte'
  import { slideScaleFade } from '$lib/transitions/slideScaleFade'

  let {
    onRefresh,
    onIndicatorChange,
    disabled = false,
    threshold = 80,
    children,
  }: {
    onRefresh: () => Promise<void>
    onIndicatorChange?: (visible: boolean) => void
    disabled?: boolean
    threshold?: number
    children?: Snippet
  } = $props()

  let refreshing = $state(false)
  let showIndicator = $state(false)

  let pulling = false
  let startY = 0
  let pullDistance = 0
  let refreshStartTime = 0

  // Minimum time the indicator stays visible after refresh completes
  const MIN_INDICATOR_MS = 1000
  // Delay before showing indicator (let nav fade out first ~0.2s)
  const SHOW_DELAY_MS = 200
  // Delay before nav fades back in after indicator hides (~0.3s)
  const HIDE_NAV_DELAY_MS = 300

  let showDelayTimer: ReturnType<typeof setTimeout> | null = null

  function setIndicator(visible: boolean) {
    showIndicator = visible
    onIndicatorChange?.(visible)
  }

  const DEAD_ZONE = 20

  let circleEl: SVGCircleElement | undefined = $state()
  let iconEl: HTMLDivElement | undefined = $state()

  const RADIUS = 18
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  function applyResistance(distance: number): number {
    return Math.min(distance * 0.4, 100)
  }

  function updateRing(dist: number) {
    if (!circleEl) return

    const effectiveDist = Math.max(0, dist - DEAD_ZONE)
    const effectiveThreshold = threshold - DEAD_ZONE
    const progress = Math.min(effectiveDist / effectiveThreshold, 1)

    // Stroke progress
    const offset = CIRCUMFERENCE * (1 - progress)
    circleEl.style.strokeDashoffset = `${offset}`
  }

  function resetRing() {
    if (circleEl) circleEl.style.strokeDashoffset = `${CIRCUMFERENCE}`
  }

  function handleTouchStart(e: TouchEvent) {
    if (disabled || refreshing) return
    if (window.scrollY > 0) return
    startY = e.touches[0].clientY
    pulling = true
    pullDistance = 0
  }

  function handleTouchMove(e: TouchEvent) {
    if (!pulling || disabled || refreshing) return

    const currentY = e.touches[0].clientY
    const rawDelta = currentY - startY

    if (rawDelta <= 0) {
      if (pullDistance > 0) {
        pullDistance = 0
        cancelShowDelay()
        setIndicator(false)
      }
      return
    }

    pullDistance = applyResistance(rawDelta)

    // Telegraph nav hide immediately; indicator appears after SHOW_DELAY_MS
    if (pullDistance > DEAD_ZONE && !showIndicator && !showDelayTimer) {
      // Notify nav to fade out right away
      onIndicatorChange?.(true)
      // Then show indicator after delay
      showDelayTimer = setTimeout(() => {
        showDelayTimer = null
        showIndicator = true
      }, SHOW_DELAY_MS)
    } else if (pullDistance <= DEAD_ZONE) {
      cancelShowDelay()
      if (showIndicator) setIndicator(false)
      else onIndicatorChange?.(false)
    }

    updateRing(pullDistance)
  }

  function cancelShowDelay() {
    if (showDelayTimer) {
      clearTimeout(showDelayTimer)
      showDelayTimer = null
    }
  }

  async function handleTouchEnd() {
    if (!pulling || disabled) return
    pulling = false

    if (pullDistance >= threshold && !refreshing) {
      cancelShowDelay()
      refreshing = true
      refreshStartTime = Date.now()
      // Ensure indicator is visible
      showIndicator = true
      if (circleEl) circleEl.style.strokeDashoffset = '0'

      try {
        await onRefresh()
      } catch (e) {
        console.error('Pull-to-refresh failed', e)
      } finally {
        pullDistance = 0
        // Keep spinning for at least MIN_INDICATOR_MS total
        const elapsed = Date.now() - refreshStartTime
        const remaining = Math.max(0, MIN_INDICATOR_MS - elapsed)
        setTimeout(() => {
          refreshing = false
          showIndicator = false
          // Delay nav fade-in by HIDE_NAV_DELAY_MS after indicator hides
          setTimeout(() => {
            onIndicatorChange?.(false)
            setTimeout(() => resetRing(), 300)
          }, HIDE_NAV_DELAY_MS)
        }, remaining)
      }
    } else {
      cancelShowDelay()
      pullDistance = 0
      showIndicator = false
      // Nav fades back after short delay
      setTimeout(() => {
        onIndicatorChange?.(false)
        setTimeout(() => resetRing(), 300)
      }, HIDE_NAV_DELAY_MS)
    }
  }

  onMount(() => {
    const wrapper = document.querySelector('.ptr-wrapper')
    if (!wrapper) return

    const onTouchMove: EventListener = (event) => handleTouchMove(event as TouchEvent)
    wrapper.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      wrapper.removeEventListener('touchmove', onTouchMove)
    }
  })
</script>

<div
  class="ptr-wrapper"
  role="presentation"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
>
  {#if showIndicator}
    <div
      class="ptr-indicator"
      in:slideScaleFade={{ duration: 400, startScale: 0.85, startOpacity: 0 }}
      out:slideScaleFade={{ duration: 400, startScale: 0.85, startOpacity: 0 }}
    >
      <div class="ptr-badge">
        {#if !refreshing}
          <svg class="ptr-ring" width="44" height="44" viewBox="0 0 44 44">
            <circle
              cx="22"
              cy="22"
              r={RADIUS}
              fill="none"
              stroke="var(--color-border)"
              stroke-width="2"
            />
            <circle
              bind:this={circleEl}
              cx="22"
              cy="22"
              r={RADIUS}
              fill="none"
              stroke="var(--color-text-main)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-dasharray={CIRCUMFERENCE}
              stroke-dashoffset={CIRCUMFERENCE}
            />
          </svg>
        {/if}
        <div class="ptr-icon">
          <RefreshCw size={16} class={refreshing ? 'animate-spin' : ''} />
        </div>
      </div>
    </div>
  {/if}

  {@render children?.()}
</div>

<style>
  .ptr-wrapper {
    position: relative;
  }

  .ptr-indicator {
    position: fixed;
    top: 12px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
    z-index: 50;
  }

  .ptr-badge {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--color-bg-btn);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  }

  .ptr-ring {
    transform: rotate(-90deg);
  }

  .ptr-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    transition: color 0.15s ease;
  }
</style>
