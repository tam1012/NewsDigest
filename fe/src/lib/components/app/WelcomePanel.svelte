<div class="welcome-panel max-w-lg w-full px-6">
  <div class="text-center mb-10">
    <h1 class="welcome-headline font-serif text-3xl font-bold mb-3">
      NewsDigest
    </h1>
    <p class="welcome-subtitle text-sm text-text-secondary leading-relaxed">
      Free & Open Source · Tổng hợp tin tức cá nhân hóa với AI
    </p>
  </div>

  <div class="space-y-6 text-sm">
    <!-- How it works -->

    <!-- Keyboard shortcuts -->
    <div>
      <h3
        class="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3"
      >
        Phím tắt
      </h3>
      <div class="grid grid-cols-2 gap-2 text-text-main-2">
        <div class="flex items-center gap-2">
          <kbd
            class="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md border border-border bg-text-main/5 text-[11px] font-mono font-medium text-text-secondary"
            >←</kbd
          >
          <span>Bài trước</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd
            class="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-md border border-border bg-text-main/5 text-[11px] font-mono font-medium text-text-secondary"
            >→</kbd
          >
          <span>Bài tiếp theo</span>
        </div>
      </div>
    </div>

    <!-- Get started -->
    <div class="pt-2 text-center">
      <p class="text-text-secondary text-xs">
        ← Chọn một bài viết từ danh sách bên trái để bắt đầu đọc
      </p>
    </div>
  </div>
</div>

<style>
  .welcome-headline {
    /* Gradient text setup */
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

    /* Start hidden & blurred */
    opacity: 0;
    filter: blur(1px);

    /* Phase 1: gradient sweep + reveal, Phase 2: settle to main color */
    animation:
      headline-sweep 3s 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards,
      headline-reveal 1s 0.6s ease forwards,
      headline-settle 0.8s 3.5s ease forwards;
  }

  /* Sweep the rainbow gradient from right to left */
  @keyframes headline-sweep {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: 0% 0;
    }
  }

  /* Fade in and unblur */
  @keyframes headline-reveal {
    0% {
      opacity: 0;
      filter: blur(1px);
    }
    100% {
      opacity: 1;
      filter: blur(0);
    }
  }

  /* Phase 2: settle to the main text color */
  @keyframes headline-settle {
    0% {
      -webkit-text-fill-color: transparent;
    }
    100% {
      -webkit-text-fill-color: hsl(var(--text-main));
    }
  }

  /* Subtitle: fade in after headline settles */
  .welcome-subtitle {
    opacity: 0;
    transform: translateY(6px);
    animation: subtitle-fade 0.8s 1.25s ease forwards;
  }

  @keyframes subtitle-fade {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
