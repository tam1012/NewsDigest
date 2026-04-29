<script lang="ts">
  import { Dialog } from 'bits-ui'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { Lock } from 'lucide-svelte'
  import { slideScaleFade, fadeOnly } from '$lib/transitions/slideScaleFade'

  let {
    open = $bindable(false),
    authError = '',
    onSave,
    onCancel,
  }: {
    open: boolean
    authError: string
    onSave: (key: string) => void
    onCancel: () => void
  } = $props()

  let keyInput = $state('')

  function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    const key = keyInput.trim()
    if (!key) return
    onSave(key)
    keyInput = ''
  }

  function handleCancel() {
    keyInput = ''
    onCancel()
  }
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

    <div class="fixed inset-0 z-50 flex justify-center items-start pt-8 p-4 pointer-events-none">
      <Dialog.Content forceMount>
        {#snippet child({ props, open })}
          {#if open}
            <div
              {...props}
              in:slideScaleFade={{ duration: 250, startScale: 0.95, slideFrom: 'top', slideDistance: '1.5rem' }}
              out:fadeOnly={{ duration: 150 }}
              class="grid w-full max-w-sm gap-5 border border-border/60 bg-bg-btn p-6 shadow-lg rounded-3xl outline-none pointer-events-auto"
            >
              <div class="flex flex-col space-y-1.5 text-center sm:text-left">
                <Dialog.Title class="text-lg font-semibold tracking-tight flex items-center justify-center sm:justify-start gap-2">
                  <Lock size={16} /> Đăng nhập Admin
                </Dialog.Title>
                <Dialog.Description class="text-sm leading-6 text-text-secondary">
                  Nhập admin key để quản lý nguồn tin.
                </Dialog.Description>
              </div>

              <form onsubmit={handleSubmit} class="flex flex-col gap-3">
                <input
                  type="password"
                  name="admin_key"
                  bind:value={keyInput}
                  placeholder="Admin key..."
                  class="h-9 w-full text-xs rounded-full border border-border bg-transparent px-4 outline-none focus-visible:ring-2 focus-visible:ring-text-main/10 placeholder:text-text-secondary/60"
                  autofocus
                />

                {#if authError}
                  <p class="text-xs text-red-600 dark:text-red-400">{authError}</p>
                {/if}

                <div class="flex justify-end gap-2 mt-1">
                  <CusButton class="h-12 sm:h-8 px-4 sm:px-3.5 text-sm sm:text-xs" type="button" onclick={handleCancel}>
                    Huỷ
                  </CusButton>
                  <CusButton class="h-12 sm:h-8 px-4 sm:px-3.5 text-sm sm:text-xs" type="submit" disabled={!keyInput.trim()}>
                    Lưu
                  </CusButton>
                </div>
              </form>
            </div>
          {/if}
        {/snippet}
      </Dialog.Content>
    </div>
  </Dialog.Portal>
</Dialog.Root>
