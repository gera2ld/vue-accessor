import {
  actionTree,
  getterTree,
  makeAccessor,
  mutationTree,
  dumpState,
  loadState,
} from '../src/index';

test('accessor', () => {
  const defState = () => ({
    value: 0,
  });

  const defMutations = mutationTree(
    { state: defState },
    {
      increase(state) {
        state.value++;
      },
      addUp(state, delta: number) {
        state.value += delta;
      },
    },
  );

  const defGetters = getterTree(
    { state: defState },
    {
      double(state) {
        return state.value * 2;
      },
    },
  );

  const defActions = actionTree(
    { state: defState, getters: defGetters, mutations: defMutations },
    {
      rock({ state, getters, mutations }) {
        // change value through `mutations`, don't modify `state` directly
        mutations.increase();
        // check the latest values
        console.log(state.value, getters.double);
      },
      rockPayload({ mutations }, delta: number) {
        mutations.addUp(delta);
      },
    },
  );

  const accessor = makeAccessor({
    state: defState,
    mutations: defMutations,
    getters: defGetters,
    actions: defActions,
  });

  // Now you can access everything from `accessor`
  expect(accessor.value).toBe(0);
  expect(accessor.double).toBe(0);
  accessor.increase();
  expect(accessor.value).toBe(1);
  expect(accessor.double).toBe(2);
  accessor.addUp(5);
  expect(accessor.value).toBe(6);
  expect(accessor.double).toBe(12);

  // Not allowed to modify state directly
  expect(() => {
    accessor.value += 1;
  }).toThrow();

  expect(dumpState(accessor)).toEqual({
    value: 6,
  });

  loadState(accessor, {
    value: 2,
  });
  expect(accessor.value).toBe(2);
  expect(accessor.double).toBe(4);
});
