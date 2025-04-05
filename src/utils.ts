import * as vscode from 'vscode';

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Helper function for ExtensionContext access
let globalExtensionContext: vscode.ExtensionContext;

export function setExtensionContext(context: vscode.ExtensionContext) {
    globalExtensionContext = context;
}

export function getExtensionContext(): vscode.ExtensionContext {
    if (!globalExtensionContext) {
        throw new Error('Extension context not initialized');
    }
    return globalExtensionContext;
}