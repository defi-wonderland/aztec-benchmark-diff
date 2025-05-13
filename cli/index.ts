// Export the base class and types for users
export { BenchmarkBase as Benchmark, BenchmarkContext } from './types.js'; // Alias BenchmarkBase to Benchmark for user convenience
export type { ProfileReport, ProfileResult, GateCount } from './types.js';

// Also export the Profiler for potential advanced use (or internal use by CLI)
export { Profiler } from './profiler.js';