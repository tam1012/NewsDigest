<script lang="ts">
  import { onMount } from 'svelte';
  import { articles, isLoading, filters } from '$lib/stores/articles';
  import { api } from '$lib/api';
  import { sources } from '$lib/stores/sources';
  import ArticleCard from '$lib/components/app/ArticleCard.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge';
  import { LoaderCircle } from 'lucide-svelte';
  import type { Article } from '$lib/types';

  const TAGS = ['AI', 'Security', 'Tech', 'Business', 'Vietnam', 'World', 'Dev', 'Science', 'Crypto', 'Policy'];

  let allArticles = $state<Article[]>([]);
  let initialLoading = $state(true);

  // Filtered + sorted articles derived from local data — no API call on filter change
  let filteredArticles = $derived.by(() => {
    let result = allArticles;

    // Filter by tag
    if ($filters.tag) {
      result = result.filter(a => {
        try {
          const tags: string[] = a.tags ? JSON.parse(a.tags) : [];
          return tags.some(t => t.toLowerCase() === $filters.tag.toLowerCase());
        } catch { return false; }
      });
    }

    // Filter by source
    if ($filters.sourceId) {
      result = result.filter(a => a.source_id === $filters.sourceId);
    }

    // Filter by min hot score
    if ($filters.minHot > 0) {
      result = result.filter(a => (a.hot_score ?? 0) >= $filters.minHot);
    }

    // Sort
    if ($filters.sort === 'hot') {
      result = [...result].sort((a, b) => (b.hot_score ?? 0) - (a.hot_score ?? 0));
    } else {
      result = [...result].sort((a, b) => {
        const da = a.published_at || a.fetched_at;
        const db = b.published_at || b.fetched_at;
        return new Date(db).getTime() - new Date(da).getTime();
      });
    }

    return result;
  });
  let fetchError = $state(false);

  async function fetchAllArticles() {
    initialLoading = true;
    fetchError = false;
    try {
      const res = await fetch(api('/api/articles?limit=200&sort=date'));
      const data = await res.json();
      if (data.articles) {
        allArticles = data.articles;
        $articles = data.articles;
      }
    } catch (e) {
      console.error('Failed to fetch articles', e);
      fetchError = true;
    } finally {
      initialLoading = false;
    }
  }

  onMount(fetchAllArticles);

  function setTag(tag: string) {
    $filters.tag = $filters.tag === tag ? '' : tag;
  }

  function toggleSort() {
    $filters.sort = $filters.sort === 'hot' ? 'date' : 'hot';
  }

  function setMinHot(val: number) {
    $filters.minHot = $filters.minHot === val ? 0 : val;
  }
</script>

<svelte:head>
  <title>NewsDigest - Home</title>
</svelte:head>

<div class="mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
  <div>
    <h1 class="text-3xl font-bold tracking-tight">Tin tức mới nhất</h1>
    <p class="text-muted-foreground mt-1">Được tổng hợp và phân tích bởi AI.</p>
  </div>
  <div class="flex gap-2 items-center">
     <Button variant={$filters.sort === 'hot' ? 'default' : 'outline'} size="sm" onclick={toggleSort}>
       {$filters.sort === 'hot' ? '🔥 Hot nhất' : '🕐 Mới nhất'}
     </Button>
     <Button variant={$filters.minHot >= 7 ? 'default' : 'outline'} size="sm" onclick={() => setMinHot(7)}>
       Hot ≥ 7
     </Button>
  </div>
</div>

<!-- Tag filter bar -->
<div class="flex gap-2 flex-wrap mb-6">
  {#each TAGS as tag}
    <button onclick={() => setTag(tag)}>
      <Badge variant={$filters.tag === tag ? 'default' : 'outline'} class="cursor-pointer hover:bg-primary/10 transition-colors">
        {tag}
      </Badge>
    </button>
  {/each}
  {#if $filters.tag || $filters.minHot > 0}
    <button onclick={() => { $filters.tag = ''; $filters.minHot = 0; }}>
      <Badge variant="secondary" class="cursor-pointer">✕ Bỏ lọc</Badge>
    </button>
  {/if}
</div>

{#if initialLoading}
  <div class="flex items-center justify-center py-24">
    <LoaderCircle size={36} class="animate-spin text-primary" />
  </div>
{:else if fetchError}
  <div class="py-20 text-center border rounded-lg border-dashed text-muted-foreground">
    ⚠️ Không thể kết nối tới server. Vui lòng kiểm tra lại kết nối hoặc thử lại sau.
    <br />
    <button class="mt-4 text-primary underline text-sm" onclick={fetchAllArticles}>Thử lại</button>
  </div>
{:else if filteredArticles.length === 0}
  <div class="py-20 text-center border rounded-lg border-dashed text-muted-foreground">
    {$filters.tag || $filters.minHot > 0 ? 'Không tìm thấy bài viết phù hợp. Thử bỏ bộ lọc.' : 'Chưa có bài viết nào được tải. Đang đợi Cron Worker...'}
  </div>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {#each filteredArticles as article (article.id)}
      <ArticleCard {article} />
    {/each}
  </div>
{/if}
