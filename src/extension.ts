import * as vscode from 'vscode';
import * as path from 'path';
import { DevexySidebarProvider } from './sidebar/devexySidebar';
import { setExtensionContext } from './utils';
import { isLoggedIn, logout } from './auth';
import { applyGeneratedTests, GeneratedTest } from './testGeneration';
import { generateStressTests } from './stressTestGeneration';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "devexy" is now active!');
    
    // Store the extension context globally
    setExtensionContext(context);
    
    // Create output channel for logging
    const outputChannel = vscode.window.createOutputChannel('DevExy');
    context.subscriptions.push(outputChannel);
    
    // Register the sidebar provider
    const sidebarProvider = new DevexySidebarProvider(context.extensionUri, outputChannel);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(DevexySidebarProvider.viewType, sidebarProvider)
    );
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('devexy.showSidebar', () => {
            vscode.commands.executeCommand('workbench.view.extension.devexy-sidebar-view');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('devexy.logout', async () => {
            try {
                await logout(context);
                vscode.window.showInformationMessage('Successfully logged out from DevExy');
            } catch (error) {
                vscode.window.showErrorMessage(`Error during logout: ${error instanceof Error ? error.message : String(error)}`);
            }
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('devexy.applyTests', async (tests: GeneratedTest[]) => {
            try {
                const result = await applyGeneratedTests(tests);
                
                if (result.success.length > 0) {
                    outputChannel.appendLine(`Successfully created ${result.success.length} test files:`);
                    result.success.forEach(file => outputChannel.appendLine(`  • ${file}`));
                    outputChannel.show();
                    
                    vscode.window.showInformationMessage(`Successfully created ${result.success.length} test files`);
                    
                    // If we have at least one successful file, ask to open it
                    if (result.success.length > 0) {
                        const openFile = await vscode.window.showInformationMessage(
                            'Do you want to open the generated test files?',
                            'Yes', 'No'
                        );
                        
                        if (openFile === 'Yes') {
                            // Open up to 5 test files
                            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                            if (workspaceFolder) {
                                for (let i = 0; i < Math.min(5, result.success.length); i++) {
                                    const fileUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, result.success[i]));
                                    try {
                                        const doc = await vscode.workspace.openTextDocument(fileUri);
                                        await vscode.window.showTextDocument(doc, { preview: false });
                                    } catch (err) {
                                        console.error(`Error opening file ${fileUri.fsPath}:`, err);
                                    }
                                }
                            }
                        }
                    }
                }
                
                if (result.errors.length > 0) {
                    outputChannel.appendLine(`Failed to create ${result.errors.length} test files:`);
                    result.errors.forEach(file => outputChannel.appendLine(`  • ${file}`));
                    outputChannel.show();
                    
                    vscode.window.showWarningMessage(`Failed to create ${result.errors.length} test files. Check the output for details.`);
                }
                
            } catch (error) {
                vscode.window.showErrorMessage(`Error applying tests: ${error instanceof Error ? error.message : String(error)}`);
            }
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('devexy.previewTest', async (test: GeneratedTest) => {
            try {
                // Create a temporary untitled document with the test content
                const document = await vscode.workspace.openTextDocument({
                    content: test.content,
                    language: getLanguageFromPath(test.filepath)
                });
                await vscode.window.showTextDocument(document);
            } catch (error) {
                vscode.window.showErrorMessage(`Error previewing test: ${error instanceof Error ? error.message : String(error)}`);
            }
        })
    );
    
    // Also keep existing commands for backward compatibility
    registerLegacyCommands(context);
    
    // Log activation
    outputChannel.appendLine(`DevExy extension activated at ${new Date().toLocaleString()}`);
}

// Register the original commands for backward compatibility
function registerLegacyCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('devexy.helloWorld', () => {
            vscode.window.showInformationMessage('Hello World from DevExy!');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('devexy.login', async () => {
            vscode.commands.executeCommand('workbench.view.extension.devexy-sidebar-view');
        })
    );
    
    context.subscriptions.push(
        vscode.commands.registerCommand('devexy.generateTests', async () => {
            // First check if user is logged in
            const loggedIn = await isLoggedIn(context);
            
            if (loggedIn) {
                vscode.commands.executeCommand('workbench.view.extension.devexy-sidebar-view');
            } else {
                const loginFirst = await vscode.window.showInformationMessage(
                    'You need to log in before generating tests',
                    'Log In Now', 'Cancel'
                );
                
                if (loginFirst === 'Log In Now') {
                    vscode.commands.executeCommand('workbench.view.extension.devexy-sidebar-view');
                }
            }
        })
    );
}

function getLanguageFromPath(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    
    switch (extension) {
        case '.js':
            return 'javascript';
        case '.ts':
            return 'typescript';
        case '.jsx':
            return 'javascriptreact';
        case '.tsx':
            return 'typescriptreact';
        case '.py':
            return 'python';
        case '.java':
            return 'java';
        case '.cs':
            return 'csharp';
        case '.go':
            return 'go';
        case '.rb':
            return 'ruby';
        case '.php':
            return 'php';
        case '.rs':
            return 'rust';
        case '.swift':
            return 'swift';
        case '.kt':
        case '.kts':
            return 'kotlin';
        default:
            return 'plaintext';
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
