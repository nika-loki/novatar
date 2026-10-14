/** Minimal type shims for untyped pure-JS encoders. */

declare module 'upng-js' {
  const UPNG: {
    /** Encode APNG/PNG from RGBA frame buffers. cnum 0 keeps RGBA. */
    encode(
      frames: Array<ArrayBuffer | Uint8Array>,
      width: number,
      height: number,
      cnum: number,
      delays: number[],
    ): ArrayBuffer
    decode(buffer: ArrayBuffer): { width: number; height: number; depth: number; frames: unknown[] }
  }
  export default UPNG
}

declare module 'gifenc' {
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string; oneBitAlpha?: boolean | number; clearAlpha?: boolean },
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: string,
  ): Uint8Array
  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: number[][]
        delay?: number
        repeat?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
        first?: boolean
      },
    ) => void
    finish: () => void
    bytes: () => Uint8Array
    bytesView: () => Uint8Array
    reset: () => void
  }
}
