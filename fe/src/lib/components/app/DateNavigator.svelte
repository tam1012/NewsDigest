<script lang="ts">
  import { ChevronLeft, ChevronRight } from 'lucide-svelte'
  import CusButton from '$lib/components/ui/CusButton.svelte'

  let {
    isToday = false,
    onPrev,
    onNext,
    class: className = '',
  }: {
    isToday?: boolean
    onPrev?: () => void
    onNext?: () => void
    /** Tailwind classes applied to each button, e.g. "size-8" or "size-12" */
    class?: string
  } = $props()
</script>

<div class="flex gap-2">
  <CusButton onclick={onPrev} class={className} aria-label="Ngày trước">
    <ChevronLeft class="-translate-x-px" size={20} />
  </CusButton>
  <CusButton
    onclick={() => !isToday && onNext?.()}
    class={className}
    disabled={isToday}
    aria-label="Ngày sau"
  >
    <div class="transition-opacity duration-200" class:opacity-50={isToday}>
      <ChevronRight class="translate-x-px" size={20} />
    </div>
  </CusButton>
</div>
