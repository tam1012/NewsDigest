<script lang="ts">
  import type { Article } from '$lib/types'

  let {
    article,
    sourceName = 'Unknown',
    isSelected = false,
    showIndicator = false,
    onclick,
  }: {
    article: Article
    sourceName?: string
    /** Desktop: highlight selected article */
    isSelected?: boolean
    /** Desktop: show left border indicator when selected */
    showIndicator?: boolean
    onclick?: () => void
  } = $props()

  let timeStr = $derived(
    new Date(article.published_at || article.fetched_at).toLocaleTimeString(
      'vi-VN',
      { hour: '2-digit', minute: '2-digit' },
    ),
  )

  let snippet = $derived(
    article.description_vn ||
      article.description ||
      article.summary?.replace(/<[^>]*>?/gm, '').substring(0, 150) ||
      'Đang xử lý nội dung...',
  )
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="cursor-pointer relative group {showIndicator
    ? 'after:w-0 after:-translate-x-6 after:bg-border ' +
      (isSelected
        ? 'after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1.5! after:rounded-l-4xl'
        : '')
    : ''}"
  {onclick}
>
  <div
    class="flex items-center text-[0.675em] text-text-secondary uppercase tracking-wider mb-1"
  >
    <span class="truncate pr-4">{sourceName}</span>
    <span class="whitespace-nowrap shrink-0">{timeStr}</span>
  </div>
  <h3
    class="font-serif text-[1.125em] leading-[1.4] mb-2 font-semibold text-text-main group-hover:underline underline-offset-4 transition-all line-clamp-4 wrap-break-word"
  >
    {@html article.title}
  </h3>
  <p
    class="text-[1em] {showIndicator
      ? 'text-text-secondary'
      : 'text-text-main-2/70'} leading-relaxed line-clamp-10 wrap-break-word"
  >
    {snippet}
  </p>
</div>
