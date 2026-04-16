<script lang="ts">
  import * as Dialog from '$lib/components/ui/dialog/index.js'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { Loader2, Pencil } from 'lucide-svelte'

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
  <Dialog.Content class="sm:max-w-[480px]">
    <Dialog.Header>
      <Dialog.Title class="text-lg font-semibold">Sửa nguồn tin</Dialog.Title>
      <Dialog.Description class="text-sm text-text-secondary">
        Cập nhật thông tin nguồn tin.
      </Dialog.Description>
    </Dialog.Header>

    <div class="mt-4 flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <Label for="edit-name">Tên nguồn</Label>
        <Input
          id="edit-name"
          bind:value={editName}
          placeholder="Tên nguồn tin"
          class="h-10 rounded-xl border-border/60 bg-transparent px-3.5 text-sm"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <Label for="edit-url">URL</Label>
        <Input
          id="edit-url"
          bind:value={editUrl}
          placeholder="URL nguồn tin"
          class="h-10 rounded-xl border-border/60 bg-transparent px-3.5 text-sm"
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
  </Dialog.Content>
</Dialog.Root>
