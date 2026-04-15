<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { clearAdminKeyStorage, adminHeaders, getStoredAdminKey, saveAdminKey } from '$lib/admin';
  import CusButton from '$lib/components/ui/CusButton.svelte';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Input } from '$lib/components/ui/input';
  import { Switch } from '$lib/components/ui/switch';
  import { sources } from '$lib/stores/sources';
  import type { Source } from '$lib/types';
  import { toast } from 'svelte-sonner';
  import {
    ArrowLeft,
    ExternalLink,
    Globe,
    Link2,
    Loader2,
    Lock,
    LockOpen,
    MessageCircle,
    MessageSquare,
    Plus,
    RefreshCw,
    Rss,
    Sparkles,
    Trash2,
    TrendingUp,
    Youtube,
  } from 'lucide-svelte';

  type SourcePreview = {
    resolved_url: string;
    detected_type: Source['type'];
    detection_method: string;
    requested_url: string;
  };

  const relativeTime = new Intl.RelativeTimeFormat('vi', { numeric: 'auto' });

  let loading = $state(true);
  let pageError = $state('');
  let authError = $state('');
  let showKeyInput = $state(false);
  let adminKey = $state('');

  let newUrl = $state('');
  let newName = $state('');

  let isAdding = $state(false);
  let isResolving = $state(false);
  let isFetchingAll = $state(false);
  let fetchingSourceId = $state<string | null>(null);
  let togglingIds = $state<string[]>([]);
  let previewError = $state('');
  let preview = $state<SourcePreview | null>(null);
  let lastPreviewInput = $state('');

  let deleteDialogOpen = $state(false);
  let deletingSource = $state<Source | null>(null);
  let isDeleting = $state(false);

  let isAuthed = $derived(adminKey.trim().length > 0);

  // Sort sources A-Z by name
  let sortedSources = $derived(
    [...$sources].sort((a, b) => a.name.localeCompare(b.name))
  );

  let enabledCount = $derived($sources.filter(s => s.enabled).length);

  onMount(() => {
    adminKey = getStoredAdminKey();
    fetchSources();
  });

  $effect(() => {
    const normalizedUrl = newUrl.trim();
    if (normalizedUrl !== lastPreviewInput) {
      if (!normalizedUrl) {
        preview = null;
      } else if (preview && preview.requested_url !== normalizedUrl) {
        preview = null;
      }
      previewError = '';
      lastPreviewInput = normalizedUrl;
    }
  });

  function normalizeSource(source: Record<string, unknown>): Source {
    return source as unknown as Source;
  }

  async function fetchSources() {
    loading = true;
    pageError = '';
    try {
      const res = await fetch(api('/api/sources'));
      if (!res.ok) throw new Error('Không thể tải danh sách nguồn tin.');
      const data = await res.json();
      $sources = (data.sources ?? []).map(normalizeSource);
    } catch (error) {
      pageError = error instanceof Error ? error.message : 'Không thể tải danh sách nguồn tin.';
      toast.error(pageError);
    } finally {
      loading = false;
    }
  }

  function openDeleteDialog(source: Source) {
    deletingSource = source;
    deleteDialogOpen = true;
  }

  function handleUnauthorized() {
    authError = 'Admin key không đúng hoặc đã hết hạn.';
    toast.error(authError);
  }

  function saveAdminKeyFromForm(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const key = String(formData.get('admin_key') ?? '').trim();
    if (!key) return;

    adminKey = saveAdminKey(key);
    authError = '';
    showKeyInput = false;
    toast.success('Đã lưu admin key.');
  }

  function clearAdminKey() {
    adminKey = '';
    clearAdminKeyStorage();
    authError = '';
    showKeyInput = false;
    toast.message('Đã đăng xuất.');
  }

  async function resolvePreviewUrl(url: string) {
    isResolving = true;
    previewError = '';
    authError = '';

    try {
      const res = await fetch(api('/api/sources/resolve'), {
        method: 'POST',
        headers: adminHeaders(adminKey),
        body: JSON.stringify({ url }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return null;
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        const message = data.error || 'Không thể phân tích URL.';
        previewError = message;
        toast.error(message);
        return null;
      }

      preview = { ...data, requested_url: url };
      return preview;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể phân tích URL.';
      previewError = message;
      toast.error(message);
      return null;
    } finally {
      isResolving = false;
    }
  }

  async function handlePreview() {
    const normalizedUrl = newUrl.trim();
    if (!normalizedUrl) return;
    await resolvePreviewUrl(normalizedUrl);
  }

  async function addSource() {
    const normalizedUrl = newUrl.trim();
    if (!normalizedUrl) return;

    isAdding = true;
    authError = '';

    try {
      let currentPreview = preview;
      if (!currentPreview || currentPreview.requested_url !== normalizedUrl) {
        currentPreview = await resolvePreviewUrl(normalizedUrl);
        if (!currentPreview) {
          isAdding = false;
          return;
        }
      }

      const res = await fetch(api('/api/sources'), {
        method: 'POST',
        headers: adminHeaders(adminKey),
        body: JSON.stringify({
          url: normalizedUrl,
          name: newName.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Không thể thêm nguồn tin.');
      }

      toast.success(`Đã thêm "${result.source.name}".`);
      newUrl = '';
      newName = '';
      preview = null;
      previewError = '';

      await fetchSources();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể thêm nguồn tin.';
      toast.error(message);
    } finally {
      isAdding = false;
    }
  }

  function addTogglingId(id: string) {
    if (!togglingIds.includes(id)) {
      togglingIds = [...togglingIds, id];
    }
  }

  function removeTogglingId(id: string) {
    togglingIds = togglingIds.filter((value) => value !== id);
  }

  async function toggleSource(id: string, currentEnabled: number) {
    const nextEnabled = currentEnabled ? 0 : 1;
    const snapshot = $sources;

    authError = '';
    addTogglingId(id);
    $sources = $sources.map((source) =>
      source.id === id ? { ...source, enabled: nextEnabled } : source,
    );

    try {
      const res = await fetch(api(`/api/sources/${id}`), {
        method: 'PATCH',
        headers: adminHeaders(adminKey),
        body: JSON.stringify({ enabled: nextEnabled === 1 }),
      });

      if (res.status === 401) {
        $sources = snapshot;
        handleUnauthorized();
        return;
      }

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Không thể cập nhật.');
      }

      toast.success(nextEnabled ? 'Đã bật nguồn tin.' : 'Đã tắt nguồn tin.');
    } catch (error) {
      $sources = snapshot;
      const message = error instanceof Error ? error.message : 'Không thể cập nhật.';
      toast.error(message);
    } finally {
      removeTogglingId(id);
    }
  }

  async function deleteSource() {
    if (!deletingSource) return;

    isDeleting = true;
    authError = '';

    try {
      const res = await fetch(api(`/api/sources/${deletingSource.id}`), {
        method: 'DELETE',
        headers: adminHeaders(adminKey),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Không thể xóa.');
      }

      toast.success(`Đã xóa "${deletingSource.name}".`);
      $sources = $sources.filter((source) => source.id !== deletingSource?.id);
      deleteDialogOpen = false;
      deletingSource = null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể xóa.';
      toast.error(message);
    } finally {
      isDeleting = false;
    }
  }

  async function manualFetch(source: Source) {
    fetchingSourceId = source.id;
    authError = '';
    const toastId = toast.loading(`Đang fetch "${source.name}"...`);

    try {
      const res = await fetch(api(`/api/sources/${source.id}/fetch`), {
        method: 'POST',
        headers: adminHeaders(adminKey),
      });

      if (res.status === 401) {
        toast.dismiss(toastId);
        handleUnauthorized();
        return;
      }

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Fetch thất bại.');
      }

      toast.success(`Fetch ${result.fetched} bài, +${result.inserted} mới.`, { id: toastId });
      await fetchSources();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fetch thất bại.';
      toast.error(message, { id: toastId });
    } finally {
      fetchingSourceId = null;
    }
  }

  async function fetchAllSources() {
    isFetchingAll = true;
    authError = '';
    const toastId = toast.loading('Đang fetch tất cả nguồn...');

    try {
      const res = await fetch(api('/api/sources/fetch-all'), {
        method: 'POST',
        headers: adminHeaders(adminKey),
      });

      if (res.status === 401) {
        toast.dismiss(toastId);
        handleUnauthorized();
        return;
      }

      const result = await res.json();
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Fetch thất bại.');
      }

      const failed = (result.results ?? []).filter((item: { error?: string }) => item.error).length;
      toast.success(
        `Fetch ${result.total_fetched ?? 0} bài, +${result.total_inserted ?? 0} mới${failed ? `, ${failed} lỗi` : ''}.`,
        { id: toastId },
      );
      await fetchSources();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fetch thất bại.';
      toast.error(message, { id: toastId });
    } finally {
      isFetchingAll = false;
    }
  }

  function formatRelativeTime(value: string | null) {
    if (!value) return 'Chưa fetch';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Không rõ';

    const diffMs = date.getTime() - Date.now();
    const absMs = Math.abs(diffMs);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (absMs < hour) return relativeTime.format(Math.round(diffMs / minute), 'minute');
    if (absMs < day) return relativeTime.format(Math.round(diffMs / hour), 'hour');
    return relativeTime.format(Math.round(diffMs / day), 'day');
  }

  function getTypeIcon(type: Source['type']) {
    const map: Record<string, { icon: typeof Rss; color: string; label: string }> = {
      rss: { icon: Rss, color: 'text-amber-600 dark:text-amber-400', label: 'RSS' },
      reddit: { icon: MessageSquare, color: 'text-orange-600 dark:text-orange-400', label: 'Reddit' },
      youtube: { icon: Youtube, color: 'text-red-600 dark:text-red-400', label: 'YouTube' },
      voz: { icon: MessageCircle, color: 'text-sky-600 dark:text-sky-400', label: 'VOZ' },
      'github-trending': { icon: TrendingUp, color: 'text-zinc-700 dark:text-zinc-300', label: 'GitHub' },
      html: { icon: Globe, color: 'text-emerald-600 dark:text-emerald-400', label: 'HTML' },
    };
    return map[type] ?? map.html;
  }
</script>

<svelte:head>
  <title>NewsDigest - Nguồn tin</title>
</svelte:head>

<div class="min-h-screen bg-bg-1">
<div class="mx-auto max-w-3xl px-4 py-6 sm:px-6">
  <!-- Header -->
  <header class="mb-8">
    <div class="flex items-center justify-between gap-4 mb-6">
      <CusButton href="/" class="size-9">
        <ArrowLeft size={18} />
      </CusButton>

      <div class="flex items-center gap-2">
        {#if isAuthed}
          <span class="text-[0.675rem] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mr-1">
            <LockOpen size={11} /> Admin
          </span>
          <CusButton class="h-8 px-3.5 text-xs" onclick={clearAdminKey}>Đăng xuất</CusButton>
        {:else if showKeyInput}
          <form onsubmit={saveAdminKeyFromForm} class="flex items-center gap-2">
            <Input
              type="password"
              name="admin_key"
              placeholder="Admin key..."
              class="h-8 w-40 text-xs rounded-full border-border bg-transparent px-3"
              autofocus
            />
            <CusButton class="h-8 px-3 text-xs" type="submit">Lưu</CusButton>
            <CusButton class="h-8 px-3 text-xs" type="button" onclick={() => (showKeyInput = false)}>Huỷ</CusButton>
          </form>
        {:else}
          <CusButton class="h-8 px-3.5 text-xs" onclick={() => (showKeyInput = true)}>
            <Lock size={12} class="mr-1.5" /> Đăng nhập
          </CusButton>
        {/if}
      </div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <h1 class="font-serif text-3xl font-bold text-text-main leading-tight">Nguồn tin</h1>
        <p class="text-sm text-text-secondary mt-1">
          {$sources.length} nguồn · {enabledCount} đang bật
        </p>
      </div>

      {#if isAuthed}
        <CusButton
          class="h-9 px-4 text-sm shrink-0"
          disabled={isFetchingAll}
          onclick={fetchAllSources}
        >
          {#if isFetchingAll}
            <Loader2 size={14} class="animate-spin mr-1.5" />
            <span>Đang fetch...</span>
          {:else}
            <RefreshCw size={14} class="mr-1.5" />
            <span>Fetch tất cả</span>
          {/if}
        </CusButton>
      {/if}
    </div>
  </header>

  {#if authError}
    <div class="mb-5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
      🔒 {authError}
    </div>
  {/if}

  <!-- Add Source (admin only) -->
  {#if isAuthed}
    <section class="mb-8 rounded-2xl border border-border/60 bg-bg-btn p-4 sm:p-5">
      <p class="text-[0.675rem] font-semibold uppercase tracking-widest text-text-secondary mb-3">
        Thêm nguồn mới
      </p>
      <div class="flex flex-col sm:flex-row gap-2">
        <Input
          bind:value={newUrl}
          placeholder="URL nguồn (RSS, Reddit, YouTube, blog...)"
          class="h-10 flex-1 rounded-xl border-border/60 bg-transparent px-3.5 text-sm"
        />
        <Input
          bind:value={newName}
          placeholder="Tên (tuỳ chọn)"
          class="h-10 w-full sm:w-36 rounded-xl border-border/60 bg-transparent px-3.5 text-sm"
        />
        <div class="flex gap-2">
          <CusButton
            class="h-10 px-3.5 text-sm"
            disabled={isResolving || !newUrl.trim()}
            onclick={handlePreview}
          >
            {#if isResolving}
              <Loader2 size={14} class="animate-spin" />
            {:else}
              <Link2 size={14} />
            {/if}
            <span class="ml-1.5">Preview</span>
          </CusButton>
          <CusButton
            class="h-10 px-3.5 text-sm"
            disabled={isAdding || !newUrl.trim()}
            onclick={addSource}
          >
            {#if isAdding}
              <Loader2 size={14} class="animate-spin" />
            {:else}
              <Plus size={14} />
            {/if}
            <span class="ml-1.5">Thêm</span>
          </CusButton>
        </div>
      </div>

      <!-- Preview result -->
      {#if preview}
        {@const typeInfo = getTypeIcon(preview.detected_type)}
        <div class="mt-3 rounded-xl bg-bg-1/80 dark:bg-bg-1/40 border border-border/40 px-4 py-3">
          <div class="flex items-center gap-2 text-sm mb-1.5">
            <svelte:component this={typeInfo.icon} size={14} class={typeInfo.color} />
            <span class="font-medium text-text-main">{typeInfo.label}</span>
            <span class="text-text-secondary text-xs">· {preview.detection_method}</span>
          </div>
          <p class="text-xs text-text-secondary break-all leading-relaxed">
            {preview.resolved_url}
          </p>
        </div>
      {:else if previewError}
        <div class="mt-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
          {previewError}
        </div>
      {/if}
    </section>
  {/if}

  <!-- Sources List -->
  {#if loading}
    <div class="flex flex-col gap-3 animate-pulse">
      {#each Array(5) as _, i (i)}
        <div class="rounded-xl border border-border/40 p-4">
          <div class="flex items-center gap-3">
            <div class="size-8 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
            <div class="flex-1">
              <div class="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800 mb-2"></div>
              <div class="h-3 w-64 rounded bg-zinc-200 dark:bg-zinc-800"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else if $sources.length === 0}
    <div class="py-20 text-center border border-dashed border-border/60 rounded-2xl text-text-secondary text-sm">
      Chưa có nguồn tin nào.{isAuthed ? ' Thêm nguồn đầu tiên ở trên.' : ' Đăng nhập admin để thêm.'}
    </div>
  {:else}
    <div class="flex flex-col gap-2">
      {#each sortedSources as source (source.id)}
        {@const typeInfo = getTypeIcon(source.type)}
        {@const isFetching = fetchingSourceId === source.id}
        {@const isToggling = togglingIds.includes(source.id)}


        <article
          class="group rounded-xl border border-border/50 bg-bg-btn transition-[border-color] duration-200 hover:border-border"
        >
          <div class="flex items-start gap-3.5 p-4">
            <!-- Type icon -->
            <div
              class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-bg-1 dark:bg-bg-1/60 border border-border/40"
            >
              <svelte:component this={typeInfo.icon} size={16} class={typeInfo.color} />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <h3 class="font-serif text-base font-semibold text-text-main truncate">
                  {source.name}
                </h3>
                {#if !source.enabled}
                  <span class="shrink-0 text-[0.6rem] font-medium uppercase tracking-wider text-text-secondary bg-bg-1 dark:bg-bg-1/60 px-2 py-0.5 rounded-full">
                    Tắt
                  </span>
                {/if}
              </div>

              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-text-secondary hover:text-text-main transition-colors truncate block mb-1.5"
              >
                {source.url}
              </a>

              <!-- Stats row -->
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-text-secondary">
                <span>{typeInfo.label}</span>
                <span class="text-border">·</span>
                <span>{formatRelativeTime(source.last_fetched_at)}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1.5 shrink-0">
              {#if isAuthed}
                <button
                  class="flex items-center justify-center size-8 rounded-full text-text-secondary hover:text-text-main hover:bg-bg-1 dark:hover:bg-bg-1/60 transition-colors cursor-pointer disabled:opacity-40"
                  title="Fetch thủ công"
                  disabled={isFetching}
                  onclick={() => manualFetch(source)}
                >
                  {#if isFetching}
                    <Loader2 size={14} class="animate-spin" />
                  {:else}
                    <RefreshCw size={14} />
                  {/if}
                </button>
                <button
                  class="flex items-center justify-center size-8 rounded-full text-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  title="Xoá nguồn"
                  onclick={() => openDeleteDialog(source)}
                >
                  <Trash2 size={14} />
                </button>
                <Switch
                  checked={source.enabled === 1}
                  disabled={isToggling}
                  onCheckedChange={() => toggleSource(source.id, source.enabled)}
                />
              {:else}
                <span
                  class="flex items-center gap-1.5 text-[0.65rem] font-medium px-2.5 py-1 rounded-full
                    {source.enabled
                      ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30'
                      : 'text-text-secondary bg-bg-1 dark:bg-bg-1/60'}"
                >
                  <span class="size-1.5 rounded-full {source.enabled ? 'bg-emerald-500' : 'bg-zinc-400'}"></span>
                  {source.enabled ? 'Bật' : 'Tắt'}
                </span>
              {/if}
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>
</div>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
  <Dialog.Content class="sm:max-w-[420px]">
    <Dialog.Header>
      <Dialog.Title class="text-lg font-semibold">
        Xóa nguồn tin?
      </Dialog.Title>
      <Dialog.Description class="text-sm leading-6 text-text-secondary">
        {#if deletingSource}
          Xóa <strong class="text-text-main">{deletingSource.name}</strong> và toàn bộ bài viết liên quan.
          Không thể hoàn tác.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div class="mt-5 flex justify-end gap-2">
      <CusButton
        class="h-9 px-4 text-sm"
        onclick={() => {
          deleteDialogOpen = false;
          deletingSource = null;
        }}
      >
        Hủy
      </CusButton>
      <CusButton class="h-9 px-4 text-sm" disabled={isDeleting} onclick={deleteSource}>
        {#if isDeleting}
          <Loader2 size={14} class="animate-spin mr-1.5" />
        {:else}
          <Trash2 size={14} class="mr-1.5" />
        {/if}
        {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
      </CusButton>
    </div>
  </Dialog.Content>
</Dialog.Root>
