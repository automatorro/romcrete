// opentype.js 2.x nu vine cu tipuri; declarăm doar ce folosim.
declare module "opentype.js" {
  export interface PathCommand {
    type: "M" | "L" | "Q" | "C" | "Z";
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
  }
  export interface Path {
    commands: PathCommand[];
  }
  export interface Font {
    getAdvanceWidth(text: string, fontSize?: number): number;
    getPath(text: string, x: number, y: number, fontSize: number): Path;
  }
  export function parse(buffer: ArrayBuffer): Font;
  // Varianta CommonJS (UMD) expune același obiect și sub `default`.
  const defaultExport: { parse(buffer: ArrayBuffer): Font };
  export { defaultExport as default };
}
