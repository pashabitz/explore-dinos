const state = {
  puzzles: [],
  puzzle: null,
  cells: [],
  pieces: [],
  placed: 0,
  drag: null,
  showReference: false,
  pieceMode: null,
}

let root

const select = (selector) => root.querySelector(selector)

async function loadPuzzles() {
  const manifest = await fetch('/puzzles/index.json').then((response) => response.json())
  state.puzzles = await Promise.all(
    manifest.puzzles.map(async (filename) => {
      const url = `/puzzles/${filename}`
      const configuration = await fetch(url).then((response) => response.json())
      return { ...configuration, url }
    }),
  )
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5)
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = source
  })
}

async function createPieces(puzzle) {
  const imageUrl = new URL(puzzle.image, new URL(puzzle.url, window.location.origin)).href
  const image = await loadImage(imageUrl)
  const cellWidth = Math.floor(image.naturalWidth / puzzle.columns)
  const cellHeight = Math.floor(image.naturalHeight / puzzle.rows)
  const cleaned = document.createElement('canvas')
  cleaned.width = image.naturalWidth
  cleaned.height = image.naturalHeight
  const cleanedContext = cleaned.getContext('2d', { willReadFrequently: true })
  cleanedContext.drawImage(image, 0, 0)
  const pixels = cleanedContext.getImageData(0, 0, cleaned.width, cleaned.height)

  for (let pixel = 0; pixel < pixels.data.length; pixel += 4) {
    const [red, green, blue] = pixels.data.slice(pixel, pixel + 3)
    if (red > 238 && green > 238 && blue > 238) pixels.data[pixel + 3] = 0
  }
  cleanedContext.putImageData(pixels, 0, 0)

  const totalCells = puzzle.columns * puzzle.rows
  const validTiles = (tiles) => new Set((tiles ?? []).filter((tile) => Number.isInteger(tile) && tile >= 0 && tile < totalCells))
  const nonEmptyTiles = validTiles(puzzle.nonEmptyTiles)
  const emptyTiles = validTiles(puzzle.emptyTiles)

  return Array.from({ length: totalCells }, (_, index) => {
    const column = index % puzzle.columns
    const row = Math.floor(index / puzzle.columns)
    const fragment = document.createElement('canvas')
    fragment.width = cellWidth
    fragment.height = cellHeight
    const fragmentContext = fragment.getContext('2d')
    fragmentContext.drawImage(
      cleaned,
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      cellWidth,
      cellHeight,
    )
    const cellPixels = fragmentContext.getImageData(0, 0, cellWidth, cellHeight).data
    let visiblePixels = 0
    for (let pixel = 3; pixel < cellPixels.length; pixel += 4) {
      if (cellPixels[pixel] > 0) visiblePixels += 1
    }
    const coverage = visiblePixels / (cellWidth * cellHeight)
    const empty = nonEmptyTiles.has(index)
      ? false
      : emptyTiles.has(index) || coverage <= (puzzle.emptyTileThreshold ?? 0.004)

    return { id: index, image: fragment.toDataURL('image/png'), empty }
  })
}

