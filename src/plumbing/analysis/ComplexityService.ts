import * as fs from 'fs/promises';

export interface ComplexityMetrics {
    cyclomaticComplexity: number;
    loc: number;
    clutterLevel: 'Clean' | 'Sparking' | 'Tangled' | 'Toxic';
    suggestions: string[];
}

/**
 * Quantifies "Clutter" and code quality to help Marie maintain a high-integrity Garden.
 */
export class ComplexityService {
    /**
     * Heuristically analyzes a file for complexity.
     */
    public static async analyze(filePath: string): Promise<ComplexityMetrics> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const loc = lines.length;

            // Simple heuristic for cyclomatic complexity: count control flow keywords
            const controlFlowMatch = content.match(/\b(if|else if|for|while|case|catch|&&|\|\||!=|==|!==|===)\b/g);
            const complexity = (controlFlowMatch?.length || 0) + 1;

            let clutterLevel: ComplexityMetrics['clutterLevel'] = 'Clean';
            const suggestions: string[] = [];

            if (complexity > 20 || loc > 300) {
                clutterLevel = 'Toxic';
                suggestions.push("This module is significantly cluttered. Consider decomposing into smaller 'Sprouts'.");
            } else if (complexity > 10 || loc > 150) {
                clutterLevel = 'Tangled';
                suggestions.push("The logic is starting to tangle. A refactor ('Bloom') is recommended.");
            } else if (complexity > 5) {
                clutterLevel = 'Sparking';
                suggestions.push("The code is healthy but keep an eye on control flow depth.");
            }

            return {
                cyclomaticComplexity: complexity,
                loc,
                clutterLevel,
                suggestions
            };
        } catch (error) {
            throw new Error(`Failed to analyze complexity for ${filePath}: ${error}`);
        }
    }
}
