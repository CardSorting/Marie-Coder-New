import * as vscode from 'vscode';

export class SymbolService {
    /**
     * Finds the definition(s) of a symbol at the specified position in a document.
     */
    public static async getDefinitions(uri: vscode.Uri, position: vscode.Position): Promise<string> {
        const definitions = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
            'vscode.executeDefinitionProvider',
            uri,
            position
        );

        if (!definitions || definitions.length === 0) {
            return "No definitions found.";
        }

        let result = `Found ${definitions.length} definition(s):\n`;
        for (const def of definitions) {
            const range = 'range' in def ? def.range : def.targetRange;
            const targetUri = 'uri' in def ? def.uri : def.targetUri;
            result += `- ${targetUri.fsPath} [L${range.start.line + 1}:C${range.start.character + 1}]\n`;
        }

        return result;
    }

    /**
     * Finds the type definition of a symbol at the specified position.
     */
    public static async getTypeDefinitions(uri: vscode.Uri, position: vscode.Position): Promise<string> {
        const typeDefs = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
            'vscode.executeTypeDefinitionProvider',
            uri,
            position
        );

        if (!typeDefs || typeDefs.length === 0) {
            return "No type definitions found.";
        }

        let result = `Found ${typeDefs.length} type definition(s):\n`;
        for (const def of typeDefs) {
            const range = 'range' in def ? def.range : def.targetRange;
            const targetUri = 'uri' in def ? def.uri : def.targetUri;
            result += `- ${targetUri.fsPath} [L${range.start.line + 1}:C${range.start.character + 1}]\n`;
        }

        return result;
    }
}
