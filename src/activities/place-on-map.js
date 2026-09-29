import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature, merge } from 'topojson-client'
import worldTopology from 'world-atlas/countries-110m.json'

const mapWidth = 1000
const mapHeight = 540
const countries = feature(worldTopology, worldTopology.objects.countries)
const projection = geoNaturalEarth1().fitSize([mapWidth, mapHeight], countries)
const path = geoPath(projection)
const land = merge(worldTopology, worldTopology.objects.countries.geometries)
const landPath = path(land)
const graticulePath = path(geoGraticule10())
const continents = [
  'north-america',
  'south-america',
  'europe',
  'africa',
  'asia',
  'australia',
  'antarctica',
]
const continentCountries = {
  'north-america': ['Bahamas', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominican Rep.', 'El Salvador', 'Greenland', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico', 'Trinidad and Tobago', 'United States of America'],
  'south-america': ['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Falkland Is.', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela'],
  europe: ['Albania', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia', 'Lithuania', 'Luxembourg', 'Macedonia', 'Moldova', 'Montenegro', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom'],
  africa: ['Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Central African Rep.', 'Chad', 'Congo', 'Dem. Rep. Congo', 'Djibouti', 'Egypt', 'Eq. Guinea', 'Eritrea', 'eSwatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'S. Sudan', 'Senegal', 'Sierra Leone', 'Somaliland', 'South Africa', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'W. Sahara', 'Zambia', 'Zimbabwe'],
  asia: ['Afghanistan', 'Armenia', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China', 'Cyprus', 'Georgia', 'India', 'Indonesia', 'Iran', 'Iraq', 'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Malaysia', 'Mongolia', 'Myanmar', 'N. Korea', 'Nepal', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar', 'Russia', 'Saudi Arabia', 'S. Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan', 'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen'],
  australia: ['Australia', 'Fiji', 'New Caledonia', 'New Zealand', 'Papua New Guinea', 'Solomon Is.', 'Vanuatu'],
  antarctica: ['Antarctica'],
}
const continentPaths = Object.fromEntries(continents.map((continent) => {
  const countryNames = new Set(continentCountries[continent])
  const geometries = worldTopology.objects.countries.geometries.filter((geometry) => countryNames.has(geometry.properties.name))
  return [continent, path(merge(worldTopology, geometries))]
}))

const state = {
  allDinosaurs: [],
  dinosaurs: [],
  spriteSheets: {},
  placedIds: new Set(),
  drag: null,
  hoveredZone: null,
}

let root

const select = (selector) => root.querySelector(selector)

function shuffle(items) {
  const shuffled = [...items]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[nextIndex]] = [shuffled[nextIndex], shuffled[index]]
  }
  return shuffled
}

function selectRound(dinosaurs) {
  const continentCounts = new Map()
  const selected = []
  for (const dinosaur of shuffle(dinosaurs)) {
    const count = continentCounts.get(dinosaur.continent) ?? 0
    if (count === 3) continue
    continentCounts.set(dinosaur.continent, count + 1)
    selected.push(dinosaur)
    if (selected.length === 8) return selected
  }
  throw new Error('Not enough dinosaur specimens to create a balanced round.')
}

async function loadDinosaurs() {
  const [roster, set1, set2] = await Promise.all([
    fetch('/map/dinosaurs.json').then((response) => response.json()),
    fetch('/map/dinosaur-sprites/dinosaurs.json').then((response) => response.json()),
    fetch('/map/dinosaur-sprites/set2/dinosaurs-set2.json').then((response) => response.json()),
  ])
  state.spriteSheets = { set1, set2 }
  state.allDinosaurs = roster.dinosaurs.map((dinosaur) => {
    const spriteSheet = state.spriteSheets[dinosaur.spriteSet ?? 'set1']
    const sprite = spriteSheet?.frames[dinosaur.sprite]
    if (!sprite) throw new Error(`No generated sprite exists for ${dinosaur.sprite}.`)
    return { ...dinosaur, ...sprite, spriteSheet }
  })
}

function spritePath(dinosaur, file) {
  const directory = dinosaur.spriteSet === 'set2' ? 'set2/' : ''
  return `/map/dinosaur-sprites/${directory}${file}`
}

