<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { cn } from "$lib/utils.js";
	import { fade } from "svelte/transition";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.OverlayProps = $props();
</script>

<DialogPrimitive.Overlay
	bind:ref
	forceMount
	{...restProps}
>
	{#snippet child({ props, open })}
		{#if open}
			<div
				{...props}
				data-slot="dialog-overlay"
				class={cn(
					"bg-black/40 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 isolate z-50",
					className
				)}
				transition:fade={{ duration: 150 }}
			></div>
		{/if}
	{/snippet}
</DialogPrimitive.Overlay>
