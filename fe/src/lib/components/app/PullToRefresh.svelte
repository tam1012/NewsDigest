<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { RefreshCw } from 'lucide-svelte'

  let {
    onRefresh,
    disabled = false,
    threshold = 80,
    children,
  }: {
    onRefresh: () => Promise<void>
    disabled?: boolean
    threshold?: number
    children?: Snippet
  } = $props()

  let refreshing = $state(false)

  let pulling = false
  let startY = 0
  let pullDistance = 0

  let indicatorEl: HTMLDivElement | undefined = $state()
  let circleEl: SVGCircleElement | undefined = $state()
  let ringEl: SVGSVGElement | undefined = $state()

  const RADIUS = 18
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS

  function applyResistance(distance: number): number {
    return Math.min(distance * 0.4, 100)
  }

  function updateIndicator(dist: number) {
    if (!indicatorEl || !circleEl) return
    const progress = Math.min(dist / threshold, 1)
    indicatorEl.style.opacity = `${progress}`
    indicatorEl.style.transform = `translateY(${dist - 24}px)`

    // Stroke progress
    const offset = CIRCUMFERENCE * (1 - progress)
    circleEl.style.strokeDashoffset = `${offset}`
  }

  function hideIndicator(animate: boolean) {
    if (!indicatorEl) return
    if (animate) {
      indicatorEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
    }
    indicatorEl.style.opacity = '0'
    indicatorEl.style.transform = 'translateY(-24px)'
    if (animate) {
      setTimeout(() => {
        if (indicatorEl) indicatorEl.style.transition = 'none'
        if (circleEl) circleEl.style.strokeDashoffset = `${CIRCUMFERENCE}`
        if (ringEl) ringEl.classList.remove('ptr-spinning')
      }, 270)
    }
  }

  function handleTouchStart(e: TouchEvent) {
    if (disabled || refreshing) return
    if (window.scrollY > 0) return
    startY = e.touches[0].clientY
    pulling = true
    pullDistance = 0
    if (indicatorEl) indicatorEl.style.transition = 'none'
    if (ringEl) ringEl.classList.remove('ptr-spinning')
  }

  function handleTouchMove(e: TouchEvent) {
    if (!pulling || disabled || refreshing) return

    const currentY = e.touches[0].clientY
    const rawDelta = currentY - startY

    if (rawDelta <= 0) {
      if (pullDistance > 0) {
        pullDistance = 0
        updateIndicator(0)
      }
      return
    }

    pullDistance = applyResistance(rawDelta)
    updateIndicator(pullDistance)
  }

  async function handleTouchEnd() {
    if (!pulling || disabled) return
    pulling = false

    if (pullDistance >= threshold && !refreshing) {
      refreshing = true
      if (circleEl) circleEl.style.strokeDashoffset = '0'
      if (ringEl) ringEl.classList.add('ptr-spinning')
      updateIndicator(threshold)

      try {
        await onRefresh()
      } catch (e) {
        console.error('Pull-to-refresh failed', e)
      } finally {
        refreshing = false
        pullDistance = 0
        hideIndicator(true)
      }
    } else {
      pullDistance = 0
      hideIndicator(true)
    }
  }

  onMount(() => {
    const el = indicatorEl?.parentElement
    if (!el) return

    const onTouchMove = (e: TouchEvent) => handleTouchMove(e)
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    hideIndicator(false)

    return () => {
      el.removeEventListener('touchmove', onTouchMove)
    }
  })
</script>

<div
  class="ptr-wrapper"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
>
  <div bind:this={indicatorEl} class="ptr-indicator">
    <div class="ptr-badge">
      <!-- Outer ring SVG -->
      <svg
        bind:this={ringEl}
        class="ptr-ring"
        width="44"
        height="44"
        viewBox="0 0 44 44"
      >
        <!-- Background track -->
        <circle
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          stroke-width="2"
        />
        <!-- Progress arc -->
        <circle
          bind:this={circleEl}
          cx="22"
          cy="22"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-dasharray={CIRCUMFERENCE}
          stroke-dashoffset={CIRCUMFERENCE}
        />
      </svg>
      <!-- Center icon -->
      <div class="ptr-icon">
        <RefreshCw size={16} />
      </div>
    </div>
  </div>

  {@render children?.()}
</div>

<style>
  .ptr-wrapper {
    position: relative;
  }

  .ptr-indicator {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    padding-top: 8px;
    pointer-events: none;
    z-index: 50;
    opacity: 0;
  }

  .ptr-badge {
    position: relative;
    width: 44px;
    height: 44px;
  }

  .ptr-ring {
    transform: rotate(-90deg);
    color: var(--color-text-main);
  }

  .ptr-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
  }

  :global(.ptr-spinning) {
    animation: ptr-spin 0.7s linear infinite !important;
  }

  @keyframes ptr-spin {
    from { transform: rotate(-90deg); }
    to { transform: rotate(270deg); }
  }
</style>
