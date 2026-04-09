<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity'
  import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
  } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import * as Drawer from '$lib/components/ui/drawer/index.js'
  import { buttonVariants } from '$lib/components/ui/button/index.js'
  import HotBadge from './HotBadge.svelte'
  import {
    ExternalLink,
    Sparkles,
  } from 'lucide-svelte'
  import type { Article } from '$lib/types'
  import { sources } from '$lib/stores/sources'
  import { marked } from 'marked'

  let { article }: { article: Article } = $props()

  let open = $state(false)
  const isDesktop = new MediaQuery('(min-width: 768px)')

  let tagsArray = $derived.by(() => {
    try {
      return article.tags ? JSON.parse(article.tags) : []
    } catch (e) {
      return []
    }
  })

  let sourceName = $derived(
    $sources.find((s) => s.id === article.source_id)?.name || 'Unknown',
  )

  // Card hiển thị description_vn (tóm tắt tiếng Việt ngắn), popup hiển thị summary (AI full)
  let displayText = $derived(
    article.description_vn || article.description || 'Đang xử lý nội dung...',
  )
  let hasSummary = $derived(!!article.summary)
  let renderedSummary = $derived(
    article.summary ? (marked.parse(article.summary) as string) : '',
  )

  function openSummary() {
    open = true
  }
</script>

<!-- Shared content for both Dialog and Drawer -->
{#snippet summaryContent()}
  <div class="space-y-4">
    <!-- AI Summary -->
    {#if article.summary}
      <div
        class="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed"
      >
        {@html renderedSummary}
      </div>
    {/if}

    <!-- Link to original -->
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      class={buttonVariants({ variant: 'outline', size: 'sm' })}
    >
      Xem bài gốc
      <ExternalLink size={14} class="ml-1.5" />
    </a>
  </div>
{/snippet}

<Card
  class="flex flex-col h-full hover:shadow-md transition-shadow"
>
  <CardHeader class="pb-2">
    <div class="flex justify-between items-start gap-4">
      <CardTitle class="text-lg leading-tight line-clamp-4">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          class="hover:underline"
        >
          {article.title}
        </a>
      </CardTitle>
      <div>
        <HotBadge score={article.hot_score} />
      </div>
    </div>
    <div class="text-xs text-muted-foreground flex gap-2 items-center mt-1">
      <span class="font-medium text-primary">{sourceName}</span>
      •
      <span
        >{new Date(
          article.published_at || article.fetched_at,
        ).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          day: 'numeric',
          month: 'short',
        })}</span
      >
    </div>
  </CardHeader>

  <CardContent class="grow">
    <p class="text-sm text-muted-foreground line-clamp-3">{displayText}</p>
    {#if tagsArray.length > 0}
      <div class="flex gap-2 flex-wrap mt-4">
        {#each tagsArray as tag}
          <Badge variant="outline" class="text-xs font-normal bg-secondary/50"
            >{tag}</Badge
          >
        {/each}
      </div>
    {/if}
  </CardContent>

  <CardFooter
    class="pt-4 border-t flex justify-end items-center text-sm text-muted-foreground"
  >
    {#if hasSummary}
      <!-- Responsive Dialog: Dialog on desktop, Drawer on mobile -->
      {#if isDesktop.current}
        <Dialog.Root bind:open>
          <Dialog.Trigger
            class="flex items-center gap-1 hover:text-foreground transition-colors text-primary font-medium"
            onclick={openSummary}
          >
            <Sparkles size={14} />
            Tóm tắt AI
          </Dialog.Trigger>
          <Dialog.Content class="sm:max-w-[560px]">
            <Dialog.Header>
              <Dialog.Title class="text-base leading-snug pr-6"
                >{article.title}</Dialog.Title
              >
              <Dialog.Description class="text-xs text-muted-foreground">
                {sourceName} • {new Date(
                  article.published_at || article.fetched_at,
                ).toLocaleString('vi-VN')}
              </Dialog.Description>
            </Dialog.Header>
            {@render summaryContent()}
          </Dialog.Content>
        </Dialog.Root>
      {:else}
        <Drawer.Root bind:open>
          <Drawer.Trigger
            class="flex items-center gap-1 hover:text-foreground transition-colors text-primary font-medium"
            onclick={openSummary}
          >
            <Sparkles size={14} />
            Tóm tắt AI
          </Drawer.Trigger>
          <Drawer.Content>
            <Drawer.Header class="text-start">
              <Drawer.Title class="text-base leading-snug"
                >{article.title}</Drawer.Title
              >
              <Drawer.Description class="text-xs text-muted-foreground">
                {sourceName} • {new Date(
                  article.published_at || article.fetched_at,
                ).toLocaleString('vi-VN')}
              </Drawer.Description>
            </Drawer.Header>
            <div class="px-4 pb-2">
              {@render summaryContent()}
            </div>
            <Drawer.Footer class="pt-2">
              <Drawer.Close class={buttonVariants({ variant: 'outline' })}
                >Đóng</Drawer.Close
              >
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Root>
      {/if}
    {:else}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        Chi tiết
        <ExternalLink size={14} />
      </a>
    {/if}
  </CardFooter>
</Card>
