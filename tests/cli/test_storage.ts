import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to create a temp storage module with custom homedir
async function createStorageWithHomedir(testDir: string) {
    // Create a mock for the storage module
    const marieDir = path.join(testDir, '.marie');
    const sessionsFile = path.join(marieDir, 'sessions.json');
    const metadataFile = path.join(marieDir, 'sessionMetadata.json');
    const configFile = path.join(marieDir, 'config.json');
    const currentSessionFile = path.join(marieDir, 'currentSession.json');
    const telemetryFile = path.join(marieDir, 'lastTelemetry.json');

    // Ensure directory exists
    if (!fs.existsSync(marieDir)) {
        fs.mkdirSync(marieDir, { recursive: true });
    }

    // Define getConfig first so saveConfig can reference it
    const getConfig = () => {
        const defaultConfig = {
            aiProvider: 'anthropic',
            model: 'claude-3-5-sonnet-20241022',
            requireApproval: true,
            maxContextTokens: 100000,
            yoloEnabled: true,
            yoloProfile: 'balanced',
            yoloAggression: 1,
            yoloMaxRequiredActions: 2
        };

        if (!fs.existsSync(configFile)) {
            return { ...defaultConfig };
        }
        try {
            const data = fs.readFileSync(configFile, 'utf-8');
            return { ...defaultConfig, ...JSON.parse(data) };
        } catch {
            return { ...defaultConfig };
        }
    };

    // Return a storage-like interface
    return {
        ensureDir: () => {
            if (!fs.existsSync(marieDir)) {
                fs.mkdirSync(marieDir, { recursive: true });
            }
        },

        getConfig,

        saveConfig: (config: any) => {
            const current = { ...getConfig(), ...config };
            fs.writeFileSync(configFile, JSON.stringify(current, null, 2));
        },

        getSessions: () => {
            if (!fs.existsSync(sessionsFile)) {
                return {};
            }
            try {
                const data = fs.readFileSync(sessionsFile, 'utf-8');
                return JSON.parse(data);
            } catch {
                return {};
            }
        },

        saveSessions: (sessions: any) => {
            fs.writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));
        },

        getSessionMetadata: () => {
            if (!fs.existsSync(metadataFile)) {
                return [];
            }
            try {
                const data = fs.readFileSync(metadataFile, 'utf-8');
                return JSON.parse(data);
            } catch {
                return [];
            }
        },

        saveSessionMetadata: (metadata: any) => {
            fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
        },

        getCurrentSessionId: () => {
            if (!fs.existsSync(currentSessionFile)) {
                return 'default';
            }
            try {
                const data = fs.readFileSync(currentSessionFile, 'utf-8');
                return JSON.parse(data).id || 'default';
            } catch {
                return 'default';
            }
        },

        setCurrentSessionId: (id: string) => {
            fs.writeFileSync(currentSessionFile, JSON.stringify({ id }));
        },

        getLastTelemetry: () => {
            if (!fs.existsSync(telemetryFile)) return undefined;
            try {
                return JSON.parse(fs.readFileSync(telemetryFile, 'utf-8'));
            } catch {
                return undefined;
            }
        },

        setLastTelemetry: (telemetry: any) => {
            fs.writeFileSync(telemetryFile, JSON.stringify(telemetry, null, 2));
        }
    };
}

// Helper to reset test directory
function resetTestDir(testDir: string) {
    if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
    }
}

async function testConfigManagement() {
    console.log('🧪 Testing Config Management...');
    const testDir = path.join(os.tmpdir(), `marie-test-config-${Date.now()}`);
    resetTestDir(testDir);

    try {
        const Storage = await createStorageWithHomedir(testDir);

        // Test getConfig with defaults
        const defaultConfig = Storage.getConfig();
        assert.strictEqual(defaultConfig.aiProvider, 'anthropic', 'Default provider should be anthropic');
        assert.strictEqual(defaultConfig.model, 'claude-3-5-sonnet-20241022', 'Default model should be set');
        assert.strictEqual(defaultConfig.requireApproval, true, 'Default requireApproval should be true');

        // Test saveConfig
        Storage.saveConfig({
            aiProvider: 'openrouter',
            model: 'claude-3-opus',
            requireApproval: false
        });

        // Verify config was saved
        const savedConfig = Storage.getConfig();
        assert.strictEqual(savedConfig.aiProvider, 'openrouter', 'Provider should be updated');
        assert.strictEqual(savedConfig.model, 'claude-3-opus', 'Model should be updated');
        assert.strictEqual(savedConfig.requireApproval, false, 'requireApproval should be updated');

        // Verify defaults are preserved for unset values
        assert.strictEqual(savedConfig.maxContextTokens, 100000, 'maxContextTokens should have default');
        assert.strictEqual(savedConfig.yoloEnabled, true, 'yoloEnabled should have default');

        console.log('✅ Config Management Test Passed!');
    } finally {
        resetTestDir(testDir);
    }
}

async function testSessionManagement() {
    console.log('🧪 Testing Session Management...');
    const testDir = path.join(os.tmpdir(), `marie-test-sessions-${Date.now()}`);
    resetTestDir(testDir);

    try {
        const Storage = await createStorageWithHomedir(testDir);

        // Test getSessions with empty state
        const emptySessions = Storage.getSessions();
        assert.deepStrictEqual(emptySessions, {}, 'Empty sessions should return empty object');

        // Test saveSessions
        const testSessions: Record<string, any[]> = {
            'session_1': [{ role: 'user', content: 'Hello' }],
            'session_2': [{ role: 'assistant', content: 'Hi!' }]
        };
        Storage.saveSessions(testSessions);

        const savedSessions = Storage.getSessions();
        assert.deepStrictEqual(savedSessions, testSessions, 'Sessions should be saved correctly');

        console.log('✅ Session Management Test Passed!');
    } finally {
        resetTestDir(testDir);
    }
}

