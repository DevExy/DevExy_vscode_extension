import * as vscode from 'vscode';
import * as path from 'path';
import { getAuthToken } from '../auth';
import { generateTests } from '../testGeneration';
import { getNonce } from '../utils';

export class DevexySidebarProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'devexy.sidebar';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _channel: vscode.OutputChannel;
    
    constructor(extensionUri: vscode.Uri, channel: vscode.OutputChannel) {
        this._extensionUri = extensionUri;
        this._channel = channel;
    }
    
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            // Enable JavaScript in the webview
            enableScripts: true,
            // Restrict the webview to only loading content from specific directories
            localResourceRoots: [
                this._extensionUri
            ]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'login':
                    this._log('User initiated login');
                    await this._login(message.username, message.password);
                    return;
                
                case 'generateTests':
                    this._log('User initiated test generation');
                    await this._generateTests(message.testDir);
                    return;
                    
                case 'checkLoginStatus':
                    await this._checkLoginStatus();
                    return;
                
                case 'logOutput':
                    this._log(message.text);
                    return;
            }
        });
        
        // Check login status when sidebar loads
        this._checkLoginStatus();
    }
    
    private async _login(username: string, password: string) {
        try {
            // Update UI to loading state
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'loading',
                action: 'login',
                message: 'Logging in...' 
            });
            
            // Attempt to log in
            const context = vscode.ExtensionContext.getExtensionContext();
            
            // Get login credentials
            if (!username) {
                throw new Error('Username is required');
            }
            
            if (!password) {
                throw new Error('Password is required');
            }
            
            try {
                // Import required module inside the function to avoid circular dependencies
                const { login } = require('../auth');
                
                // Login with credentials
                await login(context, username, password);
                
                // Update UI to success state
                this._view?.webview.postMessage({ 
                    command: 'updateStatus',
                    status: 'success',
                    action: 'login',
                    message: 'Successfully logged in' 
                });
                
                this._log('Login successful');
            } catch (error: any) {
                this._log(`Login error: ${error.message || 'Unknown error'}`);
                
                // Update UI to error state
                this._view?.webview.postMessage({ 
                    command: 'updateStatus',
                    status: 'error',
                    action: 'login',
                    message: `Login failed: ${error.response?.data?.detail || error.message || 'Unknown error'}`
                });
                
                throw error;
            }
        } catch (error: any) {
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'error',
                action: 'login',
                message: `Login failed: ${error.message || 'Unknown error'}`
            });
        }
    }
    
    private async _generateTests(testDir?: string) {
        try {
            // Update UI to loading state
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'loading',
                action: 'generateTests',
                message: 'Preparing test generation...' 
            });
            
            // Get context for token
            const context = vscode.ExtensionContext.getExtensionContext();
            
            // Get files to process
            const files = await this._getFilesToProcess();
            
            if (files.length === 0) {
                this._view?.webview.postMessage({ 
                    command: 'updateStatus',
                    status: 'error',
                    action: 'generateTests',
                    message: 'No files selected for test generation'
                });
                return;
            }
            
            // Update message
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'loading',
                action: 'generateTests',
                message: `Generating tests for ${files.length} file(s)...` 
            });
            
            const testDirDefault = testDir || 'tests';
            
            // Run test generation
            const results = await generateTests(context, files, testDirDefault, (progress: string) => {
                // Pass progress updates to the webview
                this._view?.webview.postMessage({ 
                    command: 'updateProgress',
                    action: 'generateTests',
                    message: progress
                });
                
                this._log(progress);
            });
            
            // Update UI to success state
            this._view?.webview.postMessage({ 
                command: 'updateTestResults',
                status: 'success',
                tests: results
            });
            
            this._log(`Generated ${results.length} test file(s)`);
            
        } catch (error: any) {
            this._log(`Test generation error: ${error.message || 'Unknown error'}`);
            
            // Update UI to error state
            this._view?.webview.postMessage({ 
                command: 'updateStatus',
                status: 'error',
                action: 'generateTests',
                message: `Test generation failed: ${error.message || 'Unknown error'}`
            });
        }
    }
    
    private async _checkLoginStatus() {
        try {
            const context = vscode.ExtensionContext.getExtensionContext();
            // Import isLoggedIn to avoid circular dependencies
            const { isLoggedIn } = require('../auth');
            const loggedIn = await isLoggedIn(context);
            
            this._view?.webview.postMessage({ 
                command: 'loginStatus',
                isLoggedIn: loggedIn
            });
        } catch (error) {
            this._log('Error checking login status');
            this._view?.webview.postMessage({ 
                command: 'loginStatus',
                isLoggedIn: false
            });
        }
    }
    
    private async _getFilesToProcess(): Promise<vscode.Uri[]> {
        // Check if there are files selected in the explorer
        const selectedFiles = this._getSelectedFilesFromExplorer();
        
        if (selectedFiles && selectedFiles.length > 0) {
            return selectedFiles;
        }
    
        // If no files are selected, show file picker
        const files = await vscode.window.showOpenDialog({
            canSelectMany: true,
            openLabel: 'Select Files for Test Generation',
            filters: {
                'All Files': ['*']
            }
        });
    
        return files || [];
    }
    
    private _getSelectedFilesFromExplorer(): vscode.Uri[] | undefined {
        if (vscode.window.activeTextEditor) {
            return [vscode.window.activeTextEditor.document.uri];
        }
        return undefined;
    }
    
    private _log(message: string) {
        this._channel.appendLine(`[${new Date().toLocaleTimeString()}] ${message}`);
    }
    
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script run in the webview, then convert to webview URI
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.js'));
        
        // Same for CSS file
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'sidebar.css'));
        
        // Get logo
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'logo.png'));
        
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
            <link href="${styleMainUri}" rel="stylesheet">
            <title>DevExy</title>
        </head>
        <body>
            <header>
                <div class="logo-container">
                    <img src="${logoUri}" alt="DevExy Logo" class="logo">
                    <h1>DevExy</h1>
                </div>
            </header>
            
            <section id="status-section">
                <div id="login-status">
                    <span class="status-indicator offline"></span>
                    <span class="status-text">Not logged in</span>
                </div>
            </section>
            
            <section id="login-section" class="panel">
                <h2>Login</h2>
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" placeholder="Enter your username">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="Enter your password">
                </div>
                <div id="login-status-message" class="status-message"></div>
                <button id="login-button" class="primary-button">Login</button>
            </section>
            
            <section id="generate-tests-section" class="panel">
                <h2>Generate Tests</h2>
                <p class="info-text">Generate unit tests for selected files or the current file.</p>
                <div class="form-group">
                    <label for="test-directory">Test Directory</label>
                    <input type="text" id="test-directory" value="tests" placeholder="tests">
                </div>
                <div id="test-status-message" class="status-message"></div>
                <button id="generate-button" class="primary-button">Generate Tests</button>
            </section>
            
            <section id="test-results-section" class="panel hidden">
                <h2>Test Results</h2>
                <div id="test-results-list"></div>
                <div class="button-group">
                    <button id="apply-button" class="primary-button">Apply Tests</button>
                    <button id="cancel-button" class="secondary-button">Cancel</button>
                </div>
            </section>
            
            <footer>
                <div class="version">v0.0.1</div>
            </footer>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}