function renderShell() {
  root.innerHTML = `
    <main class="game-shell">
      <header class="masthead">
        <a class="wordmark" href="#/" aria-label="Dino Bones home">DINO <span>BONES</span></a>
        <div class="puzzle-picker">
          <label for="puzzle-select">Specimen</label>
          <select id="puzzle-select"></select>
        </div>
      </header>
      <section class="game-intro" aria-labelledby="game-title">
        <p class="eyebrow">Field reconstruction</p>
        <h1 id="game-title">Put the bones back.</h1>
        <p>Reassemble the specimen by returning every fragment to its place on the field plate.</p>
      </section>
      <section class="play-area" aria-label="Puzzle workspace">
        <div class="board-panel">
          <div class="board-caption"><span>Assembly plate</span><span id="progress">0 / 0 placed</span></div>
          <div id="board" class="board" aria-label="Puzzle target board"></div>
        </div>
        <aside class="tray-panel" aria-label="Scrambled pieces">
          <div class="tray-heading">
            <div><p class="eyebrow">Loose fragments</p><h2>Specimen tray</h2></div>
            <div class="tray-actions">
              <button id="reference-button" class="icon-button" type="button" title="Show fossil reference" aria-label="Show fossil reference" aria-pressed="false">&#9673;</button>
              <button id="piece-mode-button" class="mode-button" type="button" title="Use 3 x 6 puzzle" aria-label="Use 3 x 6 puzzle">2 x 4</button>
              <button id="shuffle-button" class="icon-button" type="button" title="Shuffle fragments" aria-label="Shuffle fragments">&#10227;</button>
            </div>
          </div>
          <div id="tray" class="tray"></div>
          <p id="status" class="status" aria-live="polite">Choose a fragment and drag it onto the field plate.</p>
        </aside>
      </section>
    </main>
    <div id="drag-layer" class="drag-layer" aria-hidden="true"></div>
    <dialog id="completion-dialog" class="completion-dialog">
      <p class="eyebrow">Reconstruction complete</p>
      <h2>A whole skeleton again.</h2>
      <p id="completion-copy"></p>
      <button id="replay-button" class="primary-button" type="button">Shuffle and replay</button>
    </dialog>
  `

  const picker = select('#puzzle-select')
  picker.innerHTML = state.puzzles.map((puzzle) => `<option value="${puzzle.id}">${puzzle.name}</option>`).join('')
  picker.addEventListener('change', (event) => startPuzzle(event.target.value))
  select('#reference-button').addEventListener('click', toggleReference)
  select('#piece-mode-button').addEventListener('click', togglePieceMode)
  select('#shuffle-button').addEventListener('click', () => startPuzzle(state.puzzle.id))
  select('#replay-button').addEventListener('click', () => {
    select('#completion-dialog').close()
    startPuzzle(state.puzzle.id)
  })
}

function toggleReference() {
  state.showReference = !state.showReference
  const board = select('#board')
  const button = select('#reference-button')
  board.classList.toggle('has-reference', state.showReference)
  button.setAttribute('aria-pressed', String(state.showReference))
  button.setAttribute('aria-label', state.showReference ? 'Hide fossil reference' : 'Show fossil reference')
  button.title = state.showReference ? 'Hide fossil reference' : 'Show fossil reference'
}

function getPieceMode() {
  const modes = state.puzzle.pieceModes ?? [{ id: 'default', columns: state.puzzle.columns, rows: state.puzzle.rows, label: `${state.puzzle.rows} x ${state.puzzle.columns}` }]
  return modes.find((mode) => mode.id === state.pieceMode) ?? modes[0]
}

function updatePieceModeButton() {
  const modes = state.puzzle.pieceModes ?? [getPieceMode()]
  const mode = getPieceMode()
  const nextMode = modes[(modes.indexOf(mode) + 1) % modes.length]
  const button = select('#piece-mode-button')
  button.textContent = mode.label
  button.setAttribute('aria-label', `Use ${nextMode.label} puzzle`)
  button.title = `Use ${nextMode.label} puzzle`
}

function togglePieceMode() {
  const modes = state.puzzle.pieceModes ?? [getPieceMode()]
  const mode = getPieceMode()
  state.pieceMode = modes[(modes.indexOf(mode) + 1) % modes.length].id
  startPuzzle(state.puzzle.id)
}

function updateProgress(message) {
  select('#progress').textContent = `${state.placed} / ${state.pieces.length} placed`
  select('#status').textContent = message
}

function makePieceElement(piece) {
  const element = document.createElement('img')
  element.src = piece.image
  element.alt = ''
  element.draggable = false
  element.className = 'piece'
  element.dataset.pieceId = piece.id
  element.addEventListener('pointerdown', beginDrag)
  return element
}

