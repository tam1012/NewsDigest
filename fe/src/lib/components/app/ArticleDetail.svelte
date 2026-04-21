<script lang="ts">
  import { marked } from 'marked'
  import {
    CaseSensitive,
    ChevronLeft,
    ChevronRight,
    Clock,
    Link2,
  } from 'lucide-svelte'
  import type { Article } from '$lib/types'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import ThemeToggle from '$lib/components/app/ThemeToggle.svelte'

  let {
    article,
    navIdx = -1,
    navTotal = 0,
    darkMode = false,
    onPrev,
    onNext,
    onToggleTheme,
    onCycleFontSize,
  }: {
    article: Article
    navIdx?: number
    navTotal?: number
    darkMode?: boolean
    onPrev?: () => void
    onNext?: () => void
    onToggleTheme?: () => void
    onCycleFontSize?: () => void
  } = $props()

  let timeStr = $derived(
    new Date(article.published_at || article.fetched_at).toLocaleTimeString(
      'vi-VN',
      { hour: '2-digit', minute: '2-digit' },
    ),
  )

  let hostname = $derived(
    new URL(article.url).hostname.replace('www.', ''),
  )
</script>

<!-- Toolbar -->
<div class="flex gap-1">
  <CusButton onclick={onPrev} disabled={navIdx <= 0} class="size-8">
    <ChevronLeft class="-translate-x-px" size={20} />
  </CusButton>
  <CusButton
    onclick={onNext}
    disabled={navIdx < 0 || navIdx >= navTotal - 1}
    class="size-8"
  >
    <ChevronRight class="translate-x-px" size={20} />
  </CusButton>
  <div class="ml-auto flex gap-1">
    <!-- svelte-ignore a11y_consider_explicit_label -->
    <CusButton onclick={onCycleFontSize} class="size-8" title="Đổi cỡ chữ">
      <CaseSensitive size={16} />
    </CusButton>
    <ThemeToggle {darkMode} onToggle={onToggleTheme} class="size-8" />
  </div>
</div>

<!-- Metadata -->
<div class="flex flex-col pb-4 pt-8 gap-4" style="font-size: var(--font-size-base);">
  <div class="flex justify-center gap-4 items-center text-[0.75em] text-text-secondary">
    <p class="flex items-center gap-1.5">
      <Clock size={14} />
      {timeStr}
    </p>
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-1.5 rounded-full hover:underline px-1 underline-offset-4"
    >
      <Link2 size={14} />
      {hostname}
    </a>
  </div>

  <h1
    class="font-serif text-[1.25em] text-center text-balance md:text-[1.5em] font-bold leading-[1.2] text-text-main inline"
  >
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      class="hover:underline underline-offset-4"
    >
      {@html article.title}
    </a>
  </h1>
</div>

<!-- Body -->
<div
  class="prose text-text-main-2 prose-headings:text-text-main! prose-p:text-text-main-2! prose-li:text-text-main-2! prose-a:text-text-main-2! prose-strong:text-text-main-2! prose-blockquote:text-text-main-2! prose-code:text-text-main-2! dark:prose-invert max-w-none prose-base prose-headings:mt-8 prose-h2:text-xl prose-h3:text-lg prose-h4:text-lg prose-headings:mb-4 prose-p:leading-relaxed prose-li:leading-relaxed"
>
  {#if article.summary}
    {@html marked.parse(article.summary)}
  {:else}
    <p class="text-zinc-500 italic">Nội dung đang được xử lý...</p>
  {/if}
</div>
