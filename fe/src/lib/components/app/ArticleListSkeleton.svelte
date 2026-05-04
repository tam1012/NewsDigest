<div class="skeleton-container flex flex-col gap-8 animate-pulse">
  {#each Array(6) as _}
    <div>
      <div class="flex items-center gap-2 mb-2">
        <div class="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800"></div>
        <div class="h-3 w-10 rounded bg-zinc-200 dark:bg-zinc-800"></div>
      </div>
      <div class="h-5 w-full rounded bg-zinc-200 dark:bg-zinc-800 mb-2"></div>
      <div class="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 mb-1"></div>
      <div class="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800"></div>
    </div>
  {/each}
</div>
