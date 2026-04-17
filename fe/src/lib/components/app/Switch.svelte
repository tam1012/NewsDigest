<script lang="ts">
  import { Switch } from 'bits-ui'
  import type { WithoutChildrenOrChild } from 'bits-ui'

  type Props = WithoutChildrenOrChild<Switch.RootProps> & {
    class?: string
  }

  let {
    checked = $bindable(false),
    disabled = false,
    onCheckedChange,
    class: className = '',
    ...restProps
  }: Props = $props()
</script>

<Switch.Root
  bind:checked
  {disabled}
  {onCheckedChange}
  class="data-[state=checked]:bg-bw/50 relative data-[state=unchecked]:bg-bw/5
    inline-flex h-[18px] w-8 shrink-0 cursor-pointer items-center rounded-full
    border border-transparent p-0 outline-none transition-colors duration-200
    focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring)/0.4)]
 
    {className}"
  {...restProps}
>
  <Switch.Thumb
    class="bg-bw pointer-events-none absolute left-px block h-3.5 w-3.5 rounded-full shadow-sm
      transition-transform duration-200
      data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0"
  />
</Switch.Root>
