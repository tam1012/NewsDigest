<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import ArticleCard from '$lib/components/app/ArticleCard.svelte';
  import { Bot } from 'lucide-svelte';

  let { data } = $props();
</script>

<svelte:head>
  <title>NewsDigest - Báo Cáo AI</title>
</svelte:head>

<div class="mb-8">
  <h1 class="text-3xl font-bold tracking-tight">Báo Cáo Nhanh từ AI</h1>
  <p class="text-muted-foreground mt-1">Tổng quan tự động mỗi giờ về xu hướng nổi bật.</p>
</div>

{#if data.error}
  <div class="py-12 text-center text-muted-foreground border-dashed border rounded-xl">{data.error}</div>
{:else if data.digest}
  <Card class="mb-8 border-primary/20 bg-linear-to-br from-primary/5 to-transparent">
    <CardHeader class="pb-3 border-b border-primary/10">
      <CardTitle class="flex items-center gap-2 text-primary">
        <Bot size={24} /> 
        Nhận định AI - {new Date(data.digest.created_at).toLocaleString('vi-VN')}
      </CardTitle>
    </CardHeader>
    <CardContent class="pt-6">
      <p class="text-lg leading-relaxed font-medium">"{data.digest.summary_text}"</p>
    </CardContent>
  </Card>

  <h2 class="text-xl font-semibold mb-4">Top 10 bài hot nhất:</h2>
  
  <ScrollArea class="h-[600px] w-full pr-4 pb-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      {#each data.topArticles as article}
        <ArticleCard {article} />
      {/each}
    </div>
  </ScrollArea>
{/if}
