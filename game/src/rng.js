// Seeded randomness (xorshift32). Same seed, same city — which is what makes
// the screenshot scenes repeatable frame for frame, and what keeps a playtest
// honest: nothing in the world is secretly different between two runs.
export function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  function float() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  }
  return {
    float,
    /** Random number in [min, max). */
    range(min, max) {
      return min + float() * (max - min);
    },
    /** Random whole number in [min, max]. */
    int(min, max) {
      return min + Math.floor(float() * (max - min + 1));
    },
    /** Random element of a list. */
    from(list) {
      return list[Math.floor(float() * list.length)];
    },
    /** True with probability p. */
    chance(p) {
      return float() < p;
    },
  };
}
