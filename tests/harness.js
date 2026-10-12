/* Küçük test çalıştırıcı — hem tarayıcıda (tests/index.html) hem Node'da çalışır. */

const registry = [];

export function test(name, fn) {
  registry.push({ name, fn });
}

export function eq(actual, expected, label = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label ? label + ': ' : ''}beklenen ${e}, gelen ${a}`);
}

export function ok(cond, label = 'koşul sağlanmadı') {
  if (!cond) throw new Error(label);
}

export async function run() {
  const results = [];
  for (const { name, fn } of registry) {
    try {
      await fn();
      results.push({ name, pass: true });
    } catch (err) {
      results.push({ name, pass: false, error: err.message });
    }
  }
  return results;
}
