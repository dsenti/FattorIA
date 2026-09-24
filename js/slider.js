// Big touch slider without numbers. Pointer events + pointer capture, so dragging
// never scrolls or zooms the page. Value is 0..1. Keyboard: arrow keys, Home/End.

export class Slider {
  constructor(el, { value = 0.5, onInput = () => {}, label = '' } = {}) {
    this.el = el;
    this.onInput = onInput;
    this.value = value;
    this.enabled = true;
    el.classList.add('slider');
    el.setAttribute('role', 'slider');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', label);
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
    el.innerHTML = '<div class="slider-track"></div><div class="slider-thumb"></div>';
    this.thumb = el.querySelector('.slider-thumb');
    this.track = el.querySelector('.slider-track');
    this.dragging = false;

    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      this.dragging = true;
      el.classList.add('active');
      this._fromPointer(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (this.dragging) { e.preventDefault(); this._fromPointer(e); }
    });
    const end = () => { this.dragging = false; el.classList.remove('active'); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
    el.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const step = e.shiftKey ? 0.05 : 0.01;
      let v = this.value;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') v += step;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') v -= step;
      else if (e.key === 'Home') v = 0;
      else if (e.key === 'End') v = 1;
      else return;
      e.preventDefault();
      this.set(v, true);
    });
    this.set(value, false);
  }

  _fromPointer(e) {
    const r = this.track.getBoundingClientRect();
    this.set((e.clientX - r.left) / r.width, true);
  }

  set(v, fire) {
    this.value = Math.max(0, Math.min(1, v));
    this.thumb.style.left = `${this.value * 100}%`;
    this.el.setAttribute('aria-valuenow', String(Math.round(this.value * 100)));
    if (fire) this.onInput(this.value);
  }

  setEnabled(on) {
    this.enabled = on;
    this.el.classList.toggle('disabled', !on);
    this.el.setAttribute('aria-disabled', on ? 'false' : 'true');
  }
}