function iconMarkup(dinosaur, className = 'dino-icon') {
  return `<img class="${className}" src="${spritePath(dinosaur, dinosaur.file)}" alt="" />`
}

function sheetSpriteMarkup(dinosaur) {
  const column = dinosaur.frame.x / dinosaur.spriteSheet.tileSize
  const row = dinosaur.frame.y / dinosaur.spriteSheet.tileSize
  return `<span class="placed-dino-sprite"><img src="${spritePath(dinosaur, dinosaur.spriteSheet.image)}" alt="" style="transform: translate(-${column * 25}%, -${row * 50}%);" /></span>`
}

function zoneMarkup() {
  return continents.map((continent) => `<div class="map-zone zone-${continent}" data-continent="${continent}" aria-hidden="true"></div>`).join('')
}

function continentPathMarkup() {
  return continents.map((continent) => `<path class="continent-highlight" data-continent="${continent}" d="${continentPaths[continent]}" />`).join('')
}

function setContinentState(continent, className, enabled) {
  root.querySelector(`.continent-highlight[data-continent="${continent}"]`)?.classList.toggle(className, enabled)
}

function setDinosaurDetails(dinosaur) {
  const details = select('#dino-details')
  if (!dinosaur) {
    details.hidden = true
    details.innerHTML = ''
    return
  }
  details.innerHTML = `
    <div class="dino-details-image-frame"><img src="${spritePath(dinosaur, dinosaur.file)}" alt="${dinosaur.name}" /></div>
    <div class="dino-details-facts">
      <p class="eyebrow">Field notes</p>
      <h2>${dinosaur.name}</h2>
      <dl>
        <div><dt>Size</dt><dd>${dinosaur.size}</dd></div>
        <div><dt>Period</dt><dd>${dinosaur.period}</dd></div>
        <div><dt>Diet</dt><dd>${dinosaur.diet}</dd></div>
        <div><dt>Hip type</dt><dd>${dinosaur.hip}</dd></div>
      </dl>
    </div>
    <figure class="dino-size-comparison">
      <p class="eyebrow">Size comparison</p>
      <img src="/map/dinosaur-silhouettes/${dinosaur.silhouette}" alt="${dinosaur.name} beside a 1.75 metre human" />
      <figcaption>Human: 1.75 m</figcaption>
    </figure>
  `
  details.hidden = false
}

function playContinentSuccess(continent) {
  const highlight = root.querySelector(`.continent-highlight[data-continent="${continent}"]`)
  if (!highlight) return
  highlight.classList.remove('is-success')
  void highlight.getBoundingClientRect()
  highlight.classList.add('is-success')
  highlight.addEventListener('animationend', () => highlight.classList.remove('is-success'), { once: true })
}

function markerOffset(index) {
  const offsets = [
    { x: -22, y: -14 },
    { x: 22, y: 14 },
    { x: -24, y: 18 },
    { x: 24, y: -18 },
  ]
  return offsets[index % offsets.length]
}

