# Marie CLI Tests

This directory contains comprehensive tests for the Marie CLI components.

## Test Structure

```
tests/cli/
├── README.md                   # This file
├── run_all_tests.ts            # Test runner that executes all CLI tests
├── test_storage.ts             # Tests for storage management
├── test_marie_cli.ts           # Tests for the main MarieCLI class
├── test_tool_definitions.ts    # Tests for CLI tool definitions
├── test_joy_services.ts        # Tests for Joy services
└── test_cli_standalone.ts      # Tests for standalone CLI
```

## Running Tests

### Run All CLI Tests
```bash
npm run test:cli
```

### Run Individual Test Suites
```bash
# Storage tests
npm run test:cli:storage

# MarieCLI tests
npm run test:cli:marie

# Tool definitions tests
npm run test:cli:tools

# Joy services tests
npm run test:cli:joy
```

### Run All Tests (including other test suites)
```bash
npm test
```

## Test Coverage

### Storage Tests (`test_storage.ts`)
- ✅ Configuration management (get/save config)
- ✅ Session management (get/save sessions)
- ✅ Session metadata management
- ✅ Current session ID tracking
- ✅ Telemetry management
- ✅ Corrupted data handling

### MarieCLI Tests (`test_marie_cli.ts`)
- ✅ CLI construction and initialization
- ✅ Session management (create, load, rename, pin, delete)
- ✅ Provider creation (Anthropic, OpenRouter, Cerebras)
- ✅ Tool approval handling
- ✅ Stop generation functionality
- ✅ Session title generation
- ✅ Dispose/cleanup

### Tool Definitions Tests (`test_tool_definitions.ts`)
- ✅ Tool registry setup
- ✅ Write file tool
- ✅ Read file tool
- ✅ List directory tool
- ✅ Delete file tool
- ✅ Replace in file tool
- ✅ Get folder structure tool
- ✅ Run command tool
- ✅ Get git context tool
- ✅ Grep search tool

### Joy Services Tests (`test_joy_services.ts`)
- ✅ JoyServiceCLI construction
- ✅ Achievement tracking
- ✅ Intention setting
- ✅ Project health retrieval
- ✅ Letting go requests
- ✅ Run progress emission
- ✅ JoyAutomationServiceCLI construction
- ✅ Current run management
- ✅ Genesis trigger (CLI mode)
- ✅ Joy feature sowing (CLI mode)
- ✅ Garden pulse (CLI mode)

### Standalone CLI Tests (`test_cli_standalone.ts`)
- ✅ Config loading with fallbacks
- ✅ Tool schema definitions
- ✅ Tool execution (read, write, list)
- ✅ Message history management
- ✅ Command parsing (/help, /clear, /exit)
- ✅ ANSI formatting codes
- ✅ Environment variable detection

## Writing New Tests

When adding new tests:

1. Create a new test file in `tests/cli/`
2. Use the existing test files as templates
3. Follow the naming convention: `test_<component>.ts`
4. Add the test file to `run_all_tests.ts`
5. Add a npm script to `package.json` if needed

### Test File Template

```typescript
import * as assert from 'assert';
import { ComponentToTest } from '../../src/cli/Component.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, '..', '..', '.marie-test-<component>');

// Helper to setup test environment
function setupTestEnv() {
    if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    return () => {
        if (fs.existsSync(TEST_DIR)) {
            fs.rmSync(TEST_DIR, { recursive: true, force: true });
        }
    };
}

async function testFeature() {
    console.log('🧪 Testing Feature...');
    const cleanup = setupTestEnv();

    try {
        // Test code here
        const result = await someFunction();
        assert.ok(result, 'Should return something');

        console.log('✅ Feature Test Passed!');
    } finally {
        cleanup();
    }
}

async function runAllTests() {
    try {
        await testFeature();
        console.log('\n🌟 ALL TESTS PASSED!');
    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:');
        console.error(err);
        process.exit(1);
    }
}

runAllTests();
```

## Test Environment

Tests use:
- **Node.js built-in `assert` module** for assertions
- **TypeScript** for type safety
- **Temporary directories** for file operations (`.marie-test-*`)
- **Mocks** for external dependencies (AI providers, OS functions)

## Continuous Integration

These tests can be run in CI environments:

```yaml
# Example GitHub Actions step
- name: Run CLI Tests
  run: npm run test:cli
```

## Notes

- Tests clean up after themselves by removing temporary directories
- Tests mock `os.homedir()` to avoid polluting the user's home directory
- Tests are designed to be independent and can run in any order
- Some tests require git to be installed (for git context tests)
