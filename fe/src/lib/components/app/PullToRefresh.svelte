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

  // Plain JS — no reactivity overhead on touchmove
  let pulling = false
  let startY = 0
  let pullDistance = 0

  let indicatorEl: HTMLDivElement | undefined = $state()
  let iconEl: HTMLDivElement | undefined = $state()

  function applyResistance(distance: number): number {
    return Math.min(distance * 0.4, 100)
  }

  function updateIndicator(dist: number) {
    if (!indicatorEl || !iconEl) return
    const progress = Math.min(dist / threshold, 1)
    indicatorEl.style.opacity = `${progress}`
    indicatorEl.style.transform = `translateY(${dist - 28}px)`

    if (dist >= threshold) {
      iconEl.style.transform = 'rotate(180deg)'
      iconEl.style.color = 'var(--color-text-main)'
    } else {
      iconEl.style.transform = 'rotate(0deg)'
      iconEl.style.color = 'var(--color-text-secondary)'
    }
  }

  function hideIndicator(animate: boolean) {
    if (!indicatorEl) return
    if (animate) {
      indicatorEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease'
    }
    indicatorEl.style.opacity = '0'
    indicatorEl.style.transform = 'translateY(-28px)'
    if (animate) {
      setTimeout(() => {
        if (indicatorEl) indicatorEl.style.transition = 'none'
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
      // Keep indicator visible at threshold while refreshing
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
    // passive: true — we don't preventDefault, let native overscroll work
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
  <!-- Fixed indicator at top — just visual, doesn't move content -->
  <div bind:this={indicatorEl} class="ptr-indicator">
    <div bind:this={iconEl} class="ptr-icon">
      {#if refreshing}
        <RefreshCw size={16} class="animate-spin" />
      {:else}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      {/if}
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
    padding-top: 12px;
    pointer-events: none;
    z-index: 50;
    opacity: 0;
  }

  .ptr-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-btn);
    border: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    transition: transform 0.2s ease, color 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
</style>
