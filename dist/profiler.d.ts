import { type ContractFunctionInteraction } from '@aztec/aztec.js';
import { type ProfileResult } from './types.js';
/**
 * Profiles Aztec contract functions to measure gate counts and gas usage.
 */
export declare class Profiler {
    #private;
    /**
     * Profiles a list of contract function interactions.
     * @param fsToProfile - An array of contract function interactions to profile.
     * @returns A promise that resolves to an array of profile results.
     */
    profile(fsToProfile: ContractFunctionInteraction[]): Promise<ProfileResult[]>;
    /**
     * Saves the profiling results to a JSON file.
     * If no results are provided, an empty report is saved.
     * @param results - An array of profile results to save.
     * @param filename - The name of the file to save the results to.
     */
    saveResults(results: ProfileResult[], filename: string): Promise<void>;
}
