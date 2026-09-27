export function render(root) {
  root.innerHTML = `
    <main class="activity-home">
      <header class="masthead">
        <a class="wordmark" href="#/" aria-label="Dino Bones home">DINO <span>BONES</span></a>
        <p class="home-label">Museum field lab</p>
      </header>
      <section class="home-intro" aria-labelledby="home-title">
        <p class="eyebrow">Choose an activity</p>
        <h1 id="home-title">Where will the evidence lead?</h1>
        <p>Explore dinosaurs through reconstruction and place. Pick a field activity to begin.</p>
      </section>
      <nav class="activity-grid" aria-label="Field activities">
        <a class="activity-card activity-card-assemble" href="#/assemble-skeleton">
          <span class="activity-number">01</span>
          <div>
            <p class="eyebrow">Field reconstruction</p>
            <h2>Assemble the skeleton</h2>
            <p>Put fossil fragments back into a complete dinosaur skeleton.</p>
          </div>
          <span class="activity-arrow" aria-hidden="true">&rarr;</span>
        </a>
        <a class="activity-card activity-card-map" href="#/place-on-map">
          <span class="activity-number">02</span>
          <div>
            <p class="eyebrow">Ancient geography</p>
            <h2>Place on the map</h2>
            <p>Match dinosaurs to the continents where their fossils have been found.</p>
          </div>
          <span class="activity-arrow" aria-hidden="true">&rarr;</span>
        </a>
      </nav>
    </main>
  `
}