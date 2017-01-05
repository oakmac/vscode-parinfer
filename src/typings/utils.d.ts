declare module "utils" {
  
  interface Atom<T> {
    update: (fn: (T) => T) => void;
    addWatch: (fn: (T) => void) => void;
    removeWatch: (fn: Function) => void;
    deref: () => T
  }

  interface LinesDiff {
    diff: number;
    same: number;
  }
}