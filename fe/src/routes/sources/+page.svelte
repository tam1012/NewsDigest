<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import {
    clearAdminKeyStorage,
    adminHeaders,
    getStoredAdminKey,
    saveAdminKey,
  } from '$lib/admin'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { sources } from '$lib/stores/sources'
  import type { Source } from '$lib/types'
  import { toast } from 'svelte-sonner'
  import { ArrowLeft, Lock, LockOpen, LogOut } from 'lucide-svelte'

  import SourceItem from './components/SourceItem.svelte'
  import SourceDeleteDialog from './components/SourceDeleteDialog.svelte'
  import SourceEditDialog from './components/SourceEditDialog.svelte'
  import AddSourceForm from './components/AddSourceForm.svelte'
  import LoginDialog from './components/LoginDialog.svelte'
  import { formatRelativeTime, getTypeIcon } from './components/utils'
  import PullToRefresh from '$lib/components/app/PullToRefresh.svelte'

  let loading = $state(true)
  let pageError = $state('')
  let authError = $state('')
  let loginDialogOpen = $state(false)
  let adminKey = $state('')

  let newUrl = $state('')
  let newName = $state('')

  let isAdding = $state(false)
  let fetchingSourceId = $state<string | null>(null)
  let togglingIds = $state<string[]>([])

  let deleteDialogOpen = $state(false)
  let deletingSource = $state<Source | null>(null)
  let isDeleting = $state(false)

  let editDialogOpen = $state(false)
  let editingSource = $state<Source | null>(null)
  let editName = $state('')
  let editUrl = $state('')
  let isEditing = $state(false)

  let isAuthed = $derived(adminKey.trim().length > 0)

  // Sort sources A-Z by name
  let sortedSources = $derived(
    [...$sources].sort((a, b) => a.name.localeCompare(b.name)),
  )

  let enabledCount = $derived($sources.filter((s) => s.enabled).length)

  onMount(() => {
    adminKey = getStoredAdminKey()
    fetchSources()
  })

  function normalizeSource(source: Record<string, unknown>): Source {
    return source as unknown as Source
  }

  async function fetchSources(showLoading = true) {
    if (showLoading) loading = true
    pageError = ''
    try {
      const res = await fetch(api('/api/sources'))
      if (!res.ok) throw new Error('Unable to load sources.')
      const data = await res.json()
      $sources = (data.sources ?? []).map(normalizeSource)
    } catch (error) {
      pageError =
        error instanceof Error
          ? error.message
          : 'Unable to load sources.'
      toast.error(pageError)
    } finally {
      loading = false
    }
  }

  function openDeleteDialog(source: Source) {
    deletingSource = source
    deleteDialogOpen = true
  }

  function openEditDialog(source: Source) {
    editingSource = source
    editName = source.name
    editUrl = source.url
    editDialogOpen = true
  }

  async function editSource() {
    if (!editingSource) return

    isEditing = true
    authError = ''

    try {
      const body: Record<string, unknown> = {}
      if (editName.trim() !== editingSource.name) body.name = editName.trim()
      if (editUrl.trim() !== editingSource.url) body.url = editUrl.trim()

      if (Object.keys(body).length === 0) {
        toast.message('No changes detected.')
        editDialogOpen = false
        editingSource = null
        return
      }

      const res = await fetch(api(`/api/sources/${editingSource.id}`), {
        method: 'PATCH',
        headers: adminHeaders(adminKey),
        body: JSON.stringify(body),
      })

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      const result = await res.json()
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Unable to update source.')
      }

      toast.success(`Updated "${editName.trim()}".`)
      $sources = $sources.map((s) =>
        s.id === editingSource?.id
          ? {
              ...s,
              ...(body.name !== undefined ? { name: body.name as string } : {}),
              ...(body.url !== undefined ? { url: body.url as string } : {}),
            }
          : s,
      )
      editDialogOpen = false
      editingSource = null
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update source.'
      toast.error(message)
    } finally {
      isEditing = false
    }
  }

  function handleUnauthorized() {
    authError = 'Admin key is invalid or expired.'
    toast.error(authError)
  }

  let isVerifying = $state(false)

  async function handleLoginSave(key: string) {
    isVerifying = true
    authError = ''

    try {
      const res = await fetch(api('/api/auth/verify'), {
        method: 'POST',
        headers: { 'X-Admin-Key': key.trim() },
      })

      if (res.status === 401) {
        authError = 'Invalid admin key.'
        return
      }

      if (res.status === 429) {
        authError = 'Too many attempts. Please wait a few minutes.'
        return
      }

      if (!res.ok) {
        authError = 'Unable to verify. Please try again.'
        return
      }

      adminKey = saveAdminKey(key)
      loginDialogOpen = false
      toast.success('Admin login successful.')
    } catch {
      authError = 'Unable to connect to server.'
    } finally {
      isVerifying = false
    }
  }

  function clearAdminKey() {
    adminKey = ''
    clearAdminKeyStorage()
    authError = ''
    toast.message('Signed out.')
  }

  async function addSource() {
    const normalizedUrl = newUrl.trim()
    if (!normalizedUrl) return

    isAdding = true
    authError = ''

    try {
      const res = await fetch(api('/api/sources'), {
        method: 'POST',
        headers: adminHeaders(adminKey),
        body: JSON.stringify({
          url: normalizedUrl,
          name: newName.trim() || undefined,
        }),
      })

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      const result = await res.json()
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Unable to add source.')
      }

      toast.success(`Added "${result.source.name}".`)
      newUrl = ''
      newName = ''

      await fetchSources(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to add source.'
      toast.error(message)
    } finally {
      isAdding = false
    }
  }

  function addTogglingId(id: string) {
    if (!togglingIds.includes(id)) {
      togglingIds = [...togglingIds, id]
    }
  }

  function removeTogglingId(id: string) {
    togglingIds = togglingIds.filter((value) => value !== id)
  }

  async function toggleSource(id: string, currentEnabled: number) {
    const nextEnabled = currentEnabled ? 0 : 1
    const snapshot = $sources

    authError = ''
    addTogglingId(id)
    $sources = $sources.map((source) =>
      source.id === id ? { ...source, enabled: nextEnabled } : source,
    )

    try {
      const res = await fetch(api(`/api/sources/${id}`), {
        method: 'PATCH',
        headers: adminHeaders(adminKey),
        body: JSON.stringify({ enabled: nextEnabled === 1 }),
      })

      if (res.status === 401) {
        $sources = snapshot
        handleUnauthorized()
        return
      }

      const result = await res.json()
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Unable to update source.')
      }
    } catch (error) {
      $sources = snapshot
      const message =
        error instanceof Error ? error.message : 'Unable to update source.'
      toast.error(message)
    } finally {
      removeTogglingId(id)
    }
  }

  async function deleteSource() {
    if (!deletingSource) return

    isDeleting = true
    authError = ''

    try {
      const res = await fetch(api(`/api/sources/${deletingSource.id}`), {
        method: 'DELETE',
        headers: adminHeaders(adminKey),
      })

      if (res.status === 401) {
        handleUnauthorized()
        return
      }

      const result = await res.json()
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Unable to delete source.')
      }

      toast.success(`Deleted "${deletingSource.name}".`)
      $sources = $sources.filter((source) => source.id !== deletingSource?.id)
      deleteDialogOpen = false
      deletingSource = null
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete source.'
      toast.error(message)
    } finally {
      isDeleting = false
    }
  }

  async function manualFetch(source: Source) {
    fetchingSourceId = source.id
    authError = ''
    const toastId = toast.loading(`Fetching "${source.name}"...`)

    try {
      const res = await fetch(api(`/api/sources/${source.id}/fetch`), {
        method: 'POST',
        headers: adminHeaders(adminKey),
      })

      if (res.status === 401) {
        toast.dismiss(toastId)
        handleUnauthorized()
        return
      }

      const result = await res.json()
      if (!res.ok || !result.ok) {
        throw new Error(result.error || 'Fetch failed.')
      }

      const enqueued = result.enqueued ?? 0
      toast.success(
         `Fetched ${result.fetched} articles, +${result.inserted} new${enqueued > 0 ? `, ${enqueued} queued for summarization` : ''}.`,
        {
          id: toastId,
        },
      )
      await fetchSources(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fetch failed.'
      toast.error(message, { id: toastId })
    } finally {
      fetchingSourceId = null
    }
  }
</script>

<svelte:head>
  <title>NewsDigest - Sources</title>
</svelte:head>

<div class="min-h-screen bg-bg-1">
  <div
    class="mx-auto max-w-3xl px-4 py-6 sm:px-6"
    style="padding-top: calc(env(safe-area-inset-top, 0px) + 1.5rem);"
  >
    <!-- Header -->
    <header class="mb-8">
      <div class="flex items-center justify-between gap-4 mb-6">
        <CusButton href="/" class="size-12 sm:size-8">
          <ArrowLeft size={20} />
        </CusButton>

        <div class="flex items-center gap-2">
          <!-- Add Source (admin only) -->
          {#if isAuthed}
            <span
              class="text-[0.675rem] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mr-1"
            >
              <LockOpen size={11} /> Admin
            </span>
            <CusButton class="size-12 sm:size-8" onclick={clearAdminKey}>
              <LogOut size={16} />
            </CusButton>
          {:else}
            <CusButton
              class="size-12 sm:size-8"
              onclick={() => (loginDialogOpen = true)}
            >
              <Lock size={16} />
            </CusButton>
          {/if}
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1
            class="font-serif text-3xl font-bold text-text-main leading-tight"
          >
             Sources
          </h1>
          <p class="text-sm text-text-secondary mt-1">
            {$sources.length} sources · {enabledCount} enabled
          </p>
        </div>
      </div>
    </header>

    {#if isAuthed}
      <AddSourceForm bind:newUrl bind:newName {isAdding} onAdd={addSource} />
    {/if}

    <PullToRefresh onRefresh={() => fetchSources(false)} disabled={loading}>
      <!-- Sources List -->
      {#if loading}
        <div class="flex flex-col gap-3 animate-pulse">
          {#each Array(5) as _, i (i)}
            <div class="rounded-xl border border-border/40 p-4">
              <div class="flex items-center gap-3">
                <div
                  class="size-8 rounded-full bg-zinc-200 dark:bg-zinc-800"
                ></div>
                <div class="flex-1">
                  <div
                    class="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800 mb-2"
                  ></div>
                  <div
                    class="h-3 w-64 rounded bg-zinc-200 dark:bg-zinc-800"
                  ></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else if $sources.length === 0}
        <div
          class="py-20 text-center border border-dashed border-border/60 rounded-2xl text-text-secondary text-sm"
        >
          No sources yet.{isAuthed
            ? ' Add your first source above.'
            : ' Sign in as admin to add one.'}
        </div>
      {:else}
        <div class="flex flex-col divide-y divide-dashed divide-border">
          {#each sortedSources as source (source.id)}
            {@const typeInfo = getTypeIcon(source.type)}
            {@const isFetching = fetchingSourceId === source.id}
            {@const isToggling = togglingIds.includes(source.id)}
            <SourceItem
              {source}
              {isAuthed}
              {isFetching}
              {isToggling}
              {typeInfo}
              formattedTime={formatRelativeTime(source.last_fetched_at)}
              onManualFetch={() => manualFetch(source)}
              onEdit={() => openEditDialog(source)}
              onDelete={() => openDeleteDialog(source)}
              onToggle={() => toggleSource(source.id, source.enabled)}
            />
          {/each}
        </div>
      {/if}
    </PullToRefresh>
  </div>
</div>

<!-- Delete Confirmation Dialog -->
<SourceDeleteDialog
  bind:open={deleteDialogOpen}
  {deletingSource}
  {isDeleting}
  onDelete={deleteSource}
  onCancel={() => {
    deleteDialogOpen = false
    deletingSource = null
  }}
/>

<!-- Edit Source Dialog -->
<SourceEditDialog
  bind:open={editDialogOpen}
  bind:editName
  bind:editUrl
  {isEditing}
  onSave={editSource}
  onCancel={() => {
    editDialogOpen = false
    editingSource = null
  }}
/>

<!-- Login Dialog -->
<LoginDialog
  bind:open={loginDialogOpen}
  {authError}
  {isVerifying}
  onSave={handleLoginSave}
  onCancel={() => {
    loginDialogOpen = false
    authError = ''
  }}
/>