function renderPuzzle() {
  const { columns, rows } = getPieceMode()
  const { image } = state.puzzle
  const board = select('#board')
  const tray = select('#tray')
  board.style.setProperty('--columns', columns)
  board.style.setProperty('--rows', rows)
  board.style.setProperty('--plate-image', `url("/puzzles/${image}")`)
  board.classList.toggle('has-reference', state.showReference)
  tray.classList.toggle('is-dense', state.pieces.length > 8)
  updatePieceModeButton()
  board.innerHTML = ''
  tray.innerHTML = ''

  state.cells.forEach((cell) => {
    const target = document.createElement('div')
    target.className = cell.empty ? 'target is-empty is-filled' : 'target'
    if (!cell.empty) target.dataset.targetId = cell.id
    target.setAttribute('aria-label', cell.empty ? `Empty slot ${cell.id + 1}` : `Target ${cell.id + 1}`)
    board.append(target)
  })

  shuffle(state.pieces).forEach((piece) => tray.append(makePieceElement(piece)))
  updateProgress('Choose a fragment and drag it onto the field plate.')
}

function beginDrag(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  const source = event.currentTarget
  const dragLayer = select('#drag-layer')
  const clone = source.cloneNode(true)
  const bounds = source.getBoundingClientRect()
  clone.className = 'piece drag-piece'
  clone.style.width = `${bounds.width}px`
  clone.style.height = `${bounds.height}px`
  dragLayer.append(clone)
  source.classList.add('is-dragging')
  state.drag = { source, clone, pieceId: Number(source.dataset.pieceId), offsetX: bounds.width / 2, offsetY: bounds.height / 2 }
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
  const { clone, offsetX, offsetY } = state.drag
  clone.style.transform = `translate(${event.clientX - offsetX}px, ${event.clientY - offsetY}px)`
}

function clearDrag() {
  if (!state.drag) return
  state.drag.source.classList.remove('is-dragging')
  state.drag.clone.remove()
  document.body.classList.remove('is-dragging')
  state.drag = null
}

function finishDrag(event) {
  const drag = state.drag
  if (!drag) return
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.target')
  if (target && Number(target.dataset.targetId) === drag.pieceId) {
    drag.source.removeEventListener('pointermove', moveDrag)
    drag.source.remove()
    const lockedPiece = document.createElement('img')
    const piece = state.pieces.find((candidate) => candidate.id === drag.pieceId)
    lockedPiece.src = piece.image
    lockedPiece.alt = ''
    lockedPiece.className = 'piece is-placed'
    target.append(lockedPiece)
    target.classList.add('is-filled')
    state.placed += 1
    clearDrag()
    if (state.placed === state.pieces.length) completePuzzle()
    else updateProgress(`${state.placed} fragment${state.placed === 1 ? '' : 's'} placed. Keep excavating.`)
    return
  }
  clearDrag()
  updateProgress('That fragment does not fit there. Try another part of the plate.')
}

function cancelDrag() {
  clearDrag()
  updateProgress('Fragment returned to the specimen tray.')
}

function completePuzzle() {
  updateProgress('All fragments placed. Specimen reconstruction complete.')
  select('#completion-copy').textContent = state.puzzle.completionMessage
  select('#completion-dialog').showModal()
}

async function startPuzzle(id) {
  const isNewPuzzle = state.puzzle?.id !== id
  state.puzzle = state.puzzles.find((puzzle) => puzzle.id === id)
  if (isNewPuzzle || !state.pieceMode || !state.puzzle.pieceModes?.some((mode) => mode.id === state.pieceMode)) {
    state.pieceMode = state.puzzle.defaultPieceMode ?? state.puzzle.pieceModes?.[0]?.id ?? 'default'
  }
  state.placed = 0
  state.cells = await createPieces({ ...state.puzzle, ...getPieceMode() })
  state.pieces = state.cells.filter((cell) => !cell.empty)
  select('#puzzle-select').value = id
  renderPuzzle()
}

export async function render(container) {
  root = container
  try {
    await loadPuzzles()
    renderShell()
    await startPuzzle(state.puzzles[0].id)
  } catch (error) {
    root.innerHTML = `<main class="error-state"><p class="eyebrow">Unable to prepare the field kit</p><h1>The puzzle files could not be loaded.</h1><p>${error.message}</p></main>`
  }
}

export function cleanup() {
  clearDrag()
  const dialog = root?.querySelector('#completion-dialog')
  if (dialog?.open) dialog.close()
  if (root) root.innerHTML = ''
  root = null
}