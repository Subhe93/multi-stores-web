// STUB (owner: B4). Page curtain between brand pages, see the contract
// section 4.11. The foundation ships an inert handle with the final
// interfaces so the store runtime compiles.

export interface CurtainOptions {
  push(href: string): void;
  prefetch(href: string): void;
  isBrandPath(pathname: string): boolean;
  label: string;
  logoUrl?: string;
}

export interface CurtainHandle {
  /** The destination route rendered: the panel may lift. */
  arrived(): void;
  destroy(): void;
}

export function mountCurtain(opts: CurtainOptions): CurtainHandle {
  void opts;
  return { arrived() {}, destroy() {} };
}
