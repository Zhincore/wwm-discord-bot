/**
 * Improved type definitions for global objects.
 */

declare global {
  interface ObjectConstructor {
    keys<T extends Record<any, any>>(obj: T): (keyof T)[];
    values<T extends Record<any, any>>(obj: T): T[keyof T][];
    entries<T extends Record<any, any>>(obj: T): [keyof T, T[keyof T]][];
    fromEntries<Entries extends [PropertyKey, unknown][]>(
      entries: Entries,
    ): { [I in keyof Entries as Entries[I][0]]: Entries[I][1] };
  }

  interface Array<T> {
    filter<R = T>(
      predicate: (value: T, index: number, array: T[]) => value is R,
    ): R[];
    filter(
      predicate: (value: T, index: number, array: T[]) => T,
    ): NonFalse<T>[];

    includes(searchElement: unknown, fromIndex?: number): searchElement is T;
  }
  interface ReadonlyArray<T> {
    filter<R = T>(
      predicate: (value: T, index: number, array: T[]) => value is R,
    ): R[];
    filter(
      predicate: (value: T, index: number, array: T[]) => T,
    ): NonFalse<T>[];

    includes(searchElement: unknown, fromIndex?: number): searchElement is T;
  }

  interface ArrayConstructor {
    isArray<T>(arg: unknown): arg is T[];
  }

  interface Function {
    bind<
      P,
      T extends (this: P, ...args: any[]) => any,
      ProvidedArgs extends Partial<Parameters<T>>,
    >(
      this: T,
      thisArg: P,
      ...argArray: ProvidedArgs
    ): (
      ...args: Parameters<T> extends [...ProvidedArgs, ...infer Rest]
        ? Rest
        : Parameters<T>
    ) => ReturnType<T>;
    call<T extends (...args: any[]) => any>(
      this: T,
      thisArg: ThisParameterType<T>,
      ...argArray: Parameters<T>
    ): ReturnType<T>;
    apply<T extends (...args: any[]) => any>(
      this: T,
      thisArg: ThisParameterType<T>,
      argArray: Parameters<T>,
    ): ReturnType<T>;
  }
}

type NonFalse<T> = Exclude<T, null | undefined | false | 0 | ''>;

export {};
