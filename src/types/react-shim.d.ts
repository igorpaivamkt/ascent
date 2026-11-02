/**
 * Declarações mínimas de tipos para React 19 / react-dom.
 *
 * Por que existe: o ambiente em que o protótipo foi construído não tinha acesso ao registro npm,
 * então `@types/react` não pôde ser instalado. Este arquivo cobre apenas as APIs usadas no projeto.
 * Quando houver acesso ao npm: `npm i -D @types/react@19 @types/react-dom@19` e apague este arquivo.
 */
declare module 'react' {
  export type Key = string | number;
  export interface ReactElement {
    type: unknown;
    props: unknown;
    key: string | null;
  }
  export type ReactNode = ReactElement | string | number | bigint | boolean | null | undefined | Iterable<ReactNode>;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type DependencyList = readonly unknown[];
  export type EffectCallback = () => void | (() => void);

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useCallback<T extends (...args: never[]) => unknown>(cb: T, deps: DependencyList): T;
  export interface RefObject<T> {
    current: T;
  }
  export function useRef<T>(initial: T): RefObject<T>;
  export function useId(): string;
  export function useReducer<S, A>(reducer: (s: S, a: A) => S, initial: S): [S, Dispatch<A>];
  export interface Context<T> {
    Provider: (props: { value: T; children?: ReactNode }) => ReactNode;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(ctx: Context<T>): T;
  export function useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, getSnapshot: () => T): T;
  export function memo<P>(c: (props: P) => ReactNode): (props: P) => ReactNode;
  export function lazy<P>(f: () => Promise<{ default: (props: P) => ReactNode }>): (props: P) => ReactNode;
  export const Fragment: (props: { children?: ReactNode }) => ReactNode;
  export const StrictMode: (props: { children?: ReactNode }) => ReactNode;
  export const Suspense: (props: { children?: ReactNode; fallback?: ReactNode }) => ReactNode;

  export type CSSProperties = { [key: string]: string | number | undefined };
  export interface SyntheticEvent<T = Element> {
    target: EventTarget & T;
    currentTarget: T;
    preventDefault(): void;
    stopPropagation(): void;
  }
  export type FormEvent<T = Element> = SyntheticEvent<T>;
  export type ChangeEvent<T = Element> = SyntheticEvent<T>;
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    key: string;
    shiftKey: boolean;
  }
  export interface MouseEvent<T = Element> extends SyntheticEvent<T> {
    clientX: number;
    clientY: number;
  }
  export interface SVGAttributes<_T> {
    [attr: string]: unknown;
  }
  export type FC<P = object> = (props: P) => ReactNode;
  export type PropsWithChildren<P = object> = P & { children?: ReactNode };

  /** Atributos de elementos nativos: tipagem leve, com eventos tipados para os campos de formulário. */
  export interface DOMAttributes<T> {
    [attr: string]: unknown;
    children?: ReactNode;
    onChange?(e: ChangeEvent<T>): void;
    onInput?(e: ChangeEvent<T>): void;
    onClick?(e: MouseEvent<T>): void;
    onMouseDown?(e: MouseEvent<T>): void;
    onBlur?(e: SyntheticEvent<T>): void;
    onFocus?(e: SyntheticEvent<T>): void;
    onKeyDown?(e: KeyboardEvent<T>): void;
    onSubmit?(e: FormEvent<T>): void;
  }

  export namespace JSX {
    type Element = ReactElement;
    type ElementType = string | ((props: never) => ReactNode);
    interface IntrinsicElements {
      input: DOMAttributes<HTMLInputElement>;
      select: DOMAttributes<HTMLSelectElement>;
      textarea: DOMAttributes<HTMLTextAreaElement>;
      [el: string]: DOMAttributes<HTMLElement>;
    }
    interface IntrinsicAttributes {
      key?: Key | null;
    }
    interface ElementChildrenAttribute {
      children: object;
    }
  }
}

declare module 'react/jsx-runtime' {
  export { JSX } from 'react';
  export const jsx: unknown;
  export const jsxs: unknown;
  export const Fragment: unknown;
}

declare module 'react-dom/client' {
  import type { ReactNode } from 'react';
  export function createRoot(el: Element): { render(node: ReactNode): void; unmount(): void };
}

declare module 'react-dom' {
  import type { ReactNode } from 'react';
  export function createPortal(node: ReactNode, container: Element): ReactNode;
  export function flushSync<T>(fn: () => T): T;
}

declare const __APP_VERSION__: string;
declare const __DEV__: boolean;
