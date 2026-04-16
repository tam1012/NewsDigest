<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { Loader2, Trash2 } from 'lucide-svelte'
  import type { Source } from '$lib/types'

  let {
    open = $bindable(false),
    deletingSource,
    isDeleting,
    onDelete,
    onCancel
  }: {
    open: boolean
    deletingSource: Source | null
    isDeleting: boolean
    onDelete: () => void
    onCancel: () => void
  } = $props()
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-[420px]">
    <Dialog.Header>
      <Dialog.Title class="text-lg font-semibold">Xóa nguồn tin?</Dialog.Title>
      <Dialog.Description class="text-sm leading-6 text-text-secondary">
        {#if deletingSource}
          Xóa <strong class="text-text-main">{deletingSource.name}</strong> và toàn
          bộ bài viết liên quan. Không thể hoàn tác.
        {/if}
      </Dialog.Description>
    </Dialog.Header>

    <div class="mt-5 flex justify-end gap-2">
      <CusButton
        class="h-9 px-4 text-sm"
        onclick={onCancel}
      >
        Hủy
      </CusButton>
      <CusButton
        class="h-9 px-4 text-sm"
        disabled={isDeleting}
        onclick={onDelete}
      >
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
