import NormalizeWheel from "normalize-wheel";

interface IColorPair {
  background: string;
  foreground: string;
}

export class NickJones {
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
  boxes: NodeListOf<HTMLDivElement>;
  container: HTMLDivElement | null;
  scroll: {
    current: number;
    target: number;
    limit: number;
  };

  constructor(content: IColorPair[]) {
    this.content = content;
    this.vw = window.innerWidth;
    this.sequenceLength = content.length;

    this.gratio = 1.618; // golden ratio constant
    this.spConstant = 0.2763; // shrinkage point constant (see resources in readme)
    this.squareSize = this.vw / this.gratio; // width of main square
    this.scaleRatio = (this.vw - this.squareSize) / this.squareSize; // % difference in box sizes

    this.container = document.querySelector(".nj-container");
    this.boxes = document.querySelectorAll(".nj-item");
    this.beizer = "cubic-bezier(0.25, 0.1, 0.0, 1.0)";
    this.ease = 0.05;

    /**
     * stores scroll values on user scroll to enable
     * reading scroll position and also transitioning scroll manually
     */
    this.scroll = {
      current: 0,
      target: 0,
      limit: this.squareSize * content.length,
    };

    /** triggering starter methods */
    this.init();
    this.updateScroll();
    this.addEventListeners();
  }

  init(): void {
    /** shrinkage points X and Y are the
     * approximate cordinates for spirals's origin
     * check resources for formula
     * */
    const skrinkagePointX = window.innerWidth * this.spConstant;
    const skrinkagePointY = this.squareSize * this.spConstant;

    /**
     * transform origins X and Y for the squares is
     * gotten by multiplying shrinkage points by
     * the square of the golden ratio.
     * multiplying by just the golden ratio results
     * in a cone-shaped maze-grid or sort of
     */
    const originX = skrinkagePointX * Math.pow(this.gratio, 2);
    const originY = skrinkagePointY * Math.pow(this.gratio, 2);

    /** setting the transform origin of the boxes'
     * container because we'll be spinning it later on
     * */
    this.container!.style.transformOrigin = `${originX}px ${originY}px`;

    this.content.forEach((_, index) => {
      const div = this.boxes[index] ?? document.createElement("div");

      div.setAttribute("class", "nj-item");
      div.innerHTML = `
        <h2 class='nj-heading'>Content ${index + 1}</h2>
      `;

      /**
       * scaling each box by our
       * scaleRatio to the power of it's index
       * */
      const scale = Math.pow(this.scaleRatio, index);

      /**
       * here we're applying basic styling to each div
       * as well as setting transform origins (which we calculated earlier up there),
       * rotation (which is basically 90deg * box's index)
       * and finally, scale (which we've also calculated up here)
       */
      div.style.cssText = `
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

    /** making sure this.boxes is
     * initialized so we can use it
     * in other class methods
     * */
    this.boxes = !!this.boxes.length
      ? this.boxes
      : document.querySelectorAll(".nj-item");
  }

  updateScroll(): void {
    const { current, target, limit } = this.scroll;

    /** clamps target scroll value and updates
     * target scroll value with clamped value
     * */
    const min = (-this.squareSize * this.content.length) / 2;
    this.scroll.target = this.clamp(min, limit, target);

    /** gradually transitions from
     * current scroll value to taret
     * scroll value using interpolation
     * */
    this.scroll.current = this.lerp(current, target, this.ease);

    /** creates an animation frame (commonly 60fps)
     * to continuosly update scroll values as scroll events are triggered
     * */
    this.frame = window.requestAnimationFrame(this.updateScroll.bind(this));

    /** calls function to spin according to scroll values */
    this.spinContainer();
  }

  async spinContainer() {
    /** remember that this function is repeatedly
     * called about 60x per second due to the
     * animation frame we setup earlier
     * */
    const { current, limit } = this.scroll;
    const lastBoxIndex = this.content.length - 1;

    /**
     * to get the value by which we should rotate the
     * boxes' container, we're basically mapping/scaling
     * the value of total rotation to the value of total scroll,
     */
    const maxAngle = 90 * lastBoxIndex;
    const degreeUnit = maxAngle / limit;
    const currentDegree = degreeUnit * current;

    /**
     * we're also mapping/scaling the value of
     * total scroll to the value of total scale sizes here.
     * these one's are a bit tricky tho, I can't type everything
     * about the logic behind
     */
    const maxIndex = lastBoxIndex;
    const scaleUnit = maxIndex / limit;
    const currentScale = Math.pow(this.gratio, scaleUnit * current);

    /** this is where the magic happens,
     * from the origins we calculated earlier, we're rotating
     * and scaling the container according to scroll values
     * */
    this.container!.style.transform = `rotate(${-currentDegree}deg) scale(${currentScale})`;

    /** calculating percentage of total scrollable
     * height that we've scrolled already and then using
     * it to find out how many degrees we've spinned already
     * */
    const scrolledPercentage = Math.round((current / limit) * 100);
    const deg = (scrolledPercentage * maxAngle) / 100;

    /** we're getting the closest 90deg to our
     * current rotation and then using it to get the
     * scroll position we need to move to in order
     * to maintain an upright rotation
     * */
    const closest90Deg = Math.round(deg / 90) * 90;
    this.snapTarget = closest90Deg / degreeUnit;

    /** when we move to a new upright rotation,
     * we want to switch the background colors
     * */
    if (closest90Deg % 90 === 0) {
      const rotations = closest90Deg / 90;
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

  /** re-initializes viewport dependent values */
  onResize() {
    this.vw = window.innerWidth;
    this.squareSize = this.vw / this.gratio;
    this.scaleRatio = (this.vw - this.squareSize) / this.squareSize;
    this.scroll.limit = this.squareSize * this.content.length;

    this.init();
  }

  onMouseWheel(e: WheelEvent): void {
    /** sets scroll target to distance scrolled
     * by the mouse wheel event. PS: we're slowing the scroll
     * speed here by about 30% because I thougt it was too fast
     * */
    const { pixelY } = NormalizeWheel(e);
    this.scroll.target += pixelY * 0.3;

    /**
     * clears timeout that was set below on
     * previous call because a new scroll event is hapenning
     */
    clearTimeout(this.timeout);

    /**
     * this timeout triggers if no new wheelEvent
     * happens and cancels it, this indicates that
     * the scroll has ended and we can now snap our scroll values
     */
    this.timeout = setTimeout(() => {
      this.snapScroll();
    }, 300);
  }

  // interpolates values to create smooth transition
  lerp(current: number, target: number, ease: number) {
    return current + (target - current) * ease;
  }

  // prevents value from exceeding min and max limits
  clamp(min: number, max: number, value: number) {
    return Math.min(Math.max(value, min), max);
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
  { background: "#CA90DE", foreground: "#45316D" },
  { background: "#000000", foreground: "#FFFFFF" },
  { background: "#B82C33", foreground: "#2F3337" },
  { background: "#000000", foreground: "#2DBA51" },
  { background: "#6BD4FF", foreground: "#406E89" },
  { background: "#53BDAD", foreground: "#35293F" },
  { background: "#E95E4A", foreground: "#301A31" },
  { background: "#D9CCBA", foreground: "#23242E" },
  { background: "#000000", foreground: "#FFFFFF" },
]);
