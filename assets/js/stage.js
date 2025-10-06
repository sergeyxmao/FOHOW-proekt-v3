export function mountStage(el, store) {
  el.innerHTML = `
    <div id="stage" class="stage">
      <div id="canvas" class="canvas"></div>
      <svg id="svg-layer" class="svg-layer" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
  `;

  const stageEl = el.querySelector("#stage");

  function apply(state) {
    stageEl.classList.toggle("grid-on", !!state.modes.guides);
    // тут дальше будем рендерить карточки/линии в M4–M6
  }

  apply(store.get());
  const unsub = store.onChange(apply);
  return () => unsub();
}
