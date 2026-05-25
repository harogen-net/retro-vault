import type { Animation, AnimationBuilder } from '@ionic/react'
import { createAnimation } from '@ionic/react'

type TransitionOptions = {
  enteringEl: HTMLElement
  leavingEl?: HTMLElement
  direction?: 'forward' | 'back'
}

export const fullWidthSlideAnimation: AnimationBuilder = (
  _baseEl: unknown,
  opts?: TransitionOptions,
): Animation => {
  const enteringEl = opts?.enteringEl
  const leavingEl = opts?.leavingEl
  const isBack = opts?.direction === 'back'

  const rootTransition = createAnimation()
    .duration(280)
    .easing('cubic-bezier(0.22, 1, 0.36, 1)')

  if (!enteringEl) {
    return rootTransition
  }

  const enteringStart = isBack ? '-100%' : '100%'
  const leavingEnd = isBack ? '100%' : '-100%'

  const entering = createAnimation()
    .addElement(enteringEl)
    .beforeRemoveClass('ion-page-invisible')
    .fromTo('transform', `translateX(${enteringStart})`, 'translateX(0%)')

  rootTransition.addAnimation([entering])

  if (leavingEl) {
    const leaving = createAnimation()
      .addElement(leavingEl)
      .fromTo('transform', 'translateX(0%)', `translateX(${leavingEnd})`)

    rootTransition.addAnimation([leaving])
  }

  return rootTransition
}
