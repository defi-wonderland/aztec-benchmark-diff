# Aztec Benchmark Diff GitHub Action

This GitHub Action automatically runs benchmarks for Aztec contracts, compares the results against a baseline, and generates a Markdown report highlighting performance changes (gas usage, gate counts). It's designed to be integrated into CI/CD workflows to monitor performance regressions or improvements in pull requests.

## How it Works

1.  **Benchmark Execution:** The action discovers benchmark definition files (`*.benchmark.ts`) within a `benchmarks/` directory in your repository root. It executes these scripts, which typically involve setting up contract state and calling specific functions using `@aztec/aztec.js`. Results are saved as `*.benchmark_latest.json`.
2.  **Comparison:** It looks for corresponding baseline files (`*.benchmark.json`) and compares the metrics (gate counts, DA gas, L2 gas) between the baseline and the latest run.
3.  **Reporting:** A Markdown report (`benchmark_diff.md` by default) is generated, summarizing the comparisons with status indicators for regressions, improvements, or significant changes based on a configurable threshold.

## Usage

Integrate this action into your GitHub Actions workflow file (e.g., `.github/workflows/benchmark.yml`). You'll typically want to run it on pull requests targeting your main branch.

```yaml
name: Benchmark Comparison

on:
  pull_request:
    # Optionally specify paths if benchmarks should only run when relevant files change
    # paths:
    #   - 'contracts/**'
    #   - 'benchmarks/**'

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          # Fetch depth 0 to allow checkout of the base branch for comparison
          fetch-depth: 0

      # Add steps here to build your contracts and set up any necessary
      # environment for Aztec.js (e.g., installing dependencies, setting up PXE)
      # Make sure the baseline *.benchmark.json files are available

      - name: Run Benchmark and Compare
        id: benchmark # Give the step an ID to easily reference the report path
        uses: ./ # Use the local action path if it's in the same repo
        # Or use <your-org>/aztec-benchmark-diff@<version> if published
        # Configuration is primarily read from Nargo.toml

      # Example: Post report to PR using peter-evans/create-or-update-comment
      - name: Post Benchmark Report to PR
        uses: peter-evans/create-or-update-comment@v4
        with:
          # Read the report content. Use default path or get from Nargo.toml if customized.
          # This example assumes the default report path 'benchmark_diff.md'
          # You might need a step before this to read the actual path from Nargo.toml if it's dynamic.
          body-path: benchmark_diff.md
          # Use a consistent marker to find and update the comment
          issue-number: ${{ github.event.pull_request.number }}
          # Update existing comment if found, otherwise create a new one
          edit-mode: upsert
```

## Configuration

-   **`Nargo.toml`:** Basic configuration like the `regression_threshold_percentage` and `report_path` can be set in the `[benchmark]` section of your `Nargo.toml` file at the repository root. If these values are not present, defaults will be used (threshold: 10%, report path: `benchmark_diff.md`).

    ```toml
    # Nargo.toml (at the root of the consuming repository)

    [benchmark]
    # Optional: Define the percentage change considered a regression.
    # Default is 10 (meaning 10%)
    regression_threshold_percentage = 5

    # Optional: Specify the output filename for the markdown report.
    # Default is "benchmark_diff.md"
    report_path = "benchmarks/performance_report.md"
    ```

-   **Benchmark Scripts (`benchmarks/*.benchmark.ts`):** Each script defines how to benchmark a specific contract. It should export a `benchmarkConfig` object containing:
    -   An optional async `setup` function to prepare the environment (e.g., deploy contracts, get wallet).
    -   A required `getMethods` function that returns an array of `ContractFunctionInteraction` objects to be profiled.
-   **Baseline Results (`benchmarks/*.benchmark.json`):** These files contain the benchmark results from the base branch (e.g., `main`) and are used as the reference for comparison. You typically generate/update these when merging performance improvements to the base branch.

