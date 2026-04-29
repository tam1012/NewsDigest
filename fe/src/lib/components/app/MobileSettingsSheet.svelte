<script lang="ts">
  import { prefs, FONT_SIZES } from '$lib/stores/prefs'
  import { Sun, Moon, ChevronRight } from 'lucide-svelte'
  import MobileAboutPanel from '$lib/components/app/MobileAboutPanel.svelte'
  import { createDrawer } from '$lib/drawer.svelte'

  const SHEET_TAB_FALLBACK_WIDTH = 96
  const THEME_TAB_FALLBACK_WIDTH = 42
  const FONT_TAB_FALLBACK_WIDTH = 64

  let {
    open = false,
    onClose,
  }: {
    open?: boolean
    onClose?: () => void
  } = $props()

  const drawer = createDrawer(
    () => open,
    () => onClose?.(),
  )

  // ── Top-level tab: Settings vs About ──
  let activeTab = $state<'settings' | 'about'>('settings')

  let settingsTabW = $state(0)
  let aboutTabW = $state(0)
  let tabIndicator = $state<HTMLSpanElement | null>(null)
  let settingsTabWidth = $derived(settingsTabW || SHEET_TAB_FALLBACK_WIDTH)
  let aboutTabWidth = $derived(aboutTabW || SHEET_TAB_FALLBACK_WIDTH)

  let tabIndicatorW = $derived(
    activeTab === 'settings' ? settingsTabWidth : aboutTabWidth,
  )
  let tabIndicatorX = $derived(activeTab === 'settings' ? 0 : settingsTabWidth)

  // Reset to settings tab when sheet opens
  $effect(() => {
    if (open) activeTab = 'settings'
  })

  function playPress(el: HTMLSpanElement | null) {
    el?.animate([{ scale: '1' }, { scale: '0.85' }, { scale: '1' }], {
      duration: 400,
      easing: 'cubic-bezier(0, 0.55, 0.45, 1)',
    })
  }

  function switchTab(tab: 'settings' | 'about') {
    if (activeTab !== tab) {
      playPress(tabIndicator)
      activeTab = tab
    }
  }

  // ── Theme segmented control (2-segment, CusButtonTab style) ──
  let themeTabLightW = $state(0)
  let themeTabDarkW = $state(0)
  let themeIndicator = $state<HTMLSpanElement | null>(null)
  let themeTabLightWidth = $derived(themeTabLightW || THEME_TAB_FALLBACK_WIDTH)
  let themeTabDarkWidth = $derived(themeTabDarkW || THEME_TAB_FALLBACK_WIDTH)

  let themeIndicatorW = $derived(
    $prefs.darkMode ? themeTabDarkWidth : themeTabLightWidth,
  )
  let themeIndicatorX = $derived($prefs.darkMode ? themeTabLightWidth : 0)

  function toggleTheme() {
    playPress(themeIndicator)
    $prefs.darkMode = !$prefs.darkMode
  }

  // ── Font size 3-segment control ═
  let fontTab0W = $state(0)
  let fontTab1W = $state(0)
  let fontTab2W = $state(0)
  let fontWidths = $derived([
    fontTab0W || FONT_TAB_FALLBACK_WIDTH,
    fontTab1W || FONT_TAB_FALLBACK_WIDTH,
    fontTab2W || FONT_TAB_FALLBACK_WIDTH,
  ])
  let fontIndicator = $state<HTMLSpanElement | null>(null)

  let fontActiveIdx = $derived.by(() => {
    const fs = $prefs.fontSize
    return fs === 14 ? 0 : fs === 16 ? 1 : 2
  })

  let fontIndicatorW = $derived(fontWidths[fontActiveIdx] || 0)

  let fontIndicatorX = $derived.by(() => {
    let x = 0
    for (let i = 0; i < fontActiveIdx; i++) {
      x += fontWidths[i] || 0
    }
    return x
  })

  function cycleFont() {
    playPress(fontIndicator)
    const next = (fontActiveIdx + 1) % 3
    $prefs.fontSize = FONT_SIZES[next]
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
    aria-label="Close settings"
    onclick={drawer.requestClose}
  ></button>

  <div
    bind:this={drawer.drawerPanel}
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    class="drawer-sheet-panel fixed inset-x-0 bottom-0 h-svh rounded-t-4xl border border-b-0 border-border bg-bg-2 shadow-2xl pointer-events-none flex flex-col"
    style="transform: translateY(100%);"
  >
    <!-- Drag handle -->
    <div
      role="presentation"
      class="px-4 pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
      onmousedown={drawer.onDragStart}
      ontouchstart={drawer.onDragStart}
    >
      <div class="mx-auto h-1.5 w-12 rounded-full bg-text-secondary/30"></div>
    </div>

    <!-- Tab switcher -->
    <div
      class="relative mx-6 mt-4 shrink-0 border-b border-border/30"
      role="tablist"
    >
      <div class="flex">
        <!-- Settings tab -->
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'settings'}
          onclick={() => switchTab('settings')}
          bind:offsetWidth={settingsTabW}
          class="flex-1 h-12 font-medium flex items-center justify-center transition-colors duration-200 cursor-pointer {activeTab ===
          'settings'
            ? 'text-text-main'
            : 'text-text-secondary/50'}"
        >
          Settings
        </button>

        <!-- About tab -->
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'about'}
          onclick={() => switchTab('about')}
          bind:offsetWidth={aboutTabW}
          class="flex-1 h-12 font-medium flex items-center justify-center transition-colors duration-200 cursor-pointer {activeTab ===
          'about'
            ? 'text-text-main'
            : 'text-text-secondary/50'}"
        >
          About
        </button>
      </div>

      <!-- Sliding underline indicator -->
      <span
        bind:this={tabIndicator}
        class="absolute bottom-0 h-0.5 rounded-full bg-text-main transition-[transform,width] duration-300 ease-out"
        style="width: {tabIndicatorW}px; transform: translateX({tabIndicatorX}px);"
      ></span>
    </div>

    <!-- Scrollable content (body-drag enabled when scrolled to top) -->
    <div
      bind:this={drawer.drawerBody}
      class="flex-1 overflow-y-auto custom-scrollbar px-6 pb-8"
      role="presentation"
      ontouchstart={drawer.onBodyTouchStart}
      ontouchmove={drawer.onBodyTouchMove}
      ontouchend={drawer.onBodyTouchEnd}
      ontouchcancel={drawer.onBodyTouchEnd}
    >
      <div
        class="sticky top-0 left-0 right-0 -mx-6 h-5 pointer-events-none bg-linear-to-b from-10% from-bg-2 to-bg-2/0 z-10"
      ></div>

      {#if activeTab === 'settings'}
        <!-- ═══ SETTINGS TAB ═══ -->

        <!-- Theme row -->
        <div class="flex items-center justify-between py-3">
          <div>
            <p class="text-base text-text-main">Appearance</p>
          </div>

          <button
            type="button"
            onclick={toggleTheme}
            class="relative h-12 md:h-8 text-sm inline-flex items-center rounded-full cursor-pointer"
          >
            <!-- Frosted background -->
            <span
              class="absolute overflow-hidden flex border dark:border-border border-zinc-100 justify-center items-center inset-y-0 -inset-x-0.75 rounded-full"
            >
              <span
                class="bg-black/5 w-40 h-16 dark:bg-zinc-900/50 backdrop-blur-lg"
              ></span>
            </span>

            <!-- Sliding indicator -->
            <span
              bind:this={themeIndicator}
              class="absolute inset-y-0.75 rounded-full border border-white bg-bg-btn dark:border-white/5 dark:bg-bg-btn dark:shadow-sm shadow-[0_8px_16px_rgba(73,71,69,0.03),0_4px_8px_rgba(73,71,69,0.03)] transition-transform duration-400 ease-out"
              style="width: {themeIndicatorW}px; transform: translateX({themeIndicatorX}px);"
            ></span>

            <!-- Sun tab -->
            <span
              bind:offsetWidth={themeTabLightW}
              class="relative z-10 px-3 h-full flex items-center transition-opacity duration-200"
              class:opacity-40={$prefs.darkMode}
            >
              <Sun size={18} />
            </span>

            <!-- Moon tab -->
            <span
              bind:offsetWidth={themeTabDarkW}
              class="relative z-10 px-3 h-full flex items-center transition-opacity duration-200"
              class:opacity-40={!$prefs.darkMode}
            >
              <Moon size={18} />
            </span>
          </button>
        </div>

        <!-- Font size row -->
        <div class="flex items-center justify-between py-3">
          <p class="text-base text-text-main">Font size</p>

          <button
            type="button"
            onclick={cycleFont}
            class="relative h-12 md:h-8 text-sm inline-flex items-center rounded-full cursor-pointer"
          >
            <!-- Frosted background -->
            <span
              class="absolute overflow-hidden flex border dark:border-border border-zinc-100 justify-center items-center inset-y-0 -inset-x-0.75 rounded-full"
            >
              <span
                class="bg-black/5 w-60 h-16 dark:bg-zinc-900/50 backdrop-blur-lg"
              ></span>
            </span>

            <!-- Sliding indicator -->
            <span
              bind:this={fontIndicator}
              class="absolute inset-y-0.75 rounded-full border border-white bg-bg-btn dark:border-white/5 dark:bg-bg-btn dark:shadow-sm shadow-[0_8px_16px_rgba(73,71,69,0.03),0_4px_8px_rgba(73,71,69,0.03)] transition-transform duration-400 ease-out"
              style="width: {fontIndicatorW}px; transform: translateX({fontIndicatorX}px);"
            ></span>

            <!-- Tab 0: 14px -->
            <span
              bind:offsetWidth={fontTab0W}
              class="relative z-10 w-16 text-center px-3 h-full flex justify-center items-center transition-opacity duration-200"
              class:opacity-40={$prefs.fontSize !== 14}
            >
              14
            </span>

            <!-- Tab 1: 16px -->
            <span
              bind:offsetWidth={fontTab1W}
              class="relative z-10 w-16 text-center px-3 h-full flex justify-center items-center transition-opacity duration-200"
              class:opacity-40={$prefs.fontSize !== 16}
            >
              16
            </span>

            <!-- Tab 2: 18px -->
            <span
              bind:offsetWidth={fontTab2W}
              class="relative z-10 w-16 text-center px-3 h-full flex justify-center items-center transition-opacity duration-200"
              class:opacity-40={$prefs.fontSize !== 18}
            >
              18
            </span>
          </button>
        </div>

        <!-- Sources link -->
        <a
          href="/sources"
          onclick={() => onClose?.()}
          class="rounded-full mt-4 text-center flex items-center justify-center py-2 border border-white bg-bg-btn dark:border-white/5 dark:bg-bg-btn dark:shadow-sm shadow-[0_8px_16px_rgba(73,71,69,0.03),0_4px_8px_rgba(73,71,69,0.03)] transition-[transform,opacity]"
        >
          Manage Sources <ChevronRight size={18} />
        </a>
      {:else}
        <!-- ═══ ABOUT TAB ═══ -->
        <MobileAboutPanel />
      {/if}
    </div>
  </div>
</div>