function renderShell() {
  root.innerHTML = `
    <main class="map-game-shell">
      <header class="masthead">
        <a class="wordmark" href="#/" aria-label="Dino Bones home">DINO <span>BONES</span></a>
        <a class="back-link" href="#/">All activities</a>
      </header>
      <section class="map-intro" aria-labelledby="map-title">
        <p class="eyebrow">Ancient geography</p>
        <h1 id="map-title">Place on the map</h1>
        <p>Fossils tell us where dinosaurs lived. Match each specimen to the continent that holds its record.</p>
      </section>
      <section class="map-workspace" aria-label="Dinosaur continent map">
        <div class="map-board-panel">
          <div class="board-caption"><span>World map</span><span>Continents</span></div>
          <div class="world-map">
            <svg viewBox="0 0 ${mapWidth} ${mapHeight}" role="img" aria-label="Projected world map with country boundaries and continent labels">
              <defs>
                <linearGradient id="ocean-wash" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stop-color="#6ca8af" />
                  <stop offset="1" stop-color="#478b96" />
                </linearGradient>
                <pattern id="ocean-dashes" width="26" height="18" patternUnits="userSpaceOnUse">
                  <path d="M3 9h8" fill="none" stroke="#f5f1e6" stroke-opacity=".18" stroke-width="1" />
                </pattern>
                <pattern id="land-hatch" width="17" height="17" patternUnits="userSpaceOnUse">
                  <path d="M2 15 15 2" fill="none" stroke="#17302e" stroke-opacity=".1" stroke-width="1" />
                </pattern>
              </defs>
              <rect class="map-ocean" width="${mapWidth}" height="${mapHeight}" />
              <rect class="map-ocean-texture" width="${mapWidth}" height="${mapHeight}" />
              <path class="map-graticule" d="${graticulePath}" />
              <path class="map-land" d="${landPath}" />
              <path class="map-land-texture" d="${landPath}" />
              ${continentPathMarkup()}
              <g class="map-compass" aria-hidden="true" transform="translate(78 78)">
                <circle r="23" />
                <path d="M0-18 7 7 0 18-7 7Z" />
                <path d="M0-18 0 18" />
                <text x="0" y="-30">N</text>
              </g>
            </svg>
            ${zoneMarkup()}
            <span class="continent-label label-north-america"><i></i>North America</span>
            <span class="continent-label label-south-america"><i></i>South America</span>
            <span class="continent-label label-europe"><i></i>Europe</span>
            <span class="continent-label label-africa"><i></i>Africa</span>
            <span class="continent-label label-asia"><i></i>Asia</span>
            <span class="continent-label label-australia"><i></i>Australia</span>
            <span class="continent-label label-antarctica"><i></i>Antarctica</span>
          </div>
        </div>
        <aside class="specimen-panel" aria-label="Dinosaur specimen tray">
          <div class="map-tray-heading">
            <div><p class="eyebrow">Specimen tray</p><h2>Find their home.</h2></div>
            <button id="map-reset" class="icon-button" type="button" title="Reset round" aria-label="Reset round">&#10227;</button>
          </div>
          <div id="map-tray" class="map-tray"></div>
          <p id="map-progress" class="map-progress">0 / 0 placed</p>
          <p id="map-status" class="status" aria-live="polite">Drag a specimen onto the continent where it was found.</p>
        </aside>
        <section id="dino-details" class="dino-details" aria-live="polite" hidden></section>
      </section>
    </main>
    <div id="map-drag-layer" class="drag-layer" aria-hidden="true"></div>
    <dialog id="map-completion-dialog" class="completion-dialog">
      <p class="eyebrow">Expedition complete</p>
      <h2>The fossil record is mapped.</h2>
      <p>Every specimen has been returned to the continent that holds its story.</p>
      <button id="map-replay" class="primary-button" type="button">Shuffle and replay</button>
    </dialog>
  `

  select('#map-reset').addEventListener('click', resetRound)
  select('#map-replay').addEventListener('click', () => {
    select('#map-completion-dialog').close()
    resetRound()
  })
}

function makeCard(dinosaur) {
  const card = document.createElement('button')
  card.type = 'button'
  card.className = 'dinosaur-card'
  card.dataset.dinosaurId = dinosaur.id
  card.style.setProperty('--dino-zoom', dinosaur.zoom ?? 1.78)
  card.innerHTML = `<span class="dino-icon-frame">${iconMarkup(dinosaur)}</span><span>${dinosaur.name}</span>`
  card.addEventListener('pointerdown', beginDrag)
  return card
}

function renderTray() {
  const tray = select('#map-tray')
  tray.innerHTML = ''
  shuffle(state.dinosaurs.filter((dinosaur) => !state.placedIds.has(dinosaur.id)))
    .forEach((dinosaur) => tray.append(makeCard(dinosaur)))
}

function updateStatus(message) {
  select('#map-progress').textContent = `${state.placedIds.size} / ${state.dinosaurs.length} placed`
  select('#map-status').textContent = message
}

function resetRound() {
  clearDrag()
  setDinosaurDetails()
  state.placedIds.clear()
  state.dinosaurs = selectRound(state.allDinosaurs)
  root.querySelectorAll('.map-zone.is-filled').forEach((zone) => {
    zone.classList.remove('is-filled')
    zone.innerHTML = ''
  })
  renderTray()
  updateStatus('Drag a specimen onto the continent where it was found.')
}

