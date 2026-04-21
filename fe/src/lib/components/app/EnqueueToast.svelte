<script lang="ts">
  import { Sparkles } from 'lucide-svelte'
  import { slideScaleFade } from '$lib/transitions/slideScaleFade'

  let {
    show = false,
    count = 0,
    estimateLabel = '',
    variant = 'mobile',
  }: {
    show?: boolean
    count?: number
    estimateLabel?: string
    variant?: 'mobile' | 'desktop'
  } = $props()
</script>

{#if show}
  {#if variant === 'mobile'}
    <div
      class="fixed z-50 bottom-24 left-4 right-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
      style="background: var(--color-bg-1); border: 1px solid color-mix(in srgb, currentColor 12%, transparent);"
      in:slideScaleFade={{ duration: 250, startScale: 0.92, startOpacity: 0 }}
      out:slideScaleFade={{ duration: 200, startScale: 0.92, startOpacity: 0 }}
    >
      <Sparkles size={14} class="shrink-0 text-violet-500" />
      <span>Đã xếp hàng <strong>{count}</strong> bài · hoàn tất sau {estimateLabel}</span>
    </div>
  {:else}
    <div
      class="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium"
      style="background: color-mix(in srgb, var(--color-bg-1) 80%, transparent); border: 1px solid color-mix(in srgb, currentColor 12%, transparent);"
      in:slideScaleFade={{ duration: 250, startScale: 0.92, startOpacity: 0 }}
      out:slideScaleFade={{ duration: 200, startScale: 0.92, startOpacity: 0 }}
    >
      <Sparkles size={12} class="text-violet-500 shrink-0" />
      <span>{count} bài · {estimateLabel}</span>
    </div>
  {/if}
{/if}
