<script>
  import WelcomeSvg1 from './WelcomeSvg1.svelte'
  import WelcomeSvg2 from './WelcomeSvg2.svelte'
</script>

<div class="mobile-about">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="about-headline font-serif text-2xl font-bold mb-2">
      NewsDigest
    </h1>
    <p class="about-subtitle text-sm text-text-secondary leading-relaxed">
      Free & Open Source · Personalized AI news aggregator
    </p>
  </div>

  <!-- Feature cards – stacked vertically for mobile -->
  <div class="flex flex-col gap-4">
    <!-- Card 1: Keyboard shortcuts -->
    <div class="about-card rounded-2xl border border-border/30 bg-bg-1/40 overflow-hidden">
      <div class="flex items-center justify-center p-5 border-b border-border/20">
        <WelcomeSvg1 />
      </div>
      <div class="p-5">
        <h3 class="text-[15px] font-semibold text-text-main mb-1">
          Keyboard Shortcuts
        </h3>
        <p class="text-[13px] leading-relaxed text-text-secondary m-0">
          Use arrow keys on your keyboard to quickly navigate through news articles
        </p>
      </div>
    </div>

    <!-- Card 2: Automation -->
    <div class="about-card rounded-2xl border border-border/30 bg-bg-1/40 overflow-hidden">
      <div class="flex items-center justify-center p-5 border-b border-border/20">
        <WelcomeSvg2 />
      </div>
      <div class="p-5">
        <h3 class="text-[15px] font-semibold text-text-main mb-1">
          Automation
        </h3>
        <p class="text-[13px] leading-relaxed text-text-secondary m-0">
          News updated every 3 hours · Auto-retry every 30 minutes · Daily data cleanup
        </p>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="mt-6 text-center">
    <a
      href="https://github.com/nicktoan2s/NewsDigest"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1.5 text-xs text-text-secondary/60 hover:text-text-main transition-colors"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
      View on GitHub
    </a>
  </div>
</div>

<style>
  .about-headline {
    -webkit-text-fill-color: transparent;
    color: transparent;
    background-image: linear-gradient(
      90deg,
      hsl(var(--text-main)) 0 33.33%,
      #69bff9 33.33%,
      #b96af3 45%,
      #e9685e 52.67%,
      #f2ac3e 66.67%,
      transparent 66.67%,
      transparent
    );
    background-size: 300% 100%;
    background-position: 100% 0;
    -webkit-background-clip: text;
    background-clip: text;
    padding-bottom: 0.18em;

    opacity: 0;
    filter: blur(1px);

    animation:
      headline-sweep 3s 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards,
      headline-reveal 0.8s 0.3s ease forwards,
      headline-settle 0.8s 3.2s ease forwards;
  }

  @keyframes headline-sweep {
    0% { background-position: 100% 0; }
    100% { background-position: 0% 0; }
  }

  @keyframes headline-reveal {
    0% { opacity: 0; filter: blur(1px); }
    100% { opacity: 1; filter: blur(0); }
  }

  @keyframes headline-settle {
    0% { -webkit-text-fill-color: transparent; }
    100% { -webkit-text-fill-color: hsl(var(--text-main)); }
  }

  .about-subtitle {
    opacity: 0;
    transform: translateY(4px);
    animation: fade-up 0.6s 0.8s ease forwards;
  }

  .about-card {
    opacity: 0;
    transform: translateY(6px);
    animation: fade-up 0.5s ease forwards;
  }

  .about-card:nth-child(1) {
    animation-delay: 1s;
  }

  .about-card:nth-child(2) {
    animation-delay: 1.2s;
  }

  @keyframes fade-up {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
