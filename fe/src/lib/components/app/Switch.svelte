<script lang="ts">
  interface Props {
    checked?: boolean;
    disabled?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    class?: string;
  }

  let {
    checked = $bindable(false),
    disabled = false,
    onCheckedChange,
    class: className = '',
  }: Props = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onCheckedChange?.(checked);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggle();
    }
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  {disabled}
  onclick={toggle}
  onkeydown={handleKeydown}
  class="switch {className}"
  class:switch--checked={checked}
  class:switch--disabled={disabled}
>
  <span class="switch__thumb"></span>
</button>

<style>
  .switch {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 32px;
    height: 18px;
    border-radius: 9999px;
    border: 1.5px solid transparent;
    padding: 0;
    background-color: hsl(50 8% 72%);
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
    outline: none;
    flex-shrink: 0;
  }

  :global(.dark) .switch {
    background-color: hsl(45 3% 32%);
  }

  .switch:focus-visible {
    box-shadow: 0 0 0 3px hsl(var(--ring) / 0.4);
  }

  .switch--checked {
    background-color: hsl(var(--primary));
  }

  :global(.dark) .switch--checked {
    background-color: hsl(var(--primary));
  }

  .switch--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .switch__thumb {
    position: absolute;
    left: 1px;
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background-color: white;
    transition: transform 0.2s ease;
    pointer-events: none;
    box-shadow: 0 1px 3px hsl(0 0% 0% / 0.15);
  }

  :global(.dark) .switch__thumb {
    background-color: hsl(50 8% 85%);
  }

  .switch--checked .switch__thumb {
    transform: translateX(14px);
  }
</style>
