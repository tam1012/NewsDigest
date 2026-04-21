<script>
  import WelcomeSvg1 from './WelcomeSvg1.svelte';
  import WelcomeSvg2 from './WelcomeSvg2.svelte';
</script>

<div class="welcome-panel max-w-md w-full px-6">
  <div class="text-center mb-10">
    <h1 class="welcome-headline font-serif text-3xl font-bold mb-3">
      NewsDigest
    </h1>
    <p class="welcome-subtitle text-sm text-text-secondary leading-relaxed">
      Free & Open Source · Tổng hợp tin tức cá nhân hóa với AI
    </p>
  </div>

  <div class="flex flex-col gap-4">
    <!-- Keyboard shortcut card -->
    <div class="shortcut-card">
      <div class="shortcut-card-visual">
        <WelcomeSvg1 />
      </div>
      <div class="shortcut-card-body">
        <div class="shortcut-card-icon">
          <!-- Keyboard icon -->
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="3" ry="3" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01" />
            <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01" />
            <path d="M8 16h8" />
          </svg>
          <span>Phím tắt</span>
        </div>
        <p class="shortcut-card-desc">
          Bạn có thể nhấn phím mũi tên trên bàn phím để chuyển nhanh tin tức
        </p>
      </div>
    </div>

    <!-- Automation schedule card -->
    <div class="shortcut-card" style="animation-delay: 1.9s;">
      <div class="shortcut-card-visual">
        <WelcomeSvg2 />
      </div>
      <div class="shortcut-card-body">
        <div class="shortcut-card-icon">
          <!-- Refresh/cog icon -->
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"
            />
          </svg>
          <span>Tự động hóa</span>
        </div>
        <p class="shortcut-card-desc">
          Tin tức được cập nhật mỗi 3 giờ · Tự động sửa lỗi mỗi 30 phút · Dọn
          dẹp dữ liệu cũ hàng ngày
        </p>
      </div>
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

  /* ── Shortcut card ── */
  .shortcut-card {
    border-radius: 16px;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--bg-2));
    overflow: hidden;
    opacity: 0;
    transform: translateY(8px);
    animation: subtitle-fade 0.6s 1.6s ease forwards;
  }

  .shortcut-card-visual {
    display: flex;
    justify-content: center;
    padding: 28px 24px 20px;
  }

  .shortcut-card-body {
    padding: 4px 20px 20px;
  }

  .shortcut-card-icon {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--text-main));
    margin-bottom: 4px;
  }

  .shortcut-card-desc {
    font-size: 13px;
    line-height: 1.5;
    color: hsl(var(--text-secondary));
    margin: 0;
  }

</style>

