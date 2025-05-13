import {
  type ContractFunctionInteraction,
} from '@aztec/aztec.js';
import fs from 'node:fs';
import {
  type ProfileResult,
  type GateCount,
  type ProfileReport,
  type Gas,
  type GasLimits,
} from './types.js';

/**
 * Sums all numbers in an array.
 * @param arr - The array of numbers to sum.
 * @returns The sum of the numbers.
 */
function sumArray(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

/**
 * Sums DA and L2 gas components.
 * @param gas - The gas object.
 * @returns The total gas (DA + L2).
 */
function sumGas(gas: Gas): number {
  return (gas?.daGas ?? 0) + (gas?.l2Gas ?? 0);
}

/**
 * Profiles Aztec contract functions to measure gate counts and gas usage.
 */
export class Profiler {
  /**
   * Profiles a list of contract function interactions.
   * @param fsToProfile - An array of contract function interactions to profile.
   * @returns A promise that resolves to an array of profile results.
   */
  async profile(fsToProfile: ContractFunctionInteraction[]): Promise<ProfileResult[]> {
    const results: ProfileResult[] = [];
    for (const f of fsToProfile) {
      results.push(await this.#profileOne(f));
    }
    return results;
  }

  /**
   * Saves the profiling results to a JSON file.
   * If no results are provided, an empty report is saved.
   * @param results - An array of profile results to save.
   * @param filename - The name of the file to save the results to.
   */
  async saveResults(results: ProfileResult[], filename: string) {
    if (!results.length) {
      console.log(`No results to save for ${filename}. Saving empty report.`);
      fs.writeFileSync(
        filename,
        JSON.stringify({ summary: {}, results: [], gasSummary: {} } as ProfileReport, null, 2),
      );
      return;
    }

    const summary = results.reduce(
      (acc, result) => ({
        ...acc,
        [result.name]: result.totalGateCount,
      }),
      {} as Record<string, number>,
    );

    const gasSummary = results.reduce(
      (acc, result) => ({
        ...acc,
        [result.name]: result.gas
          ? sumGas(result.gas.gasLimits) + sumGas(result.gas.teardownGasLimits)
          : 0,
      }),
      {} as Record<string, number>,
    );

    const report: ProfileReport = {
      summary,
      results: results,
      gasSummary,
    };

    console.log(`Saving results for ${results.length} methods in ${filename}`);
    try {
      fs.writeFileSync(filename, JSON.stringify(report, null, 2));
    } catch (error: any) {
      console.error(`Error writing results to ${filename}:`, error.message);
      throw error;
    }
  }

  /**
   * Profiles a single contract function interaction.
   * @param f - The contract function interaction to profile.
   * @returns A promise that resolves to a profile result for the function.
   *          Returns a result with FAILED in the name and zero counts/gas if profiling errors.
   * @private
   */
  async #profileOne(f: ContractFunctionInteraction): Promise<ProfileResult> {
    let name = 'unknown_function';
    try {
      const executionPayload = await f.request();
      if (executionPayload.calls && executionPayload.calls.length > 0) {
        const firstCall = executionPayload.calls[0];
        name = firstCall?.name ?? firstCall?.selector?.toString() ?? 'unknown_function';
      } else {
        console.warn('No calls found in execution payload.');
      }
    } catch (e: any) {
      const potentialMethodName = (f as any).methodName;
      if (potentialMethodName) {
          name = potentialMethodName;
          console.warn(`Could not simulate request (${e.message}), using interaction.methodName as fallback: ${name}`);
      } else {
          console.warn(`Could not determine function name from request simulation: ${e.message}`);
      }
    }

    console.log(`Profiling ${name}...`);

    try {
      const gas: GasLimits = await f.estimateGas();
      const profileResults = await f.profile({ profileMode: 'full' });
      await f.send().wait();

      const result: ProfileResult = {
        name,
        totalGateCount: sumArray(
          profileResults.executionSteps
            .map(step => step.gateCount)
            .filter((count): count is number => count !== undefined),
        ),
        gateCounts: profileResults.executionSteps.map(step => ({
          circuitName: step.functionName,
          gateCount: step.gateCount || 0,
        })),
        gas,
      };

      const daGas = gas?.gasLimits?.daGas ?? 'N/A';
      const l2Gas = gas?.gasLimits?.l2Gas ?? 'N/A';
      console.log(` -> ${name}: ${result.totalGateCount} gates, Gas (DA: ${daGas}, L2: ${l2Gas})`);
      return result;
    } catch (error: any) {
      console.error(`Error profiling ${name}:`, error.message);
      return {
        name: `${name} (FAILED)`,
        totalGateCount: 0,
        gateCounts: [],
        gas: { gasLimits: {daGas: 0, l2Gas: 0}, teardownGasLimits: {daGas: 0, l2Gas: 0} },
      };
    }
  }
} 