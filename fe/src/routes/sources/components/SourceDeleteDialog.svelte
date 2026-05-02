<script lang="ts">
  import { Dialog } from 'bits-ui'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { Loader2, Trash2 } from 'lucide-svelte'
  import type { Source } from '$lib/types'
  import { slideScaleFade, fadeOnly } from '$lib/transitions/slideScaleFade'

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
  <Dialog.Portal>
    <Dialog.Overlay forceMount>
      {#snippet child({ props, open })}
        {#if open}
          <div {...props} transition:fadeOnly={{ duration: 150 }} class="fixed inset-0 z-50 bg-black/80"></div>
        {/if}
      {/snippet}
    </Dialog.Overlay>

    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0 pointer-events-none"
      style="padding-top: calc(env(safe-area-inset-top, 0px) + 1rem); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 1rem);"
    >
      <Dialog.Content forceMount>
        {#snippet child({ props, open })}
          {#if open}
            <div 
              {...props} 
              in:slideScaleFade={{ duration: 250, startScale: 0.95 }}
              out:fadeOnly={{ duration: 150 }}
              class="grid w-full gap-4 border border-border/60 bg-bg-btn p-6 shadow-lg rounded-3xl sm:max-w-[420px] outline-none pointer-events-auto"
            >
              <div class="flex flex-col space-y-1.5 text-center sm:text-left">
        <Dialog.Title class="text-lg font-semibold tracking-tight">Delete source?</Dialog.Title>
        <Dialog.Description class="text-sm leading-6 text-text-secondary">
          {#if deletingSource}
            Delete <strong class="text-text-main">{deletingSource.name}</strong> and all
            related articles. This action cannot be undone.
          {/if}
        </Dialog.Description>
      </div>

    <div class="mt-5 flex justify-end gap-2">
      <CusButton
        class="h-12 sm:h-8 px-4 sm:px-3.5 text-sm sm:text-xs"
        onclick={onCancel}
      >
        Cancel
      </CusButton>
      <CusButton
        class="h-12 sm:h-8 px-4 sm:px-3.5 text-sm sm:text-xs"
        disabled={isDeleting}
        onclick={onDelete}
      >
        {#if isDeleting}
          <Loader2 size={14} class="animate-spin mr-1.5" />
        {:else}
          <Trash2 size={14} class="mr-1.5" />
        {/if}
        {isDeleting ? 'Deleting...' : 'Confirm delete'}
      </CusButton>
    </div>
            </div>
          {/if}
        {/snippet}
      </Dialog.Content>
    </div>
  </Dialog.Portal>
</Dialog.Root>
