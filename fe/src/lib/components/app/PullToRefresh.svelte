<script lang="ts">
  import { onMount, type Snippet } from 'svelte'
  import { RefreshCw } from 'lucide-svelte'
  import { slideScaleFade } from '$lib/transitions/slideScaleFade'

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
  let showIndicator = $state(false)

  let pulling = false
  let startY = 0
  let pullDistance = 0

  const DEAD_ZONE = 20

  let circleEl: SVGCircleElement | undefined = $state()
  let ringEl: SVGSVGElement | undefined = $state()
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

    // Icon color at 100%
    if (iconEl) {
      iconEl.style.color = progress >= 1
        ? 'var(--color-text-main)'
        : 'var(--color-text-secondary)'
    }
  }

  function resetRing() {
    if (circleEl) circleEl.style.strokeDashoffset = `${CIRCUMFERENCE}`
    if (ringEl) ringEl.classList.remove('ptr-spinning')
    if (iconEl) iconEl.style.color = 'var(--color-text-secondary)'
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
        showIndicator = false
      }
      return
    }

    pullDistance = applyResistance(rawDelta)

    // Show indicator after dead zone
    if (pullDistance > DEAD_ZONE && !showIndicator) {
      showIndicator = true
    } else if (pullDistance <= DEAD_ZONE && showIndicator) {
      showIndicator = false
    }

    updateRing(pullDistance)
  }

  async function handleTouchEnd() {
    if (!pulling || disabled) return
    pulling = false

    if (pullDistance >= threshold && !refreshing) {
      refreshing = true
      if (circleEl) circleEl.style.strokeDashoffset = '0'
      if (ringEl) ringEl.classList.add('ptr-spinning')
      if (iconEl) iconEl.style.color = 'var(--color-text-main)'

      try {
        await onRefresh()
      } catch (e) {
        console.error('Pull-to-refresh failed', e)
      } finally {
        refreshing = false
        pullDistance = 0
        showIndicator = false
        // Reset ring after hide transition
        setTimeout(() => resetRing(), 300)
      }
    } else {
      pullDistance = 0
      showIndicator = false
      setTimeout(() => resetRing(), 300)
    }
  }

  onMount(() => {
    const wrapper = document.querySelector('.ptr-wrapper')
    if (!wrapper) return

    const onTouchMove = (e: TouchEvent) => handleTouchMove(e)
    wrapper.addEventListener('touchmove', onTouchMove, { passive: true })

    return () => {
      wrapper.removeEventListener('touchmove', onTouchMove)
    }
  })
</script>

<div
  class="ptr-wrapper"
  ontouchstart={handleTouchStart}
  ontouchend={handleTouchEnd}
  ontouchcancel={handleTouchEnd}
>
  {#if showIndicator}
    <div
      class="ptr-indicator"
      in:slideScaleFade={{ duration: 200, startScale: 0.5, startOpacity: 0 }}
      out:slideScaleFade={{ duration: 200, startScale: 0.5, startOpacity: 0 }}
    >
      <div class="ptr-badge">
        <svg
          bind:this={ringEl}
          class="ptr-ring"
          width="44"
          height="44"
          viewBox="0 0 44 44"
        >
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
        <div bind:this={iconEl} class="ptr-icon">
          <RefreshCw size={16} />
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

  :global(.ptr-spinning) {
    animation: ptr-spin 0.7s linear infinite !important;
  }

  @keyframes ptr-spin {
    from { transform: rotate(-90deg); }
    to { transform: rotate(270deg); }
  }
</style>
