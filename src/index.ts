import { reactive, readonly } from 'vue';

const symbolState = Symbol('vueAccessorState');

type DropFirst<T extends unknown[]> = T extends [any, ...infer U] ? U : [];

type MutationHandler<S> = (state: S, payload?: any) => void;
type GetterHandler<S> = (state: S, getters?: any) => any;

type Getters<S, G extends { [key: string]: GetterHandler<S> }> = {
  [P in keyof G]: ReturnType<G[P]>;
};
type Mutations<S, M extends { [key: string]: MutationHandler<S> }> = {
  [P in keyof M]: (...args: DropFirst<Parameters<M[P]>>) => ReturnType<M[P]>;
};
type InjectStore<
  S,
  G extends { [key: string]: (state: S) => any },
  M extends { [key: string]: MutationHandler<S> },
> = {
  state: S;
  getters: Getters<S, G>;
  mutations: Mutations<S, M>;
};

type ActionHandler<
  S,
  G extends { [key: string]: GetterHandler<S> },
  M extends { [key: string]: MutationHandler<S> },
> = (store: InjectStore<S, G, M>, payload?: any) => any;
type Actions<
  S,
  G extends { [key: string]: GetterHandler<S> },
  M extends { [key: string]: MutationHandler<S> },
  A extends {
    [key: string]: ActionHandler<S, G, M>;
  },
> = {
  [P in keyof A]: (...args: DropFirst<Parameters<A[P]>>) => ReturnType<A[P]>;
};
type Accessor<
  S,
  G extends { [key: string]: GetterHandler<S> },
  M extends { [key: string]: MutationHandler<S> },
  A extends {
    [key: string]: ActionHandler<S, G, M>;
  },
> = S & Getters<S, G> & Mutations<S, M> & Actions<S, G, M, A>;

export const getterTree = <S, T extends { [key: string]: GetterHandler<S> }>(
  _: { state: () => S },
  tree: T,
): T => tree;

export const mutationTree = <
  S,
  T extends { [key: string]: MutationHandler<S> },
>(
  _: { state: () => S },
  tree: T,
): T => tree;

export const actionTree = <
  S,
  G extends { [key: string]: GetterHandler<S> },
  M extends { [key: string]: MutationHandler<S> },
  T extends {
    [key: string]: (
      store: {
        state: S;
        getters: Getters<S, G>;
        mutations: Mutations<S, M>;
      },
      payload?: any,
    ) => any;
  },
>(
  _: { state: () => S; getters?: G; mutations?: M },
  tree: T,
): T => tree;

function makeReadOnlyProxy<T extends object>(target: T, keys: (keyof T)[]) {
  return Object.seal(
    Object.defineProperties(
      {},
      Object.fromEntries(
        keys.map((key) => [
          key,
          {
            get() {
              return target[key];
            },
          },
        ]),
      ),
    ),
  ) as T;
}

export function makeAccessor<
  S extends object,
  G extends { [key: string]: GetterHandler<S> },
  M extends { [key: string]: MutationHandler<S> },
  A extends {
    [key: string]: ActionHandler<S, G, M>;
  },
>({
  state,
  getters,
  mutations,
  actions,
}: {
  state: () => S;
  getters?: G;
  mutations?: M;
  actions?: A;
}) {
  const stateData = reactive(state() as object) as S;
  const stateKeys = Object.keys(stateData as object) as (keyof S)[];

  const accessor = Object.defineProperties(
    {},
    Object.fromEntries([
      ...(mutations
        ? Object.entries(mutations).map(([key, mutate]) => [
            key,
            {
              value(...args: any[]) {
                return mutate(stateData, ...args);
              },
              writable: false,
            },
          ])
        : []),

      ...(actions
        ? Object.entries(actions).map(([key, action]) => [
            key,
            {
              value(this: Accessor<S, G, M, A>, ...args: any[]) {
                return action(
                  {
                    state: stateProxy,
                    getters: getterProxy,
                    mutations: mutationProxy,
                  },
                  ...args,
                );
              },
              writable: false,
            },
          ])
        : []),

      ...stateKeys.map((key) => [
        key,
        {
          get() {
            return stateData[key];
          },
          configurable: true,
        },
      ]),

      ...Object.entries(getters || {}).map(([key, getter]) => [
        key,
        {
          get() {
            return getter(stateProxy, getterProxy);
          },
          configurable: true,
        },
      ]),
    ]),
  ) as Accessor<S, G, M, A>;

  const stateProxy = makeReadOnlyProxy(stateData, stateKeys) as S;
  const getterProxy = makeReadOnlyProxy(
    accessor,
    Object.keys(getters || {}),
  ) as Getters<S, G>;
  const mutationProxy = makeReadOnlyProxy(
    accessor,
    Object.keys(mutations || {}),
  ) as Mutations<S, M>;

  (accessor as any)[symbolState] = stateData;

  return accessor;
}

export function dumpState<
  S,
  G extends { [key: string]: GetterHandler<S> },
  M extends { [key: string]: MutationHandler<S> },
  A extends {
    [key: string]: ActionHandler<S, G, M>;
  },
>(accessor: Accessor<S, G, M, A>) {
  const stateData = (accessor as any)[symbolState];
  return readonly(stateData);
}

export function loadState<
  S extends object,
  G extends { [key: string]: GetterHandler<S> },
  M extends { [key: string]: MutationHandler<S> },
  A extends {
    [key: string]: ActionHandler<S, G, M>;
  },
>(accessor: Accessor<S, G, M, A>, state: S) {
  const stateData = (accessor as any)[symbolState];
  Object.keys(stateData).forEach((key) => {
    stateData[key] = state[key as keyof S];
  });
}
