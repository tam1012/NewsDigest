import { cubicOut } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'

type EasingFunction = (progress: number) => number

export type SlideDirection = 'left' | 'right' | 'top' | 'bottom'

export interface SlideScaleFadeParams {
  delay?: number
  duration?: number
  easing?: EasingFunction
  slideFrom?: SlideDirection
  slideDistance?: string
  startScale?: number
  startOpacity?: number
  startBlur?: number
}

export interface FadeOnlyParams {
  delay?: number
  duration?: number
  easing?: EasingFunction
}

export interface FlyOnlyParams {
  delay?: number
  duration?: number
  easing?: EasingFunction
  x?: number
  y?: number
  opacity?: number
}

export function slideScaleFade(
  _node: Element,
  params: SlideScaleFadeParams = {},
): TransitionConfig {
  const {
    delay = 0,
    duration = 500,
    easing = cubicOut,
    slideFrom = 'top',
    slideDistance = '0rem',
    startScale = 1,
    startOpacity = 0,
    startBlur = 0,
  } = params

  const distanceValue = Number.parseFloat(slideDistance)
  const distanceUnit = slideDistance.replace(/[\d.-]/g, '') || 'px'

  return {
    delay,
    duration,
    easing,
    css: (progress, remaining) => {
      const opacity = startOpacity + (1 - startOpacity) * progress
      const scale = startScale + (1 - startScale) * progress
      const blur = startBlur * (1 - progress)
      const currentDistance = distanceValue * remaining

      let transform = ''

      switch (slideFrom) {
        case 'left':
          transform = `translateX(-${currentDistance}${distanceUnit})`
          break
        case 'right':
          transform = `translateX(${currentDistance}${distanceUnit})`
          break
        case 'top':
          transform = `translateY(-${currentDistance}${distanceUnit})`
          break
        case 'bottom':
          transform = `translateY(${currentDistance}${distanceUnit})`
          break
      }

      return [
        `opacity: ${opacity};`,
        `transform: ${transform} scale(${scale});`,
        `filter: blur(${blur}px);`,
        'transform-origin: center center;',
      ].join('\n')
    },
  }
}

export function fadeOnly(
  _node: Element,
  params: FadeOnlyParams = {},
): TransitionConfig {
  const {
    delay = 0,
    duration = 200,
    easing = cubicOut,
  } = params

  return {
    delay,
    duration,
    easing,
    css: (progress) => `opacity: ${progress};`,
  }
}

export function flyOnly(
  _node: Element,
  params: FlyOnlyParams = {},
): TransitionConfig {
  const {
    delay = 0,
    duration = 300,
    easing = cubicOut,
    x = 0,
    y = 0,
    opacity = 0,
  } = params

  return {
    delay,
    duration,
    easing,
    css: (progress, remaining) =>
      [
        `transform: translate(${remaining * x}px, ${remaining * y}px);`,
        `opacity: ${opacity + (1 - opacity) * progress};`,
      ].join('\n'),
  }
}
