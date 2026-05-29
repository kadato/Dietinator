/**
 * Metro 0.83+ calls os.availableParallelism() (Node >= 18.14 / 19.7).
 * Must be loaded before @expo/cli / Metro start (metro.config.js loads too late).
 */
const os = require('os');

if (typeof os.availableParallelism !== 'function') {
  os.availableParallelism = () => Math.max(1, os.cpus()?.length ?? 1);
}