See the action's implementation details for more advanced configuration options or specific requirements.
=======
# Aztec Benchmark
[![npm version](https://badge.fury.io/js/%40defi-wonderland%2Faztec-benchmark.svg)](https://www.npmjs.com/package/@defi-wonderland/aztec-benchmark)

**CLI tool for running Aztec contract benchmarks.**

Use this tool to execute benchmark files written in TypeScript. For comparing results and generating reports in CI, use the separate companion GitHub Action: [`defi-wonderland/aztec-benchmark`](https://github.com/defi-wonderland/aztec-benchmark).

## Table of Contents

- [Installation](#installation)
- [CLI Usage](#cli-usage)
  - [Configuration (`Nargo.toml`)](#configuration-nargotoml)
  - [Options](#options)
  - [Examples](#examples)
- [Writing Benchmarks](#writing-benchmarks)
- [Benchmark Output](#benchmark-output)
- [Action Usage](#action-usage)
  - [Inputs](#inputs)
  - [Outputs](#outputs)
  - [Example Usage (in PR workflow)](#example-usage-in-pr-workflow)

---

## Installation

```sh
yarn add --dev @defi-wonderland/aztec-benchmark
# or
npm install --save-dev @defi-wonderland/aztec-benchmark
```

---

## CLI Usage

After installing, run the CLI using `npx aztec-benchmark`. By default, it looks for a `Nargo.toml` file in the current directory and runs benchmarks defined within it.

```sh
npx aztec-benchmark [options]
```

### Configuration (`Nargo.toml`)

Define which contracts have associated benchmark files in your `Nargo.toml` under the `[benchmark]` section:

```toml
[benchmark]
token = "benchmarks/token_contract.benchmark.ts"
another_contract = "path/to/another.benchmark.ts"
```

The paths to the `.benchmark.ts` files are relative to the `Nargo.toml` file.

### Options

- `-c, --contracts <names...>`: Specify which contracts (keys from the `[benchmark]` section) to run. If omitted, runs all defined benchmarks.
- `--config <path>`: Path to your `Nargo.toml` file (default: `./Nargo.toml`).
- `-o, --output-dir <path>`: Directory to save benchmark JSON reports (default: `./benchmarks`).
- `-s, --suffix <suffix>`: Optional suffix to append to report filenames (e.g., `_pr` results in `token_pr.benchmark.json`).

### Examples

Run all benchmarks defined in `./Nargo.toml`:
```sh
npx aztec-benchmark 
```

Run only the `token` benchmark:
```sh
npx aztec-benchmark --contracts token
```

Run `token` and `another_contract` benchmarks, saving reports with a suffix:
```sh
npx aztec-benchmark --contracts token another_contract --output-dir ./benchmark_results --suffix _v2
```

---

## Writing Benchmarks

Benchmarks are TypeScript classes extending `BenchmarkBase` from this package.
Each entry in the array returned by `getMethods` can either be a plain `ContractFunctionInteraction` 
(in which case the benchmark name is auto-derived) or a `NamedBenchmarkedInteraction` object 
(which includes the `interaction` and a custom `name` for reporting).

```ts
import {
  Benchmark, // Alias for BenchmarkBase
  type BenchmarkContext, 
  type NamedBenchmarkedInteraction 
} from '@defi-wonderland/aztec-benchmark';
import {
  type AccountWallet,
  type ContractFunctionInteraction,
  type PXE,
  type Contract, // Generic Contract type from Aztec.js
  createPXEClient, // Example import
  getInitialTestAccountsWallets // Example import
} from '@aztec/aztec.js';
// import { YourSpecificContract } from '../artifacts/YourSpecificContract.js'; // Replace with your actual contract artifact

// 1. Define a specific context for your benchmark (optional but good practice)
interface MyBenchmarkContext extends BenchmarkContext {
  pxe: PXE;
  deployer: AccountWallet;
  contract: Contract; // Use the generic Contract type or your specific contract type
}

export default class MyContractBenchmark extends Benchmark {
  // Runs once before all benchmark methods.
  async setup(): Promise<MyBenchmarkContext> {
    console.log('Setting up benchmark environment...');
    const pxe = createPXEClient(process.env.PXE_URL || 'http://localhost:8080');
    const [deployer] = await getInitialTestAccountsWallets(pxe);
    
    //  Deploy your contract (replace YourSpecificContract with your actual contract class)
    const deployedContract = await YourSpecificContract.deploy(deployer, /* constructor args */).send().deployed();
    const contract = await YourSpecificContract.at(deployedContract.address, deployer);
    console.log('Contract deployed at:', contract.address.toString());

    return { pxe, deployer, contract }; 
  }

  // Returns an array of interactions to benchmark. 
  async getMethods(context: MyBenchmarkContext): Promise<Array<ContractFunctionInteraction | NamedBenchmarkedInteraction>> {
    // Ensure context is available (it should be if setup ran correctly)
    if (!context || !context.contract) {
      // In a real scenario, setup() must initialize the context properly.
      // Throwing an error or returning an empty array might be appropriate here if setup failed.
      console.error("Benchmark context or contract not initialized in setup(). Skipping getMethods.");
      return [];
    }
    
    const { contract, deployer } = context;
    const recipient = deployer.getAddress(); // Example recipient

    // Replace `contract.methods.someMethodName` with actual methods from your contract.
    const interactionPlain = contract.methods.transfer(recipient, 100n); 
    const interactionNamed1 = contract.methods.someOtherMethod("test_value_1");
    const interactionNamed2 = contract.methods.someOtherMethod("test_value_2");

    return [
      // Example of a plain interaction - name will be auto-derived
      interactionPlain,
      // Example of a named interaction
      { interaction: interactionNamed1, name: "Some Other Method (value 1)" }, 
      // Another named interaction
      { interaction: interactionNamed2, name: "Some Other Method (value 2)" }, 
    ];
  }

  // Optional cleanup phase
  async teardown(context: MyBenchmarkContext): Promise<void> {
    console.log('Cleaning up benchmark environment...');
    if (context && context.pxe) { 
      await context.pxe.stop(); 
    }
  }
}
```

**Note:** Your benchmark code needs a valid Aztec project setup to interact with contracts.
Your `BenchmarkBase` implementation is responsible for constructing the `ContractFunctionInteraction` objects.
If you provide a `NamedBenchmarkedInteraction` object, its `name` field will be used in reports. 
If you provide a plain `ContractFunctionInteraction`, the tool will attempt to derive a name from the interaction (e.g., the method name).

### Wonderland's Usage Example

You can find how we use this tool for benchmarking our Aztec contracts in [`aztec-standards`](https://github.com/defi-wonderland/aztec-standards/tree/dev/benchmarks).

---

## Benchmark Output

Your `BenchmarkBase` implementation is responsible for measuring and outputting performance data (e.g., as JSON). The comparison action uses this output.
Each entry in the output will be identified by the custom `name` you provided (if any) or the auto-derived name.

--- 

## Action Usage

This repository includes a GitHub Action (defined in `action/action.yml`) designed for CI workflows. It automatically finds and compares benchmark results (conventionally named with `_base` and `_latest` suffixes) generated by previous runs of `aztec-benchmark` and produces a Markdown comparison report.

### Inputs

- `threshold`: Regression threshold percentage (default: `2.5`).
- `output_markdown_path`: Path to save the generated Markdown comparison report (default: `benchmark-comparison.md`).

### Outputs

- `comparison_markdown`: The generated Markdown report content.
- `markdown_file_path`: Path to the saved Markdown file.

### Example Usage (in PR workflow)

This action is typically used in a workflow that runs on pull requests. It assumes a previous step or job has already run the benchmarks on the base commit and saved the results with the `_base` suffix (e.g., in `./benchmarks/token_base.benchmark.json`).

**Workflow Steps:**
1. Checkout the base branch/commit.
2. Run `npx aztec-benchmark -s _base` (saving outputs to `./benchmarks`).
3. Checkout the PR branch/current commit.
4. Use this action (`./action`), which will:
   a. Run `npx aztec-benchmark -s _latest` to generate current benchmarks.
   b. Compare the new `_latest` files against the existing `_base` files.
   c. Generate the Markdown report.

```yaml
# Example steps within a PR workflow job:

# (Assume previous steps checked out base, ran benchmarks with _base suffix, 
#  and artifacts/reports are available, potentially via actions/upload-artifact 
#  and actions/download-artifact if run in separate jobs)

- name: Checkout Current Code
  uses: actions/checkout@v4

# (Ensure Nargo.toml and benchmark dependencies are set up)
- name: Install Dependencies
  run: yarn install --frozen-lockfile

- name: Generate Latest Benchmarks, Compare, and Create Report
  # This action runs 'aztec-benchmark -s _latest' internally
  uses: defi-wonderland/aztec-benchmark-diff/action 
  id: benchmark_compare
  with:
    threshold: '2.0' # Optional threshold
    output_markdown_path: 'benchmark_diff.md' # Optional output path

- name: Comment Report on PR
  uses: peter-evans/create-or-update-comment@v4
  with:
    issue-number: ${{ github.event.pull_request.number }}
    body-file: ${{ steps.benchmark_compare.outputs.markdown_file_path }}
```

Refer to the `action/action.yml` file for the definitive inputs and description.
