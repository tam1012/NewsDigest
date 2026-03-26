<script lang="ts">
  import { onMount } from 'svelte';
  import { prefs } from '$lib/stores/prefs';
  import { sources } from '$lib/stores/sources';
  import NavBar from '$lib/components/app/NavBar.svelte';
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  let { data, children }: { data: any; children: Snippet } = $props();

  let mounted = $state(false);

  // Sync sources from load function to store (used by ArticleCard)
  $effect(() => {
    if (data.sources) {
      $sources = data.sources;
    }
  });

  // Redirect to onboarding if no sources
  $effect(() => {
    if (mounted && data.sources.length === 0 && $page.url.pathname !== '/onboarding') {
      goto('/onboarding');
    }
  });

  onMount(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
        $prefs.darkMode = saved === 'true';
    } else {
        $prefs.darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    mounted = true;
  });

  $effect(() => {
    if (mounted && typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', $prefs.darkMode);
      localStorage.setItem('darkMode', String($prefs.darkMode));
    }
  });
</script>

<NavBar />
<main class="container mx-auto px-4 py-6">
  {@render children()}
</main>