function beginDrag(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const source = event.currentTarget
  const dinosaur = state.dinosaurs.find((item) => item.id === source.dataset.dinosaurId)
  if (source.classList.contains('is-placed')) {
    setDinosaurDetails(dinosaur)
    event.preventDefault()
    return
  }
  const bounds = source.getBoundingClientRect()
  const clone = source.cloneNode(true)
  clone.className = 'dinosaur-card drag-dinosaur-card'
  clone.style.width = `${bounds.width}px`
  clone.style.height = `${bounds.height}px`
  select('#map-drag-layer').append(clone)
  source.classList.add('is-dragging')
  state.drag = {
    source,
    clone,
    dinosaur,
    offsetX: bounds.width / 2,
    offsetY: bounds.height / 2,
    originX: event.clientX,
    originY: event.clientY,
    moved: false,
  }
  setDinosaurDetails(dinosaur)
  document.body.classList.add('is-dragging')
  source.setPointerCapture(event.pointerId)
  moveDrag(event)
  source.addEventListener('pointermove', moveDrag)
  source.addEventListener('pointerup', finishDrag, { once: true })
  source.addEventListener('pointercancel', cancelDrag, { once: true })
  event.preventDefault()
}

function moveDrag(event) {
  if (!state.drag) return
  const { clone, offsetX, offsetY, originX, originY } = state.drag
  if (Math.hypot(event.clientX - originX, event.clientY - originY) >= 6) state.drag.moved = true
  clone.style.transform = `translate(${event.clientX - offsetX}px, ${event.clientY - offsetY}px)`
  const hoveredZone = document.elementFromPoint(event.clientX, event.clientY)?.closest('.map-zone') ?? null
  if (hoveredZone === state.hoveredZone) return
  state.hoveredZone?.classList.remove('is-hovered')
  if (state.hoveredZone) setContinentState(state.hoveredZone.dataset.continent, 'is-hovered', false)
  hoveredZone?.classList.add('is-hovered')
  if (hoveredZone) setContinentState(hoveredZone.dataset.continent, 'is-hovered', true)
  state.hoveredZone = hoveredZone
}

function clearDrag() {
  if (!state.drag) return
  state.hoveredZone?.classList.remove('is-hovered')
  if (state.hoveredZone) setContinentState(state.hoveredZone.dataset.continent, 'is-hovered', false)
  state.hoveredZone = null
  state.drag.source.classList.remove('is-dragging')
  state.drag.clone.remove()
  document.body.classList.remove('is-dragging')
  state.drag = null
}

function finishDrag(event) {
  const drag = state.drag
  if (!drag) return
  if (!drag.moved) {
    clearDrag()
    setDinosaurDetails(drag.dinosaur)
    return
  }
  const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest('.map-zone')
  if (zone?.dataset.continent === drag.dinosaur.continent) {
    drag.source.classList.add('is-placed')
    drag.source.setAttribute('aria-label', `${drag.dinosaur.name} placed. View field notes`)
    drag.source.title = 'Placed - click for field notes'
    state.placedIds.add(drag.dinosaur.id)
    zone.classList.add('is-filled')
    playContinentSuccess(zone.dataset.continent)
    const marker = document.createElement('span')
    const offset = markerOffset(zone.querySelectorAll('.placed-dinosaur').length)
    marker.className = 'placed-dinosaur'
    marker.style.setProperty('--anchor-x', drag.dinosaur.anchor.x)
    marker.style.setProperty('--anchor-y', drag.dinosaur.anchor.y)
    marker.style.setProperty('--placement-x', `${offset.x}px`)
    marker.style.setProperty('--placement-y', `${offset.y}px`)
    marker.innerHTML = sheetSpriteMarkup(drag.dinosaur)
    zone.append(marker)
    clearDrag()
    if (state.placedIds.size === state.dinosaurs.length) {
      updateStatus('Every specimen is placed.')
      select('#map-completion-dialog').showModal()
    } else {
      updateStatus(`${state.placedIds.size} specimen${state.placedIds.size === 1 ? '' : 's'} placed. Keep mapping.`)
    }
    return
  }
  clearDrag()
  updateStatus('That specimen was not found there. Try another continent.')
}

function cancelDrag() {
  clearDrag()
  updateStatus('Specimen returned to the tray.')
}

export async function render(container) {
  root = container
  await loadDinosaurs()
  renderShell()
  resetRound()
}

export function cleanup() {
  clearDrag()
  const dialog = root?.querySelector('#map-completion-dialog')
  if (dialog?.open) dialog.close()
  if (root) root.innerHTML = ''
  root = null
}