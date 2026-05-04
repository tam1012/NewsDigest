const touchMoveOptions: AddEventListenerOptions = { passive: false }
const velocityCloseThreshold = 0.7 // px/ms

function getPageY(e: MouseEvent | TouchEvent): number {
  if ('touches' in e) return e.touches[0]?.pageY ?? 0
  return e.pageY
}

export function createDrawer(getOpen: () => boolean, onClose: () => void) {
  let drawerContainer = $state<HTMLDivElement | null>(null)
  let drawerBackdrop = $state<HTMLButtonElement | null>(null)
  let drawerPanel = $state<HTMLDivElement | null>(null)
  let drawerBody = $state<HTMLDivElement | null>(null)

  let isDragging = $state(false)
  let startY = $state(0)
  let currentTranslateY = $state(0)
  let dragStartTime = $state(0)
  let previousTranslateY = $state(0)
  let previousMoveTime = $state(0)
  let instantVelocity = $state(0)
  let animationFrameId = $state<number | null>(null)
  let pendingBodyDrag = $state(false)
  let bodyStartY = $state(0)

  let originalBodyOverflow = $state<string | null>(null)
  let originalBodyOverscrollBehavior = $state<string | null>(null)
  let originalHtmlOverflow = $state<string | null>(null)
  let originalHtmlOverscrollBehavior = $state<string | null>(null)

  // ── Style sync ────────────────────────────────────────

  function syncOpenStyles() {
    if (!drawerContainer || !drawerBackdrop || !drawerPanel) return
    drawerContainer.classList.remove('pointer-events-none')
    drawerBackdrop.classList.remove('pointer-events-none')
    drawerPanel.classList.remove('pointer-events-none')

    requestAnimationFrame(() => {
      if (!drawerBackdrop || !drawerPanel) return
      drawerBackdrop.style.opacity = '1'
      drawerPanel.style.transform = 'translateY(0)'
    })
  }

  function syncCloseStyles() {
    if (!drawerContainer || !drawerBackdrop || !drawerPanel) return
    drawerContainer.classList.add('pointer-events-none')
    drawerBackdrop.classList.add('pointer-events-none')
    drawerPanel.classList.add('pointer-events-none')
    drawerBackdrop.style.opacity = '0'
    drawerPanel.style.transform = 'translateY(100%)'
  }

  function requestClose() {
    syncCloseStyles()
    onClose()
  }

  // ── Page scroll lock ──────────────────────────────────

  function lockPageScroll() {
    if (typeof document === 'undefined') return
    const body = document.body
    const html = document.documentElement

    if (originalBodyOverflow === null) {
      originalBodyOverflow = body.style.overflow
      originalBodyOverscrollBehavior = body.style.overscrollBehavior
      originalHtmlOverflow = html.style.overflow
      originalHtmlOverscrollBehavior = html.style.overscrollBehavior
    }

    html.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
  }

  function unlockPageScroll() {
    if (typeof document === 'undefined') return
    const body = document.body
    const html = document.documentElement

    html.style.overflow = originalHtmlOverflow ?? ''
    html.style.overscrollBehavior = originalHtmlOverscrollBehavior ?? ''
    body.style.overflow = originalBodyOverflow ?? ''
    body.style.overscrollBehavior = originalBodyOverscrollBehavior ?? ''

    originalHtmlOverflow = null
    originalHtmlOverscrollBehavior = null
    originalBodyOverflow = null
    originalBodyOverscrollBehavior = null
  }

  // ── Drag handlers ─────────────────────────────────────

  function removeDragListeners() {
    document.removeEventListener('mousemove', onDragging)
    document.removeEventListener('mouseup', onDragEnd)
    document.removeEventListener('touchmove', onDragging, touchMoveOptions)
    document.removeEventListener('touchend', onDragEnd)
    document.removeEventListener('touchcancel', onDragEnd)
  }

  function onDragStart(e: MouseEvent | TouchEvent) {
    if (!drawerPanel || !drawerBackdrop || !getOpen()) return

    isDragging = true
    pendingBodyDrag = false
    startY = getPageY(e)
    dragStartTime = performance.now()
    previousTranslateY = 0
    previousMoveTime = dragStartTime
    instantVelocity = 0
    currentTranslateY = 0
    drawerPanel.style.transition = 'none'
    drawerBackdrop.style.transition = 'none'

    document.addEventListener('mousemove', onDragging)
    document.addEventListener('mouseup', onDragEnd)
    document.addEventListener('touchmove', onDragging, touchMoveOptions)
    document.addEventListener('touchend', onDragEnd)
    document.addEventListener('touchcancel', onDragEnd)
  }

  function onDragging(e: MouseEvent | TouchEvent) {
    if (!isDragging || !drawerPanel || !drawerBackdrop) return
    if (e.cancelable) e.preventDefault()

    const currentY = getPageY(e)
    const deltaY = Math.max(0, currentY - startY)
    const now = performance.now()
    const dt = Math.max(1, now - previousMoveTime)
    instantVelocity = Math.max(0, deltaY - previousTranslateY) / dt
    currentTranslateY = deltaY
    previousTranslateY = deltaY
    previousMoveTime = now

    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(() => {
        if (!drawerPanel || !drawerBackdrop) return
        drawerPanel.style.transform = `translateY(${currentTranslateY}px)`
        const panelHeight = drawerPanel.offsetHeight || 1
        const opacity = 1 - (currentTranslateY / panelHeight) * 0.8
        drawerBackdrop.style.opacity = String(Math.max(0, opacity))
        animationFrameId = null
      })
    }
  }

  function onDragEnd() {
    if (!isDragging || !drawerPanel || !drawerBackdrop) return

    isDragging = false
    pendingBodyDrag = false
    removeDragListeners()

    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }

    drawerPanel.style.transition = ''
    drawerBackdrop.style.transition = ''

    const panelHeight = drawerPanel.offsetHeight || 1
    const distanceThreshold = panelHeight / 4
    const nowEnd = performance.now()
    const elapsed = Math.max(1, nowEnd - dragStartTime)
    const avgVelocity = currentTranslateY / elapsed
    const shouldCloseByVelocity =
      avgVelocity >= velocityCloseThreshold ||
      instantVelocity >= velocityCloseThreshold

    if (currentTranslateY > distanceThreshold || shouldCloseByVelocity) {
      requestClose()
      return
    }

    drawerBackdrop.style.opacity = '1'
    drawerPanel.style.transform = 'translateY(0)'
  }

  // ── Body-drag (scroll-top → pull-to-close) ────────────

  function onBodyTouchStart(e: TouchEvent) {
    if (!getOpen() || !drawerBody) return
    pendingBodyDrag = drawerBody.scrollTop <= 0
    bodyStartY = getPageY(e)
  }

  function onBodyTouchMove(e: TouchEvent) {
    if (!drawerBody || !pendingBodyDrag) return

    if (isDragging) {
      onDragging(e)
      return
    }

    const deltaY = getPageY(e) - bodyStartY
    if (deltaY > 6 && drawerBody.scrollTop <= 0) {
      onDragStart(e)
      onDragging(e)
      return
    }

    if (deltaY < -6) {
      pendingBodyDrag = false
    }
  }

  function onBodyTouchEnd() {
    if (!isDragging) pendingBodyDrag = false
  }

  // ── Lifecycle effects ─────────────────────────────────

  $effect(() => {
    if (getOpen()) {
      syncOpenStyles()
      lockPageScroll()
    } else {
      syncCloseStyles()
      unlockPageScroll()
    }
  })

  $effect(() => {
    return () => {
      removeDragListeners()
      unlockPageScroll()
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  })

  return {
    get drawerContainer() { return drawerContainer },
    set drawerContainer(v) { drawerContainer = v },
    get drawerBackdrop() { return drawerBackdrop },
    set drawerBackdrop(v) { drawerBackdrop = v },
    get drawerPanel() { return drawerPanel },
    set drawerPanel(v) { drawerPanel = v },
    get drawerBody() { return drawerBody },
    set drawerBody(v) { drawerBody = v },
    onDragStart,
    onBodyTouchStart,
    onBodyTouchMove,
    onBodyTouchEnd,
    requestClose,
  }
}
