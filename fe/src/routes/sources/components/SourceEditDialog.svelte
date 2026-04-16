<script lang="ts">
  import { Dialog } from 'bits-ui'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { Loader2, Pencil } from 'lucide-svelte'
  import { slideScaleFade, fadeOnly } from '$lib/transitions/slideScaleFade'

  let {
    open = $bindable(false),
    editName = $bindable(''),
    editUrl = $bindable(''),
    isEditing,
    onSave,
    onCancel,
  }: {
    open: boolean
    editName: string
    editUrl: string
    isEditing: boolean
    onSave: () => void
    onCancel: () => void
  } = $props()
  $effect(() => {
    if (open) {
      // Ultimate scroll lock for iOS PWA
      const scrollY = window.scrollY
      const originalPosition = document.body.style.position
      const originalTop = document.body.style.top
      const originalWidth = document.body.style.width

      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
      // Optional: Prevent bounce/overscroll on html too
      document.documentElement.style.overscrollBehavior = 'none'

      return () => {
        document.body.style.position = originalPosition
        document.body.style.top = originalTop
        document.body.style.width = originalWidth
        document.documentElement.style.overscrollBehavior = ''
        window.scrollTo(0, scrollY)
      }
    }
  })
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

    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0 pointer-events-none">
      <Dialog.Content forceMount>
        {#snippet child({ props, open })}
          {#if open}
            <div 
              {...props} 
              in:slideScaleFade={{ duration: 250, startScale: 0.95 }}
              out:fadeOnly={{ duration: 150 }}
              class="grid w-full gap-4 border border-border/60 bg-bg-btn p-6 shadow-lg rounded-3xl sm:max-w-[480px] outline-none pointer-events-auto"
            >
              <div class="flex flex-col space-y-1.5 text-center sm:text-left">
        <Dialog.Title class="text-lg font-semibold tracking-tight">Sửa nguồn tin</Dialog.Title>
        <Dialog.Description class="text-sm text-text-secondary">
          Cập nhật thông tin nguồn tin.
        </Dialog.Description>
      </div>

      <div class="mt-4 flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="edit-name" class="text-sm font-medium leading-none">Tên nguồn</label>
          <input
            id="edit-name"
            bind:value={editName}
            placeholder="Tên nguồn tin"
            class="h-10 rounded-xl border border-border/60 bg-transparent px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-text-main/10 placeholder:text-text-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="edit-url" class="text-sm font-medium leading-none">URL</label>
          <input
            id="edit-url"
            bind:value={editUrl}
            placeholder="URL nguồn tin"
            class="h-10 rounded-xl border border-border/60 bg-transparent px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-text-main/10 placeholder:text-text-secondary/60 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <CusButton class="h-9 px-4 text-sm" onclick={onCancel}>Hủy</CusButton>
        <CusButton
          class="h-9 px-4 text-sm"
          disabled={isEditing || !editName.trim() || !editUrl.trim()}
          onclick={onSave}
        >
        {#if isEditing}
          <Loader2 size={14} class="animate-spin mr-1.5" />
        {:else}
          <Pencil size={14} class="mr-1.5" />
        {/if}
        {isEditing ? 'Đang lưu...' : 'Lưu thay đổi'}
      </CusButton>
    </div>
            </div>
          {/if}
        {/snippet}
      </Dialog.Content>
    </div>
  </Dialog.Portal>
</Dialog.Root>
