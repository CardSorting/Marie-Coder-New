import { withRetry, RetryConfig } from "./monolith/plumbing/utils/RetryUtils.js";

console.log("Starting RetryUtils Tests...\n");

// Helper to simulate async operations
async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Test Suite 1: Successful Execution
async function testSuccessfulExecution() {
    console.log("Suite 1: Successful Execution");

    // Test 1: No retry needed
    let callCount = 0;
    const config = new RetryConfig();

    try {
        const result = await withRetry(
            async () => {
                callCount++;
                return "success";
            },
            config,
            "Test1"
        );
        console.log(`Test: No retry needed - ${result === "success" && callCount === 1 ? 'PASS' : 'FAIL'}`);
    } catch (e) {
        console.log(`Test: No retry needed - FAIL (threw error)`);
    }
}

// Test Suite 2: Retryable Errors
async function testRetryableErrors() {
    console.log("\nSuite 2: Retryable Errors");

    // Test 1: Success on 2nd attempt
    let attempt1 = 0;
    const config1 = new RetryConfig();

    try {
        const result = await withRetry(
            async () => {
                attempt1++;
                if (attempt1 === 1) {
                    throw new Error("ETIMEDOUT: Connection timeout");
                }
                return "success";
            },
            config1,
            "Test2.1"
        );
        console.log(`Test: Success on 2nd attempt - ${result === "success" && attempt1 === 2 ? 'PASS' : 'FAIL (attempts: ' + attempt1 + ')'}`);
    } catch (e) {
        console.log(`Test: Success on 2nd attempt - FAIL (threw error)`);
    }

    // Test 2: Success on 3rd attempt
    let attempt2 = 0;
    const config2 = new RetryConfig();

    try {
        const result = await withRetry(
            async () => {
                attempt2++;
                if (attempt2 < 3) {
                    throw new Error("Rate limit exceeded");
                }
                return "success";
            },
            config2,
            "Test2.2"
        );
        console.log(`Test: Success on 3rd attempt - ${result === "success" && attempt2 === 3 ? 'PASS' : 'FAIL (attempts: ' + attempt2 + ')'}`);
    } catch (e) {
        console.log(`Test: Success on 3rd attempt - FAIL (threw error)`);
    }
}

// Test Suite 3: Non-Retryable Errors
async function testNonRetryableErrors() {
    console.log("\nSuite 3: Non-Retryable Errors");

    // Test 1: Validation error (immediate failure)
    let attempt1 = 0;
    const config1 = new RetryConfig();

    try {
        await withRetry(
            async () => {
                attempt1++;
                throw new Error("Invalid input: missing required field");
            },
            config1,
            "Test3.1"
        );
        console.log(`Test: Non-retryable error - FAIL (should have thrown)`);
    } catch (e: any) {
        console.log(`Test: Non-retryable error - ${attempt1 === 1 ? 'PASS' : 'FAIL (attempts: ' + attempt1 + ')'}`);
    }

    // Test 2: Permission error
    let attempt2 = 0;
    const config2 = new RetryConfig();

    try {
        await withRetry(
            async () => {
                attempt2++;
                throw new Error("Permission denied");
            },
            config2,
            "Test3.2"
        );
        console.log(`Test: Permission error - FAIL (should have thrown)`);
    } catch (e: any) {
        console.log(`Test: Permission error - ${attempt2 === 1 ? 'PASS' : 'FAIL (attempts: ' + attempt2 + ')'}`);
    }
}

// Test Suite 4: Exhausted Retries
async function testExhaustedRetries() {
    console.log("\nSuite 4: Exhausted Retries");

    // Test 1: Max retries exceeded
    let attempt = 0;
    const config = new RetryConfig();
    config.maxRetries = 3;

    try {
        await withRetry(
            async () => {
                attempt++;
                throw new Error("ETIMEDOUT: persistent timeout");
            },
            config,
            "Test4.1"
        );
        console.log(`Test: Max retries - FAIL (should have thrown)`);
    } catch (e: any) {
        // Should attempt 1 initial + 3 retries = 4 total
        console.log(`Test: Max retries - ${attempt === 4 ? 'PASS' : 'FAIL (attempts: ' + attempt + ', expected 4)'}`);
    }
}

// Test Suite 5: Exponential Backoff
async function testExponentialBackoff() {
    console.log("\nSuite 5: Exponential Backoff");

    const config = new RetryConfig();
    config.baseDelayMs = 100;
    config.maxDelayMs = 5000;

    // Test 1: First retry delay
    const delay1 = config.getBackoffDelay(0);
    console.log(`Test: First retry delay - ${delay1 >= 100 && delay1 <= 200 ? 'PASS' : 'FAIL (got ' + delay1 + 'ms)'}`);

    // Test 2: Second retry delay
    const delay2 = config.getBackoffDelay(1);
    console.log(`Test: Second retry delay - ${delay2 >= 200 && delay2 <= 350 ? 'PASS' : 'FAIL (got ' + delay2 + 'ms)'}`);

    // Test 3: Max delay cap
    const delay10 = config.getBackoffDelay(10);
    console.log(`Test: Max delay cap - ${delay10 <= 5000 ? 'PASS' : 'FAIL (got ' + delay10 + 'ms)'}`);

    // Test 4: Actual timing (2 retries)
    let attempt = 0;
    const startTime = Date.now();

    try {
        await withRetry(
            async () => {
                attempt++;
                if (attempt < 3) {
                    throw new Error("TIMEOUT: retry me");
                }
                return "success";
            },
            config,
            "Test5.4"
        );
        const duration = Date.now() - startTime;
        // Should take ~100ms + ~200ms = ~300ms (with some variance for jitter)
        console.log(`Test: Actual timing - ${duration >= 250 && duration <= 600 ? 'PASS' : 'FAIL (took ' + duration + 'ms)'}`);
    } catch (e) {
        console.log(`Test: Actual timing - FAIL (threw error)`);
    }
}

// Test Suite 6: Error Detection
function testErrorDetection() {
    console.log("\nSuite 6: Error Detection");

    const config = new RetryConfig();

    // Test retryable errors
    console.log(`Test: ETIMEDOUT - ${config.isRetryable("ETIMEDOUT: connection timeout") ? 'PASS' : 'FAIL'}`);
    console.log(`Test: ECONNRESET - ${config.isRetryable("Error: ECONNRESET") ? 'PASS' : 'FAIL'}`);
    console.log(`Test: Rate limit - ${config.isRetryable("Rate limit exceeded") ? 'PASS' : 'FAIL'}`);
    console.log(`Test: Throttle - ${config.isRetryable("Request throttled") ? 'PASS' : 'FAIL'}`);

    // Test non-retryable errors
    console.log(`Test: Invalid input - ${!config.isRetryable("Invalid input") ? 'PASS' : 'FAIL'}`);
    console.log(`Test: Permission - ${!config.isRetryable("Permission denied") ? 'PASS' : 'FAIL'}`);
}

// Run all tests
async function runAllTests() {
    await testSuccessfulExecution();
    await testRetryableErrors();
    await testNonRetryableErrors();
    await testExhaustedRetries();
    await testExponentialBackoff();
    testErrorDetection();

    console.log("\nAll RetryUtils tests completed!");
}

runAllTests().catch(err => {
    console.error("Test error:", err);
});
