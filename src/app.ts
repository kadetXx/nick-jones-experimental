import NormalizeWheel from "normalize-wheel";

interface IColorPair {
  background: string;
  foreground: string;
}

export class NickJones {
  container: HTMLDivElement | null;
  boxes: NodeListOf<HTMLDivElement>;
  vw: number;
  ease: number;
  frame?: number;
  gratio: number;
  beizer: string;
  timeout?: number;
  snapTarget?: number;
  spConstant: number;
  squareSize: number;
  scaleRatio: number;
  sequenceLength: number;
  content: IColorPair[];
  scroll: {
    current: number;
    target: number;
    limit: number;
  };

  constructor(content: IColorPair[]) {
    this.content = content;
    this.gratio = 1.618;
    this.spConstant = 0.2763;
    this.vw = window.innerWidth;
    this.sequenceLength = content.length;
    this.squareSize = this.vw / this.gratio;
    this.scaleRatio = (this.vw - this.squareSize) / this.squareSize;
    this.container = document.querySelector(".nj-container");
    this.boxes = document.querySelectorAll(".nj-item");
    this.beizer = "cubic-bezier(0.25, 0.1, 0.0, 1.0)";
    this.ease = 0.05;
    this.scroll = {
      current: 0,
      target: 0,
      limit: this.squareSize * content.length,
    };

    this.init();
    this.updateScroll();
    this.addEventListeners();
  }

  init(): void {
    const skrinkagePointX = window.innerWidth * this.spConstant;
    const skrinkagePointY = this.squareSize * this.spConstant;

    const originX = skrinkagePointX * Math.pow(this.gratio, 2);
    const originY = skrinkagePointY * Math.pow(this.gratio, 2);

    this.container!.style.transformOrigin = `${originX}px ${originY}px`;

    this.content.forEach((content, index) => {
      const div = this.boxes[index] ?? document.createElement("div");

      div.setAttribute("class", "nj-item");
      div.innerHTML = `
        <h2>Content ${index + 1}</h2>
      `;

      const scale = Math.pow(this.scaleRatio, index);
      const divElement = div as HTMLDivElement;

      divElement.style.cssText = `
        position: absolute;
        border: 2px solid black;
        background-color: white;
        width: ${this.squareSize / 10}rem;
        height: ${this.squareSize / 10}rem;
        transform-origin: ${originX / 10}rem ${originY / 10}rem;
        transform: rotate(${90 * index}deg) scale(${scale});
      `;

      !this.boxes.length && this.container?.appendChild(div);
    });

    this.boxes = !!this.boxes.length
      ? this.boxes
      : document.querySelectorAll(".nj-item");
  }

  updateScroll(): void {
    const { current, target, limit } = this.scroll;

    //clamp target value
    const min = (-this.squareSize * this.content.length) / 2;
    this.scroll.target = this.clamp(min, limit, target);

    // interpolate current scoll position to target
    this.scroll.current = this.lerp(current, target, this.ease);

    // update container params
    this.spinContainer();

    this.frame = window.requestAnimationFrame(this.updateScroll.bind(this));
  }

  async spinContainer() {
    const { current, limit } = this.scroll;
    const lastIndex = this.content.length - 1;

    const maxAngle = 90 * lastIndex;
    const degreeUnit = maxAngle / limit;
    const currentDegree = degreeUnit * current;

    const maxIndex = lastIndex;
    const scaleUnit = maxIndex / limit;
    const currentScale = Math.pow(this.gratio, scaleUnit * current);

    this.container!.style.transform = `rotate(${-currentDegree}deg) scale(${currentScale})`;

    const pos = Math.round((current / limit) * 100);
    const deg = (pos * maxAngle) / 100;
    const rounded = Math.round(deg / 90) * 90;

    this.snapTarget = rounded / degreeUnit;

    // switch colors
    if (rounded % 90 === 0) {
      const rotations = rounded / 90;
      const colors = this.content[rotations];

      document.body.style.backgroundColor = colors.background;
      this.boxes.forEach((item, index) => {
        item.style.backgroundColor = colors.foreground;
        item.style.color = colors.background;
        item.style.borderColor = colors.background;

        item.style.display = rotations >= index + 2 ? "none" : "grid";
      });
    }
  }

  snapScroll() {
    if (this.snapTarget === undefined) return;

    const transitionTime = 500;
    this.scroll.target = this.snapTarget;
    this.scroll.current = this.snapTarget;
    this.container!.style.transition = `transform ${transitionTime}ms ${this.beizer}`;

    setTimeout(() => {
      this.container!.style.transition = "unset";
    }, transitionTime);
  }

  onResize() {
    this.vw = window.innerWidth;
    this.squareSize = this.vw / this.gratio;
    this.scaleRatio = (this.vw - this.squareSize) / this.squareSize;
    this.scroll.limit = this.squareSize * this.content.length;

    this.init();
  }

  onMouseWheel(e: WheelEvent): void {
    const { pixelY } = NormalizeWheel(e);

    // set scroll target to mouse wheel event target
    this.scroll.target += pixelY * 0.3;

    // clear previous  timeout
    clearTimeout(this.timeout);

    // create new timeout to trigger if now new wheelEvent is detected
    this.timeout = setTimeout(() => {
      this.snapScroll();
    }, 300);
  }

  lerp(current: number, target: number, ease: number) {
    return current + (target - current) * ease;
  }

  clamp(min: number, max: number, value: number) {
    const clamped = Math.min(Math.max(value, min), max);
    return clamped;
  }

  addEventListeners() {
    document.addEventListener("wheel", e => {
      this.onMouseWheel(e);
    });

    window.onresize = () => {
      this.onResize();
    };
  }
}

new NickJones([
  { background: "#000000", foreground: "#FFFFFF" },
  { background: "#000000", foreground: "#FFFFFF" },
  { background: "#B82C33", foreground: "#2F3337" },
  { background: "#000000", foreground: "#2DBA51" },
  { background: "#6BD4FF", foreground: "#406E89" },
  { background: "#53BDAD", foreground: "#35293F" },
  { background: "#E95E4A", foreground: "#301A31" },
  { background: "#D9CCBA", foreground: "#23242E" },
  { background: "#000000", foreground: "#FFFFFF" },
]);
