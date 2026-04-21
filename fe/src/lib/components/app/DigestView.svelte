<script lang="ts">
  import type { Digest } from '$lib/types'

  let {
    digest = null,
    parsedHtml = '',
    onArticleClick,
    class: className = '',
  }: {
    digest?: Digest | null
    parsedHtml?: string
    onArticleClick?: (e: MouseEvent) => void
    class?: string
  } = $props()
</script>

{#if digest}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="prose prose-sm max-w-none text-text-main-2 prose-headings:text-text-main! prose-p:text-text-main-2! prose-li:text-text-main-2! prose-a:text-text-main-2! prose-strong:text-text-main! prose-headings:text-base prose-headings:mt-6 prose-headings:mb-2 prose-p:leading-relaxed {className}"
    onclick={onArticleClick}
  >
    {@html parsedHtml}
  </div>
{:else}
  <div
    class="text-sm text-zinc-500 py-10 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl"
  >
    Chưa có bản tin tổng hợp cho ngày này.
  </div>
{/if}
