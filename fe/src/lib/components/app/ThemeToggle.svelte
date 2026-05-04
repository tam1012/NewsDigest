<script lang="ts">
  import { Moon, Sun } from 'lucide-svelte'
  import CusButton from '$lib/components/ui/CusButton.svelte'
  import { slideScaleFade } from '$lib/transitions/slideScaleFade'

  let {
    darkMode = false,
    onToggle,
    class: className = '',
  }: {
    darkMode?: boolean
    onToggle?: () => void
    class?: string
  } = $props()
</script>

<CusButton onclick={onToggle} class={className} aria-label={darkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}>
  <div class="grid place-items-center">
    {#if darkMode}
      <div
        class="col-start-1 row-start-1"
        in:slideScaleFade={{ duration: 250, startScale: 0.5, startOpacity: 0 }}
        out:slideScaleFade={{ duration: 200, startScale: 0.5, startOpacity: 0 }}
      >
        <Sun size={16} />
      </div>
    {:else}
      <div
        class="col-start-1 row-start-1"
        in:slideScaleFade={{ duration: 250, startScale: 0.5, startOpacity: 0 }}
        out:slideScaleFade={{ duration: 200, startScale: 0.5, startOpacity: 0 }}
      >
        <Moon size={16} />
      </div>
    {/if}
  </div>
</CusButton>
