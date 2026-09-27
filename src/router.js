import { render as renderHome } from './pages/home.js'
import * as assembleSkeleton from './activities/assemble-skeleton.js'
import * as placeOnMap from './activities/place-on-map.js'

const activities = {
  'assemble-skeleton': assembleSkeleton,
  'place-on-map': placeOnMap,
}

export function createRouter(root) {
  let activeActivity = null
  let navigationId = 0

  async function renderRoute() {
    const currentNavigation = ++navigationId
    const route = window.location.hash.replace(/^#\/?/, '')
    activeActivity?.cleanup?.()
    activeActivity = null

    if (!route) {
      renderHome(root)
      return
    }

    const activity = activities[route]
    if (!activity) {
      window.location.hash = '#/'
      return
    }

    activeActivity = activity
    await activity.render(root)
    if (currentNavigation !== navigationId) activity.cleanup?.()
  }

  return {
    start() {
      window.addEventListener('hashchange', renderRoute)
      renderRoute()
    },
  }
}