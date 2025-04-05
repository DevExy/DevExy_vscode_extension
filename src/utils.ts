export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Helper function for ExtensionContext access
import * as vscode from 'vscode';
let globalExtensionContext: vscode.ExtensionContext;

export function setExtensionContext(context: vscode.ExtensionContext) {
    globalExtensionContext = context;
}

declare module 'vscode' {
    // Add a static method to the ExtensionContext class
    export namespace ExtensionContext {
        export function getExtensionContext(): vscode.ExtensionContext;
    }
}

// Add the static method implementation
vscode.ExtensionContext.getExtensionContext = () => {
    if (!globalExtensionContext) {
        throw new Error('Extension context not initialized');
    }
    return globalExtensionContext;
};