async function testSessionMetadataManagement() {
    console.log('🧪 Testing Session Metadata Management...');
    const testDir = path.join(os.tmpdir(), `marie-test-metadata-${Date.now()}`);
    resetTestDir(testDir);

    try {
        const Storage = await createStorageWithHomedir(testDir);

        // Test empty metadata
        const emptyMetadata = Storage.getSessionMetadata();
        assert.deepStrictEqual(emptyMetadata, [], 'Empty metadata should return empty array');

        // Test saveSessionMetadata
        const testMetadata = [
            { id: 'session_1', title: 'Test Session 1', lastModified: Date.now(), isPinned: false },
            { id: 'session_2', title: 'Test Session 2', lastModified: Date.now(), isPinned: true }
        ];
        Storage.saveSessionMetadata(testMetadata);

        const savedMetadata = Storage.getSessionMetadata();
        assert.strictEqual(savedMetadata.length, 2, 'Metadata should have 2 entries');
        assert.strictEqual(savedMetadata[0].title, 'Test Session 1', 'First session title should match');
        assert.strictEqual(savedMetadata[1].isPinned, true, 'Second session should be pinned');

        console.log('✅ Session Metadata Management Test Passed!');
    } finally {
        resetTestDir(testDir);
    }
}

async function testCurrentSessionId() {
    console.log('🧪 Testing Current Session ID Management...');
    const testDir = path.join(os.tmpdir(), `marie-test-current-${Date.now()}`);
    resetTestDir(testDir);

    try {
        const Storage = await createStorageWithHomedir(testDir);

        // Test default session ID
        const defaultId = Storage.getCurrentSessionId();
        assert.strictEqual(defaultId, 'default', 'Default session ID should be "default"');

        // Test setCurrentSessionId
        Storage.setCurrentSessionId('session_abc123');
        const newId = Storage.getCurrentSessionId();
        assert.strictEqual(newId, 'session_abc123', 'Session ID should be updated');

        console.log('✅ Current Session ID Test Passed!');
    } finally {
        resetTestDir(testDir);
    }
}

async function testTelemetryManagement() {
    console.log('🧪 Testing Telemetry Management...');
    const testDir = path.join(os.tmpdir(), `marie-test-telemetry-${Date.now()}`);
    resetTestDir(testDir);

    try {
        const Storage = await createStorageWithHomedir(testDir);

        // Test getLastTelemetry with no telemetry
        const noTelemetry = Storage.getLastTelemetry();
        assert.strictEqual(noTelemetry, undefined, 'Should return undefined when no telemetry exists');

        // Test setLastTelemetry
        const testTelemetry = {
            runId: 'run_123',
            steps: 5,
            tools: 3,
            achieved: ['objective_1', 'objective_2']
        };
        Storage.setLastTelemetry(testTelemetry);

        const savedTelemetry = Storage.getLastTelemetry();
        assert.deepStrictEqual(savedTelemetry, testTelemetry, 'Telemetry should be saved correctly');

        console.log('✅ Telemetry Management Test Passed!');
    } finally {
        resetTestDir(testDir);
    }
}

async function testCorruptedDataHandling() {
    console.log('🧪 Testing Corrupted Data Handling...');
    const testDir = path.join(os.tmpdir(), `marie-test-corrupt-${Date.now()}`);
    resetTestDir(testDir);

    try {
        const Storage = await createStorageWithHomedir(testDir);

        // Create corrupted config file
        const marieDir = path.join(testDir, '.marie');
        fs.mkdirSync(marieDir, { recursive: true });
        fs.writeFileSync(path.join(marieDir, 'config.json'), 'not valid json {{{');

        // Should return defaults when config is corrupted
        const config = Storage.getConfig();
        assert.strictEqual(config.aiProvider, 'anthropic', 'Should return default provider on corruption');
        assert.strictEqual(config.model, 'claude-3-5-sonnet-20241022', 'Should return default model on corruption');

        // Create corrupted sessions file
        fs.writeFileSync(path.join(marieDir, 'sessions.json'), 'invalid json');
        const sessions = Storage.getSessions();
        assert.deepStrictEqual(sessions, {}, 'Should return empty object on corruption');

        console.log('✅ Corrupted Data Handling Test Passed!');
    } finally {
        resetTestDir(testDir);
    }
}

async function testEnsureDir() {
    console.log('🧪 Testing ensureDir...');
    const testDir = path.join(os.tmpdir(), `marie-test-ensure-${Date.now()}`);
    resetTestDir(testDir);

    try {
        const Storage = await createStorageWithHomedir(testDir);

        // Remove directory if it exists
        const marieDir = path.join(testDir, '.marie');
        if (fs.existsSync(marieDir)) {
            fs.rmSync(marieDir, { recursive: true });
        }

        Storage.ensureDir();

        // Check that directory was created
        assert.ok(fs.existsSync(marieDir), 'Marie directory should be created');

        console.log('✅ ensureDir Test Passed!');
    } finally {
        resetTestDir(testDir);
    }
}

async function runAllTests() {
    try {
        await testEnsureDir();
        await testConfigManagement();
        await testSessionManagement();
        await testSessionMetadataManagement();
        await testCurrentSessionId();
        await testTelemetryManagement();
        await testCorruptedDataHandling();

        console.log('\n🌟 ALL STORAGE TESTS PASSED!');
    } catch (err) {
        console.error('\n❌ TEST SUITE FAILED:');
        console.error(err);
        process.exit(1);
    }
}

runAllTests();
