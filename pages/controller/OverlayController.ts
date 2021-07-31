import { Unsubscribe } from "redux";
import { store } from "../../store";
import { SET_OVERLAY_AUTOCOLOR, SET_OVERLAY_POSITION, SET_OVERLAY_TAINTED } from "../../store/actions/overlay";
import { PIXEL_SIZE } from "../constants/painting";
import { FindNearestColor, getRGBPalette } from "../ui/modals/Converter";
import { CanvasController } from "./CanvasController";

export default class OverlayController {
  canvasController: CanvasController;
  imgUrl: string;
  position: { x: number, y: number };
  activate: boolean;
  transparency: number;
  unsubscribe: Unsubscribe;
  canvas: HTMLCanvasElement;

  constructor(canvasController: CanvasController) {
    this.canvasController = canvasController;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 0;
    this.canvas.height = 0;

    this.position = store?.getState().overlay.position || { x: 0, y: 0 };
    this.transparency = store?.getState().overlay.transparency || 50;
    this.activate = false;

    this.imgUrl = store?.getState().overlay.image || "";
    if (this.imgUrl)
      this.setImage(this.imgUrl);

    this.unsubscribe = store!.subscribe(() => {
      if (store) {
        const state = store.getState();
        const imgUrl = state.overlay.image;
        if (imgUrl !== this.imgUrl && imgUrl)
          this.setImage(imgUrl);
        if (this.activate !== state.overlay.activate) {
          this.activate = state.overlay.activate || false;
          this.canvasController.render();
        }
        if (this.transparency !== state.overlay.transparency) {
          this.transparency = state.overlay.transparency;
          this.canvasController.render();
        }
        if (this.position.x !== state.overlay.position.x || this.position.y !== state.overlay.position.y) {
          this.position = state.overlay.position;
          this.canvasController.render();
        }
        if (state.overlay.positionMouse && (this.position.x !== state.cursorPos.x || this.position.y !== state.cursorPos.y)) {
          store.dispatch({ type: SET_OVERLAY_POSITION, payload: state.cursorPos });
        }
      }
    })
  }
  destructor() {
    this.unsubscribe();
  }


  render(ctx: CanvasRenderingContext2D) {
    if (this.imgUrl && this.activate) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = this.transparency;
      const pixelSize = PIXEL_SIZE / this.canvasController.position.zoom;
      const { posX, posY } = this.canvasController.coordinatesOnCanvas(this.position.x, this.position.y);
      ctx.drawImage(this.canvas, posX, posY, this.canvas.width * pixelSize, this.canvas.height * pixelSize);
      ctx.globalAlpha = 1;
    }
  }
  setImage(imgUrl: string) {
    this.imgUrl = imgUrl;
    const img = new Image();    
    img.src = imgUrl;
    img.onload = () => {
      const ctx = this.canvas.getContext('2d');
      this.canvas.width = img.width
      this.canvas.height = img.height;

      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        this.canvasController.render();
      }
      try {
        ctx?.getImageData(0, 0, 1, 1);
        store?.dispatch({ type: SET_OVERLAY_TAINTED, payload: false });
      } catch (e) {
        store?.dispatch({ type: SET_OVERLAY_AUTOCOLOR, payload: false });
        store?.dispatch({ type: SET_OVERLAY_TAINTED, payload: true });
      }
    }
  }

  toHex(n: number) {
    const s = n.toString(16);
    return s.length === 1 ? '0' + s : s;
  }
  getColorAt(x: number, y: number) {
    const ctx = this.canvas.getContext('2d');

    if (!ctx)
      return '#000000';
    const data = ctx.getImageData(x, y, 1, 1).data;
    const palette = getRGBPalette();

    if (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 0)
      return null;

    const color = FindNearestColor([data[0], data[1], data[2]], palette);
    return ('#' + this.toHex(color[0]) + this.toHex(color[1]) + this.toHex(color[2])).toUpperCase();
  }
}