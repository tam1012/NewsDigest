<script lang="ts">
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { Loader2, Plus } from 'lucide-svelte'

  let {
    newUrl = $bindable(''),
    newName = $bindable(''),
    isAdding,
    onAdd,
  }: {
    newUrl: string
    newName: string
    isAdding: boolean
    onAdd: () => void
  } = $props()
</script>

<section class="mb-8">
  <p
    class="text-[0.675rem] font-semibold uppercase tracking-widest text-text-secondary mb-3"
  >
    Thêm nguồn mới
  </p>
  <div class="flex flex-col sm:flex-row gap-2">
    <input
      bind:value={newUrl}
      type="url"
      placeholder="URL nguồn (RSS, Reddit, YouTube, blog...)"
      class="h-10 w-full sm:flex-1 rounded-4xl border border-border bg-bg-2 px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-text-main/10 placeholder:text-text-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
    />
    <input
      bind:value={newName}
      placeholder="Tên (tuỳ chọn)"
      class="h-10 w-full sm:w-36 rounded-4xl border border-border bg-bg-2 px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-text-main/10 placeholder:text-text-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
    />
    <div class="flex gap-2 w-full sm:w-auto">
      <CusButton
        class="h-12 sm:h-10 px-4 sm:px-3.5 w-full sm:w-auto text-sm"
        disabled={isAdding || !newUrl.trim()}
        onclick={onAdd}
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
</section>
