<script lang="ts">
  import { marked } from 'marked'
  import { ChevronLeft, ChevronRight, Clock, Link2, X } from 'lucide-svelte'
  import type { Article } from '$lib/types'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { createDrawer } from '$lib/drawer.svelte'

  let {
    open = false,
    selectedArticle = null,
    filteredArticles = [],
    onPrev,
    onNext,
    onClose,
  }: {
    open?: boolean
    selectedArticle?: Article | null
    filteredArticles?: Article[]
    onPrev?: () => void
    onNext?: () => void
    onClose?: () => void
  } = $props()

  const drawer = createDrawer(() => open, () => onClose?.())

  const doubleTapMs = 280
  const maxTapDurationMs = 260
  const maxTapMovePx = 12

  let prevPressSignal = $state(0)
  let nextPressSignal = $state(0)
  let tapStartX = $state(0)
  let tapStartY = $state(0)
  let tapStartAt = $state(0)
  let lastTapAt = $state(0)
  let lastTapX = $state(0)
  let lastTapY = $state(0)

  let currentIndex = $derived.by(() => {
    if (!selectedArticle) return -1
    return filteredArticles.findIndex((a) => a.id === selectedArticle.id)
  })

  let canGoPrev = $derived(currentIndex > 0)
  let canGoNext = $derived(
    currentIndex >= 0 && currentIndex < filteredArticles.length - 1,
  )

  // Scroll to top when article changes
  $effect(() => {
    if (selectedArticle && drawer.drawerBody) {
      drawer.drawerBody.scrollTop = 0
    }
  })

  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return !!target.closest('a, button, input, textarea, select, [role="button"]')
  }

  function onSheetTouchStart(e: TouchEvent) {
    drawer.onBodyTouchStart(e)
    const touch = e.changedTouches[0]
    if (!touch) return
    tapStartX = touch.clientX
    tapStartY = touch.clientY
    tapStartAt = performance.now()
  }

  function onSheetTouchMove(e: TouchEvent) {
    drawer.onBodyTouchMove(e)
  }

  function onSheetTouchEnd(e: TouchEvent) {
    drawer.onBodyTouchEnd()
    if (!open || !selectedArticle || isInteractiveTarget(e.target)) return

    const touch = e.changedTouches[0]
    if (!touch) return

    const now = performance.now()
    const dx = touch.clientX - tapStartX
    const dy = touch.clientY - tapStartY
    const moved = Math.hypot(dx, dy)
    const tapDuration = now - tapStartAt

    if (moved > maxTapMovePx || tapDuration > maxTapDurationMs) {
      lastTapAt = 0
      return
    }

    const dt = now - lastTapAt
    const gap = Math.hypot(touch.clientX - lastTapX, touch.clientY - lastTapY)
    if (dt <= doubleTapMs && gap <= maxTapMovePx * 2) {
      const rect = drawer.drawerBody?.getBoundingClientRect()
      const splitX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
      const isRightHalf = touch.clientX >= splitX

      if (isRightHalf && canGoNext) {
        nextPressSignal += 1
        onNext?.()
      } else if (!isRightHalf && canGoPrev) {
        prevPressSignal += 1
        onPrev?.()
      }
      lastTapAt = 0
      return
    }

    lastTapAt = now
    lastTapX = touch.clientX
    lastTapY = touch.clientY
  }
</script>

<div
  bind:this={drawer.drawerContainer}
  class="fixed inset-0 z-50 pointer-events-none"
  aria-hidden={!open}
>
  <button
    type="button"
    bind:this={drawer.drawerBackdrop}
    class="drawer-sheet-backdrop absolute inset-0 opacity-0 pointer-events-none"
    aria-label="Đóng khung chi tiết bài viết"
    onclick={drawer.requestClose}
  ></button>

  <div
    bind:this={drawer.drawerPanel}
    role="dialog"
    aria-modal="true"
    aria-label="Chi tiết bài viết"
    class="drawer-sheet-panel will-change-transform fixed inset-x-0 bottom-0 h-svh rounded-t-4xl border border-b-0 border-border bg-bg-2 shadow-2xl pointer-events-none flex flex-col"
    style="transform: translateY(100%);"
  >
    <div
      role="presentation"
      class="px-4 pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
      onmousedown={drawer.onDragStart}
      ontouchstart={drawer.onDragStart}
    >
      <div class="mx-auto h-1.5 w-12 rounded-full bg-text-secondary/30"></div>
    </div>

    {#if selectedArticle}
      <div
        bind:this={drawer.drawerBody}
        role="presentation"
        class="drawer-body custom-scrollbar"
        style="font-size: var(--font-size-base);"
        ontouchstart={onSheetTouchStart}
        ontouchmove={onSheetTouchMove}
        ontouchend={onSheetTouchEnd}
        ontouchcancel={drawer.onBodyTouchEnd}
      >
        <div
          class="fixed top-6 left-2 right-2 h-7 pointer-events-none bg-linear-to-b from-10% from-bg-2 to-bg-2/0"
        ></div>
        <div
          class="flex justify-center gap-4 items-center text-[0.75em] text-text-secondary mb-4"
        >
          <p class="flex items-center gap-1.5">
            <Clock size={14} />
            {new Date(
              selectedArticle.published_at || selectedArticle.fetched_at,
            ).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <a
            href={selectedArticle.url}
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1.5 hover:underline underline-offset-4"
          >
            <Link2 size={14} />
            {new URL(selectedArticle.url).hostname.replace('www.', '')}
          </a>
        </div>
        <a
          href={selectedArticle.url}
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline flex justify-center underline-offset-4"
        >
          <h1
            class="font-serif text-[1.25em] text-center font-bold leading-[1.2] text-text-main mb-4 inline"
          >
            {@html selectedArticle.title}
          </h1>
        </a>
        <div
          class="prose prose-sm text-text-main-2 prose-headings:text-text-main! prose-p:text-text-main-2! prose-li:text-text-main-2! prose-a:text-text-main-2! prose-strong:text-text-main-2! prose-blockquote:text-text-main-2! dark:prose-invert max-w-none prose-headings:mt-6 prose-h2:text-lg prose-h3:text-base prose-headings:mb-3 prose-p:leading-relaxed prose-li:leading-relaxed"
        >
          {#if selectedArticle.summary}
            {@html marked.parse(selectedArticle.summary)}
          {:else}
            <p class="text-zinc-500 italic">Nội dung đang được xử lý...</p>
          {/if}
        </div>
      </div>

      <div
        class="fixed bottom-0 left-0 right-0 pb-8 pt-4 px-8 bg-linear-to-t from-10% from-bg-2 to-bg-2/0"
      >
        <div class="flex gap-2">
          <CusButton
            onclick={onPrev}
            disabled={!canGoPrev}
            pressSignal={prevPressSignal}
            class="h-12 flex-1"
          >
            <ChevronLeft class="-translate-x-px" size={20} />
          </CusButton>
          <CusButton onclick={drawer.requestClose} class="h-12 flex-1 px-3 text-xs">
            {currentIndex + 1} / {filteredArticles.length}
          </CusButton>
          <CusButton
            onclick={onNext}
            disabled={!canGoNext}
            pressSignal={nextPressSignal}
            class="h-12 flex-1"
          >
            <ChevronRight class="translate-x-px" size={20} />
          </CusButton>
        </div>
        <!-- <div class="flex gap-1">
          <CusButton onclick={requestClose} class="size-8">
            <X size={16} />
          </CusButton>
        </div> -->
      </div>
    {/if}
  </div>
</div>
