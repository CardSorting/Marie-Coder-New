import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { ToolRegistry } from '../../src/infrastructure/tools/ToolRegistry.js';
import { registerMarieToolsCLI } from '../../src/cli/MarieToolDefinitionsCLI.js';
import { JoyAutomationServiceCLI } from '../../src/cli/services/JoyAutomationServiceCLI.js';
import { JoyServiceCLI } from '../../src/cli/services/JoyServiceCLI.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, '..', '..', '.marie-tools-test');

// Helper to setup test environment
function setupTestEnv() {
    // Clean up test directory
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

// Helper to create a fresh registry
function createRegistry() {
    const joyService = new JoyServiceCLI();
    const automationService = new JoyAutomationServiceCLI(joyService, TEST_DIR);
    const registry = new ToolRegistry();
    registerMarieToolsCLI(registry, automationService, TEST_DIR);
    return { registry, joyService, automationService };
}

async function testToolRegistrySetup() {
    console.log('🧪 Testing Tool Registry Setup...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();

        // Verify all expected tools are registered
        const expectedTools = [
            'write_file',
            'read_file',
            'list_dir',
            'grep_search',
            'delete_file',
            'get_git_context',
            'run_command',
            'get_folder_structure',
            'replace_in_file'
        ];

        for (const toolName of expectedTools) {
            const tool = registry.getTool(toolName);
            assert.ok(tool, `Tool ${toolName} should be registered`);
            assert.strictEqual(tool.name, toolName, `Tool name should match ${toolName}`);
        }

        console.log('✅ Tool Registry Setup Test Passed!');
    } finally {
        cleanup();
    }
}

async function testWriteFileTool() {
    console.log('🧪 Testing Write File Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const writeFileTool = registry.getTool('write_file');

        assert.ok(writeFileTool, 'write_file tool should exist');

        // Test writing a file
        const testContent = 'Hello, World!';
        const testFile = path.join(TEST_DIR, 'test.txt');

        const result = await writeFileTool.execute({
            path: testFile,
            content: testContent
        });

        // Verify file was created
        assert.ok(fs.existsSync(testFile), 'File should be created');
        const content = fs.readFileSync(testFile, 'utf-8');
        assert.strictEqual(content, testContent, 'File content should match');
        assert.ok(result.includes(testFile), 'Result should mention the file path');

        // Test writing with relative path
        const relativeFile = 'relative/test.txt';
        const relativeContent = 'Relative content';

        await writeFileTool.execute({
            path: relativeFile,
            content: relativeContent
        });

        const absolutePath = path.join(TEST_DIR, relativeFile);
        assert.ok(fs.existsSync(absolutePath), 'Relative path file should be created');

        console.log('✅ Write File Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testReadFileTool() {
    console.log('🧪 Testing Read File Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const readFileTool = registry.getTool('read_file');

        assert.ok(readFileTool, 'read_file tool should exist');

        // Create a test file
        const testFile = path.join(TEST_DIR, 'read_test.txt');
        const testContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        fs.mkdirSync(path.dirname(testFile), { recursive: true });
        fs.writeFileSync(testFile, testContent);

        // Test reading entire file
        const fullContent = await readFileTool.execute({ path: testFile });
        assert.strictEqual(fullContent, testContent, 'Should read entire file');

        // Test reading specific lines
        const partialContent = await readFileTool.execute({
            path: testFile,
            startLine: 2,
            endLine: 4
        });
        assert.strictEqual(partialContent, 'Line 2\nLine 3\nLine 4', 'Should read specific lines');

        console.log('✅ Read File Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testListDirTool() {
    console.log('🧪 Testing List Dir Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const listDirTool = registry.getTool('list_dir');

        assert.ok(listDirTool, 'list_dir tool should exist');

        // Create test directory structure
        fs.mkdirSync(path.join(TEST_DIR, 'subdir'), { recursive: true });
        fs.writeFileSync(path.join(TEST_DIR, 'file1.txt'), 'content');
        fs.writeFileSync(path.join(TEST_DIR, 'file2.txt'), 'content');

        // List directory
        const result = await listDirTool.execute({ path: TEST_DIR });

        assert.ok(result.includes('📁'), 'Result should include folder icon');
        assert.ok(result.includes('📄'), 'Result should include file icon');
        assert.ok(result.includes('subdir/'), 'Result should include subdirectory');
        assert.ok(result.includes('file1.txt'), 'Result should include files');

        // Test empty directory
        const emptyDir = path.join(TEST_DIR, 'empty');
        fs.mkdirSync(emptyDir);
        const emptyResult = await listDirTool.execute({ path: emptyDir });
        assert.ok(emptyResult.includes('empty') || emptyResult === '(empty directory)', 'Should handle empty directory');

        console.log('✅ List Dir Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testDeleteFileTool() {
    console.log('🧪 Testing Delete File Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const deleteFileTool = registry.getTool('delete_file');

        assert.ok(deleteFileTool, 'delete_file tool should exist');
        assert.strictEqual(deleteFileTool.isDestructive, true, 'delete_file should be marked as destructive');

        // Create a test file
        const testFile = path.join(TEST_DIR, 'to_delete.txt');
        fs.writeFileSync(testFile, 'delete me');
        assert.ok(fs.existsSync(testFile), 'Test file should exist before deletion');

        // Delete the file
        const result = await deleteFileTool.execute({ path: testFile });
        assert.ok(!fs.existsSync(testFile), 'File should be deleted');
        assert.ok(result.includes(testFile), 'Result should mention deleted file');

        console.log('✅ Delete File Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testReplaceInFileTool() {
    console.log('🧪 Testing Replace In File Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const replaceTool = registry.getTool('replace_in_file');

        assert.ok(replaceTool, 'replace_in_file tool should exist');
        assert.strictEqual(replaceTool.isDestructive, true, 'replace_in_file should be marked as destructive');

        // Create a test file
        const testFile = path.join(TEST_DIR, 'replace_test.txt');
        const originalContent = 'Hello World! Hello World!';
        fs.writeFileSync(testFile, originalContent);

        // Replace text
        const result = await replaceTool.execute({
            path: testFile,
            search: 'World',
            replace: 'Universe'
        });

        const newContent = fs.readFileSync(testFile, 'utf-8');
        assert.strictEqual(newContent, 'Hello Universe! Hello Universe!', 'Text should be replaced');
        assert.ok(result.includes('occurrence'), 'Result should mention occurrences');

        // Test replace non-existent text
        const errorResult = await replaceTool.execute({
            path: testFile,
            search: 'NonExistentText',
            replace: 'Something'
        });
        assert.ok(errorResult.includes('Error'), 'Should return error for non-existent text');

        console.log('✅ Replace In File Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testGetFolderStructureTool() {
    console.log('🧪 Testing Get Folder Structure Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const treeTool = registry.getTool('get_folder_structure');

        assert.ok(treeTool, 'get_folder_structure tool should exist');

        // Create test directory structure
        fs.mkdirSync(path.join(TEST_DIR, 'src', 'components'), { recursive: true });
        fs.mkdirSync(path.join(TEST_DIR, 'src', 'utils'), { recursive: true });
        fs.writeFileSync(path.join(TEST_DIR, 'src', 'index.ts'), '');
        fs.writeFileSync(path.join(TEST_DIR, 'src', 'components', 'App.tsx'), '');
        fs.writeFileSync(path.join(TEST_DIR, 'src', 'utils', 'helpers.ts'), '');

        // Get folder structure
        const result = await treeTool.execute({
            path: path.join(TEST_DIR, 'src'),
            depth: 3
        });

        assert.ok(result.includes('src/'), 'Result should include root directory');
        assert.ok(result.includes('components/'), 'Result should include subdirectories');
        assert.ok(result.includes('├──') || result.includes('└──'), 'Result should use tree characters');

        console.log('✅ Get Folder Structure Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testRunCommandTool() {
    console.log('🧪 Testing Run Command Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const runCommandTool = registry.getTool('run_command');

        assert.ok(runCommandTool, 'run_command tool should exist');
        assert.strictEqual(runCommandTool.isDestructive, true, 'run_command should be marked as destructive');

        // Test echo command
        const result = await runCommandTool.execute({
            command: 'echo "Hello from test"'
        });
        assert.ok(result.includes('Hello from test'), 'Should execute echo command');

        // Test pwd command (should return working directory)
        const pwdResult = await runCommandTool.execute({
            command: 'pwd'
        });
        assert.ok(pwdResult.includes(TEST_DIR) || pwdResult.includes(path.basename(TEST_DIR)), 'Should run in correct directory');

        // Test invalid command
        const errorResult = await runCommandTool.execute({
            command: 'invalid_command_12345'
        });
        assert.ok(errorResult.includes('Error'), 'Should return error for invalid command');

        console.log('✅ Run Command Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testGetGitContextTool() {
    console.log('🧪 Testing Get Git Context Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const gitContextTool = registry.getTool('get_git_context');

        assert.ok(gitContextTool, 'get_git_context tool should exist');

        // Initialize git repo
        const { execSync } = await import('child_process');
        execSync('git init', { cwd: TEST_DIR });

        // Test git context (may vary depending on git state)
        const result = await gitContextTool.execute({});

        assert.ok(result.includes('Git Context'), 'Result should include header');
        assert.ok(result.includes('Status'), 'Result should include status section');

        console.log('✅ Get Git Context Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function testGrepSearchTool() {
    console.log('🧪 Testing Grep Search Tool...');
    const cleanup = setupTestEnv();

    try {
        const { registry } = createRegistry();
        const grepTool = registry.getTool('grep_search');

        assert.ok(grepTool, 'grep_search tool should exist');

        // Create test files with searchable content
        fs.writeFileSync(path.join(TEST_DIR, 'file1.ts'), 'const foo = "bar";\nfunction test() {}');
        fs.writeFileSync(path.join(TEST_DIR, 'file2.ts'), 'const baz = "qux";\nfunction foo() {}');

        // Search for "foo"
        const result = await grepTool.execute({
            query: 'foo',
            path: TEST_DIR
        });

        assert.ok(result.includes('file1.ts') || result.includes('file2.ts'), 'Should find files containing query');

        // Search for non-existent pattern
        const noResult = await grepTool.execute({
            query: 'xyz123notfound',
            path: TEST_DIR
        });
        assert.ok(noResult.includes('No matches') || noResult === 'No matches found', 'Should handle no matches');

        console.log('✅ Grep Search Tool Test Passed!');
    } finally {
        cleanup();
    }
}

async function runAllTests() {
    try {
        await testToolRegistrySetup();
        await testWriteFileTool();
        await testReadFileTool();
        await testListDirTool();
        await testDeleteFileTool();
        await testReplaceInFileTool();
        await testGetFolderStructureTool();
        await testRunCommandTool();
        await testGetGitContextTool();
        await testGrepSearchTool();

        console.log('\n🌟 ALL TOOL DEFINITIONS TESTS PASSED!');
    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:');
        console.error(err);
        process.exit(1);
    }
}

runAllTests();
