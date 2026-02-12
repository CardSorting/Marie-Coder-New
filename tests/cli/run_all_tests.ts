#!/usr/bin/env node
import { spawn } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TestResult {
    name: string;
    passed: boolean;
    output: string;
    error?: string;
}

const testFiles = [
    'test_storage.ts',
    'test_joy_services.ts',
    'test_tool_definitions.ts',
    'test_marie_cli.ts'
];

async function runTest(testFile: string): Promise<TestResult> {
    return new Promise((resolve) => {
        const testPath = path.join(__dirname, testFile);
        const child = spawn('node', ['--loader', 'ts-node/esm', testPath], {
            cwd: path.join(__dirname, '../..'),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            resolve({
                name: testFile,
                passed: code === 0,
                output: output,
                error: errorOutput || undefined
            });
        });

        child.on('error', (err) => {
            resolve({
                name: testFile,
                passed: false,
                output: output,
                error: err.message
            });
        });
    });
}

async function runAllTests() {
    console.log('🧪 Running Marie CLI Test Suite\n');
    console.log('='.repeat(50));
    console.log();

    const results: TestResult[] = [];

    for (const testFile of testFiles) {
        console.log(`\n📋 Running ${testFile}...`);
        console.log('-'.repeat(50));

        const result = await runTest(testFile);
        results.push(result);

        // Print output
        if (result.output) {
            console.log(result.output);
        }

        if (result.error) {
            console.error('STDERR:', result.error);
        }

        // Print status
        if (result.passed) {
            console.log(`\n✅ ${testFile} PASSED`);
        } else {
            console.log(`\n❌ ${testFile} FAILED`);
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('\n📊 TEST SUMMARY\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(result => {
        const icon = result.passed ? '✅' : '❌';
        console.log(`${icon} ${result.name}`);
    });

    console.log('\n' + '-'.repeat(50));
    console.log(`\nTotal: ${results.length} tests`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ❌`);

    if (failed > 0) {
        console.log('\n❌ SOME TESTS FAILED');
        process.exit(1);
    } else {
        console.log('\n🌟 ALL CLI TESTS PASSED!');
        process.exit(0);
    }
}

runAllTests();
